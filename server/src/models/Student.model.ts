import mongoose, { Schema, Document } from 'mongoose';

export interface IStudent extends Document {
  user: mongoose.Types.ObjectId;
  tenant: mongoose.Types.ObjectId;
  matricNumber: string;
  programme: mongoose.Types.ObjectId;
  company?: mongoose.Types.ObjectId;
  supervisor?: mongoose.Types.ObjectId;
  academicSession: string;
  level: string;
  personalEmail?: string;
  gender?: 'Male' | 'Female' | 'Other';
  isNigerian?: boolean;
  status: 'pending' | 'active' | 'completed' | 'withdrawn' | 'suspended';
  thesisPhase: 'coursework' | 'proposal' | 'research' | 'writing' | 'defense';
  researchInterests?: string[];
  riskScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  stateOfOrigin?: string;
  lga?: string;
  address?: string;
  lat?: number;
  lng?: number;
  lastSeen?: Date;
  overallScore: number;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  deleteReason?: string;
  lastEditReason?: string;
}

const StudentSchema: Schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  matricNumber: { type: String, required: true, unique: true },
  programme: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  company: { type: Schema.Types.ObjectId, ref: 'Company' },
  supervisor: { type: Schema.Types.ObjectId, ref: 'User' },
  academicSession: { type: String, required: true },
  level: { type: String, required: true },
  personalEmail: { type: String, lowercase: true, trim: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  isNigerian: { type: Boolean, default: true },
  status: { 
    type: String, 
    enum: ['pending', 'active', 'completed', 'withdrawn', 'suspended'],
    default: 'pending'
  },
  riskScore: { type: Number, default: 0 },
  riskLevel: { 
    type: String, 
    enum: ['Low', 'Medium', 'High'],
    default: 'Low'
  },
  stateOfOrigin: { type: String },
  lga: { type: String },
  address: { type: String },
  emergencyContact: { type: String },
  emergencyPhone: { type: String },
  acceptanceLetter: { type: String },
  insuranceDoc: { type: String },
  lat: { type: Number },
  lng: { type: Number },
  lastSeen: { type: Date },
  overallScore: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deleteReason: { type: String },
  lastEditReason: { type: String }
}, {
  timestamps: true
});

export default mongoose.model<IStudent>('Student', StudentSchema);
