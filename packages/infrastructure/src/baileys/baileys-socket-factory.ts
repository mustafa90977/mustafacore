import makeWASocket, {
  WASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  UserFacingSocketConfig,
  ConnectionState,
  WAMessage,
} from '@whiskeysockets/baileys';
import { ILogger, UniqueId } from '@wacore/shared';
import { BaileysConfig, DEFAULT_BAILEYS_CONFIG } from './baileys-config';
import { BaileysLoggerAdapter } from './baileys-logger-adapter';

export interface SocketInstance {
  socket: WASocket;
  saveCreds: () => Promise<void>;
  cleanup: () => void;
}

export interface SocketCallbacks {
  onConnectionUpdate?: (state: Partial<ConnectionState>) => void;
  onMessagesUpsert?: (data: { messages: WAMessage[]; type: string }) => void;
  onMessagesUpdate?: (messages: WAMessage[]) => void;
  onMessagesDelete?: (data: { keys: any[] }) => void;
  onCredsUpdate?: () => void;
}

export class BaileysSocketFactory {
  private readonly _logger: ILogger;
  private readonly _config: Required<BaileysConfig>;

  constructor(logger: ILogger, config?: BaileysConfig) {
    this._logger = logger;
    this._config = { ...DEFAULT_BAILEYS_CONFIG, ...config };
  }

  async createSocket(
    instanceId: UniqueId,
    callbacks: SocketCallbacks,
  ): Promise<SocketInstance> {
    const authFolder = `${this._config.authStateFolder}/${instanceId}`;
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const baileysLogger = new BaileysLoggerAdapter(this._logger, this._config.loggerLevel as any);

    const socketConfig: UserFacingSocketConfig = {
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger as any),
      },
      logger: baileysLogger as any,
      printQRInTerminal: this._config.printQRInTerminal,
      browser: this._config.browser as [string, string, string],
      version: this._config.version as [number, number, number],
      waWebSocketUrl: this._config.waWebSocketUrl,
      connectTimeoutMs: this._config.connectTimeoutMs,
      qrTimeout: this._config.qrTimeout,
      keepAliveIntervalMs: this._config.keepAliveIntervalMs,
      emitOwnEvents: this._config.emitOwnEvents,
      markOnlineOnConnect: this._config.markOnlineOnConnect,
      syncFullHistory: this._config.syncFullHistory,
      generateHighQualityLinkPreview: false,
      shouldSyncHistoryMessage: () => false,
      getMessage: async () => undefined,
    };

    const socket = makeWASocket(socketConfig);

    this.setupEventListeners(socket, callbacks, saveCreds);

    const cleanup = () => {
      this._logger.info(`Cleaning up socket for instance ${instanceId}`);
      socket.ev.removeAllListeners('connection.update');
      socket.ev.removeAllListeners('messages.upsert');
      socket.ev.removeAllListeners('messages.update');
      socket.ev.removeAllListeners('creds.update');
    };

    return { socket, saveCreds, cleanup };
  }

  private setupEventListeners(
    socket: WASocket,
    callbacks: SocketCallbacks,
    saveCreds: () => Promise<void>,
  ): void {
    socket.ev.on('connection.update', (state: Partial<ConnectionState>) => {
      callbacks.onConnectionUpdate?.(state);
    });

    socket.ev.on('messages.upsert', (data: { messages: WAMessage[]; type: string }) => {
      callbacks.onMessagesUpsert?.(data);
    });

    socket.ev.on('messages.update', (updates: any[]) => {
      const messages = updates.map((u) => ({
        ...u.update,
        key: u.key,
      })) as WAMessage[];
      callbacks.onMessagesUpdate?.(messages);
    });

    socket.ev.on('creds.update', () => {
      saveCreds();
      callbacks.onCredsUpdate?.();
    });
  }
}
