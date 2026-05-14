import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { composeEmail, getEmailHistory, getEmailContacts } from '../controllers/email.controller';

const r = Router();

r.use(authenticate);

// All authenticated users can compose — scope enforcement is in the controller
r.post('/compose', composeEmail);
r.get('/history', getEmailHistory);
r.get('/contacts', getEmailContacts);

export default r;
