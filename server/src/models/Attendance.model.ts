import mongoose, { Schema, Document } from 'mongoose';

export interface IAttendance extends Document {
  student: mongoose.Types.ObjectId;
  tenant: mongoose.Types.ObjectId;
  /** Which of the two required daily check-ins this record is for. */
  session: 'morning' | 'afternoon';
  /** Calendar day this record belongs to, in the tenant's local time, as YYYY-MM-DD.
   *  Stored explicitly (rather than derived from checkInTime at query time) so a
   *  unique index can cheaply guarantee "one record per student per session per day"
   *  at the database level, closing the race condition a pure application-level
   *  check can't fully prevent under concurrent requests. */
  attendanceDate: string;
  checkInTime: Date;
  checkOutTime?: Date;
  lat?: number;
  lng?: number;
  distanceFromCompany?: number;
  isValid: boolean;
  method: 'gps' | 'qr' | 'manual' | 'offline' | 'biometric';
  photoUrl?: string;
  notes?: string;
}

const AttendanceSchema: Schema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  session: { type: String, enum: ['morning', 'afternoon'], required: true, default: 'morning' },
  attendanceDate: { type: String, required: true }, // YYYY-MM-DD
  checkInTime: { type: Date, required: true, default: Date.now },
  checkOutTime: { type: Date },
  lat: { type: Number },
  lng: { type: Number },
  distanceFromCompany: { type: Number },
  isValid: { type: Boolean, default: true },
  method: { 
    type: String, 
    enum: ['gps', 'qr', 'manual', 'offline', 'biometric'], 
    default: 'gps' 
  },
  photoUrl: { type: String },
  notes: { type: String }
}, {
  timestamps: true
});

// Index for reporting
AttendanceSchema.index({ student: 1, checkInTime: -1 });
// Enforce one record per student, per calendar day, per session (morning/afternoon)
AttendanceSchema.index({ student: 1, attendanceDate: 1, session: 1 }, { unique: true });

export default mongoose.model<IAttendance>('Attendance', AttendanceSchema);
