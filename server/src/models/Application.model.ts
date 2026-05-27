import mongoose, { Schema, Document } from 'mongoose';

export interface IApplication extends Document {
  student: mongoose.Types.ObjectId;
  company: mongoose.Types.ObjectId;
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected';
  coverLetter?: string;
  documents?: string[];
  reviewedBy?: mongoose.Types.ObjectId;
  reviewNotes?: string;
  appliedAt: Date;
  updatedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>({
  student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  status: { 
    type: String, 
    enum: ['pending', 'reviewed', 'accepted', 'rejected'], 
    default: 'pending' 
  },
  coverLetter: String,
  documents: [String],
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewNotes: String,
  appliedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model<IApplication>('Application', ApplicationSchema);
