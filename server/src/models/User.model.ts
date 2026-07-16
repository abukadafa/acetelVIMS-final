import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { getDefaultPermissionsForRole } from '../config/permissions';

export interface IUser extends Document {
  email: string;
  username: string;
  password?: string;
  role: 'admin' | 'supervisor' | 'student' | 'prog_coordinator' | 'internship_coordinator' | 'ict_support' | 'industry_supervisor';
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  programme?: mongoose.Types.ObjectId; // For per-programme staff roles
  /** Explicit, admin-editable grants. Admin role bypasses this and implicitly has everything. */
  permissions: string[];
  tenant: mongoose.Types.ObjectId;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  deleteReason?: string;
  lastEditReason?: string;
  lastLogin?: Date;
  /** Forces a password-change prompt on next login (e.g. after an admin-initiated reset). */
  mustChangePassword?: boolean;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  username: { type: String, required: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    required: true, 
    enum: ['admin', 'supervisor', 'student', 'prog_coordinator', 'internship_coordinator', 'ict_support', 'industry_supervisor'],
    default: 'student'
  },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String },
  avatar: { type: String },
  programme: { type: Schema.Types.ObjectId, ref: 'Programme' }, // optional per-programme linkage
  permissions: { type: [String], default: [] },
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deleteReason: { type: String },
  lastEditReason: { type: String },
  lastLogin: { type: Date },
  mustChangePassword: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Active users only — soft-deleted records do not block email/username reuse
UserSchema.index(
  { email: 1, tenant: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
UserSchema.index(
  { username: 1, tenant: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

// Seed default permissions for brand-new users based on their role, unless
// permissions were explicitly provided (e.g. by the permission-migration script).
UserSchema.pre<IUser>('validate', function () {
  if (this.isNew && (!this.permissions || this.permissions.length === 0)) {
    this.permissions = getDefaultPermissionsForRole(this.role);
  }
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
