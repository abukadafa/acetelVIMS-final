import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  tenant: mongoose.Types.ObjectId;
  user?: mongoose.Types.ObjectId;
  action: string;
  module: string;
  details: string;
  targetId?: mongoose.Types.ObjectId;
  reason?: string;
  ipAddress?: string;
  createdAt: Date;
}

const AuditLogSchema: Schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  module: { type: String, required: true },
  details: { type: String, required: true },
  targetId: { type: Schema.Types.ObjectId },
  reason: { type: String },
  ipAddress: { type: String }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Index for performance
AuditLogSchema.index({ tenant: 1, user: 1, createdAt: -1 });
AuditLogSchema.index({ tenant: 1, module: 1 });

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
