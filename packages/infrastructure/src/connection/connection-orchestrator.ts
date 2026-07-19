import { UniqueId, ILogger } from '@wacore/shared';
import { ConnectionStatus, IncomingMessage } from '@wacore/wa-core';
import { InstanceStatus, SessionStatus } from '@prisma/client';
import { BaileysProvider } from '../baileys/baileys-provider';
import { SessionManager, SessionManagerConfig } from '../session/session-manager';
import { IInstanceRepository } from '../repositories/instance.repository';
import { ISessionRepository } from '../repositories/session.repository';
import { InboundMessageOrchestrator } from '../messaging/inbound-message-orchestrator';

export interface ConnectionOrchestratorConfig {
  sessionConfig: SessionManagerConfig;
}

export class ConnectionOrchestrator {
  private readonly _logger: ILogger;
  private readonly _sessionManager: SessionManager;
  private readonly _instanceRepo: IInstanceRepository;
  private readonly _sessionRepo: ISessionRepository;
  private readonly _messageOrchestrator: InboundMessageOrchestrator;
  private readonly _providers: Map<UniqueId, BaileysProvider> = new Map();

  constructor(
    logger: ILogger,
    config: ConnectionOrchestratorConfig,
    instanceRepo: IInstanceRepository,
    sessionRepo: ISessionRepository,
    messageOrchestrator: InboundMessageOrchestrator,
  ) {
    this._logger = logger.child({ module: 'ConnectionOrchestrator' });
    this._sessionManager = new SessionManager(logger, config.sessionConfig);
    this._instanceRepo = instanceRepo;
    this._sessionRepo = sessionRepo;
    this._messageOrchestrator = messageOrchestrator;
  }

  async startConnection(instanceId: UniqueId): Promise<{ success: boolean; status: string }> {
    const instance = await this._instanceRepo.findById(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    await this._instanceRepo.updateStatus(instanceId, InstanceStatus.CONNECTING);

    let session = await this._sessionRepo.findActiveByInstanceId(instanceId);
    if (!session) {
      session = await this._sessionRepo.create({
        instanceId,
        sessionId: `session_${instanceId}`,
        status: SessionStatus.QR_PENDING,
        isActive: true,
      });
    }

    const provider = new BaileysProvider({
      instanceId,
      logger: this._logger,
    });

    this._providers.set(instanceId, provider);

    provider.on('qr', async (data: { instanceId: string; qr: string }) => {
      try {
        const qrExpiryMs = 60000;
        const expiresAt = new Date(Date.now() + qrExpiryMs);
        await this._sessionRepo.updateQR(session!.id, data.qr, expiresAt);
        await this._instanceRepo.updateStatus(instanceId, InstanceStatus.QR_PENDING);
        this._logger.info('QR saved to DB', { instanceId });
      } catch (error) {
        this._logger.error('Failed to save QR to DB', error as Error, { instanceId });
      }
    });

    provider.on('connection_update', async (normalized: { status: ConnectionStatus }) => {
      try {
        if (normalized.status === ConnectionStatus.CONNECTED) {
          await this._instanceRepo.recordConnection(instanceId);
          await this._sessionRepo.markActive(session!.id);
          this._logger.info('Instance connected', { instanceId });
        } else if (normalized.status === ConnectionStatus.DISCONNECTED) {
          await this._instanceRepo.recordDisconnection(instanceId);
          this._logger.info('Instance disconnected', { instanceId });
        }
      } catch (error) {
        this._logger.error('Failed to update DB on connection change', error as Error, { instanceId });
      }
    });

    provider.on('error', async (data: { instanceId: string; error: string }) => {
      try {
        await this._instanceRepo.recordError(instanceId, data.error);
      } catch (error) {
        this._logger.error('Failed to record error', error as Error, { instanceId });
      }
    });

    provider.on('creds_updated', async () => {
      try {
        await this._sessionManager.saveAuthState(instanceId);
        this._logger.info('Auth state saved after credentials update', { instanceId });
      } catch (error) {
        this._logger.error('Failed to save auth state', error as Error, { instanceId });
      }
    });

    provider.on('message_received', async (data: { instanceId: string; message: IncomingMessage }) => {
      try {
        await this._messageOrchestrator.handleIncomingMessage(data.message);
      } catch (error) {
        this._logger.error('Failed to process incoming message', error as Error, { instanceId });
      }
    });

    const started = await this._sessionManager.start(instanceId, provider);
    if (!started) {
      await this._instanceRepo.updateStatus(instanceId, InstanceStatus.ERROR);
      return { success: false, status: 'ERROR' };
    }

    return { success: true, status: provider.getConnectionStatus() };
  }

  async stopConnection(instanceId: UniqueId): Promise<void> {
    await this._sessionManager.stop(instanceId);
    await this._instanceRepo.recordDisconnection(instanceId);

    const provider = this._providers.get(instanceId);
    if (provider) {
      provider.removeAllListeners();
      this._providers.delete(instanceId);
    }

    this._logger.info('Connection stopped', { instanceId });
  }

  async getQRCode(instanceId: UniqueId): Promise<{ qr: string | null; expiresAt: Date | null }> {
    const session = await this._sessionRepo.findActiveByInstanceId(instanceId);
    if (!session || !session.qrCode) {
      return { qr: null, expiresAt: null };
    }

    if (session.qrExpiresAt && new Date(session.qrExpiresAt) < new Date()) {
      return { qr: null, expiresAt: null };
    }

    return { qr: session.qrCode, expiresAt: session.qrExpiresAt };
  }

  async getStatus(instanceId: UniqueId): Promise<{ status: string; isConnected: boolean }> {
    const provider = this._providers.get(instanceId);
    const providerStatus = provider ? provider.getConnectionStatus() : null;

    const instance = await this._instanceRepo.findById(instanceId);
    const dbStatus = instance?.status || 'DISCONNECTED';

    return {
      status: providerStatus || dbStatus,
      isConnected: providerStatus === ConnectionStatus.CONNECTED,
    };
  }

  async hasStoredSession(instanceId: UniqueId): Promise<boolean> {
    return this._sessionManager.hasStoredAuth(instanceId);
  }

  getSessionManager(): SessionManager {
    return this._sessionManager;
  }
}
