import mongoose from 'mongoose';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Attendance from '../models/Attendance.model';
import Student from '../models/Student.model';
import Setting from '../models/Setting.model';
import { calculateDistance } from '../utils/geo.utils';
import logger from '../utils/logger';
import { z } from 'zod';

const checkInSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  method: z.enum(['gps', 'biometric', 'manual']).optional().default('gps'),
});

const attendanceQuerySchema = z.object({
  studentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format').optional(),
  month: z.preprocess((val) => Number(val), z.number().min(1).max(12)).optional(),
  year: z.preprocess((val) => Number(val), z.number().min(2000).max(2100)).optional(),
});

const manualAttendanceSchema = z.object({
  studentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  notes: z.string().max(500).optional(),
});

export async function checkIn(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { lat, lng, method } = checkInSchema.parse(req.body);
    const { id: userId, tenant: userTenant } = req.user!;
    
    const student = await Student.findOne({ user: userId, tenant: userTenant }).populate('company');

    if (!student) {
      res.status(404).json({ error: 'Student profile not found' });
      return;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const existing = await Attendance.findOne({
      student: student._id,
      tenant: userTenant,
      checkInTime: { $gte: startOfDay, $lte: endOfDay }
    });

    if (existing) {
      res.status(409).json({ error: 'Already checked in today' });
      return;
    }

    let distance: number | null = null;
    let isValid = true;
    
    const radiusSetting = await Setting.findOne({ tenant: userTenant, key: 'attendance_radius_km' });
    const radiusKm = parseFloat(radiusSetting?.value || '0.5');

    const company = student.company as any;
    if (company && company.lat && company.lng) {
      distance = calculateDistance(lat, lng, company.lat, company.lng);
      isValid = distance <= radiusKm;
    }

    const attendance = new Attendance({
      student: student._id,
      tenant: userTenant,
      checkInTime: new Date(),
      lat,
      lng,
      distanceFromCompany: distance,
      isValid,
      method
    });

    await attendance.save();

    student.lat = lat;
    student.lng = lng;
    student.lastSeen = new Date();
    await student.save();

    res.json({
      message: isValid ? '✅ Check-in successful' : '⚠️ Check-in recorded but location is outside company radius',
      isValid,
      distance: distance ? `${distance.toFixed(2)} km` : null,
      attendanceId: attendance._id,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in checkIn: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function checkOut(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id: userId, tenant: userTenant } = req.user!;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const student = await Student.findOne({ user: userId, tenant: userTenant });
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const record = await Attendance.findOne({
      student: student._id,
      tenant: userTenant,
      checkInTime: { $gte: startOfDay, $lte: endOfDay },
      checkOutTime: { $exists: false }
    });

    if (!record) {
      res.status(404).json({ error: 'No active check-in found for today' });
      return;
    }

    record.checkOutTime = new Date();
    await record.save();

    res.json({ message: '✅ Check-out successful' });
  } catch (err) {
    logger.error('Error in checkOut: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getAttendanceRecords(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { studentId, month, year } = attendanceQuerySchema.parse(req.query);
    const { role: userRole, id: userId, tenant: userTenant } = req.user!;
    let targetId = studentId;

    let filter: any = { tenant: userTenant };

    if (userRole === 'student') {
      const student = await Student.findOne({ user: userId, tenant: userTenant });
      targetId = student?._id.toString();
    }

    if (targetId) {
      // SECURITY Check
      const targetStudent = await Student.findOne({ _id: targetId, tenant: userTenant });
      if (!targetStudent) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
      
      if (userRole === 'supervisor' && targetStudent.supervisor?.toString() !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      filter.student = targetId;
    }

    if (month && year) {
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);
      filter.checkInTime = { $gte: startOfMonth, $lte: endOfMonth };
    }

    const records = await Attendance.find(filter)
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'firstName lastName email' }
      })
      .sort({ checkInTime: -1 });

    let summary = null;
    if (targetId) {
      summary = {
        total: await Attendance.countDocuments({ student: targetId, tenant: userTenant }),
        valid: await Attendance.countDocuments({ student: targetId, tenant: userTenant, isValid: true })
      };
    }

    res.json({ records, summary });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in getAttendanceRecords: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function manualAttendance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { studentId, date, notes } = manualAttendanceSchema.parse(req.body);
    const { tenant: userTenant } = req.user!;

    // SECURITY: Only admins or coordinators can log manual attendance
    if (!['admin', 'prog_coordinator', 'internship_coordinator'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const student = await Student.findOne({ _id: studentId, tenant: userTenant });
    if (!student) {
      res.status(404).json({ error: 'Student not found in this tenant' });
      return;
    }

    const attendance = new Attendance({
      student: studentId,
      tenant: userTenant,
      checkInTime: new Date(`${date} 08:00:00`),
      isValid: true,
      method: 'manual',
      notes
    });
    await attendance.save();
    res.status(201).json({ message: 'Manual attendance recorded', id: attendance._id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in manualAttendance: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getAttendanceAnalytics(req: AuthRequest, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenant;
    
    // 1. Overall Compliance Rate
    const totalStudents = await Student.countDocuments({ tenant: tenantId, status: 'active' });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const presentToday = await Attendance.countDocuments({ 
      tenant: tenantId, 
      checkInTime: { $gte: today },
      isValid: true 
    });

    // 2. Daily Trend (Last 7 days)
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const nextD = new Date(d);
      nextD.setDate(d.getDate() + 1);

      const count = await Attendance.countDocuments({
        tenant: tenantId,
        checkInTime: { $gte: d, $lt: nextD },
        isValid: true
      });

      trend.push({
        date: d.toLocaleDateString('en-US', { weekday: 'short' }),
        count
      });
    }

    // 3. Programme-wise Breakdown
    const programmes = await Student.aggregate([
      { $match: { tenant: new mongoose.Types.ObjectId(tenantId), status: 'active' } },
      { $group: { _id: '$programme', total: { $sum: 1 } } }
    ]);

    const programmeStats = await Promise.all(programmes.map(async (p) => {
      const prog = await Student.db.model('Programme').findById(p._id);
      const present = await Attendance.countDocuments({
        tenant: tenantId,
        checkInTime: { $gte: today },
        student: { $in: await Student.find({ programme: p._id }).distinct('_id') }
      });

      return {
        name: prog?.name || 'Unknown',
        total: p.total,
        present,
        rate: p.total > 0 ? Math.round((present / p.total) * 100) : 0
      };
    }));

    res.json({
      summary: {
        totalActive: totalStudents,
        presentToday,
        complianceRate: totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0
      },
      trend,
      programmeStats
    });
  } catch (err) {
    logger.error('Attendance Analytics Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}
