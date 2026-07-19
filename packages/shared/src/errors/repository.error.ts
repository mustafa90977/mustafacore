import { BaseError } from './base.error';

export class RepositoryError extends BaseError {
  constructor(message: string, correlationId?: string) {
    super(message, 'REPOSITORY_ERROR', 500, true, correlationId);
  }
}
