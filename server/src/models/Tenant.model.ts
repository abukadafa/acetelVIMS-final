import mongoose, { Schema, Document } from 'mongoose';

export interface ITenant extends Document {
  name: string;
  slug: string; // unique identifier for the university (e.g., 'noun')
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  institutionType: 'University' | 'Polytechnic' | 'College';
  settings: {
    allowSelfRegistration: boolean;
    requireSupervisorApproval: boolean;
    defaultAttendanceRadius: number;
  };
  isActive: boolean;
}

const TenantSchema: Schema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  logoUrl: { type: String },
  primaryColor: { type: String, default: '#004d00' },
  secondaryColor: { type: String, default: '#ffcc00' },
  institutionType: { 
    type: String, 
    enum: ['University', 'Polytechnic', 'College'],
    default: 'University'
  },
  settings: {
    allowSelfRegistration: { type: Boolean, default: true },
    requireSupervisorApproval: { type: Boolean, default: true },
    defaultAttendanceRadius: { type: Number, default: 0.5 } // km
  },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

export default mongoose.model<ITenant>('Tenant', TenantSchema);
