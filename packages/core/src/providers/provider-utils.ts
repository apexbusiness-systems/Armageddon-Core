import type { LLMResponse } from './types.js';

export function mapStopFinishReason(reason: string | null | undefined): LLMResponse['finishReason'] {
    switch (reason) {
        case 'stop':
        case 'end_turn':
        case 'stop_sequence':
            return 'stop';
        case 'length':
        case 'max_tokens':
            return 'length';
        case 'content_filter':
            return 'content_filter';
        default:
            return 'error';
    }
}

export async function assertJsonResponse<T>(response: Response, label: string): Promise<T> {
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`[${label}] API Error ${response.status}: ${errorText}`);
    }

    return response.json() as Promise<T>;
}
