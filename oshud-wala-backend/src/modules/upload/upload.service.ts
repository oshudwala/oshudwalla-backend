import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { ApiError } from '../../utils/apiError';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_FOLDERS = new Set([
    'prescriptions',
    'promotions',
    'pharmacies',
    'products',
    'profiles',
    'doctors',
    'general',
]);

const slugifyName = (name: string) =>
    name
        .toLowerCase()
        .trim()
        .replace(/\.[^/.]+$/, '') // strip extension if passed
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);

export const deleteFromCloudinary = async (storageKey?: string | null) => {
    if (!storageKey) return;
    try {
        await cloudinary.uploader.destroy(storageKey, { invalidate: true });
    } catch {
        // Ignore if already deleted on Cloudinary
    }
};

export const uploadBufferToCloudinary = async (
    file: Express.Multer.File,
    options?: {
        folder?: string;
        fileName?: string;
        oldStorageKey?: string;
    }
) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        throw new ApiError(500, 'Cloudinary environment variables are not configured');
    }

    const rawFolder = options?.folder;
    const folderName = rawFolder && ALLOWED_FOLDERS.has(rawFolder) ? rawFolder : 'general';
    const fullFolder = `oshudwala/${folderName}`;
    const checksumSha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');

    const cleanFileName = options?.fileName ? slugifyName(options.fileName) : undefined;
    const uploadOptions: Record<string, any> = {
        folder: fullFolder,
        resource_type: 'auto',
        overwrite: true,
        invalidate: true,
        unique_filename: !cleanFileName,
    };

    if (cleanFileName) {
        uploadOptions.public_id = cleanFileName;
    }

    const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(uploadOptions, (err, res) => {
            if (err || !res) return reject(err || new ApiError(500, 'Cloudinary upload failed'));
            resolve(res);
        });
        stream.end(file.buffer);
    });

    const newStorageKey = result.public_id as string;

    // If oldStorageKey was provided and differs from the newly overwritten public_id, delete old file
    if (options?.oldStorageKey && options.oldStorageKey !== newStorageKey) {
        await deleteFromCloudinary(options.oldStorageKey);
    }

    return {
        url: result.secure_url as string,
        storageKey: newStorageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        checksumSha256,
    };
};
