/**
 * One-off migration: backfills `session` and `attendanceDate` on Attendance
 * records created before dual (morning/afternoon) sessions were introduced.
 *
 * IMPORTANT — run this BEFORE the app boots with the new Attendance model,
 * since Attendance.model.ts now declares a unique index on
 * (student, attendanceDate, session). Under the old one-check-in-per-day
 * design there was at most one record per student per calendar day, so
 * backfilling every legacy record as 'morning' is always collision-safe —
 * no two pre-migration records for the same student ever share a day.
 *
 * Usage (from the server/ directory):
 *   npx tsx src/scripts/migrate-attendance-sessions.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Attendance from '../models/Attendance.model';
import logger from '../utils/logger';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/acetel_ims';

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function migrate() {
  logger.info('🔧 Attendance session migration starting');
  await mongoose.connect(MONGODB_URI);

  // Drop the old (student, checkInTime) unique constraints if any exist under a stale
  // name, and make sure we never try to build the new unique index before backfilling.
  const collection = mongoose.connection.collection('attendances');
  const indexes = await collection.indexes();
  const newIndexName = indexes.find((i) => i.name === 'student_1_attendanceDate_1_session_1');
  if (newIndexName) {
    logger.info('Dropping existing (student, attendanceDate, session) index before backfill...');
    await collection.dropIndex('student_1_attendanceDate_1_session_1').catch(() => {});
  }

  const legacy = await Attendance.find({
    $or: [{ session: { $exists: false } }, { attendanceDate: { $exists: false } }],
  }).select('_id checkInTime');

  logger.info(`Found ${legacy.length} legacy attendance record(s) to backfill.`);

  let updated = 0;
  for (const rec of legacy) {
    await Attendance.updateOne(
      { _id: rec._id },
      { $set: { session: 'morning', attendanceDate: dateKey(rec.checkInTime) } }
    );
    updated++;
  }

  logger.info(`✅ Backfilled ${updated} record(s). Rebuilding indexes...`);
  await Attendance.syncIndexes();

  logger.info('✅ Attendance session migration complete.');
  await mongoose.disconnect();
}

migrate().catch((err) => {
  logger.error('❌ Attendance session migration failed: %s', err.message);
  process.exit(1);
});
