import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Company from '../models/Company.model';
import Student from '../models/Student.model';
import logger from '../utils/logger';
import { z } from 'zod';
import { sendEmail, emailTemplates, isEmailConfigured, getPrimaryAppUrl } from '../utils/mail.service';
import { sendWhatsAppMessage } from '../utils/whatsapp.service';
import AuditLog from '../models/AuditLog.model';
import { normalizeCompanySector } from '../utils/sector.util';
import { normalizeStateName } from '../utils/nigeria-states.util';
import { getDefaultTenantId } from '../utils/tenant.util';

const companyQuerySchema = z.object({
  state: z.string().optional(),
  sector: z.string().optional(),
  specialisation: z.string().optional(),
  search: z.string().optional(),
  isApproved: z.preprocess((val) => val === 'true', z.boolean()).optional(),
});

const companyBodySchema = z.object({
  name: z.preprocess((val) => String(val || '').trim(), z.string().min(1, 'Organisation name is required').max(150)),
  address: z.preprocess((val) => String(val || '').trim(), z.string().min(1, 'Address is required').max(300)),
  state: z.preprocess((val) => normalizeStateName(String(val || '')), z.string().min(1)),
  lga: z.preprocess((val) => String(val || '').trim(), z.string().optional().or(z.literal(''))),
  sector: z.preprocess(
    (val) => normalizeCompanySector(String(val || 'General IT')),
    z.enum(['AI', 'CS', 'MIS', 'Cybersecurity', 'Data Science', 'General IT'])
  ),
  specialisation: z.preprocess((val) => String(val || '').trim(), z.string().optional().or(z.literal(''))),
  contactPerson: z.preprocess((val) => String(val || '').trim(), z.string().optional().or(z.literal(''))),
  contactEmail: z.preprocess(
    (val) => String(val || '').trim().toLowerCase(),
    z.string().email().optional().or(z.literal(''))
  ),
  contactPhone: z.preprocess((val) => String(val || '').trim(), z.string().optional().or(z.literal(''))),
  website: z.preprocess((val) => String(val || '').trim(), z.string().optional().or(z.literal(''))),
  lat: z.preprocess((val) => (val !== undefined && val !== '' && !isNaN(Number(val)) ? Number(val) : undefined), z.number().optional()),
  lng: z.preprocess((val) => (val !== undefined && val !== '' && !isNaN(Number(val)) ? Number(val) : undefined), z.number().optional()),
  maxStudents: z.preprocess((val) => {
    const num = Number(val);
    return isNaN(num) || num < 1 ? 5 : num;
  }, z.number().min(1).optional().default(5)),
});

const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
});

export async function getAllCompanies(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { state, sector, specialisation, search, isApproved } = companyQuerySchema.parse(req.query);
    const userTenant = req.user?.tenant || (await getDefaultTenantId().catch(() => undefined));
    
    let query: any = { isDeleted: { $ne: true } };
    if (userTenant) {
      query.tenant = userTenant;
    }

    if (state) query.state = normalizeStateName(state);
    if (sector) query.sector = sector;
    if (specialisation) query.specialisation = specialisation;
    if (isApproved !== undefined) query.isApproved = isApproved;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { specialisation: { $regex: search, $options: 'i' } },
        { sector: { $regex: search, $options: 'i' } }
      ];
    }

    const companies = await Company.find(query).sort({ name: 1 });
    
    const companiesWithCount = await Promise.all(
      companies.map(async (c) => {
        const studentCount = await Student.countDocuments({
          company: c._id,
          ...(userTenant ? { tenant: userTenant } : {}),
          isDeleted: { $ne: true },
        });
        return { ...c.toObject(), studentCount };
      })
    );

    res.json({ companies: companiesWithCount });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in getAllCompanies: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createCompany(req: AuthRequest, res: Response): Promise<void> {
  try {
    const data = companyBodySchema.parse(req.body);
    let userTenant = req.user?.tenant;
    if (!userTenant) {
      userTenant = await getDefaultTenantId();
    }

    const website = data.website?.trim() ? String(data.website).trim() : undefined;
    const normalizedWebsite = website && !/^https?:\/\//i.test(website) ? `https://${website}` : website;
    const company = new Company({ ...data, website: normalizedWebsite, tenant: userTenant });
    await company.save();
    
    // Audit
    await AuditLog.create({
      tenant: userTenant,
      user: req.user!.id as any,
      action: 'CREATE_COMPANY',
      module: 'COMPANY_MANAGEMENT',
      targetId: company._id,
      details: `Registered partner company: ${company.name}`,
      ipAddress: req.ip,
    }).catch(() => {});

    // Auto-send onboarding to partner contact (email + WhatsApp if provided)
    const appUrl = process.env.FRONTEND_URL || 'https://acetel-vims.onrender.com';
    if (company.contactEmail) {
      try {
        const html = emailTemplates.welcomeCompany(
          company.name,
          company.contactPerson || 'Partner Contact',
          appUrl
        );
        await sendEmail(company.contactEmail, 'ACETEL IMS — Partner Registration Confirmed', html);
      } catch (e: any) {
        logger.warn('Partner welcome email failed: %s', e.message);
      }
    }
    if (company.contactPhone) {
      try {
        await sendWhatsAppMessage(company.contactPhone, `*ACETEL IMS — Partner Registered* 🏢

Hello ${company.contactPerson || 'Partner'},

Your organisation *${company.name}* has been registered on ACETEL IMS.

Portal: ${appUrl}

_You will be contacted by the institution for next steps._`);
      } catch (e: any) {
        logger.warn('Partner welcome whatsapp failed: %s', e.message);
      }
    }

    logger.info('Company created: %s by user %s', company._id, req.user!.id);
    res.status(201).json({ message: 'Company created', id: company._id, company });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      res.status(400).json({ error: `Validation failed: ${msg}`, details: err.errors });
      return;
    }
    if (err?.code === 11000) {
      res.status(409).json({ error: 'A partner with this name already exists in your institution' });
      return;
    }
    logger.error('Error in createCompany: %s', (err as Error).message);
    res.status(500).json({ error: 'Failed to register partner. Please check all required fields.' });
  }
}

export async function updateCompany(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = companyBodySchema.partial().parse(req.body);
    const { tenant: userTenant } = req.user!;
    
    const company = await Company.findOneAndUpdate(
      { _id: id, tenant: userTenant },
      { $set: data },
      { new: true }
    );
    
    if (!company) {
      res.status(404).json({ error: 'Company not found or access denied' });
      return;
    }
    
    logger.info('Company updated: %s by user %s', id, req.user!.id);
    res.json({ message: 'Company updated', company });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in updateCompany: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteCompany(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { tenant: userTenant } = req.user!;

    const company = await Company.findOne({ _id: id, tenant: userTenant });
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const studentCount = await Student.countDocuments({ company: id, ...(userTenant ? { tenant: userTenant } : {}), isDeleted: { $ne: true } });
    if (studentCount > 0) {
      res.status(400).json({ error: 'Cannot delete company with assigned students' });
      return;
    }

    company.isDeleted = true;
    company.deletedAt = new Date();
    company.deletedBy = req.user!.id as any;
    await company.save();

    logger.info('Company soft-deleted: %s by user %s', id, req.user!.id);
    res.json({ message: 'Company deleted' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in deleteCompany: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getCompanyById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const userTenant = req.user?.tenant || (await getDefaultTenantId().catch(() => undefined));

    const company = await Company.findOne({ _id: id, ...(userTenant ? { tenant: userTenant } : {}), isDeleted: { $ne: true } });
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const students = await Student.find({ company: company._id, ...(userTenant ? { tenant: userTenant } : {}), isDeleted: { $ne: true } })
      .populate('user', 'firstName lastName')
      .populate('programme', 'name level');
    
    res.json({ company, students });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in getCompanyById: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getCompanyMetadata(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userTenant = req.user?.tenant || (await getDefaultTenantId().catch(() => undefined));
    const baseQuery = { ...(userTenant ? { tenant: userTenant } : {}), isDeleted: { $ne: true } };
    const states = await Company.distinct('state', baseQuery);
    const sectors = await Company.distinct('sector', baseQuery);
    const specialisations = await Company.distinct('specialisation', baseQuery);
    
    res.json({ 
      states: states.sort(), 
      sectors: sectors.sort(),
      specialisations: specialisations.sort()
    });
  } catch (err) {
    logger.error('Error in getCompanyMetadata: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

const sendPartnerEnrollmentEmailsSchema = z.object({
  companyIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
});

/**
 * POST /api/companies/send-enrollment-emails
 * Resends onboarding / registration emails to partner organisations (individual or bulk).
 */
export async function sendPartnerEnrollmentEmails(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { companyIds } = sendPartnerEnrollmentEmailsSchema.parse(req.body);
    const tenantId = req.user?.tenant || (await getDefaultTenantId().catch(() => undefined));

    const query: any = { isDeleted: { $ne: true } };
    if (tenantId) query.tenant = tenantId;
    if (companyIds?.length) {
      query._id = { $in: companyIds };
    }

    const companies = await Company.find(query);

    if (companies.length === 0) {
      res.status(400).json({ error: 'No matching partner organisations found' });
      return;
    }

    if (!isEmailConfigured()) {
      res.status(400).json({
        error: 'Email is not configured on this server. Check SMTP settings under Settings → Integrations before sending enrollment emails.',
      });
      return;
    }

    const appUrl = getPrimaryAppUrl();
    const results: { companyId: string; email: string | null; sent: boolean; error?: string }[] = [];
    let sent = 0;
    let failed = 0;

    for (const c of companies) {
      if (!c.contactEmail) {
        results.push({ companyId: c._id.toString(), email: null, sent: false, error: 'No contact email on file' });
        failed++;
        continue;
      }

      const html = emailTemplates.welcomeCompany(
        c.name,
        c.contactPerson || 'Partner Contact',
        appUrl
      );

      const ok = await sendEmail(c.contactEmail, 'ACETEL IMS — Partner Registration & Onboarding', html);
      results.push({ companyId: c._id.toString(), email: c.contactEmail, sent: ok, error: ok ? undefined : 'Send failed — see server logs' });
      if (ok) sent++; else failed++;

      if (c.contactPhone) {
        try {
          await sendWhatsAppMessage(
            c.contactPhone,
            `*ACETEL IMS — Partner Onboarding* 🏢\n\nHello ${c.contactPerson || 'Partner'},\n\nYour organisation *${c.name}* is registered on ACETEL IMS.\n\nPortal: ${appUrl}\n\n_Access the partner portal to manage interns and monitor attendance._`
          );
        } catch (waErr: any) {
          logger.warn('Partner WhatsApp failed for %s: %s', c.contactPhone, (waErr as Error).message);
        }
      }
    }

    await AuditLog.create({
      tenant: tenantId,
      user: req.user!.id,
      action: 'BULK_SEND_PARTNER_EMAIL',
      module: 'COMPANY_MANAGEMENT',
      details: `Sent onboarding email to ${sent}/${companies.length} partner(s) (${failed} failed)`,
      ipAddress: req.ip,
    }).catch(() => {});

    res.json({
      message: `Partner onboarding email sent to ${sent} of ${companies.length} partner(s)${failed > 0 ? ` — ${failed} failed` : ''}.`,
      total: companies.length,
      sent,
      failed,
      results,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in sendPartnerEnrollmentEmails: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

