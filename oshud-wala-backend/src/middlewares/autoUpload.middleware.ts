import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ApiError } from '../utils/apiError';
import { uploadBufferToCloudinary } from '../modules/upload/upload.service';

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

interface AutoUploadOptions {
    folder: string;
    targetBodyKey: string;
    nameFromBody?: string;
}

export const autoUpload = (options: AutoUploadOptions) => {
    const multerMiddleware = upload.fields([
        { name: 'photo', maxCount: 1 },
        { name: 'image', maxCount: 1 },
        { name: 'file', maxCount: 1 },
    ]);

    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.is('multipart/form-data')) {
            return next();
        }

        multerMiddleware(req, res, async (err: any) => {
            if (err) return next(err);

            try {
                if (req.body && typeof req.body === 'object') {
                    for (const key of Object.keys(req.body)) {
                        const val = req.body[key];
                        if (typeof val === 'string') {
                            if (val === 'true') req.body[key] = true;
                            else if (val === 'false') req.body[key] = false;
                            else if ((val.startsWith('[') && val.endsWith(']')) || (val.startsWith('{') && val.endsWith('}'))) {
                                try { req.body[key] = JSON.parse(val); } catch {}
                            }
                        }
                    }
                }

                const filesObj = req.files as Record<string, Express.Multer.File[]> | undefined;
                const file = filesObj?.photo?.[0] || filesObj?.image?.[0] || filesObj?.file?.[0];

                if (file) {
                    const fileName = options.nameFromBody ? req.body?.[options.nameFromBody] : undefined;
                    const oldStorageKey = req.body?.oldStorageKey as string | undefined;

                    const uploaded = await uploadBufferToCloudinary(file, {
                        folder: options.folder,
                        fileName,
                        oldStorageKey,
                    });

                    req.body[options.targetBodyKey] = uploaded.url;
                }

                next();
            } catch (uploadErr) {
                next(uploadErr);
            }
        });
    };
};

export const autoUploadPrescriptionFiles = () => {
    const multerMiddleware = upload.fields([
        { name: 'files', maxCount: 5 },
        { name: 'file', maxCount: 5 },
        { name: 'photo', maxCount: 5 },
    ]);

    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.is('multipart/form-data')) {
            return next();
        }

        multerMiddleware(req, res, async (err: any) => {
            if (err) return next(err);

            try {
                const filesObj = req.files as Record<string, Express.Multer.File[]> | undefined;
                const incomingFiles = [
                    ...(filesObj?.files || []),
                    ...(filesObj?.file || []),
                    ...(filesObj?.photo || []),
                ];

                if (req.body && typeof req.body === 'object') {
                    if (req.body.pharmacyId === '' || req.body.pharmacyId === 'null' || req.body.pharmacyId === 'undefined') {
                        delete req.body.pharmacyId;
                    }
                    if (req.body.doctorName === '' || req.body.doctorName === 'null') {
                        req.body.doctorName = null;
                    }
                    if (req.body.patientNote === '' || req.body.patientNote === 'null') {
                        req.body.patientNote = null;
                    }
                }

                if (incomingFiles.length > 0) {
                    const uploadedFiles = await Promise.all(
                        incomingFiles.map((f) =>
                            uploadBufferToCloudinary(f, { folder: 'prescriptions' })
                        )
                    );

                    req.body.files = uploadedFiles.map((u) => ({
                        storageKey: u.storageKey,
                        mimeType: u.mimeType,
                        sizeBytes: u.sizeBytes,
                        checksumSha256: u.checksumSha256,
                    }));
                } else if (typeof req.body?.files === 'string') {
                    try { req.body.files = JSON.parse(req.body.files); } catch {}
                }

                next();
            } catch (uploadErr) {
                next(uploadErr);
            }
        });
    };
};
