import { randomUUID } from 'crypto';

export interface IUuidGenerator {
  generate(): string;
  isValid(uuid: string): boolean;
  parse(uuid: string): { version: number; variant: number } | null;
}

export class UuidGenerator implements IUuidGenerator {
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  generate(): string {
    return randomUUID();
  }

  isValid(uuid: string): boolean {
    return UuidGenerator.UUID_REGEX.test(uuid);
  }

  parse(uuid: string): { version: number; variant: number } | null {
    if (!this.isValid(uuid)) return null;
    const parts = uuid.replace(/-/g, '');
    const version = parseInt(parts[12], 16);
    const variantChar = parseInt(parts[16], 16);
    let variant: number;
    if (variantChar <= 7) variant = 0;
    else if (variantChar <= 11) variant = 1;
    else variant = 2;
    return { version, variant };
  }
}
