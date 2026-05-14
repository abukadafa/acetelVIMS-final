import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage {
  _id: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  content: string;
  type: 'text' | 'file' | 'image';
  fileUrl?: string;
  readBy: mongoose.Types.ObjectId[];
  createdAt: Date;
}

export interface IChat extends Document {
  tenant: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[];
  messages: IChatMessage[];
  lastMessage?: string;
  lastMessageAt?: Date;
  lastMessageBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema({
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 4000 },
  type: { type: String, enum: ['text', 'file', 'image'], default: 'text' },
  fileUrl: { type: String },
  readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: { createdAt: true, updatedAt: false } });

const ChatSchema: Schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
  messages: [MessageSchema],
  lastMessage: { type: String },
  lastMessageAt: { type: Date },
  lastMessageBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

ChatSchema.index({ participants: 1, tenant: 1 });
ChatSchema.index({ lastMessageAt: -1 });

export default mongoose.model<IChat>('Chat', ChatSchema);
