import { Boom } from '@hapi/boom';

export interface BaileysErrorInfo {
  message: string;
  statusCode?: number;
  isRecoverable: boolean;
  category: BaileysErrorCategory;
  raw?: Error;
}

export type BaileysErrorCategory =
  | 'AUTHENTICATION'
  | 'CONNECTION'
  | 'PROTOCOL'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'UNKNOWN';

const RECOVERABLE_CODES = new Set([408, 428, 500, 515, 440]);
const FATAL_CODES = new Set([401, 403, 411, 503]);

export class BaileysErrorMapper {
  static mapError(error: Error | Boom): BaileysErrorInfo {
    if (error instanceof Boom) {
      return this.mapBoomError(error);
    }
    return {
      message: error.message,
      isRecoverable: false,
      category: 'UNKNOWN',
      raw: error,
    };
  }

  static mapBoomError(error: Boom): BaileysErrorInfo {
    const statusCode = error.output?.statusCode;
    const message = error.message || error.output?.payload?.error || 'Unknown Baileys error';
    return {
      message,
      statusCode,
      isRecoverable: statusCode != null && !FATAL_CODES.has(statusCode),
      category: statusCode != null ? this.getCategoryForCode(statusCode) : 'UNKNOWN',
      raw: error,
    };
  }

  static mapDisconnectReason(reason: number): BaileysErrorInfo {
    return {
      message: this.getDisconnectReasonMessage(reason),
      statusCode: reason,
      isRecoverable: RECOVERABLE_CODES.has(reason),
      category: this.getCategoryForCode(reason),
    };
  }

  static shouldReconnect(error: Error | Boom): boolean {
    return this.mapError(error).isRecoverable;
  }

  static getCategoryForCode(code: number): BaileysErrorCategory {
    if (code === 401 || code === 403) return 'AUTHENTICATION';
    if (code === 408 || code === 428 || code === 440) return 'CONNECTION';
    if (code === 500 || code === 515) return 'PROTOCOL';
    if (code === 429) return 'RATE_LIMIT';
    if (code === 503) return 'NETWORK';
    return 'UNKNOWN';
  }

  static getDisconnectReasonMessage(code: number): string {
    const messages: Record<number, string> = {
      401: 'Logged out — authentication credentials are invalid',
      403: 'Forbidden — access denied by WhatsApp',
      408: 'Connection timed out',
      411: 'Multidevice mismatch — device ID conflict',
      428: 'Connection closed unexpectedly',
      440: 'Connection replaced — logged in from another device',
      500: 'Bad session — corrupted session data',
      503: 'Service unavailable — WhatsApp server issue',
      515: 'Restart required — server requests reconnect',
    };
    return messages[code] || `Disconnect with code ${code}`;
  }
}
