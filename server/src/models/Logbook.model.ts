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

  // Academic supervisor (school-side) review
  supervisorComment?: string;
  supervisorRating?: number;
  isSupervisorSigned: boolean;
  supervisorSignedAt?: Date;

  // Industry supervisor (company-side) review — NEW
  industrySupervisorId?: mongoose.Types.ObjectId;
  industrySupervisorComment?: string;
  industrySupervisorRating?: number;
  isIndustrySigned: boolean;
  industrySignedAt?: Date;

  // Final submission to school — requires both signatures
  finalSubmittedAt?: Date;
  finalSubmittedBy?: mongoose.Types.ObjectId;

  status: 'draft' | 'submitted' | 'industry_reviewed' | 'approved' | 'rejected' | 'revision_requested' | 'final_submitted';
  isOfflineSync: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LogbookSchema: Schema = new Schema({
  student:   { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  tenant:    { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  entryDate: { type: Date, required: true },
  weekNumber:{ type: Number, required: true },
  activities:{ type: String, required: true, maxlength: 5000 },
  toolsUsed: { type: String, maxlength: 500 },
  skillsLearned: { type: String, maxlength: 1000 },
  challenges:{ type: String, maxlength: 1000 },
  solutions: { type: String, maxlength: 1000 },
  attachments: [{ type: String }],

  // Academic supervisor
  supervisorComment:  { type: String, maxlength: 2000 },
  supervisorRating:   { type: Number, min: 1, max: 5 },
  isSupervisorSigned: { type: Boolean, default: false },
  supervisorSignedAt: { type: Date },

  // Industry supervisor
  industrySupervisorId:      { type: Schema.Types.ObjectId, ref: 'User' },
  industrySupervisorComment: { type: String, maxlength: 2000 },
  industrySupervisorRating:  { type: Number, min: 1, max: 5 },
  isIndustrySigned:          { type: Boolean, default: false },
  industrySignedAt:          { type: Date },

  // Final submission
  finalSubmittedAt: { type: Date },
  finalSubmittedBy: { type: Schema.Types.ObjectId, ref: 'User' },

  status: {
    type: String,
    enum: ['draft', 'submitted', 'industry_reviewed', 'approved', 'rejected', 'revision_requested', 'final_submitted'],
    default: 'draft',
  },
  isOfflineSync: { type: Boolean, default: false },
}, { timestamps: true });

LogbookSchema.index({ student: 1, entryDate: 1 });
LogbookSchema.index({ student: 1, status: 1 });
LogbookSchema.index({ industrySupervisorId: 1, status: 1 });
LogbookSchema.index({ tenant: 1, status: 1 });

export default mongoose.model<ILogbookEntry>('Logbook', LogbookSchema);
