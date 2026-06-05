import mongoose from 'mongoose';
import User from '../models/User.model';
import Tenant from '../models/Tenant.model';
import logger from './logger';

export async function getDefaultTenantId(): Promise<string> {
  const tenant = await Tenant.findOne({ slug: 'acetel' });
  if (!tenant) {
    throw new Error('Default ACETEL tenant not found');
  }
  return (tenant._id as mongoose.Types.ObjectId).toString();
}

/** Ensure a user record has a valid tenant ObjectId; backfill from default if missing. */
export async function resolveUserTenantId(user: { _id: mongoose.Types.ObjectId; tenant?: mongoose.Types.ObjectId }): Promise<string> {
  if (user.tenant && mongoose.Types.ObjectId.isValid(user.tenant.toString())) {
    return user.tenant.toString();
  }
  const tenantId = await getDefaultTenantId();
  await User.findByIdAndUpdate(user._id, { tenant: tenantId });
  logger.warn('Backfilled missing tenant for user %s', user._id);
  return tenantId;
}
