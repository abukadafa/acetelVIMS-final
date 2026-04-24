import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Identifier must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(2, 'First name is too short'),
  lastName: z.string().min(2, 'Last name is too short'),
  phone: z.string().optional(),
  role: z.enum(['student', 'supervisor', 'admin', 'prog_coordinator', 'internship_coordinator', 'ict_support']).default('student'),
  matricNumber: z.string().optional(),
  academicSession: z.string().optional(),
  level: z.string().optional(),
  stateOfOrigin: z.string().optional(),
  lga: z.string().optional(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const updateStudentSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(['pending', 'active', 'completed', 'withdrawn']).optional(),
  programme: z.string().optional(),
  company: z.string().optional(),
  supervisor: z.string().optional(),
});

export const locationUpdateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// Logbook Schemas
export const logbookEntrySchema = z.object({
  body: z.object({
    entryDate: z.string().datetime(),
    activities: z.string().min(10, 'Activities description is too short'),
    toolsUsed: z.string().optional(),
    skillsLearned: z.string().optional(),
    challenges: z.string().optional(),
    solutions: z.string().optional(),
    weekNumber: z.number().int().min(1).max(52),
    isOfflineSync: z.boolean().optional(),
  })
});

export const logbookReviewSchema = z.object({
  body: z.object({
    supervisorComment: z.string().min(5, 'Comment is too short'),
    supervisorRating: z.number().min(1).max(5),
    status: z.enum(['approved', 'rejected', 'revision_requested']).optional(),
  }),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-D]{24}$/i, 'Invalid ID format')
  })
});

// Attendance Schemas
export const checkInSchema = z.object({
  body: z.object({
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    method: z.enum(['gps', 'biometric', 'manual', 'qr', 'offline']).default('gps'),
  })
});

export const manualAttendanceSchema = z.object({
  body: z.object({
    studentId: z.string().regex(/^[0-9a-fA-D]{24}$/i, 'Invalid Student ID'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    notes: z.string().optional(),
  })
});

// Company Schemas
export const companyCreateSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    address: z.string().min(5),
    state: z.string().min(2),
    sector: z.string().min(2),
    specialisation: z.string().min(2),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    contactPerson: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    isApproved: z.boolean().optional(),
  })
});
