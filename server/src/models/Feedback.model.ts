import mongoose, { Schema, Document } from 'mongoose';

export interface IFeedbackResponse {
  user: mongoose.Types.ObjectId;
  message: string;
  createdAt: Date;
}

export interface IFeedback extends Document {
  user: mongoose.Types.ObjectId;
  tenant: mongoose.Types.ObjectId;
  subject: string;
  category: 'Logbook' | 'Placement' | 'Technical' | 'Support' | 'Academic';
  message: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Open' | 'Assigned' | 'Closed';
  responses: IFeedbackResponse[];
  assignedTo?: mongoose.Types.ObjectId;
  programme?: mongoose.Types.ObjectId;
  satisfactionRating?: number;
  satisfactionComment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema: Schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  subject: { type: String, required: true, maxlength: 200 },
  category: {
    type: String, required: true,
    enum: ['Logbook', 'Placement', 'Technical', 'Support', 'Academic']
  },
  message: { type: String, required: true, maxlength: 4000 },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
  status: { type: String, required: true, enum: ['Open', 'Assigned', 'Closed'], default: 'Open' },
  responses: [{
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, maxlength: 4000 },
    createdAt: { type: Date, default: Date.now }
  }],
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  programme: { type: Schema.Types.ObjectId, ref: 'Programme' },
  satisfactionRating: { type: Number, min: 1, max: 5 },
  satisfactionComment: { type: String, maxlength: 500 },
}, { timestamps: true });

FeedbackSchema.index({ tenant: 1, status: 1, createdAt: -1 });
FeedbackSchema.index({ user: 1, tenant: 1 });

export default mongoose.model<IFeedback>('Feedback', FeedbackSchema);
