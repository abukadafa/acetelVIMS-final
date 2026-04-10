import mongoose, { Schema, Document } from 'mongoose';

export interface ILogbookEntry extends Document {
  student: mongoose.Types.ObjectId;
  tenant: mongoose.Types.ObjectId;
  entryDate: Date;
  weekNumber: number;
  activities: string;
  toolsUsed?: string;
  skillsLearned?: string;
  challenges?: string;
  solutions?: string;
  attachments?: string[];
  supervisorComment?: string;
  supervisorRating?: number;
  isSupervisorSigned: boolean;
  supervisorSignedAt?: Date;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  isOfflineSync: boolean;
}

const LogbookSchema: Schema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  entryDate: { type: Date, required: true },
  weekNumber: { type: Number, required: true },
  activities: { type: String, required: true },
  toolsUsed: { type: String },
  skillsLearned: { type: String },
  challenges: { type: String },
  solutions: { type: String },
  attachments: [{ type: String }],
  supervisorComment: { type: String },
  supervisorRating: { type: Number, min: 1, max: 5 },
  isSupervisorSigned: { type: Boolean, default: false },
  supervisorSignedAt: { type: Date },
  status: { 
    type: String, 
    enum: ['draft', 'submitted', 'approved', 'rejected'],
    default: 'draft'
  },
  isOfflineSync: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Index for performance
LogbookSchema.index({ student: 1, entryDate: 1 });
LogbookSchema.index({ status: 1 });

export default mongoose.model<ILogbookEntry>('Logbook', LogbookSchema);
