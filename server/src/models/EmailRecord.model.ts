import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailRecord extends Document {
  tenant: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  recipients: { userId?: mongoose.Types.ObjectId; email: string; name: string; }[];
  subject: string;
  body: string;
  bodyHtml?: string;
  recipientScope: 'individual' | 'all_students' | 'all_staff' | 'programme' | 'custom';
  programme?: mongoose.Types.ObjectId;
  sentCount: number;
  failedCount: number;
  status: 'sending' | 'sent' | 'failed' | 'partial';
  createdAt: Date;
}

const EmailRecordSchema: Schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  recipients: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    email: { type: String, required: true },
    name: { type: String, required: true },
  }],
  subject: { type: String, required: true, maxlength: 300 },
  body: { type: String, required: true, maxlength: 10000 },
  bodyHtml: { type: String },
  recipientScope: {
    type: String,
    enum: ['individual', 'all_students', 'all_staff', 'programme', 'custom'],
    required: true,
  },
  programme: { type: Schema.Types.ObjectId, ref: 'Programme' },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  status: { type: String, enum: ['sending', 'sent', 'failed', 'partial'], default: 'sending' },
}, { timestamps: true });

EmailRecordSchema.index({ tenant: 1, sender: 1, createdAt: -1 });

export default mongoose.model<IEmailRecord>('EmailRecord', EmailRecordSchema);
