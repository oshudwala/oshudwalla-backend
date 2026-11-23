import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middlewares/auth.middleware';
import { ApiError } from '../../utils/apiError';
import * as c from './upload.controller';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIMES.has(file.mimetype)) {
            return cb(new ApiError(400, 'Only JPG, PNG, WEBP, and PDF files are allowed'));
        }
        cb(null, true);
    },
});

const router = Router();
router.use(authenticate);

router.post('/', upload.single('file'), c.uploadSingle);
router.post('/multiple', upload.array('files', 5), c.uploadMultiple);
router.delete('/', c.removeUploadedFile);

export default router;
