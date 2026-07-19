import { createHash, createHmac } from 'crypto';

export interface IHashService {
  sha256(data: string): string;
  sha512(data: string): string;
  hmacSha256(data: string, secret: string): string;
  md5(data: string): string;
}

export class HashService implements IHashService {
  sha256(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  sha512(data: string): string {
    return createHash('sha512').update(data).digest('hex');
  }

  hmacSha256(data: string, secret: string): string {
    return createHmac('sha256', secret).update(data).digest('hex');
  }

  md5(data: string): string {
    return createHash('md5').update(data).digest('hex');
  }
}
