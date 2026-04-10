import mongoose, { Schema, Document } from 'mongoose';

export interface IFeedbackResponse {
  user: any;
  message: string;
  createdAt: Date;
}

export interface IFeedback extends Document {
  user: mongoose.Types.ObjectId;
  tenant: mongoose.Types.ObjectId;
  subject: string;
  category: 'Logbook' | 'Placement' | 'Technical' | 'Support' | 'Academic';
  message: string;
  status: 'Open' | 'Assigned' | 'Closed';
  responses: IFeedbackResponse[];
  assignedTo?: mongoose.Types.ObjectId;
  programme?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema: Schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  subject: { type: String, required: true },
  category: { 
    type: String, 
    required: true, 
    enum: ['Logbook', 'Placement', 'Technical', 'Support', 'Academic'] 
  },
  message: { type: String, required: true },
  status: { 
    type: String, 
    required: true, 
    enum: ['Open', 'Assigned', 'Closed'], 
    default: 'Open' 
  },
  responses: [{
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  programme: { type: Schema.Types.ObjectId, ref: 'Programme' }
}, {
  timestamps: true
});

export default mongoose.model<IFeedback>('Feedback', FeedbackSchema);
