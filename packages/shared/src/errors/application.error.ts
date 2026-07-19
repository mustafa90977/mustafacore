import { BaseError } from './base.error';

export class ApplicationError extends BaseError {
  constructor(message: string, code: string = 'APPLICATION_ERROR', correlationId?: string) {
    super(message, code, 500, true, correlationId);
  }
}
