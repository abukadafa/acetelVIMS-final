import mongoose, { Schema, Document } from 'mongoose';

export interface IRefreshToken extends Document {
  user: mongoose.Types.ObjectId;
  tenant: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  isRevoked: boolean;
  replacedByToken?: string;
  ipAddress?: string;
  userAgent?: string;
}

const RefreshTokenSchema: Schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  isRevoked: { type: Boolean, default: false },
  replacedByToken: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String }
}, {
  timestamps: true
});

// Automatically expire old/revoked tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
RefreshTokenSchema.index({ tenant: 1, user: 1 });

export default mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);
