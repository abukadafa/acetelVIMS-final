import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage {
  sender: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
  isRead: boolean;
}

export interface IChat extends Document {
  tenant: mongoose.Types.ObjectId;
  name: string;
  participants: mongoose.Types.ObjectId[];
  messages: IChatMessage[];
  lastMessage?: string;
  lastMessageAt?: Date;
  lastMessageBy?: mongoose.Types.ObjectId;
}

const ChatMessageSchema: Schema = new Schema({
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
  isRead: { type: Boolean, default: false },
}, { _id: false });

const ChatSchema: Schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  name: { type: String, required: true },
  participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
  messages: { type: [ChatMessageSchema], default: [] },
  lastMessage: { type: String },
  lastMessageAt: { type: Date },
  lastMessageBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

ChatSchema.index({ tenant: 1, participants: 1 });

export default mongoose.model<IChat>('Chat', ChatSchema);
