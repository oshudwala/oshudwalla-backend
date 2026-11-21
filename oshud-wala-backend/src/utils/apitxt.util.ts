import crypto from 'crypto';

export const generateNumericOtp = (digits = 6): string => {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    return String(crypto.randomInt(min, max + 1));
};

export const hashOtp = (phone: string, otp: string): string => {
    return crypto.createHash('sha256').update(`${phone}:${otp}`).digest('hex');
};

export const sendApitxtOtp = async (phone: string, otp: string): Promise<{ dryRun: boolean; response?: any }> => {
    const isDryRun = process.env.NODE_ENV === 'test' || process.env.OTP_DRY_RUN === 'true';
    if (isDryRun) {
        return { dryRun: true, response: { status: 'success', message: 'Dry-run OTP (not sent to APITXT)' } };
    }

    const authkey = process.env.APITXT_AUTH_KEY;
    if (!authkey) {
        throw new Error('APITXT_AUTH_KEY is not configured in .env');
    }

    const country = process.env.APITXT_COUNTRY || '91';
    const channel = process.env.APITXT_CHANNEL || 'sms';
    const mobile = phone.length === 10 ? `${country}${phone}` : phone;

    const params = new URLSearchParams({
        authkey,
        mobile,
        otp,
        channel,
        country,
    });

    const url = `https://apitxt.com/api/sendOTP?${params.toString()}`;
    const res = await fetch(url, { method: 'GET' });
    const data: any = await res.json().catch(() => ({}));

    if (!res.ok || data?.status === 'error') {
        throw new Error(data?.message || `APITXT OTP send failed (HTTP ${res.status})`);
    }

    return { dryRun: false, response: data };
};
