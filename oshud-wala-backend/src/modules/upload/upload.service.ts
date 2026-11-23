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

export const uploadBufferToCloudinary = async (
    file: Express.Multer.File,
    rawFolder?: string
) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        throw new ApiError(500, 'Cloudinary environment variables are not configured');
    }

    const folderName = rawFolder && ALLOWED_FOLDERS.has(rawFolder) ? rawFolder : 'general';
    const checksumSha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');

    const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: `oshudwala/${folderName}`,
                resource_type: 'auto',
            },
            (err, res) => {
                if (err || !res) return reject(err || new ApiError(500, 'Cloudinary upload failed'));
                resolve(res);
            }
        );
        stream.end(file.buffer);
    });

    return {
        url: result.secure_url as string,
        storageKey: result.public_id as string,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        checksumSha256,
    };
};
