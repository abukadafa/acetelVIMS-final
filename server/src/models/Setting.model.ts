import mongoose, { Schema, Document } from 'mongoose';

export interface ISetting extends Document {
  tenant: mongoose.Types.ObjectId;
  key: string;
  value: string;
  description?: string;
}

const SettingSchema: Schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  key: { type: String, required: true },
  value: { type: String, required: true },
  description: { type: String }
}, {
  timestamps: true
});

// Ensure key is unique per tenant
SettingSchema.index({ tenant: 1, key: 1 }, { unique: true });

export default mongoose.model<ISetting>('Setting', SettingSchema);
