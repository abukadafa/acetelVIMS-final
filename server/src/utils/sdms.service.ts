import mongoose from 'mongoose';

/**
 * Service to interface with the existing ACETEL Student Database Management System (SDMS).
 * In a real scenario, this would connect to a secondary MongoDB instance.
 * For this implementation, we provide a mock lookup that simulates the fetch.
 */

export interface SDMSData {
  matricNumber: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  programme: string;
  programmeName?: string;
  level?: string;
  email: string;
}

const MOCK_SDMS_DATA: Record<string, SDMSData> = {
  'STU/2024/001': {
    matricNumber: 'STU/2024/001',
    firstName: 'John',
    lastName: 'Doe',
    otherNames: 'Okon',
    programme: 'MSC-AI',
    programmeName: 'MSc Artificial Intelligence',
    level: 'MSc',
    email: 'john.doe@example.com'
  },
  'STU/2024/002': {
    matricNumber: 'STU/2024/002',
    firstName: 'Jane',
    lastName: 'Smith',
    otherNames: 'Ada',
    programme: 'MSC-CYB',
    programmeName: 'MSc Cybersecurity',
    level: 'MSc',
    email: 'jane.smith@example.com'
  },
  'STU/2024/003': {
    matricNumber: 'STU/2024/003',
    firstName: 'Musa',
    lastName: 'Ibrahim',
    otherNames: 'Kola',
    programme: 'MSC-MIS',
    programmeName: 'MSc Management Information System',
    level: 'MSc',
    email: 'musa.ibrahim@example.com'
  },
  'STU/2024/004': {
    matricNumber: 'STU/2024/004',
    firstName: 'Amaka',
    lastName: 'Okafor',
    programme: 'PHD-AI',
    programmeName: 'PhD Artificial Intelligence',
    level: 'PhD',
    email: 'amaka.okafor@example.com'
  },
  'STU/2024/005': {
    matricNumber: 'STU/2024/005',
    firstName: 'Emeka',
    lastName: 'Nwosu',
    programme: 'PHD-CYB',
    programmeName: 'PhD Cybersecurity',
    level: 'PhD',
    email: 'emeka.nwosu@example.com'
  },
  'STU/2024/006': {
    matricNumber: 'STU/2024/006',
    firstName: 'Fatima',
    lastName: 'Aliyu',
    programme: 'PHD-MIS',
    programmeName: 'PhD Management Information System',
    level: 'PhD',
    email: 'fatima.aliyu@example.com'
  },
  'STU/2023/001': {
    matricNumber: 'STU/2023/001',
    firstName: 'Chukwuemeka',
    lastName: 'Obi',
    programme: 'MSC-AI',
    programmeName: 'MSc Artificial Intelligence',
    level: 'MSc',
    email: 'chukwuemeka.obi@example.com'
  },
  'STU/2023/002': {
    matricNumber: 'STU/2023/002',
    firstName: 'Blessing',
    lastName: 'Adeyemi',
    programme: 'MSC-CYB',
    programmeName: 'MSc Cybersecurity',
    level: 'MSc',
    email: 'blessing.adeyemi@example.com'
  },
  'NOUN/MSC/2024/001': {
    matricNumber: 'NOUN/MSC/2024/001',
    firstName: 'Uche',
    lastName: 'Eze',
    programme: 'MSC-AI',
    programmeName: 'MSc Artificial Intelligence',
    level: 'MSc',
    email: 'uche.eze@example.com'
  },
  'NOUN/PHD/2024/001': {
    matricNumber: 'NOUN/PHD/2024/001',
    firstName: 'Ngozi',
    lastName: 'Chukwu',
    programme: 'PHD-AI',
    programmeName: 'PhD Artificial Intelligence',
    level: 'PhD',
    email: 'ngozi.chukwu@example.com'
  },
};

export async function fetchStudentDetails(matricNumber: string): Promise<SDMSData | null> {
  console.log(`🔍 Fetching details for matric: ${matricNumber} from SDMS...`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // In production, you would do:
  // const sdmsDb = await mongoose.createConnection(process.env.SDMS_MONGODB_URI);
  // const Student = sdmsDb.model('Student', StudentSchema);
  // return await Student.findOne({ matricNumber: { $regex: new RegExp(`^${matricNumber}$`, 'i') } });

  // Try exact match first (already normalised to uppercase by caller)
  if (MOCK_SDMS_DATA[matricNumber]) {
    return MOCK_SDMS_DATA[matricNumber];
  }

  // Fallback: case-insensitive, slash/dash normalised match
  const normalise = (s: string) => s.toUpperCase().replace(/[-\s]/g, '/');
  const needle = normalise(matricNumber);
  const found = Object.values(MOCK_SDMS_DATA).find(
    (s) => normalise(s.matricNumber) === needle
  );

  return found || null;
}
