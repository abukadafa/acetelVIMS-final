import { Router } from 'express';
import { fixCode } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth.middleware';

const r = Router();

// Protect AI routes - only authenticated users can use the AI assistant
r.use(authenticate);

r.post('/ai-fix', fixCode);

export default r;
