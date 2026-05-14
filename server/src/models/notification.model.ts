import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  tenant?: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'reminder';
  channel?: 'in-app' | 'email' | 'whatsapp';
  isRead: boolean;
  readAt?: Date;
  link?: string;
}

const NotificationSchema: Schema = new Schema({
  user:    { type: Schema.Types.ObjectId, ref: 'User',   required: true },
  tenant:  { type: Schema.Types.ObjectId, ref: 'Tenant', required: false },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  type:    { type: String, enum: ['info', 'warning', 'success', 'error', 'reminder'], default: 'info' },
  channel: { type: String, enum: ['in-app', 'email', 'whatsapp'], default: 'in-app' },
  isRead:  { type: Boolean, default: false },
  readAt:  { type: Date },
  link:    { type: String },
}, { timestamps: true });

NotificationSchema.index({ user: 1, isRead: 1 });

export default mongoose.model<INotification>('Notification', NotificationSchema);
