import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.model';
import Student from './models/Student.model';
import Programme from './models/Programme.model';
import Company from './models/Company.model';
import Logbook from './models/Logbook.model';
import Attendance from './models/Attendance.model';
import Setting from './models/Setting.model';
import Tenant from './models/Tenant.model';
import logger from './utils/logger';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/acetel_ims';

async function seed() {
  try {
    logger.info('🌱 Starting ACETEL IMS Idempotent Seeding...');
    await mongoose.connect(MONGODB_URI);
    
    // 1. Ensure ACETEL tenant exists
    let tenant = await Tenant.findOneAndUpdate(
      { slug: 'acetel' },
      { $setOnInsert: { name: 'ACETEL', slug: 'acetel', institutionType: 'University' } },
      { upsert: true, new: true }
    );
    const tenantId = tenant!._id;

    const plainPassword = process.env.ADMIN_PASSWORD || 'Acetel@2024';

    // 2. Synchronize Programmes
    const programmesData = [
      { code: 'MSC-AI', name: 'MSc Artificial Intelligence', level: 'MSc', tenant: tenantId, isActive: true },
      { code: 'MSC-CYB', name: 'MSc Cybersecurity', level: 'MSc', tenant: tenantId, isActive: true },
      { code: 'MSC-MIS', name: 'MSc Management Information Systems', level: 'MSc', tenant: tenantId, isActive: true },
      { code: 'PHD-AI', name: 'PhD Artificial Intelligence', level: 'PhD', tenant: tenantId, isActive: true },
      { code: 'PHD-CYB', name: 'PhD Cybersecurity', level: 'PhD', tenant: tenantId, isActive: true },
      { code: 'PHD-MIS', name: 'PhD Management Information Systems', level: 'PhD', tenant: tenantId, isActive: true },
    ];

    for (const prog of programmesData) {
      await Programme.findOneAndUpdate({ code: prog.code, tenant: tenantId }, { $set: prog }, { upsert: true });
    }
    const programmes = await Programme.find({ tenant: tenantId });
    logger.info('✅ Programmes synchronized');

    // 3. Synchronize Core Users
    const coreUsers = [
      { email: process.env.ADMIN_EMAIL || 'admin@acetel.ng', username: 'admin', password: plainPassword, role: 'admin', firstName: 'ACETEL', lastName: 'Administrator', tenant: tenantId, isActive: true },
      { email: 'internship@acetel.ng', username: 'internship', password: plainPassword, role: 'internship_coordinator', firstName: 'IMS', lastName: 'Coordinator', tenant: tenantId, isActive: true },
      { email: 'prog_coordinator@acetel.ng', username: 'prog_coordinator', password: plainPassword, role: 'prog_coordinator', firstName: 'Dept', lastName: 'Head', tenant: tenantId, isActive: true },
    ];

    for (const userData of coreUsers) {
      const existing = await User.findOne({ email: userData.email });
      if (!existing) {
        await User.create(userData); // Use create to trigger pre-save hashing
      } else {
        // Update basic info but don't force reset password unless explicitly requested
        await User.updateOne({ _id: existing._id }, { $set: { role: userData.role, firstName: userData.firstName, lastName: userData.lastName } });
      }
    }
    logger.info('✅ Core users synchronized');

    // 4. Synchronize Supervisors
    const supervisorData = [
      { email: 'emeka@acetel.ng', username: 'emeka', password: plainPassword, role: 'supervisor', firstName: 'Emeka', lastName: 'Okonkwo', tenant: tenantId, isActive: true },
      { email: 'aisha@acetel.ng', username: 'aisha', password: plainPassword, role: 'supervisor', firstName: 'Aisha', lastName: 'Bello', tenant: tenantId, isActive: true },
      { email: 'tunde@acetel.ng', username: 'tunde', password: plainPassword, role: 'supervisor', firstName: 'Tunde', lastName: 'Adeyemi', tenant: tenantId, isActive: true },
    ];

    for (const sData of supervisorData) {
      if (!(await User.findOne({ email: sData.email }))) {
        await User.create(sData);
      }
    }
    const supervisors = await User.find({ role: 'supervisor', tenant: tenantId });
    logger.info('✅ Supervisors synchronized');

    // 5. Synchronize Companies
    const companiesData = [
        { name: 'NITDA Nigeria', address: 'Area 11, Garki, Abuja', lga: 'Garki', state: 'FCT', sector: 'Government', lat: 9.0494, lng: 7.4877, isApproved: true },
        { name: 'MTN Nigeria HQ', address: 'Ikoyi, Lagos', lga: 'Lagos', state: 'Lagos', sector: 'Telecommunications', lat: 6.4526, lng: 3.4243, isApproved: true },
        { name: 'Shell Nigeria', address: 'Port Harcourt', lga: 'PH', state: 'Rivers', sector: 'Energy', lat: 4.8156, lng: 7.0498, isApproved: true },
        { name: 'Interswitch Group', address: 'Victoria Island, Lagos', lga: 'Lagos', state: 'Lagos', sector: 'Fintech', lat: 6.4281, lng: 3.4219, isApproved: true },
    ];

    for (const cData of companiesData) {
      await Company.findOneAndUpdate({ name: cData.name }, { $set: cData }, { upsert: true });
    }
    const companies = await Company.find({ isApproved: true });
    logger.info('✅ Companies synchronized');

    // 6. Synchronize Sample Students (One per programme)
    for (const prog of programmes) {
      const studentEmail = `${prog.code.toLowerCase()}@student.ng`;
      let user = await User.findOne({ email: studentEmail });
      
      if (!user) {
        user = await User.create({
          email: studentEmail,
          username: studentEmail.split('@')[0],
          password: plainPassword,
          role: 'student',
          firstName: prog.code.split('-')[1],
          lastName: 'Student',
          tenant: tenantId,
          isActive: true
        });
      }

      let student = await Student.findOne({ user: user._id });
      if (!student) {
        student = await Student.create({
          user: user._id,
          tenant: tenantId,
          matricNumber: `NOUN/${prog.code}/2024/${Math.floor(1000 + Math.random() * 999)}`,
          programme: prog._id,
          company: companies[Math.floor(Math.random() * companies.length)]._id,
          supervisor: supervisors[Math.floor(Math.random() * supervisors.length)]._id,
          academicSession: '2024/2025',
          status: 'active',
          lat: 9.0 + (Math.random() - 0.5),
          lng: 7.4 + (Math.random() - 0.5)
        });
      }
    }
    logger.info('✅ Sample students synchronized');

    // 7. Synchronize Settings
    const settingsData = [
      { key: 'academic_session', value: '2024/2025', tenant: tenantId },
      { key: 'system_name', value: 'ACETEL Internship Management System', tenant: tenantId },
      { key: 'institution', value: 'National Open University of Nigeria (NOUN)', tenant: tenantId },
    ];

    for (const s of settingsData) {
      await Setting.findOneAndUpdate({ key: s.key, tenant: tenantId }, { $set: s }, { upsert: true });
    }
    logger.info('✅ Settings synchronized');

    logger.info('🌱 Seeding/Sync complete!');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Seeding failed: %s', (err as Error).message);
    process.exit(1);
  }
}

seed();
