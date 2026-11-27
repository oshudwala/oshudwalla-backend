import { ApiError } from '../../utils/apiError';

export interface ApitxtBalanceResponse {
    provider: string;
    balance: number | null;
    currency: string;
    raw: unknown;
}

export const getApitxtBalance = async (overrideAuthKey?: string): Promise<ApitxtBalanceResponse> => {
    const authKey = (overrideAuthKey || process.env.APITXT_AUTH_KEY || '').trim();

    if (!authKey) {
        throw new ApiError(500, 'APITXT_AUTH_KEY is not configured in environment variables');
    }

    const url = `https://apitxt.com/api/balance?authkey=${encodeURIComponent(authKey)}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            authkey: authKey,
            Accept: 'application/json',
        },
    });

    const rawText = await response.text();
    let parsed: Record<string, any> | string = rawText;

    try {
        parsed = JSON.parse(rawText);
    } catch {
        // Keep raw text if APITxT returns non-JSON response
    }

    if (!response.ok || (typeof parsed === 'object' && parsed !== null && parsed.status === 'error')) {
        const errorMessage =
            typeof parsed === 'object' && parsed !== null
                ? parsed.message || parsed.error || 'Failed to fetch APITxT balance'
                : `APITxT balance request failed (HTTP ${response.status})`;

        throw new ApiError(response.status >= 400 && response.status < 500 ? response.status : 502, errorMessage);
    }

    const dataObj = typeof parsed === 'object' && parsed !== null ? parsed.data : null;
    const rawBalance = dataObj?.balance ?? (typeof parsed === 'object' && parsed !== null ? parsed.balance : null);
    const balance = rawBalance !== null && rawBalance !== undefined ? Number(rawBalance) : null;
    const currency = (dataObj?.currency as string) || 'INR';

    return {
        provider: 'APITXT',
        balance: Number.isNaN(balance as number) ? null : balance,
        currency,
        raw: parsed,
    };
};