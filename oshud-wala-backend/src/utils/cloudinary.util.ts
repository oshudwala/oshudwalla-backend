import crypto from 'crypto';

export const deleteCloudinaryImage = async (publicId: string): Promise<{ dryRun: boolean; result?: any }> => {
    const isDryRun = process.env.NODE_ENV === 'test' || !process.env.CLOUDINARY_CLOUD_NAME;
    if (isDryRun) {
        return { dryRun: true, result: { result: 'ok', publicId } };
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
    const apiKey = process.env.CLOUDINARY_API_KEY!;
    const apiSecret = process.env.CLOUDINARY_API_SECRET!;
    const timestamp = Math.floor(Date.now() / 1000);

    const signaturePayload = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(signaturePayload).digest('hex');

    const body = new URLSearchParams({
        public_id: publicId,
        api_key: apiKey,
        timestamp: String(timestamp),
        signature,
    });

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`;
    const res = await fetch(url, { method: 'POST', body });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error?.message || `Cloudinary destroy failed (HTTP ${res.status})`);
    }
    return { dryRun: false, result: data };
};
