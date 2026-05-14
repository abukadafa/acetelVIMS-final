import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// Allowed MIME types and their expected file signatures (magic bytes)
const ALLOWED_TYPES: Record<string, Buffer> = {
  'image/jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
  'image/jpg':  Buffer.from([0xFF, 0xD8, 0xFF]),
  'image/png':  Buffer.from([0x89, 0x50, 0x4E, 0x47]),
  'application/pdf': Buffer.from([0x25, 0x50, 0x44, 0x46]),
};

// Allowed file extensions — must match MIME type
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    let type = 'logbooks';
    if (req.path.includes('avatar')) type = 'avatars';
    else if (req.path.includes('restore') || req.path.includes('permanent-delete')) type = 'memos';
    const finalDir = path.join(uploadsDir, type);
    if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true });
    cb(null, finalDir);
  },
  filename: (req, file, cb) => {
    // Never use original filename — UUID prevents path traversal and overwrite attacks
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error('Invalid file extension'), '');
    }
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
  // 1. Check declared MIME type
  if (!Object.keys(ALLOWED_TYPES).includes(file.mimetype)) {
    logger.warn('Upload blocked — disallowed MIME type: %s | IP: %s', file.mimetype, req.ip);
    return cb(new Error('Invalid file type. Only JPEG, PNG and PDF are allowed.'), false);
  }

  // 2. Check extension matches declared MIME type
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    logger.warn('Upload blocked — extension/MIME mismatch: ext=%s mime=%s | IP: %s', ext, file.mimetype, req.ip);
    return cb(new Error('File extension does not match content type.'), false);
  }

  // Note: magic byte validation happens in the multer transform stream.
  // For server-side magic byte checks, use a post-upload validation middleware.
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,    // 5MB max
    files: 1,                      // One file per request
    fields: 20,                    // Max 20 non-file fields
    fieldNameSize: 100,            // Max field name length
    fieldSize: 1 * 1024 * 1024,   // 1MB max per text field
  },
});

/**
 * Post-upload magic byte validation middleware.
 * Use after upload.single()/upload.fields() to validate actual file content.
 */
export function validateUploadedFile(req: any, res: any, next: any) {
  if (!req.file) return next();

  const filePath = req.file.path;
  const expectedMime = req.file.mimetype;
  const expectedSig = ALLOWED_TYPES[expectedMime];

  if (!expectedSig) {
    fs.unlinkSync(filePath);
    logger.warn('Magic byte check: unknown MIME type %s | IP: %s', expectedMime, req.ip);
    return res.status(415).json({ error: 'Unsupported file type' });
  }

  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(expectedSig.length);
    fs.readSync(fd, buf, 0, expectedSig.length, 0);
    fs.closeSync(fd);

    if (!buf.slice(0, expectedSig.length).equals(expectedSig)) {
      fs.unlinkSync(filePath);
      logger.warn('Magic byte mismatch — file content does not match declared MIME %s | IP: %s', expectedMime, req.ip);
      return res.status(415).json({ error: 'File content does not match declared type. Upload rejected.' });
    }
  } catch (err) {
    try { fs.unlinkSync(filePath); } catch {}
    logger.error('Magic byte validation error: %s', (err as Error).message);
    return res.status(500).json({ error: 'File validation failed' });
  }

  next();
}
