import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './models/User.model';
import Student from './models/Student.model';
import Programme from './models/Programme.model';
import Company from './models/Company.model';
import Logbook from './models/Logbook.model';
import Attendance from './models/Attendance.model';
import Setting from './models/Setting.model';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/acetel_ims';

async function seed() {
  try {
    console.log('🌱 Starting ACETEL IMS Mongoose Seeding...');
    await mongoose.connect(MONGODB_URI);
    
    // Clear existing data (Optional for fresh seed)
    const collections = Object.keys(mongoose.connection.collections);
    for (const collectionName of collections) {
      await mongoose.connection.collections[collectionName].deleteMany({});
    }
    console.log('🧹 Database cleared');

    const hash = await bcrypt.hash('Acetel@2024', 12);

    // 1. Create Programmes
    const programmesData = [
      { code: 'MSC-AI', name: 'MSc Artificial Intelligence', level: 'MSc' },
      { code: 'MSC-CYB', name: 'MSc Cybersecurity', level: 'MSc' },
      { code: 'MSC-MIS', name: 'MSc Management Information Systems', level: 'MSc' },
      { code: 'PHD-AI', name: 'PhD Artificial Intelligence', level: 'PhD' },
      { code: 'PHD-CYB', name: 'PhD Cybersecurity', level: 'PhD' },
      { code: 'PHD-MIS', name: 'PhD Management Information Systems', level: 'PhD' },
    ];
    const programmes = await Programme.insertMany(programmesData);
    console.log('✅ Programmes created');

    // 2. Create Users
    const admin = new User({ email: 'admin@acetel.ng', password: hash, role: 'admin', firstName: 'ACETEL', lastName: 'Administrator' });
    const internshipCoord = new User({ email: 'internship@acetel.ng', password: hash, role: 'internship_coordinator', firstName: 'IMS', lastName: 'Coordinator' });
    const progCoord = new User({ email: 'prog_coordinator@acetel.ng', password: hash, role: 'prog_coordinator', firstName: 'Dept', lastName: 'Head' });
    
    await admin.save();
    await internshipCoord.save();
    await progCoord.save();

    // 3. Create Supervisors
    const supervisors = await User.insertMany([
      { email: 'emeka@acetel.ng', password: hash, role: 'supervisor', firstName: 'Emeka', lastName: 'Okonkwo' },
      { email: 'aisha@acetel.ng', password: hash, role: 'supervisor', firstName: 'Aisha', lastName: 'Bello' },
      { email: 'tunde@acetel.ng', password: hash, role: 'supervisor', firstName: 'Tunde', lastName: 'Adeyemi' },
    ]);
    console.log('✅ Supervisors created');

    // 4. Create Companies
    const companiesData = [
        { name: 'NITDA Nigeria', address: 'Area 11, Garki, Abuja', lga: 'Garki', state: 'FCT', sector: 'Government', lat: 9.0494, lng: 7.4877, isApproved: true },
        { name: 'MTN Nigeria HQ', address: 'Ikoyi, Lagos', lga: 'Lagos', state: 'Lagos', sector: 'Telecommunications', lat: 6.4526, lng: 3.4243, isApproved: true },
        { name: 'Shell Nigeria', address: 'Port Harcourt', lga: 'PH', state: 'Rivers', sector: 'Energy', lat: 4.8156, lng: 7.0498, isApproved: true },
        { name: 'Interswitch Group', address: 'Victoria Island, Lagos', lga: 'Lagos', state: 'Lagos', sector: 'Fintech', lat: 6.4281, lng: 3.4219, isApproved: true },
    ];
    const companies = await Company.insertMany(companiesData);
    console.log('✅ Companies created');

    // 5. Create Students & Logs
    for (const prog of programmes) {
      const studentUser = new User({
        email: `${prog.code.toLowerCase()}@student.ng`,
        password: hash,
        role: 'student',
        firstName: prog.code.split('-')[1],
        lastName: 'Student'
      });
      await studentUser.save();

      const student = new Student({
        user: studentUser._id,
        matricNumber: `NOUN/${prog.code}/2024/${Math.floor(1000 + Math.random() * 9000)}`,
        programme: prog._id,
        company: companies[Math.floor(Math.random() * companies.length)]._id,
        supervisor: supervisors[Math.floor(Math.random() * supervisors.length)]._id,
        academicSession: '2024/2025',
        status: 'active',
        lat: 9.0 + (Math.random() - 0.5),
        lng: 7.4 + (Math.random() - 0.5)
      });
      await student.save();

      // Attendance & Logbooks
      for (let i = 0; i < 5; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        await new Attendance({ student: student._id, checkInTime: date, isValid: true }).save();
        await new Logbook({
          student: student._id,
          entryDate: date,
          activities: `Completed tasks related to ${prog.name} specialization module ${i+1}.`,
          status: 'approved',
          supervisorRating: Math.floor(Math.random() * 5) + 6
        }).save();
      }
    }

    // 6. Seed Settings
    await Setting.insertMany([
      { key: 'academic_session', value: '2024/2025' },
      { key: 'system_name', value: 'ACETEL Internship Management System' },
      { key: 'institution', value: 'National Open University of Nigeria (NOUN)' },
    ]);

    console.log('✅ Seeding complete!');
    console.log(`
      🚀 ACCESS CREDENTIALS:
      - Admin: admin@acetel.ng / Acetel@2024
      - Internship Coordinator: internship@acetel.ng / Acetel@2024
      - Prog Coordinator: prog_coordinator@acetel.ng / Acetel@2024
      - Student: msc-ai@student.ng / Acetel@2024 
    `);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();
