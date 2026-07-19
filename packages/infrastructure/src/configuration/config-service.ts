import { IConfigurationProvider } from '@wacore/shared';
import { EnvConfig, validateEnv } from './env-validation';

export class ConfigurationService implements IConfigurationProvider {
  private readonly _config: EnvConfig;

  constructor(env?: Record<string, string | undefined>) {
    this._config = validateEnv(env || process.env);
  }

  get<T>(key: string): T | undefined {
    return (this._config as Record<string, unknown>)[key] as T | undefined;
  }

  getOrThrow<T>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined || value === null) {
      throw new Error(`Configuration key not found: ${key}`);
    }
    return value;
  }

  getOrElse<T>(key: string, defaultValue: T): T {
    return this.get<T>(key) ?? defaultValue;
  }

  has(key: string): boolean {
    return (this._config as Record<string, unknown>)[key] !== undefined;
  }

  getAll(): Record<string, unknown> {
    return { ...this._config };
  }

  get database(): { url: string } {
    return { url: this.getOrThrow<string>('DATABASE_URL') };
  }

  get app(): { env: string; port: number; host: string; corsOrigin: string } {
    return {
      env: this.getOrThrow<string>('NODE_ENV'),
      port: this.getOrThrow<number>('APP_PORT'),
      host: this.getOrThrow<string>('APP_HOST'),
      corsOrigin: this.getOrThrow<string>('CORS_ORIGIN'),
    };
  }

  get logging(): { level: string; format: string } {
    return {
      level: this.getOrThrow<string>('LOG_LEVEL'),
      format: this.getOrThrow<string>('LOG_FORMAT'),
    };
  }

  get supabase(): { url?: string; anonKey?: string; serviceRoleKey?: string; bucket: string } {
    return {
      url: this.get<string>('SUPABASE_URL'),
      anonKey: this.get<string>('SUPABASE_ANON_KEY'),
      serviceRoleKey: this.get<string>('SUPABASE_SERVICE_ROLE_KEY'),
      bucket: this.getOrThrow<string>('SUPABASE_BUCKET'),
    };
  }

  get encryption(): { key?: string; algorithm: string } {
    return {
      key: this.get<string>('ENCRYPTION_KEY'),
      algorithm: this.getOrThrow<string>('ENCRYPTION_ALGORITHM'),
    };
  }
}
