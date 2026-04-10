import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './User.model';
import Tenant from './Tenant.model';
import logger from '../utils/logger';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/acetel_ims';

export async function initDatabase(): Promise<void> {
  const options: mongoose.ConnectOptions = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4, // Use IPv4, skip trying IPv6
  };

  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(MONGODB_URI, options);
    logger.info('✅ Connected to MongoDB successfully');
    
    // Seed default data if needed
    await seedProgrammes();
    await seedSettings();
    await seedAdmin();
  } catch (error) {
    logger.error('❌ MongoDB connection error: %s', (error as Error).message);
    process.exit(1);
  }
}

// Seed Programmes directly as Mongoose objects aren't defined yet, 
// using the connection to check collection state
async function seedProgrammes() {
  const Programme = mongoose.connection.collection('programmes');
  const count = await Programme.countDocuments();
  
  if (count === 0) {
    const programmes = [
      { code: 'MSC-AI', name: 'MSc Artificial Intelligence', level: 'MSc' },
      { code: 'MSC-CYB', name: 'MSc Cybersecurity', level: 'MSc' },
      { code: 'MSC-MIS', name: 'MSc Management Information Systems', level: 'MSc' },
      { code: 'PHD-AI', name: 'PhD Artificial Intelligence', level: 'PhD' },
      { code: 'PHD-CYB', name: 'PhD Cybersecurity', level: 'PhD' },
      { code: 'PHD-MIS', name: 'PhD Management Information Systems', level: 'PhD' },
    ];
    await Programme.insertMany(programmes);
    logger.info('🌱 Programmemes seeded');
  }
}

async function seedSettings() {
  const Setting = mongoose.connection.collection('settings');
  const count = await Setting.countDocuments();
  
  if (count === 0) {
    const settings = [
      { key: 'academic_session', value: '2024/2025', description: 'Current academic session' },
      { key: 'internship_start', value: '2025-01-01', description: 'Internship start date' },
      { key: 'internship_end', value: '2025-06-30', description: 'Internship end date' },
      { key: 'logbook_deadline_day', value: '7', description: 'Day of week for logbook submission (1=Monday)' },
      { key: 'attendance_radius_km', value: '0.5', description: 'Max distance from company for valid check-in (km)' },
      { key: 'system_name', value: 'ACETEL Internship Management System', description: 'System display name' },
      { key: 'institution', value: 'National Open University of Nigeria (NOUN)', description: 'Institution name' },
      { key: 'centre', 'value': 'African Centre of Excellence for Technology Enhanced Learning (ACETEL)', description: 'Centre name' },
    ];
    await Setting.insertMany(settings);
    logger.info('🌱 Settings seeded');
  }
}

async function seedAdmin() {
  const adminEmail = 'admin@acetel.ng';
  
  let tenant = await Tenant.findOne({ slug: 'acetel' });
  if (!tenant) {
    tenant = new Tenant({ name: 'ACETEL', slug: 'acetel', institutionType: 'University' });
    await tenant.save();
  }

  const count = await User.countDocuments({ email: adminEmail });
  
  if (count === 0) {
    const admin = new User({
      email: adminEmail,
      password: 'password123',
      role: 'admin',
      firstName: 'System',
      lastName: 'Administrator',
      tenant: tenant._id,
      isActive: true,
      username: 'admin'
    });
    
    // Using save will trigger the pre-save hook to hash 'password123'
    await admin.save();
    logger.warn('🗝️ Default Admin seeded! Email: admin@acetel.ng | Password: password123');
  }
}
