import { BaseError } from './base.error';

export class DomainError extends BaseError {
  constructor(message: string, code: string = 'DOMAIN_ERROR', correlationId?: string) {
    super(message, code, 400, true, correlationId);
  }
}
