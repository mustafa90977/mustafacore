import { BaseError } from './base.error';

export class AuthorizationError extends BaseError {
  constructor(message: string = 'Authorization failed', correlationId?: string) {
    super(message, 'AUTHORIZATION_ERROR', 403, true, correlationId);
  }
}
