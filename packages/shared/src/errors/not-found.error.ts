import { BaseError } from './base.error';

export class NotFoundError extends BaseError {
  constructor(resource: string, identifier: string, correlationId?: string) {
    super(`${resource} with identifier '${identifier}' not found`, 'NOT_FOUND', 404, true, correlationId);
  }
}
