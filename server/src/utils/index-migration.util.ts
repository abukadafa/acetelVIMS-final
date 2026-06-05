import mongoose from 'mongoose';
import User from '../models/User.model';
import Student from '../models/Student.model';
import logger from './logger';

const LEGACY_DROPS: { collection: string; names: string[] }[] = [
  { collection: 'users', names: ['email_1', 'username_1'] },
  { collection: 'students', names: ['matricNumber_1'] },
];

export async function migrateLegacyIndexes(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  for (const { collection, names } of LEGACY_DROPS) {
    try {
      const coll = db.collection(collection);
      const existing = await coll.indexes();
      for (const name of names) {
        if (existing.some((idx) => idx.name === name)) {
          await coll.dropIndex(name);
          logger.info('Dropped legacy index %s on %s', name, collection);
        }
      }
    } catch (err) {
      logger.warn('Legacy index drop skipped for %s: %s', collection, (err as Error).message);
    }
  }

  try {
    await User.syncIndexes();
    await Student.syncIndexes();
    logger.info('User and Student indexes synchronized');
  } catch (err) {
    logger.warn('Index sync warning: %s', (err as Error).message);
  }
}
