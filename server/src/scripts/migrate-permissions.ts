/**
 * One-off migration: backfills the new `permissions` field on every existing
 * User document based on their current role, using the same defaults the
 * app now seeds for brand-new accounts (see src/config/permissions.ts).
 *
 * Safe to re-run: by default it only touches users that have NO permissions
 * yet (empty array / missing field), so it will never clobber grants an
 * admin has already customised through the UI.
 *
 * Usage (from the server/ directory):
 *   npx tsx src/scripts/migrate-permissions.ts
 *
 * Flags:
 *   --force   Re-apply role defaults to EVERY user, overwriting any custom
 *             grants an admin previously made. Use with care.
 *   --dry-run Print what would change without writing to the database.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.model';
import { getDefaultPermissionsForRole } from '../config/permissions';
import logger from '../utils/logger';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/acetel_ims';

async function migrate() {
  const force = process.argv.includes('--force');
  const dryRun = process.argv.includes('--dry-run');

  logger.info(`🔧 Permission migration starting (force=${force}, dryRun=${dryRun})`);
  await mongoose.connect(MONGODB_URI);

  const query = force ? {} : { $or: [{ permissions: { $exists: false } }, { permissions: { $size: 0 } }] };
  const users = await User.find(query).select('_id email role permissions');

  logger.info(`Found ${users.length} user(s) to update.`);

  let updated = 0;
  for (const user of users) {
    const defaults = getDefaultPermissionsForRole(user.role);
    if (dryRun) {
      logger.info(`[dry-run] ${user.email} (${user.role}) → [${defaults.join(', ')}]`);
      continue;
    }
    await User.updateOne({ _id: user._id }, { $set: { permissions: defaults } });
    updated++;
  }

  logger.info(dryRun ? '✅ Dry run complete — no changes written.' : `✅ Updated ${updated} user(s).`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  logger.error('❌ Permission migration failed: %s', err.message);
  process.exit(1);
});
