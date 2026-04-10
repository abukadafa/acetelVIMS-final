import mongoose from 'mongoose';

/**
 * Service to interface with the existing ACETEL Student Database Management System (SDMS).
 * In a real scenario, this would connect to a secondary MongoDB instance.
 * For this implementation, we provide a mock lookup that simulates the fetch.
 */

interface SDMSData {
  matricNumber: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  programme: string;
  email: string;
}

const MOCK_SDMS_DATA: Record<string, SDMSData> = {
  'STU/2024/001': {
    matricNumber: 'STU/2024/001',
    firstName: 'John',
    lastName: 'Doe',
    otherNames: 'Okon',
    programme: 'MSC-AI',
    email: 'john.doe@example.com'
  },
  'STU/2024/002': {
    matricNumber: 'STU/2024/002',
    firstName: 'Jane',
    lastName: 'Smith',
    otherNames: 'Ada',
    programme: 'MSC-CYB',
    email: 'jane.smith@example.com'
  },
  'STU/2024/003': {
    matricNumber: 'STU/2024/003',
    firstName: 'Musa',
    lastName: 'Ibrahim',
    otherNames: 'Kola',
    programme: 'MSC-MIS',
    email: 'musa.ibrahim@example.com'
  },
};

export async function fetchStudentDetails(matricNumber: string): Promise<SDMSData | null> {
  console.log(`🔍 Fetching details for matric: ${matricNumber} from SDMS...`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // In production, you would do:
  // const sdmsDb = await mongoose.createConnection(process.env.SDMS_MONGODB_URI);
  // const Student = sdmsDb.model('Student', StudentSchema);
  // return await Student.findOne({ matricNumber });

  return MOCK_SDMS_DATA[matricNumber] || null;
}
