import { BaseError } from './base.error';

export class AuthenticationError extends BaseError {
  constructor(message: string = 'Authentication failed', correlationId?: string) {
    super(message, 'AUTHENTICATION_ERROR', 401, true, correlationId);
  }
}
