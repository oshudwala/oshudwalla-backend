import crypto from 'crypto';

const getKey = () =>
    crypto
        .createHash('sha256')
        .update(process.env.JWT_SECRET || 'oshudwala_delivery_otp_secret')
        .digest();

export const sha256Hex = (val: string) => crypto.createHash('sha256').update(val).digest('hex');

export const encryptOtp = (otp: string): string => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
    const enc = Buffer.concat([cipher.update(otp, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
};

export const decryptOtp = (payload: string): string => {
    const [ivHex, tagHex, encHex] = payload.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
};
