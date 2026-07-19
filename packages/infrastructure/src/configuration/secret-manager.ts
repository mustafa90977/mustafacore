export interface ISecretManager {
  getSecret(key: string): Promise<string | null>;
  getSecretOrThrow(key: string): Promise<string>;
  setSecret(key: string, value: string): Promise<void>;
  deleteSecret(key: string): Promise<void>;
  hasSecret(key: string): Promise<boolean>;
}

export class EnvironmentSecretManager implements ISecretManager {
  async getSecret(key: string): Promise<string | null> {
    return process.env[key] || null;
  }

  async getSecretOrThrow(key: string): Promise<string> {
    const value = await this.getSecret(key);
    if (!value) {
      throw new Error(`Secret not found: ${key}`);
    }
    return value;
  }

  async setSecret(key: string, value: string): Promise<void> {
    process.env[key] = value;
  }

  async deleteSecret(key: string): Promise<void> {
    delete process.env[key];
  }

  async hasSecret(key: string): Promise<boolean> {
    return (await this.getSecret(key)) !== null;
  }
}
