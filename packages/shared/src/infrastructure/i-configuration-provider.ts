export interface IConfigurationProvider {
  get<T>(key: string): T | undefined;
  getOrThrow<T>(key: string): T;
  getOrElse<T>(key: string, defaultValue: T): T;
  has(key: string): boolean;
  getAll(): Record<string, unknown>;
}
