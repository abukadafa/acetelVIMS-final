import mongoose from 'mongoose';
import Programme from './src/models/Programme.model';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const programmes = [
  { code: 'MAI', name: 'MSc Artificial Intelligence', level: 'MSc', durationMonths: 18 },
  { code: 'MCS', name: 'MSc Cyber Security', level: 'MSc', durationMonths: 18 },
  { code: 'MMI', name: 'MSc Management Information Systems', level: 'MSc', durationMonths: 18 },
  { code: 'PAI', name: 'PhD Artificial Intelligence', level: 'PhD', durationMonths: 36 },
  { code: 'PCS', name: 'PhD Cyber Security', level: 'PhD', durationMonths: 36 },
  { code: 'PMI', name: 'PhD Management Information Systems', level: 'PhD', durationMonths: 36 },
];

async function seed() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/acetel-ims';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB for seeding...');

    for (const p of programmes) {
      await Programme.findOneAndUpdate(
        { code: p.code },
        p,
        { upsert: true, new: true }
      );
      console.log(`Seeded: ${p.name} (${p.code})`);
    }

    console.log('Institutional seeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
