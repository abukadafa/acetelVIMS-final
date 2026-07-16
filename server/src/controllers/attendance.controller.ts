import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Attendance from '../models/Attendance.model';
import Student from '../models/Student.model';
import Setting from '../models/Setting.model';
import Programme from '../models/Programme.model';
import { calculateDistance } from '../utils/geo.utils';
import { resolveCurrentSession, getAttendanceDateKey } from '../utils/attendance.util';
import logger from '../utils/logger';
import { z } from 'zod';

const checkInSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  method: z.enum(['gps', 'biometric', 'manual', 'qr', 'offline']).optional().default('gps'),
  photoBase64: z.string().optional(),
});

const attendanceQuerySchema = z.object({
  studentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format').optional(),
  month: z.preprocess((val) => Number(val), z.number().min(1).max(12)).optional(),
  year: z.preprocess((val) => Number(val), z.number().min(2000).max(2100)).optional(),
});

const manualAttendanceSchema = z.object({
  studentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  session: z.enum(['morning', 'afternoon']).optional().default('morning'),
  notes: z.string().max(500).optional(),
});

export async function checkIn(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { lat, lng, method, photoBase64 } = checkInSchema.parse(req.body);
    const { id: userId, tenant: userTenant } = req.user!;
    
    const student = await Student.findOne({ user: userId, tenant: userTenant }).populate('company');

    if (!student) {
      res.status(404).json({ error: 'Student profile not found' });
      return;
    }

    const now = new Date();
    const { session, attendanceDate } = await resolveCurrentSession(userTenant!, now);

    const existing = await Attendance.findOne({
      student: student._id,
      tenant: userTenant,
      attendanceDate,
      session,
    });

    if (existing) {
      res.status(409).json({ error: `Already checked in for the ${session} session today` });
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

    let photoUrl = undefined;
    if (photoBase64) {
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `selfie_${student._id}_${Date.now()}.jpg`;
      const filepath = path.join(process.cwd(), 'uploads', filename);
      fs.writeFileSync(filepath, buffer);
      photoUrl = `/uploads/${filename}`;
    }

    let attendance: InstanceType<typeof Attendance>;
    try {
      attendance = new Attendance({
        student: student._id,
        tenant: userTenant,
        session,
        attendanceDate,
        checkInTime: now,
        lat,
        lng,
        distanceFromCompany: distance,
        isValid,
        method,
        photoUrl,
      });
      await attendance.save();
    } catch (saveErr: any) {
      // Unique index (student, attendanceDate, session) caught a race — two
      // near-simultaneous requests both passed the findOne check above.
      if (saveErr?.code === 11000) {
        res.status(409).json({ error: `Already checked in for the ${session} session today` });
        return;
      }
      throw saveErr;
    }

    student.lat = lat;
    student.lng = lng;
    student.lastSeen = new Date();
    await student.save();

    res.json({
      message: isValid
        ? `✅ ${session === 'morning' ? 'Morning' : 'Afternoon'} check-in successful`
        : `⚠️ Check-in recorded but location is outside company radius`,
      session,
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

    const student = await Student.findOne({ user: userId, tenant: userTenant });
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const now = new Date();
    const { session, attendanceDate } = await resolveCurrentSession(userTenant!, now);

    // Prefer the record for the current session; if the student is checking
    // out just after the AM/PM cutoff rolled over, fall back to any still-open
    // record for today so a late checkout isn't lost.
    let record = await Attendance.findOne({
      student: student._id,
      tenant: userTenant,
      attendanceDate,
      session,
      checkOutTime: { $exists: false },
    });

    if (!record) {
      record = await Attendance.findOne({
        student: student._id,
        tenant: userTenant,
        attendanceDate,
        checkOutTime: { $exists: false },
      }).sort({ checkInTime: -1 });
    }

    if (!record) {
      res.status(404).json({ error: 'No active check-in found for today' });
      return;
    }

    record.checkOutTime = now;
    await record.save();

    res.json({ message: `✅ ${record.session === 'morning' ? 'Morning' : 'Afternoon'} check-out successful`, session: record.session });
  } catch (err) {
    logger.error('Error in checkOut: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getTodayStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id: userId, tenant: userTenant } = req.user!;
    const student = await Student.findOne({ user: userId, tenant: userTenant });
    if (!student) {
      res.status(404).json({ error: 'Student profile not found' });
      return;
    }

    const now = new Date();
    const { session: currentSession, attendanceDate } = await resolveCurrentSession(userTenant!, now);

    const records = await Attendance.find({ student: student._id, tenant: userTenant, attendanceDate });
    const morning = records.find((r) => r.session === 'morning') || null;
    const afternoon = records.find((r) => r.session === 'afternoon') || null;

    res.json({
      date: attendanceDate,
      currentSession,
      morning: morning ? { checkedIn: true, checkInTime: morning.checkInTime, checkedOut: !!morning.checkOutTime, checkOutTime: morning.checkOutTime, isValid: morning.isValid } : { checkedIn: false },
      afternoon: afternoon ? { checkedIn: true, checkInTime: afternoon.checkInTime, checkedOut: !!afternoon.checkOutTime, checkOutTime: afternoon.checkOutTime, isValid: afternoon.isValid } : { checkedIn: false },
    });
  } catch (err) {
    logger.error('Error in getTodayStatus: %s', (err as Error).message);
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
    const { studentId, date, session, notes } = manualAttendanceSchema.parse(req.body);
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

    const existing = await Attendance.findOne({ student: studentId, tenant: userTenant, attendanceDate: date, session });
    if (existing) {
      res.status(409).json({ error: `Attendance already recorded for the ${session} session on ${date}` });
      return;
    }

    const attendance = new Attendance({
      student: studentId,
      tenant: userTenant,
      session,
      attendanceDate: date,
      checkInTime: new Date(`${date} ${session === 'morning' ? '08:00:00' : '13:00:00'}`),
      isValid: true,
      method: 'manual',
      notes
    });
    await attendance.save();
    res.status(201).json({ message: `Manual ${session} attendance recorded`, id: attendance._id });
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
      const prog = await Programme.findById(p._id);
      const present = await Attendance.countDocuments({
        tenant: tenantId,
        checkInTime: { $gte: today },
        student: { $in: await Student.find({ programme: p._id, tenant: tenantId }).distinct('_id') }
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

export async function exportAttendanceRecords(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { tenant: userTenant, role: userRole, id: userId } = req.user!;
    
    let filter: any = { tenant: userTenant };
    
    // Scoping for supervisors
    if (userRole === 'supervisor') {
      const students = await Student.find({ supervisor: userId, tenant: userTenant });
      filter.student = { $in: students.map(s => s._id) };
    } else if (userRole === 'prog_coordinator') {
      const coord = await mongoose.model('User').findById(userId);
      if (coord?.programme) {
        const students = await Student.find({ programme: coord.programme, tenant: userTenant });
        filter.student = { $in: students.map(s => s._id) };
      }
    }

    const records = await Attendance.find(filter)
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'firstName lastName email' }
      })
      .sort({ checkInTime: -1 });

    let csv = 'Student Name,Student Email,Date,Session,Time In,Time Out,Method,Verification Status,Distance Deviation (km),Has Selfie\n';
    
    for (const r of records) {
      const student = r.student as any;
      const user = student?.user;
      const d = new Date(r.checkInTime);
      const dateStr = d.toLocaleDateString();
      const timeStr = d.toLocaleTimeString();
      const timeOutStr = r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString() : '';
      const sessionLabel = r.session === 'afternoon' ? 'Afternoon' : 'Morning';
      const verificationStatus = r.isValid ? 'Verified' : 'Out of Range';
      const deviation = r.distanceFromCompany ? r.distanceFromCompany.toFixed(3) : '';
      const hasSelfie = r.photoUrl ? 'Yes' : 'No';
      
      csv += `"${user?.firstName} ${user?.lastName}","${user?.email}",${dateStr},${sessionLabel},${timeStr},${timeOutStr},${r.method},${verificationStatus},${deviation},${hasSelfie}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=ACETEL_Attendance_${new Date().toISOString().split('T')[0]}.csv`);
    res.status(200).send(csv);
  } catch (err) {
    logger.error('Error in exportAttendanceRecords: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}
