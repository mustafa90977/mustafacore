import { UniqueId } from '@wacore/shared';
import { SessionStatus } from '../../../domain/enums/session-status';
import { AuthState } from './i-provider';

export interface ISessionStore {
  getActiveSession(instanceId: UniqueId): Promise<SessionData | null>;
  createSession(instanceId: UniqueId): Promise<SessionData>;
  updateSession(instanceId: UniqueId, data: Partial<SessionData>): Promise<SessionData>;
  deleteSession(instanceId: UniqueId): Promise<void>;
  revokeSession(instanceId: UniqueId): Promise<void>;
  markSessionActive(instanceId: UniqueId): Promise<void>;
  markSessionExpired(instanceId: UniqueId): Promise<void>;
}

export interface SessionData {
  id: UniqueId;
  instanceId: UniqueId;
  sessionId: string;
  status: SessionStatus;
  qrCode?: string;
  qrGeneratedAt?: Date;
  qrExpiresAt?: Date;
  authData?: AuthState;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
