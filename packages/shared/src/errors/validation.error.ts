import { BaseError } from './base.error';

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

export class ValidationError extends BaseError {
  public readonly errors: ValidationErrorDetail[];

  constructor(message: string, errors: ValidationErrorDetail[], correlationId?: string) {
    super(message, 'VALIDATION_ERROR', 400, true, correlationId);
    this.errors = errors;
  }

  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      errors: this.errors,
    };
  }

  public static fromZodErrors(zodErrors: unknown[], correlationId?: string): ValidationError {
    const errors: ValidationErrorDetail[] = zodErrors.map((error) => {
      const zodError = error as { path: (string | number)[]; message: string; code: string };
      return {
        field: zodError.path.join('.'),
        message: zodError.message,
        code: zodError.code,
      };
    });
    return new ValidationError('Validation failed', errors, correlationId);
  }
}
