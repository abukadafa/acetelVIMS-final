import mongoose, { Schema, Document } from 'mongoose';

export interface IAttendance extends Document {
  student: mongoose.Types.ObjectId;
  tenant: mongoose.Types.ObjectId;
  session: 'morning' | 'afternoon';
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
  session: {
    type: String,
    enum: ['morning', 'afternoon'],
    required: true,
    default: 'morning',
  },
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

// Index for reporting — one record per student per session per day
AttendanceSchema.index({ student: 1, session: 1, checkInTime: -1 });
AttendanceSchema.index({ student: 1, tenant: 1, session: 1, checkInTime: -1 });

export default mongoose.model<IAttendance>('Attendance', AttendanceSchema);
