import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  tenant: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'reminder';
  isRead: boolean;
  link?: string;
}

const NotificationSchema: Schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['info', 'warning', 'success', 'error', 'reminder'],
    default: 'info'
  },
  isRead: { type: Boolean, default: false },
  link: { type: String }
}, {
  timestamps: true
});

// Index for unread notifications
NotificationSchema.index({ user: 1, tenant: 1, isRead: 1 });

export default mongoose.model<INotification>('Notification', NotificationSchema);
