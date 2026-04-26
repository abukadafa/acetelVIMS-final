import mongoose, { Schema, Document } from 'mongoose';

export interface IBlockedIP extends Document {
  ip: string;
  reason: string;
  requestCount: number;
  firstSeen: Date;
  lastSeen: Date;
  blockedAt?: Date;
  blockedUntil?: Date;      // null = permanent
  isActive: boolean;        // true = currently blocked
  autoBlocked: boolean;     // true = blocked by system, false = manual admin block
  unblockReason?: string;
  unblockedAt?: Date;
  unblockedBy?: mongoose.Types.ObjectId;
}

const BlockedIPSchema: Schema = new Schema({
  ip: { type: String, required: true, unique: true, index: true },
  reason: { type: String, required: true },
  requestCount: { type: Number, default: 0 },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  blockedAt: { type: Date },
  blockedUntil: { type: Date },   // undefined = permanent
  isActive: { type: Boolean, default: false, index: true },
  autoBlocked: { type: Boolean, default: true },
  unblockReason: { type: String },
  unblockedAt: { type: Date },
  unblockedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Compound index for the firewall lookup (hot path — every request hits this)
BlockedIPSchema.index({ ip: 1, isActive: 1 });
// TTL index — auto-expire temporary blocks from the DB after blockedUntil passes
BlockedIPSchema.index({ blockedUntil: 1 }, { expireAfterSeconds: 0, sparse: true });

export default mongoose.model<IBlockedIP>('BlockedIP', BlockedIPSchema);
