import { BaseError } from './base.error';

export class ProviderError extends BaseError {
  public readonly provider: string;
  public readonly retryable: boolean;

  constructor(
    message: string,
    provider: string,
    retryable: boolean = false,
    correlationId?: string
  ) {
    super(message, 'PROVIDER_ERROR', 502, true, correlationId);
    this.provider = provider;
    this.retryable = retryable;
  }

  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      provider: this.provider,
      retryable: this.retryable,
    };
  }
}
