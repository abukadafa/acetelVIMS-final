import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './User.model';
import Tenant from './Tenant.model';
import Programme from './Programme.model';
import Setting from './Setting.model';
import logger from '../utils/logger';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/acetel_ims';

export async function initDatabase(): Promise<void> {
  const options: mongoose.ConnectOptions = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
  };

  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(MONGODB_URI, options);
    logger.info('✅ Connected to MongoDB successfully');
    
    // Ensure default ACETEL tenant exists
    let tenant = await Tenant.findOneAndUpdate(
      { slug: 'acetel' },
      { $setOnInsert: { name: 'ACETEL', slug: 'acetel', institutionType: 'University' } },
      { upsert: true, new: true }
    );

    if (!tenant) {
      throw new Error('Failed to ensure tenant existence');
    }

    // Seed default data for this tenant
    await seedProgrammes(tenant._id as mongoose.Types.ObjectId);
    await seedSettings(tenant._id as mongoose.Types.ObjectId);
    await ensureAdminExists(tenant._id as mongoose.Types.ObjectId);
  } catch (error) {
    logger.error('❌ MongoDB connection error: %s', (error as Error).message);
    process.exit(1);
  }
}

/**
 * Ensures at least one admin exists in the database.
 * If missing, creates one using environment variables.
 */
async function ensureAdminExists(tenantId: mongoose.Types.ObjectId) {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@acetel.ng').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Acetel@2024';

  let admin = await User.findOne({ email: adminEmail });

  if (!admin) {
    logger.warn('⚠️ No admin user found. Creating default admin from environment variables...');
    await User.create({
      email: adminEmail,
      username: 'admin',
      password: adminPassword,
      role: 'admin',
      firstName: 'System',
      lastName: 'Administrator',
      tenant: tenantId,
      isActive: true
    });
    logger.info('✅ Default admin created: %s', adminEmail);
  } else if (process.env.RESET_ADMIN === 'true') {
    logger.warn('🔄 Force-resetting admin password (RESET_ADMIN=true)...');
    admin.password = adminPassword;
    admin.isActive = true;
    await admin.save();
    logger.info('✅ Admin password reset successful: %s', adminEmail);
  } else {
    // Verify the stored password matches env — auto-fix if admin was created with wrong password
    const bcrypt = require('bcryptjs');
    const matches = await bcrypt.compare(adminPassword, admin.password);
    if (!matches) {
      logger.warn('🔄 Admin password in DB does not match ADMIN_PASSWORD env var — updating...');
      admin.password = adminPassword;
      admin.isActive = true;
      await admin.save();
      logger.info('✅ Admin password synced to env var for: %s', adminEmail);
    } else {
      logger.info('✅ Admin user exists and password matches: %s', admin.email);
    }
  }
}

// Seed Programmes (Idempotent)
async function seedProgrammes(tenantId: mongoose.Types.ObjectId) {
  const programmes = [
    { code: 'MSC-AI', name: 'MSc Artificial Intelligence', level: 'MSc', tenant: tenantId, isActive: true },
    { code: 'MSC-CYB', name: 'MSc Cybersecurity', level: 'MSc', tenant: tenantId, isActive: true },
    { code: 'MSC-MIS', name: 'MSc Management Information Systems', level: 'MSc', tenant: tenantId, isActive: true },
    { code: 'PHD-AI', name: 'PhD Artificial Intelligence', level: 'PhD', tenant: tenantId, isActive: true },
    { code: 'PHD-CYB', name: 'PhD Cybersecurity', level: 'PhD', tenant: tenantId, isActive: true },
    { code: 'PHD-MIS', name: 'PhD Management Information Systems', level: 'PhD', tenant: tenantId, isActive: true },
  ];

  for (const prog of programmes) {
    await Programme.findOneAndUpdate(
      { code: prog.code, tenant: tenantId },
      { $set: prog },
      { upsert: true }
    );
  }
  logger.info('🌱 Programmes synchronized');
}

// Seed Settings (Idempotent)
async function seedSettings(tenantId: mongoose.Types.ObjectId) {
  const settings = [
    { key: 'academic_session', value: '2024/2025', description: 'Current academic session', tenant: tenantId },
    { key: 'internship_start', value: '2025-01-01', description: 'Internship start date', tenant: tenantId },
    { key: 'internship_end', value: '2025-06-30', description: 'Internship end date', tenant: tenantId },
    { key: 'logbook_deadline_day', value: '7', description: 'Day of week for logbook submission (1=Monday)', tenant: tenantId },
    { key: 'attendance_radius_km', value: '0.5', description: 'Max distance from company for valid check-in (km)', tenant: tenantId },
    { key: 'system_name', value: 'ACETEL Internship Management System', description: 'System display name', tenant: tenantId },
    { key: 'institution', value: 'National Open University of Nigeria (NOUN)', description: 'Institution name', tenant: tenantId },
    { key: 'centre', value: 'African Centre of Excellence for Technology Enhanced Learning (ACETEL)', description: 'Centre name', tenant: tenantId },
  ];

  for (const setting of settings) {
    await Setting.findOneAndUpdate(
      { key: setting.key, tenant: tenantId },
      { $set: setting },
      { upsert: true }
    );
  }
  logger.info('🌱 Settings synchronized');
}
