import mongoose, { Schema, Document } from 'mongoose';

export interface IIPTracker extends Document {
  ip: string;
  windows: {
    '1m': number;    // requests in last 1 minute
    '5m': number;    // requests in last 5 minutes
    '15m': number;   // requests in last 15 minutes
    '1h': number;    // requests in last 1 hour
  };
  failedLogins: number;
  last404s: number;
  lastSeen: Date;
  suspicionScore: number;
  flaggedAt?: Date;
  flagReason?: string;
}

const IPTrackerSchema: Schema = new Schema({
  ip: { type: String, required: true, unique: true, index: true },
  windows: {
    '1m':  { type: Number, default: 0 },
    '5m':  { type: Number, default: 0 },
    '15m': { type: Number, default: 0 },
    '1h':  { type: Number, default: 0 },
  },
  failedLogins: { type: Number, default: 0 },
  last404s: { type: Number, default: 0 },
  lastSeen: { type: Date, default: Date.now, index: true },
  suspicionScore: { type: Number, default: 0, index: true },
  flaggedAt: { type: Date },
  flagReason: { type: String },
}, { timestamps: true });

// TTL: auto-clean entries not seen in 24 hours
IPTrackerSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model<IIPTracker>('IPTracker', IPTrackerSchema);
