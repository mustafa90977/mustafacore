# WhatsApp Engine Foundation - First Sprint Plan

## Overview

This plan outlines the first sprint for building the WhatsApp Engine foundation. We will establish clean architecture, database schema, provider interface, and skeleton implementations.

---

## Phase 1: Project Initialization

### 1.1 Create Next.js Project
- Initialize with TypeScript, App Router, TailwindCSS, ESLint
- Use `src/` directory structure

### 1.2 Install Core Dependencies
```bash
# Core
npm install next react react-dom typescript

# Database
npm install prisma @prisma/client

# WhatsApp
npm install @whiskeysockets/baileys

# Utilities
npm install zod dotenv

# Dev Dependencies
npm install -D @types/node @types/react @types/react-dom
```

### 1.3 Initialize Prisma
```bash
npx prisma init
```

### 1.4 Set Up shadcn/ui
```bash
npx shadcn@latest init
```

### 1.5 Initialize Git
```bash
git init
# Create .gitignore
```

---

## Phase 2: Project Structure (Clean Architecture)

### Feature-Based Directory Structure

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx
│   └── api/                      # API Routes (thin layer)
│       └── whatsapp/
│           ├── instances/
│           │   └── route.ts
│           ├── messages/
│           │   └── route.ts
│           └── sessions/
│               └── route.ts
│
├── features/
│   └── whatsapp/
│       ├── components/           # UI Components (Presentation)
│       │   ├── WhatsAppDashboard.tsx
│       │   ├── QRCodeDisplay.tsx
│       │   └── ConnectionStatus.tsx
│       │
│       ├── hooks/                # React Hooks
│       │   ├── useWhatsAppInstance.ts
│       │   ├── useQRCode.ts
│       │   └── useConnectionStatus.ts
│       │
│       ├── services/             # Application Layer (Business Logic)
│       │   ├── SessionManager.ts
│       │   ├── MessagingEngine.ts
│       │   ├── InstanceManager.ts
│       │   └── WebhookEngine.ts
│       │
│       ├── repositories/         # Data Access Layer
│       │   ├── WhatsAppInstanceRepository.ts
│       │   ├── WhatsAppSessionRepository.ts
│       │   └── WhatsAppMessageRepository.ts
│       │
│       ├── providers/            # Infrastructure Layer
│       │   ├── interfaces/
│       │   │   └── IWhatsAppProvider.ts
│       │   ├── baileys/
│       │   │   ├── BaileysProvider.ts
│       │   │   ├── BaileysAdapter.ts
│       │   │   └── index.ts
│       │   └── index.ts
│       │
│       ├── events/               # Event Bus System
│       │   ├── EventBus.ts
│       │   ├── types.ts
│       │   └── index.ts
│       │
│       ├── types/                # TypeScript Types
│       │   ├── instance.ts
│       │   ├── session.ts
│       │   ├── message.ts
│       │   └── events.ts
│       │
│       └── validators/           # Zod Schemas
│           ├── instance.validator.ts
│           ├── message.validator.ts
│           └── session.validator.ts
│
├── lib/                          # Shared Utilities
│   ├── prisma.ts                 # Prisma Client Singleton
│   ├── supabase.ts               # Supabase Client
│   └── errors.ts                 # Custom Error Classes
│
├── config/                       # Configuration
│   └── environment.ts
│
└── prisma/
    └── schema.prisma             # Database Schema
```

---

## Phase 3: Database Schema

### 3.1 Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model Workspace {
  id            String           @id @default(cuid())
  name          String
  slug          String           @unique
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  instances     WhatsAppInstance[]

  @@index([slug])
  @@map("workspaces")
}

model WhatsAppInstance {
  id            String           @id @default(cuid())
  workspaceId   String
  workspace     Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  name          String
  phoneNumber   String?
  status        InstanceStatus   @default(DISCONNECTED)
  provider      String           @default("baileys")
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  deletedAt     DateTime?

  sessions      WhatsAppSession[]
  messages      WhatsAppMessage[]
  events        WhatsAppEvent[]

  @@index([workspaceId])
  @@index([status])
  @@map("whatsapp_instances")
}

model WhatsAppSession {
  id            String           @id @default(cuid())
  instanceId    String
  instance      WhatsAppInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)
  sessionId     String           @unique
  authState     Json?            // Encrypted auth data
  status        SessionStatus    @default(INACTIVE)
  lastActiveAt  DateTime?
  expiresAt     DateTime?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  @@index([instanceId])
  @@index([sessionId])
  @@map("whatsapp_sessions")
}

model WhatsAppMessage {
  id            String           @id @default(cuid())
  instanceId    String
  instance      WhatsAppInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)
  externalId    String?          // WhatsApp message ID
  from          String           // Sender JID
  to            String           // Recipient JID
  type          MessageType
  content       Json             // Message content (text, media, etc.)
  status        MessageStatus    @default(PENDING)
  direction     MessageDirection
  timestamp     DateTime         @default(now())
  metadata      Json?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  @@index([instanceId])
  @@index([externalId])
  @@index([from])
  @@index([to])
  @@index([status])
  @@map("whatsapp_messages")
}

model WhatsAppEvent {
  id            String           @id @default(cuid())
  instanceId    String
  instance      WhatsAppInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)
  eventType     EventType
  payload       Json
  processed     Boolean          @default(false)
  createdAt     DateTime         @default(now())

  @@index([instanceId])
  @@index([eventType])
  @@index([processed])
  @@map("whatsapp_events")
}

enum InstanceStatus {
  DISCONNECTED
  CONNECTING
  QR_PENDING
  CONNECTED
  ERROR
}

enum SessionStatus {
  INACTIVE
  ACTIVE
  EXPIRED
  REVOKED
}

enum MessageType {
  TEXT
  IMAGE
  VIDEO
  AUDIO
  FILE
  DOCUMENT
  LOCATION
  CONTACT
}

enum MessageStatus {
  PENDING
  SENT
  DELIVERED
  READ
  FAILED
}

enum MessageDirection {
  INBOUND
  OUTBOUND
}

enum EventType {
  MESSAGE_RECEIVED
  MESSAGE_SENT
  MESSAGE_READ
  MESSAGE_DELIVERED
  QR_UPDATED
  CONNECTED
  DISCONNECTED
  INSTANCE_CREATED
  INSTANCE_DELETED
}
```

---

## Phase 4: Provider Interface

### 4.1 IWhatsAppProvider Interface

```typescript
// src/features/whatsapp/providers/interfaces/IWhatsAppProvider.ts

import { EventEmitter } from 'events';

export interface ConnectionOptions {
  authState?: AuthState;
  qrTimeout?: number;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export interface AuthState {
  creds: any;
  keys: any;
}

export interface QRCodeEvent {
  qr: string;
  timestamp: Date;
}

export interface ConnectionStatus {
  state: 'disconnected' | 'connecting' | 'connected' | 'qr_pending';
  error?: string;
  lastConnectedAt?: Date;
}

export interface SendMessageOptions {
  to: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  content: string | Buffer;
  caption?: string;
  mimetype?: string;
}

export interface MessageInfo {
  id: string;
  from: string;
  to: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
}

export interface IWhatsAppProvider extends EventEmitter {
  // Connection Management
  connect(options?: ConnectionOptions): Promise<void>;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;
  getStatus(): ConnectionStatus;
  
  // QR Code
  getQRCode(): Promise<QRCodeEvent | null>;
  
  // Messaging
  sendMessage(options: SendMessageOptions): Promise<MessageInfo>;
  
  // Auth State
  saveAuthState(): Promise<AuthState>;
  loadAuthState(state: AuthState): Promise<void>;
  
  // Cleanup
  destroy(): Promise<void>;
}
```

---

## Phase 5: Event Bus System

### 5.1 Event Types

```typescript
// src/features/whatsapp/events/types.ts

export interface WhatsAppEvent {
  type: EventType;
  instanceId: string;
  payload: any;
  timestamp: Date;
}

export type EventType =
  | 'message.received'
  | 'message.sent'
  | 'message.read'
  | 'message.delivered'
  | 'qr.updated'
  | 'connected'
  | 'disconnected';

export interface EventHandlers {
  'message.received': (event: WhatsAppEvent) => void | Promise<void>;
  'message.sent': (event: WhatsAppEvent) => void | Promise<void>;
  'message.read': (event: WhatsAppEvent) => void | Promise<void>;
  'message.delivered': (event: WhatsAppEvent) => void | Promise<void>;
  'qr.updated': (event: WhatsAppEvent) => void | Promise<void>;
  'connected': (event: WhatsAppEvent) => void | Promise<void>;
  'disconnected': (event: WhatsAppEvent) => void | Promise<void>;
}
```

### 5.2 EventBus Implementation

```typescript
// src/features/whatsapp/events/EventBus.ts

import { EventEmitter } from 'events';
import { WhatsAppEvent, EventType, EventHandlers } from './types';

export class WhatsAppEventBus extends EventEmitter {
  private static instance: WhatsAppEventBus;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  static getInstance(): WhatsAppEventBus {
    if (!WhatsAppEventBus.instance) {
      WhatsAppEventBus.instance = new WhatsAppEventBus();
    }
    return WhatsAppEventBus.instance;
  }

  emitEvent(event: WhatsAppEvent): void {
    this.emit(event.type, event);
    this.emit('*', event); // Wildcard for logging/debugging
  }

  onEvent<T extends EventType>(
    eventType: T,
    handler: EventHandlers[T]
  ): void {
    this.on(eventType, handler);
  }

  offEvent<T extends EventType>(
    eventType: T,
    handler: EventHandlers[T]
  ): void {
    this.off(eventType, handler);
  }
}

export const eventBus = WhatsAppEventBus.getInstance();
```

---

## Phase 6: WhatsApp Provider Skeleton

### 6.1 Baileys Provider (Skeleton)

```typescript
// src/features/whatsapp/providers/baileys/BaileysProvider.ts

import { EventEmitter } from 'events';
import {
  IWhatsAppProvider,
  ConnectionOptions,
  ConnectionStatus,
  QRCodeEvent,
  SendMessageOptions,
  MessageInfo,
  AuthState
} from '../interfaces/IWhatsAppProvider';
import { eventBus } from '../../events/EventBus';

export class BaileysProvider extends EventEmitter implements IWhatsAppProvider {
  private status: ConnectionStatus = { state: 'disconnected' };
  private currentQR: QRCodeEvent | null = null;
  private instanceId: string;

  constructor(instanceId: string) {
    super();
    this.instanceId = instanceId;
  }

  async connect(options?: ConnectionOptions): Promise<void> {
    this.status = { state: 'connecting' };
    // TODO: Implement Baileys connection logic
    throw new Error('Method not implemented');
  }

  async disconnect(): Promise<void> {
    this.status = { state: 'disconnected' };
    // TODO: Implement disconnection logic
    throw new Error('Method not implemented');
  }

  async reconnect(): Promise<void> {
    // TODO: Implement reconnection logic
    throw new Error('Method not implemented');
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  async getQRCode(): Promise<QRCodeEvent | null> {
    return this.currentQR;
  }

  async sendMessage(options: SendMessageOptions): Promise<MessageInfo> {
    // TODO: Implement message sending
    throw new Error('Method not implemented');
  }

  async saveAuthState(): Promise<AuthState> {
    // TODO: Implement auth state persistence
    throw new Error('Method not implemented');
  }

  async loadAuthState(state: AuthState): Promise<void> {
    // TODO: Implement auth state loading
    throw new Error('Method not implemented');
  }

  async destroy(): Promise<void> {
    await this.disconnect();
    this.removeAllListeners();
  }
}
```

### 6.2 Provider Factory

```typescript
// src/features/whatsapp/providers/index.ts

import { IWhatsAppProvider } from './interfaces/IWhatsAppProvider';
import { BaileysProvider } from './baileys/BaileysProvider';

export type ProviderType = 'baileys';

export function createProvider(
  type: ProviderType,
  instanceId: string
): IWhatsAppProvider {
  switch (type) {
    case 'baileys':
      return new BaileysProvider(instanceId);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

export { IWhatsAppProvider };
export { BaileysProvider };
```

---

## Phase 7: Session Manager Skeleton

### 7.1 Session Manager Service

```typescript
// src/features/whatsapp/services/SessionManager.ts

import { PrismaClient } from '@prisma/client';
import { createProvider, IWhatsAppProvider, ProviderType } from '../providers';
import { eventBus } from '../events/EventBus';
import {
  WhatsAppInstance,
  CreateInstanceDTO,
  InstanceConnectionResult
} from '../types/instance';
import { Session, CreateSessionDTO } from '../types/session';

export class SessionManager {
  private prisma: PrismaClient;
  private activeSessions: Map<string, IWhatsAppProvider> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createInstance(dto: CreateInstanceDTO): Promise<WhatsAppInstance> {
    // TODO: Implement instance creation
    throw new Error('Method not implemented');
  }

  async connectInstance(instanceId: string): Promise<InstanceConnectionResult> {
    // TODO: Implement connection logic
    throw new Error('Method not implemented');
  }

  async disconnectInstance(instanceId: string): Promise<void> {
    // TODO: Implement disconnection logic
    throw new Error('Method not implemented');
  }

  async getInstance(instanceId: string): Promise<WhatsAppInstance | null> {
    // TODO: Implement instance retrieval
    throw new Error('Method not implemented');
  }

  async listInstances(workspaceId: string): Promise<WhatsAppInstance[]> {
    // TODO: Implement instance listing
    throw new Error('Method not implemented');
  }

  async deleteInstance(instanceId: string): Promise<void> {
    // TODO: Implement instance deletion
    throw new Error('Method not implemented');
  }

  async getActiveProvider(instanceId: string): Promise<IWhatsAppProvider | null> {
    return this.activeSessions.get(instanceId) || null;
  }

  async logoutInstance(instanceId: string): Promise<void> {
    // TODO: Implement logout
    throw new Error('Method not implemented');
  }
}
```

---

## Phase 8: Repositories

### 8.1 Workspace Repository

```typescript
// src/features/whatsapp/repositories/WorkspaceRepository.ts

import { PrismaClient, Workspace } from '@prisma/client';

export class WorkspaceRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(data: { name: string; slug: string }): Promise<Workspace> {
    return this.prisma.workspace.create({ data });
  }

  async findById(id: string): Promise<Workspace | null> {
    return this.prisma.workspace.findUnique({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    return this.prisma.workspace.findUnique({ where: { slug } });
  }

  async findAll(): Promise<Workspace[]> {
    return this.prisma.workspace.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async update(id: string, data: { name?: string }): Promise<Workspace> {
    return this.prisma.workspace.update({
      where: { id },
      data
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.workspace.delete({ where: { id } });
  }
}
```

### 8.2 Instance Repository

```typescript
// src/features/whatsapp/repositories/WhatsAppInstanceRepository.ts

import { PrismaClient, WhatsAppInstance, InstanceStatus } from '@prisma/client';

export class WhatsAppInstanceRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(data: {
    workspaceId: string;
    name: string;
    phoneNumber?: string;
    provider?: string;
  }): Promise<WhatsAppInstance> {
    return this.prisma.whatsAppInstance.create({ data });
  }

  async findById(id: string): Promise<WhatsAppInstance | null> {
    return this.prisma.whatsAppInstance.findUnique({ where: { id } });
  }

  async findByWorkspaceId(workspaceId: string): Promise<WhatsAppInstance[]> {
    return this.prisma.whatsAppInstance.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateStatus(id: string, status: InstanceStatus): Promise<WhatsAppInstance> {
    return this.prisma.whatsAppInstance.update({
      where: { id },
      data: { status }
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.whatsAppInstance.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}
```

---

## Phase 9: Type Definitions

### 9.1 Instance Types

```typescript
// src/features/whatsapp/types/instance.ts

export interface WhatsAppInstance {
  id: string;
  workspaceId: string;
  name: string;
  phoneNumber?: string;
  status: InstanceStatus;
  provider: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InstanceStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'QR_PENDING'
  | 'CONNECTED'
  | 'ERROR';

export interface CreateInstanceDTO {
  workspaceId: string;
  name: string;
  phoneNumber?: string;
  provider?: 'baileys';
}

export interface InstanceConnectionResult {
  instanceId: string;
  status: InstanceStatus;
  qrCode?: string;
  error?: string;
}
```

### 9.2 Session Types

```typescript
// src/features/whatsapp/types/session.ts

export interface Session {
  id: string;
  instanceId: string;
  sessionId: string;
  status: SessionStatus;
  lastActiveAt?: Date;
  expiresAt?: Date;
}

export type SessionStatus = 'INACTIVE' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface CreateSessionDTO {
  instanceId: string;
  sessionId?: string;
}
```

---

## Phase 10: Validators

### 10.1 Instance Validator

```typescript
// src/features/whatsapp/validators/instance.validator.ts

import { z } from 'zod';

export const createInstanceSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(100),
  phoneNumber: z.string().optional(),
  provider: z.enum(['baileys']).default('baileys')
});

export const updateInstanceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phoneNumber: z.string().optional()
});

export type CreateInstanceInput = z.infer<typeof createInstanceSchema>;
export type UpdateInstanceInput = z.infer<typeof updateInstanceSchema>;
```

---

## Phase 11: Prisma Client Singleton

### 11.1 Prisma Client

```typescript
// src/lib/prisma.ts

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : []
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

---

## Phase 12: Environment Configuration

### 12.1 Environment Config

```typescript
// src/config/environment.ts

import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);
```

---

## Implementation Order

1. **Project Setup** (Phase 1)
   - Initialize Next.js
   - Install dependencies
   - Set up shadcn/ui

2. **Directory Structure** (Phase 2)
   - Create all directories
   - Add placeholder files

3. **Database Schema** (Phase 3)
   - Write Prisma schema (including Workspace table)
   - Run migrations

4. **Type Definitions** (Phase 9)
   - Create all type files

5. **Validators** (Phase 10)
   - Create Zod schemas

6. **Event System** (Phase 5)
   - Implement EventBus

7. **Provider Interface** (Phase 4)
   - Define IWhatsAppProvider

8. **Provider Implementation** (Phase 6)
   - Create Baileys skeleton

9. **Repositories** (Phase 8)
   - Implement Workspace repository
   - Implement Instance repository
   - Implement Session repository
   - Implement Message repository

10. **Services** (Phase 7)
    - Create SessionManager skeleton

11. **Configuration** (Phases 11-12)
    - Set up Prisma client
    - Configure environment

---

## Deliverables

After this sprint, we will have:

1. ✅ Clean architecture foundation
2. ✅ Database schema ready for migration (including Workspace table)
3. ✅ Provider interface for future implementations
4. ✅ Baileys provider skeleton
5. ✅ Session manager skeleton
6. ✅ Event bus system
7. ✅ Type-safe validators
8. ✅ Proper project structure
9. ✅ All repositories (Workspace, Instance, Session, Message)

---

## What We Will NOT Build Yet

- ❌ QR Code generation/display
- ❌ Actual messaging functionality
- ❌ Real UI components (only placeholders)
- ❌ API route implementations
- ❌ Real-time subscriptions
- ❌ Authentication (will add in later sprint)
- ❌ Testing setup (will add in later sprint)

---

## Decisions Made

1. **Workspace Model**: ✅ Created workspaces table for multi-tenancy
2. **Authentication**: ⏸️ Skipping auth for now (will add in later sprint)
3. **Testing**: ⏸️ Skipping testing setup for now (will add in later sprint)

---

## Next Sprint Preview

After approval, the next sprint will focus on:

1. Baileys connection implementation
2. QR Code generation and display
3. Session persistence
4. Basic text messaging
5. API routes for instance management
6. Supabase Auth integration
