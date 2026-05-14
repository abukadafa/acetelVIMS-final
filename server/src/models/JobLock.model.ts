import mongoose, { Schema, Document } from 'mongoose';

export interface IJobLock extends Document {
  jobName: string;
  lockedAt: Date;
  expiresAt: Date;
  lastRunSuccess: boolean;
}

const JobLockSchema: Schema = new Schema({
  jobName: { type: String, required: true, unique: true },
  lockedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  lastRunSuccess: { type: Boolean, default: false }
});

export default mongoose.model<IJobLock>('JobLock', JobLockSchema);
