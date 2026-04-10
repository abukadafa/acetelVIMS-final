import mongoose, { Schema, Document } from 'mongoose';

export interface IAttendance extends Document {
  student: mongoose.Types.ObjectId;
  tenant: mongoose.Types.ObjectId;
  checkInTime: Date;
  checkOutTime?: Date;
  lat?: number;
  lng?: number;
  distanceFromCompany?: number;
  isValid: boolean;
  method: 'gps' | 'qr' | 'manual' | 'offline';
  notes?: string;
}

const AttendanceSchema: Schema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  checkInTime: { type: Date, required: true, default: Date.now },
  checkOutTime: { type: Date },
  lat: { type: Number },
  lng: { type: Number },
  distanceFromCompany: { type: Number },
  isValid: { type: Boolean, default: true },
  method: { 
    type: String, 
    enum: ['gps', 'qr', 'manual', 'offline'], 
    default: 'gps' 
  },
  notes: { type: String }
}, {
  timestamps: true
});

// Index for reporting
AttendanceSchema.index({ student: 1, checkInTime: -1 });

export default mongoose.model<IAttendance>('Attendance', AttendanceSchema);
