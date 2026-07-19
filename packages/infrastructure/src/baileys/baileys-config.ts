export interface BaileysConfig {
  authStateFolder?: string;
  waWebSocketUrl?: string;
  connectTimeoutMs?: number;
  qrTimeout?: number;
  keepAliveIntervalMs?: number;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectIntervalMs?: number;
  printQRInTerminal?: boolean;
  syncFullHistory?: boolean;
  markOnlineOnConnect?: boolean;
  emitOwnEvents?: boolean;
  loggerLevel?: 'silent' | 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  browser?: [string, string, string];
  version?: [number, number, number];
}

export const DEFAULT_BAILEYS_CONFIG: Required<BaileysConfig> = {
  authStateFolder: './auth_state',
  waWebSocketUrl: 'wss://web.whatsapp.com/ws/chat',
  connectTimeoutMs: 60000,
  qrTimeout: 60000,
  keepAliveIntervalMs: 30000,
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectIntervalMs: 5000,
  printQRInTerminal: false,
  syncFullHistory: false,
  markOnlineOnConnect: true,
  emitOwnEvents: false,
  loggerLevel: 'info',
  browser: ['WACore', 'Chrome', '4.0.0'],
  version: [2, 3000, 0],
};
