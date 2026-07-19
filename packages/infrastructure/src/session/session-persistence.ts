import { UniqueId, ILogger } from '@wacore/shared';
import { AuthState } from '@wacore/wa-core';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SessionPersistenceConfig {
  baseFolder: string;
  maxAuthStateAge?: number;
}

export interface ISessionPersistence {
  saveAuthState(instanceId: UniqueId, state: AuthState): Promise<void>;
  loadAuthState(instanceId: UniqueId): Promise<AuthState | null>;
  destroyAuthState(instanceId: UniqueId): Promise<boolean>;
  authStateExists(instanceId: UniqueId): Promise<boolean>;
  getAuthStatePath(instanceId: UniqueId): string;
  getAuthStateAge(instanceId: UniqueId): Promise<number | null>;
}

export class SessionPersistence implements ISessionPersistence {
  private readonly _baseFolder: string;
  private readonly _logger: ILogger;

  constructor(logger: ILogger, config: SessionPersistenceConfig) {
    this._logger = logger.child({ module: 'SessionPersistence' });
    this._baseFolder = config.baseFolder;
  }

  getAuthStatePath(instanceId: UniqueId): string {
    return path.join(this._baseFolder, instanceId);
  }

  async saveAuthState(instanceId: UniqueId, state: AuthState): Promise<void> {
    const folder = this.getAuthStatePath(instanceId);
    try {
      await fs.mkdir(folder, { recursive: true });
      await fs.writeFile(
        path.join(folder, 'creds.json'),
        JSON.stringify(state.creds, null, 2),
        'utf-8',
      );
      await fs.writeFile(
        path.join(folder, 'keys.json'),
        JSON.stringify(state.keys, null, 2),
        'utf-8',
      );
      this._logger.debug('Auth state saved', { instanceId, folder });
    } catch (error) {
      this._logger.error('Failed to save auth state', error as Error, { instanceId });
      throw error;
    }
  }

  async loadAuthState(instanceId: UniqueId): Promise<AuthState | null> {
    const folder = this.getAuthStatePath(instanceId);
    const credsPath = path.join(folder, 'creds.json');
    const keysPath = path.join(folder, 'keys.json');

    try {
      await fs.access(credsPath);
      await fs.access(keysPath);
    } catch {
      this._logger.debug('No auth state found', { instanceId });
      return null;
    }

    try {
      const credsRaw = await fs.readFile(credsPath, 'utf-8');
      const keysRaw = await fs.readFile(keysPath, 'utf-8');
      const authState: AuthState = {
        creds: JSON.parse(credsRaw),
        keys: JSON.parse(keysRaw),
      };
      this._logger.debug('Auth state loaded', { instanceId });
      return authState;
    } catch (error) {
      this._logger.error('Failed to load auth state', error as Error, { instanceId });
      return null;
    }
  }

  async destroyAuthState(instanceId: UniqueId): Promise<boolean> {
    const folder = this.getAuthStatePath(instanceId);
    try {
      await fs.rm(folder, { recursive: true, force: true });
      this._logger.debug('Auth state destroyed', { instanceId });
      return true;
    } catch (error) {
      this._logger.error('Failed to destroy auth state', error as Error, { instanceId });
      return false;
    }
  }

  async authStateExists(instanceId: UniqueId): Promise<boolean> {
    try {
      const folder = this.getAuthStatePath(instanceId);
      await fs.access(path.join(folder, 'creds.json'));
      return true;
    } catch {
      return false;
    }
  }

  async getAuthStateAge(instanceId: UniqueId): Promise<number | null> {
    const folder = this.getAuthStatePath(instanceId);
    try {
      const stat = await fs.stat(path.join(folder, 'creds.json'));
      return Date.now() - stat.mtimeMs;
    } catch {
      return null;
    }
  }
}
