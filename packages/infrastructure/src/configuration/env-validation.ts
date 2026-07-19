import { z } from 'zod';

const databaseSchema = z.object({
  DATABASE_URL: z.string().url(),
});

const appSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_PORT: z.coerce.number().int().positive().default(3000),
  APP_HOST: z.string().default('localhost'),
  CORS_ORIGIN: z.string().default('*'),
});

const loggingSchema = z.object({
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'text']).default('json'),
});

const supabaseSchema = z.object({
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_BUCKET: z.string().default('media'),
});

const encryptionSchema = z.object({
  ENCRYPTION_KEY: z.string().min(32).optional(),
  ENCRYPTION_ALGORITHM: z.string().default('aes-256-gcm'),
});

export const envSchema = databaseSchema
  .merge(appSchema)
  .merge(loggingSchema)
  .merge(supabaseSchema)
  .merge(encryptionSchema);

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(env: Record<string, string | undefined>): EnvConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
  return result.data;
}
