import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Company from '../models/Company.model';
import Student from '../models/Student.model';
import logger from '../utils/logger';
import { z } from 'zod';
import { sendEmail, emailTemplates } from '../utils/mail.service';
import { sendWhatsAppMessage } from '../utils/whatsapp.service';
import AuditLog from '../models/AuditLog.model';

const companyQuerySchema = z.object({
  state: z.string().optional(),
  sector: z.string().optional(),
  specialisation: z.string().optional(),
  search: z.string().optional(),
  isApproved: z.preprocess((val) => val === 'true', z.boolean()).optional(),
});

const companyBodySchema = z.object({
  name: z.string().min(2).max(100),
  address: z.string().min(5).max(200),
  state: z.string().min(2),
  lga: z.string().optional(),
  sector: z.enum(['AI', 'CS', 'MIS', 'Cybersecurity', 'Data Science', 'General IT']),
  specialisation: z.string().optional(),
  contactPerson: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  maxStudents: z.number().min(1).optional().default(5),
});

const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
});

export async function getAllCompanies(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { state, sector, specialisation, search, isApproved } = companyQuerySchema.parse(req.query);
    const { tenant: userTenant } = req.user!;
    
    let query: any = { tenant: userTenant, isDeleted: false };

    if (state) query.state = state;
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
        const studentCount = await Student.countDocuments({ company: c._id, tenant: userTenant, isDeleted: false });
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
    const { tenant: userTenant } = req.user!;
    
    const company = new Company({ ...data, tenant: userTenant });
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
      const html = emailTemplates.companyPlacementNotice(
        company.name,
        company.contactPerson || 'Partner Contact',
        'N/A',
        company.contactEmail,
        company.contactPhone || 'N/A'
      );
      await sendEmail(company.contactEmail, 'ACETEL IMS — Partner Registration Confirmed', html).catch((e) => {
        logger.warn('Partner welcome email failed: %s', (e as Error).message);
      });
    }
    if (company.contactPhone) {
      await sendWhatsAppMessage(company.contactPhone, `*ACETEL IMS — Partner Registered* 🏢

Hello ${company.contactPerson || 'Partner'},

Your organisation *${company.name}* has been registered on ACETEL IMS.

Portal: ${appUrl}

_You will be contacted by the institution for next steps._`).catch(() => false);
    }

    logger.info('Company created: %s by user %s', company._id, req.user!.id);
    res.status(201).json({ message: 'Company created', id: company._id, company });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in createCompany: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
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

    const studentCount = await Student.countDocuments({ company: id, tenant: userTenant, isDeleted: false });
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
    const { tenant: userTenant } = req.user!;

    const company = await Company.findOne({ _id: id, tenant: userTenant });
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const students = await Student.find({ company: company._id, tenant: userTenant, isDeleted: false })
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
    const { tenant: userTenant } = req.user!;
    const states = await Company.distinct('state', { tenant: userTenant, isDeleted: false });
    const sectors = await Company.distinct('sector', { tenant: userTenant, isDeleted: false });
    const specialisations = await Company.distinct('specialisation', { tenant: userTenant, isDeleted: false });
    
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
