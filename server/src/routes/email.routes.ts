import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { composeEmail, getEmailHistory, getEmailContacts } from '../controllers/email.controller';

const r = Router();

r.use(authenticate);

// Only staff roles can compose broadcast emails
r.post('/compose', authorize('admin', 'prog_coordinator', 'internship_coordinator', 'supervisor', 'ict_support'), composeEmail);
r.get('/history', getEmailHistory);
r.get('/contacts', authorize('admin', 'prog_coordinator', 'internship_coordinator', 'supervisor', 'ict_support'), getEmailContacts);

export default r;
