import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  username: string;
  password?: string;
  role: 'admin' | 'supervisor' | 'student' | 'prog_coordinator' | 'internship_coordinator' | 'ict_support';
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  programme?: mongoose.Types.ObjectId; // For per-programme staff roles
  tenant: mongoose.Types.ObjectId;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  deleteReason?: string;
  lastEditReason?: string;
  lastLogin?: Date;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    required: true, 
    enum: ['admin', 'supervisor', 'student', 'prog_coordinator', 'internship_coordinator', 'ict_support'],
    default: 'student'
  },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String },
  avatar: { type: String },
  programme: { type: Schema.Types.ObjectId, ref: 'Programme' }, // optional per-programme linkage
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deleteReason: { type: String },
  lastEditReason: { type: String },
  lastLogin: { type: Date }
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre<IUser>('save', async function() {
  if (!this.isModified('password')) return;
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password!, salt);
  } catch (err: any) {
    throw err;
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);
