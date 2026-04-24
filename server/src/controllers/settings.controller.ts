import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Setting from '../models/Setting.model';
import AuditLog from '../models/AuditLog.model';
import Student from '../models/Student.model';
import User from '../models/User.model';
import Company from '../models/Company.model';
import Logbook from '../models/Logbook.model';
import Attendance from '../models/Attendance.model';
import { z } from 'zod';
import logger from '../utils/logger';

const settingUpdateSchema = z.object({
  key: z.string(),
  value: z.string(),
});

const multipleSettingsSchema = z.object({
  settings: z.record(z.string()),
});

export async function getSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenant;
    const settings = await Setting.find({ tenant: tenantId });
    const obj: Record<string, string> = {};
    settings.forEach(s => { obj[s.key] = s.value; });
    res.json({ settings: obj });
  } catch (err) {
    logger.error('Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateSetting(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { key, value } = settingUpdateSchema.parse(req.body);
    const tenantId = req.user!.tenant;

    await Setting.findOneAndUpdate(
      { tenant: tenantId, key },
      { $set: { value, updatedAt: new Date() } },
      { upsert: true, new: true }
    );
    
    // Log the action
    await new AuditLog({
      tenant: tenantId,
      user: req.user!.id,
      action: 'UPDATE_SETTING',
      module: 'SETTINGS',
      details: `Updated ${key} to ${value}`
    }).save();

    res.json({ message: 'Setting updated' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateMultipleSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { settings } = multipleSettingsSchema.parse(req.body);
    const tenantId = req.user!.tenant;
    
    for (const [key, value] of Object.entries(settings)) {
      await Setting.findOneAndUpdate(
        { tenant: tenantId, key },
        { $set: { value, updatedAt: new Date() } },
        { upsert: true }
      );
    }

    await new AuditLog({
      tenant: tenantId,
      user: req.user!.id,
      action: 'UPDATE_MULTIPLE_SETTINGS',
      module: 'SETTINGS',
      details: `Updated ${Object.keys(settings).length} settings`
    }).save();

    res.json({ message: 'Settings updated' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getAuditLog(req: AuthRequest, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenant;
    const logs = await AuditLog.find({ tenant: tenantId })
      .populate('user', 'firstName lastName role')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ logs });
  } catch (err) {
    logger.error('Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getAdminDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenant;
    
    const totalStudents = await Student.countDocuments({ tenant: tenantId });
    const activeStudents = await Student.countDocuments({ tenant: tenantId, status: 'active' });
    const pendingStudents = await Student.countDocuments({ tenant: tenantId, status: 'pending' });
    const totalCompanies = await Company.countDocuments({ tenant: tenantId, isApproved: true });
    const totalSupervisors = await User.countDocuments({ tenant: tenantId, role: 'supervisor' });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const todayAttendance = await Attendance.countDocuments({
      tenant: tenantId,
      checkInTime: { $gte: today, $lt: tomorrow }
    });

    const pendingLogbooks = await Logbook.countDocuments({ tenant: tenantId, status: 'submitted' });
    const unallocated = await Student.countDocuments({ tenant: tenantId, company: { $exists: false } });

    const recentStudents = await Student.find({ tenant: tenantId })
      .populate('user', 'firstName lastName email')
      .populate('programme', 'name level')
      .sort({ createdAt: -1 })
      .limit(8);

    const recentActivity = await AuditLog.find({ tenant: tenantId })
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      stats: { 
        totalStudents, 
        activeStudents, 
        pendingStudents, 
        totalCompanies, 
        totalSupervisors, 
        todayAttendance, 
        pendingLogbooks, 
        unallocated 
      },
      recentStudents,
      recentActivity,
    });
  } catch (err) {
    logger.error('Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}
