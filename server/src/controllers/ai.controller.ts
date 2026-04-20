import { Request, Response } from 'express';
import { askGemini } from '../utils/gemini.service';
import logger from '../utils/logger';
import { z } from 'zod';

const aiFixSchema = z.object({
  code: z.string().min(1, 'Code snippet is required'),
});

/**
 * Controller for AI-powered features
 */
export const fixCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = aiFixSchema.parse(req.body);

    const prompt = `
You are a senior software engineer assistant for the ACETEL VIMS project.
A user has provided the following code snippet that needs fixing or explanation:

---
${code}
---

Please fix the code and provide a brief explanation of any errors or improvements.
`;

    const result = await askGemini(prompt);
    res.json({ success: true, result });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('AI Fix Controller Error: %s', err.message);
    res.status(500).json({ error: 'AI processing failed. Please check if GEMINI_API_KEY is valid.' });
  }
};
