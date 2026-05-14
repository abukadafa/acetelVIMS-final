import { GoogleGenerativeAI } from "@google/generative-ai";
import logger from "./logger";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  logger.warn('GEMINI_API_KEY is missing in environment variables. AI features will not work.');
}

const genAI = new GoogleGenerativeAI(apiKey || 'dummy-key');

/**
 * Service to interface with Google Gemini AI
 */
export async function askGemini(prompt: string): Promise<string> {
  try {
    if (!apiKey) throw new Error('Gemini API Key is not configured');

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    logger.info('🤖 Sending prompt to Gemini AI...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return text;
  } catch (err: any) {
    logger.error('Gemini AI Error: %s', err.message);
    throw err;
  }
}
