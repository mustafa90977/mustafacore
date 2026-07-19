# WhatsApp Commerce Engine - Architecture Design

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Domain Design](#domain-design)
4. [Event Catalog](#event-catalog)
5. [Contracts & Interfaces](#contracts--interfaces)
6. [Database Design](#database-design)
7. [Application Layer](#application-layer)
8. [Provider Layer](#provider-layer)
9. [Event Bus Flow](#event-bus-flow)
10. [API Layer](#api-layer)
11. [Presentation Layer](#presentation-layer)
12. [Future SaaS Considerations](#future-saas-considerations)
13. [Implementation Order](#implementation-order)

---

# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                                     │
│                              apps/dashboard                                         │
│                              (Next.js App Router)                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                              │
│                              apps/api (future)                                      │
│                              (Thin HTTP Routes)                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────────────┐
│          COMMERCE CORE                │ │           WA CORE                     │
│      packages/commerce-core           │ │       packages/wa-core                │
├───────────────────────────────────────┤ ├───────────────────────────────────────┤
│                                       │ │                                       │
│  ┌─────────────────────────────────┐  │ │  ┌─────────────────────────────────┐  │
│  │     Application Services        │  │ │  │     Application Services        │  │
│  │  - Conversation Engine          │  │ │  │  - Session Manager              │  │
│  │  - Customer Engine              │  │ │  │  - Connection Manager           │  │
│  │  - Order Engine                 │  │ │  │  - Message Dispatcher           │  │
│  │  - Product Engine               │  │ │  │  - QR Manager                   │  │
│  │  - Catalog Engine               │  │ │  │  - Media Manager                │  │
│  └─────────────────────────────────┘  │ │  └─────────────────────────────────┘  │
│                                       │ │                                       │
│  ┌─────────────────────────────────┐  │ │  ┌─────────────────────────────────┐  │
│  │     Domain Entities             │  │ │  │     Domain Entities             │  │
│  │  - Conversation                 │  │ │  │  - WhatsAppInstance             │  │
│  │  - Customer                     │  │ │  │  - WhatsAppSession              │  │
│  │  - Order / OrderItem            │  │ │  │  - Message                      │  │
│  │  - Product                      │  │ │  │  - Connection                   │  │
│  │  - Store                        │  │ │  │  - Provider                     │  │
│  └─────────────────────────────────┘  │ │  └─────────────────────────────────┘  │
│                                       │ │                                       │
│  ┌─────────────────────────────────┐  │ │  ┌─────────────────────────────────┐  │
│  │     Repositories                │  │ │  │     Provider System             │  │
│  │  - IConversationRepository      │  │ │  │  - IWhatsAppProvider            │  │
│  │  - ICustomerRepository          │  │ │  │  - ProviderFactory              │  │
│  │  - IOrderRepository             │  │ │  │  - ProviderRegistry             │  │
│  │  - IProductRepository           │  │ │  │  - ProviderHealth               │  │
│  │  - IStoreRepository             │  │ │  │  - ProviderCapabilities         │  │
│  └─────────────────────────────────┘  │ │  └─────────────────────────────────┘  │
│                                       │ │                                       │
└───────────────────────────────────────┘ └───────────────────────────────────────┘
                    │                               │
                    │   ┌───────────────────────┐   │
                    │   │    SHARED KERNEL      │   │
                    │   │  packages/shared      │   │
                    │   ├───────────────────────┤   │
                    │   │ - Types               │   │
                    │   │ - Errors              │   │
                    │   │ - Validators (Zod)    │   │
                    │   │ - Event Bus           │   │
                    │   │ - Utilities           │   │
                    │   │ - Constants           │   │
                    │   └───────────────────────┘   │
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              INFRASTRUCTURE LAYER                                   │
│                              packages/infrastructure (future)                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  - Prisma Client (Database)                                                         │
│  - Redis (Caching - future)                                                         │
│  - S3 (Media Storage - future)                                                      │
│  - WebSocket (Real-time)                                                            │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Dependency Rules

### Rule 1: Strict Package Boundaries

```
apps/* → packages/* (can import)
packages/wa-core → packages/shared (can import)
packages/commerce-core → packages/shared (can import)
packages/shared → nothing (no imports from other packages)

packages/wa-core ←✗→ packages/commerce-core (NO DIRECT IMPORTS)
```

### Rule 2: Communication via Events

```
wa-core ←→ commerce-core ONLY through EventBus

wa-core emits: MESSAGE_RECEIVED, MESSAGE_SENT, etc.
commerce-core emits: MESSAGE_SEND_REQUEST, etc.

wa-core listens: MESSAGE_SEND_REQUEST
commerce-core listens: MESSAGE_RECEIVED, MESSAGE_SENT, etc.
```

### Rule 3: Provider Isolation

```
Provider implementations live ONLY in wa-core

commerce-core NEVER imports:
- BaileysProvider
- MetaProvider
- Any provider class

commerce-core ONLY knows:
- Message type
- Conversation type
- Event types
```

---

# Monorepo Structure

## Package Layout

```
wacore/
├── apps/
│   ├── dashboard/                          # Next.js App Router
│   │   ├── app/                            # Pages and API routes
│   │   ├── components/                     # UI components
│   │   ├── hooks/                          # React hooks
│   │   ├── lib/                            # App-specific utilities
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── api/                                # Future dedicated backend
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared/                             # Shared kernel
│   │   ├── src/
│   │   │   ├── types/                      # Shared TypeScript types
│   │   │   │   ├── index.ts
│   │   │   │   ├── common.ts               # ID, Timestamp, etc.
│   │   │   │   ├── events.ts               # Event types
│   │   │   │   └── enums.ts                # Shared enums
│   │   │   │
│   │   │   ├── errors/                     # Custom error classes
│   │   │   │   ├── index.ts
│   │   │   │   ├── base.error.ts
│   │   │   │   ├── validation.error.ts
│   │   │   │   ├── not-found.error.ts
│   │   │   │   └── unauthorized.error.ts
│   │   │   │
│   │   │   ├── validators/                 # Zod schemas
│   │   │   │   ├── index.ts
│   │   │   │   ├── common.validator.ts     # Phone, Email, etc.
│   │   │   │   └── events.validator.ts
│   │   │   │
│   │   │   ├── events/                     # Event Bus implementation
│   │   │   │   ├── index.ts
│   │   │   │   ├── event-bus.ts
│   │   │   │   ├── event-handler.ts
│   │   │   │   └── subscription.ts
│   │   │   │
│   │   │   └── utils/                      # Utility functions
│   │   │       ├── index.ts
│   │   │       ├── id.ts                   # CUID generation
│   │   │       ├── date.ts                 # Date utilities
│   │   │       └── logger.ts               # Logging utility
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── wa-core/                            # WhatsApp Engine
│   │   ├── src/
│   │   │   ├── domain/                     # Domain layer
│   │   │   │   ├── entities/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── whatsapp-instance.ts
│   │   │   │   │   ├── whatsapp-session.ts
│   │   │   │   │   ├── message.ts
│   │   │   │   │   └── connection.ts
│   │   │   │   │
│   │   │   │   ├── value-objects/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── phone-number.ts
│   │   │   │   │   ├── auth-state.ts
│   │   │   │   │   └── message-content.ts
│   │   │   │   │
│   │   │   │   ├── enums/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── instance-status.ts
│   │   │   │   │   ├── session-status.ts
│   │   │   │   │   ├── message-type.ts
│   │   │   │   │   ├── message-status.ts
│   │   │   │   │   ├── provider-type.ts
│   │   │   │   │   └── connection-status.ts
│   │   │   │   │
│   │   │   │   └── events/
│   │   │   │       ├── index.ts
│   │   │   │       ├── instance-events.ts
│   │   │   │       ├── message-events.ts
│   │   │   │       ├── session-events.ts
│   │   │   │       └── qr-events.ts
│   │   │   │
│   │   │   ├── application/                # Application layer
│   │   │   │   ├── services/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── session-manager.ts
│   │   │   │   │   ├── connection-manager.ts
│   │   │   │   │   ├── message-dispatcher.ts
│   │   │   │   │   ├── qr-manager.ts
│   │   │   │   │   └── media-manager.ts
│   │   │   │   │
│   │   │   │   └── handlers/
│   │   │   │       ├── index.ts
│   │   │   │       ├── message-send.handler.ts
│   │   │   │       ├── presence-update.handler.ts
│   │   │   │       └── read-receipt.handler.ts
│   │   │   │
│   │   │   ├── infrastructure/             # Infrastructure layer
│   │   │   │   ├── providers/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── interfaces/
│   │   │   │   │   │   ├── i-whatsapp-provider.ts
│   │   │   │   │   │   ├── i-provider-factory.ts
│   │   │   │   │   │   └── i-provider-registry.ts
│   │   │   │   │   │
│   │   │   │   │   ├── baileys/
│   │   │   │   │   │   ├── index.ts
│   │   │   │   │   │   ├── baileys-provider.ts
│   │   │   │   │   │   ├── baileys-adapter.ts
│   │   │   │   │   │   └── baileys-factory.ts
│   │   │   │   │   │
│   │   │   │   │   ├── registry/
│   │   │   │   │   │   ├── provider-registry.ts
│   │   │   │   │   │   ├── provider-health.ts
│   │   │   │   │   │   ├── provider-capabilities.ts
│   │   │   │   │   │   └── provider-metrics.ts
│   │   │   │   │   │
│   │   │   │   │   └── factory/
│   │   │   │   │       └── provider-factory.ts
│   │   │   │   │
│   │   │   │   ├── repositories/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── interfaces/
│   │   │   │   │   │   ├── i-instance-repository.ts
│   │   │   │   │   │   └── i-session-repository.ts
│   │   │   │   │   │
│   │   │   │   │   └── prisma/
│   │   │   │   │       ├── prisma-instance-repository.ts
│   │   │   │   │       └── prisma-session-repository.ts
│   │   │   │   │
│   │   │   │   └── config/
│   │   │   │       └── wa-core.config.ts
│   │   │   │
│   │   │   ├── ports/                      # Port definitions
│   │   │   │   ├── index.ts
│   │   │   │   ├── inbound/
│   │   │   │   │   ├── i-message-handler.ts
│   │   │   │   │   └── i-connection-handler.ts
│   │   │   │   └── outbound/
│   │   │   │       ├── i-message-sender.ts
│   │   │   │       └── i-presence-sender.ts
│   │   │   │
│   │   │   └── index.ts                    # Public API
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── commerce-core/                      # Commerce Engine
│   │   ├── src/
│   │   │   ├── domain/                     # Domain layer
│   │   │   │   ├── entities/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── conversation.ts
│   │   │   │   │   ├── customer.ts
│   │   │   │   │   ├── order.ts
│   │   │   │   │   ├── order-item.ts
│   │   │   │   │   ├── product.ts
│   │   │   │   │   └── store.ts
│   │   │   │   │
│   │   │   │   ├── value-objects/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── money.ts
│   │   │   │   │   ├── address.ts
│   │   │   │   │   └── order-number.ts
│   │   │   │   │
│   │   │   │   ├── enums/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── conversation-status.ts
│   │   │   │   │   ├── order-status.ts
│   │   │   │   │   ├── payment-status.ts
│   │   │   │   │   └── fulfillment-status.ts
│   │   │   │   │
│   │   │   │   └── events/
│   │   │   │       ├── index.ts
│   │   │   │       ├── conversation-events.ts
│   │   │   │       ├── customer-events.ts
│   │   │   │       ├── order-events.ts
│   │   │   │       └── product-events.ts
│   │   │   │
│   │   │   ├── application/                # Application layer
│   │   │   │   ├── services/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── conversation-engine.ts
│   │   │   │   │   ├── customer-engine.ts
│   │   │   │   │   ├── order-engine.ts
│   │   │   │   │   ├── product-engine.ts
│   │   │   │   │   ├── catalog-engine.ts
│   │   │   │   │   └── command-parser.ts
│   │   │   │   │
│   │   │   │   └── handlers/
│   │   │   │       ├── index.ts
│   │   │   │       ├── message-received.handler.ts
│   │   │   │       ├── message-sent.handler.ts
│   │   │   │       └── order-created.handler.ts
│   │   │   │
│   │   │   ├── infrastructure/             # Infrastructure layer
│   │   │   │   ├── repositories/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── interfaces/
│   │   │   │   │   │   ├── i-conversation-repository.ts
│   │   │   │   │   │   ├── i-customer-repository.ts
│   │   │   │   │   │   ├── i-order-repository.ts
│   │   │   │   │   │   ├── i-product-repository.ts
│   │   │   │   │   │   └── i-store-repository.ts
│   │   │   │   │   │
│   │   │   │   │   └── prisma/
│   │   │   │   │       ├── prisma-conversation-repository.ts
│   │   │   │   │       ├── prisma-customer-repository.ts
│   │   │   │   │       ├── prisma-order-repository.ts
│   │   │   │   │       ├── prisma-product-repository.ts
│   │   │   │   │       └── prisma-store-repository.ts
│   │   │   │   │
│   │   │   │   └── config/
│   │   │   │       └── commerce-core.config.ts
│   │   │   │
│   │   │   ├── ports/                      # Port definitions
│   │   │   │   ├── index.ts
│   │   │   │   ├── inbound/
│   │   │   │   │   ├── i-message-receiver.ts
│   │   │   │   │   └── i-notification-receiver.ts
│   │   │   │   └── outbound/
│   │   │   │       ├── i-message-sender.ts
│   │   │   │       └── i-notification-sender.ts
│   │   │   │
│   │   │   └── index.ts                    # Public API
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── infrastructure/                     # Future infrastructure package
│       ├── src/
│       │   ├── database/
│       │   │   ├── prisma/
│       │   │   │   ├── schema.prisma
│       │   │   │   ├── migrations/
│       │   │   │   └── seed.ts
│       │   │   └── client.ts
│       │   │
│       │   ├── cache/
│       │   │   └── redis.ts
│       │   │
│       │   ├── storage/
│       │   │   └── s3.ts
│       │   │
│       │   └── realtime/
│       │       └── websocket.ts
│       │
│       ├── package.json
│       └── tsconfig.json
│
├── prisma/
│   ├── schema.prisma                       # Unified Prisma schema
│   ├── migrations/
│   └── seed.ts
│
├── package.json                            # Root package.json
├── pnpm-workspace.yaml                     # Monorepo config
├── tsconfig.json                           # Root tsconfig
├── .eslintrc.js
├── .prettierrc
└── .gitignore
```

## Package Dependencies

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'

# Dependency graph
apps/dashboard:
  - @wacore/shared
  - @wacore/wa-core
  - @wacore/commerce-core

apps/api:
  - @wacore/shared
  - @wacore/wa-core
  - @wacore/commerce-core

packages/wa-core:
  - @wacore/shared

packages/commerce-core:
  - @wacore/shared

packages/shared:
  - (no internal dependencies)

packages/infrastructure:
  - @wacore/shared
  - prisma
  - @prisma/client
```

---

# Domain Design

## Domain Boundaries

### WA Core Domain

Owns all WhatsApp-related concepts:

```
┌─────────────────────────────────────────────────────────────────┐
│                        WA CORE DOMAIN                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Entities:                                                      │
│  ├── WhatsAppInstance                                          │
│  ├── WhatsAppSession                                           │
│  ├── Message                                                   │
│  └── Connection                                                │
│                                                                 │
│  Value Objects:                                                │
│  ├── PhoneNumber                                               │
│  ├── AuthState                                                 │
│  └── MessageContent                                            │
│                                                                 │
│  Enums:                                                        │
│  ├── InstanceStatus                                            │
│  ├── SessionStatus                                             │
│  ├── MessageType                                               │
│  ├── MessageStatus                                             │
│  ├── ProviderType                                              │
│  └── ConnectionStatus                                          │
│                                                                 │
│  Events:                                                       │
│  ├── INSTANCE_CREATED                                         │
│  ├── INSTANCE_CONNECTED                                       │
│  ├── INSTANCE_DISCONNECTED                                    │
│  ├── QR_GENERATED                                             │
│  ├── QR_SCANNED                                               │
│  ├── MESSAGE_RECEIVED                                         │
│  ├── MESSAGE_SENT                                             │
│  ├── MESSAGE_DELIVERED                                        │
│  └── MESSAGE_READ                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Commerce Core Domain

Owns all commerce-related concepts:

```
┌─────────────────────────────────────────────────────────────────┐
│                      COMMERCE CORE DOMAIN                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Entities:                                                      │
│  ├── Store                                                    │
│  ├── Conversation                                             │
│  ├── Customer                                                 │
│  ├── Order                                                    │
│  ├── OrderItem                                                │
│  └── Product                                                  │
│                                                                 │
│  Value Objects:                                                │
│  ├── Money                                                    │
│  ├── Address                                                  │
│  └── OrderNumber                                              │
│                                                                 │
│  Enums:                                                        │
│  ├── ConversationStatus                                        │
│  ├── OrderStatus                                              │
│  ├── PaymentStatus                                            │
│  └── FulfillmentStatus                                        │
│                                                                 │
│  Events:                                                       │
│  ├── CONVERSATION_CREATED                                     │
│  ├── CUSTOMER_CREATED                                         │
│  ├── ORDER_CREATED                                            │
│  ├── PRODUCT_CREATED                                          │
│  └── MESSAGE_SEND_REQUEST (outbound to wa-core)              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Entity: WhatsAppInstance (WA Core)

### Purpose
Represents a single WhatsApp Web connection. Manages the technical connection to WhatsApp servers.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier (cuid) |
| workspaceId | FK | Parent workspace |
| storeId | FK | Associated store (nullable) |
| name | String | Instance display name |
| phoneNumber | String | Linked WhatsApp number |
| provider | Enum | BAILEYS, META, TWILIO, etc. |
| status | Enum | Connection status |
| authState | JSON | Encrypted authentication credentials |
| lastConnectedAt | DateTime | Last successful connection |
| lastDisconnectedAt | DateTime | Last disconnection |
| errorCount | Integer | Consecutive error count |
| maxErrors | Integer | Max errors before disable (default: 10) |
| lastError | Text | Last error message |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

### Relationships

- Belongs to: Workspace
- Belongs to: Store (optional)
- Has one: WhatsAppSession
- Has many: Message

### Business Rules

1. One instance per phone number per workspace
2. Instance can be associated with only one store
3. Error count resets on successful connection
4. Auto-disable after maxErrors consecutive failures
5. Auth state must be encrypted at rest

### Lifecycle

```
Created → Connecting → Connected → Disconnected
    ↓                    ↓            ↓
  Error ←────────────── Error      Reconnecting
    ↓
  Disabled (after max errors)
```

---

## Entity: WhatsAppSession (WA Core)

### Purpose
Tracks the authentication session for a WhatsApp instance.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| instanceId | FK | Parent instance |
| sessionId | String | Provider-specific session identifier |
| status | Enum | Session status |
| qrCode | Text | Current QR code data (base64) |
| qrGeneratedAt | DateTime | When QR was generated |
| qrExpiresAt | DateTime | When QR expires |
| authData | JSON | Encrypted auth state from provider |
| isActive | Boolean | Whether session is currently active |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

### Business Rules

1. Only one active session per instance
2. QR codes expire after 20 seconds
3. Session data must be encrypted at rest
4. Old sessions are soft-deleted

### Lifecycle

```
Created → QR_PENDING → QR_SCANNED → ACTIVE → EXPIRED
    ↓                              ↓         ↓
  FAILED                        REVOKED   RESTORED
```

---

## Entity: Message (WA Core)

### Purpose
Individual message within WhatsApp. Supports multiple content types and tracks delivery status.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| instanceId | FK | Instance that handled this message |
| externalId | String | WhatsApp message ID |
| conversationId | FK | Associated conversation (nullable) |
| direction | Enum | INBOUND, OUTBOUND |
| type | Enum | TEXT, IMAGE, VIDEO, AUDIO, FILE |
| content | JSON | Message content |
| mediaUrl | String | URL for media messages |
| mimeType | String | MIME type for media |
| status | Enum | PENDING, SENT, DELIVERED, READ, FAILED |
| error | Text | Error details if failed |
| retryCount | Integer | Number of retry attempts |
| maxRetries | Integer | Maximum retry attempts |
| quotedMessageId | FK | Message being replied to |
| timestamp | DateTime | WhatsApp server timestamp |
| metadata | JSON | Additional message data |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

### Business Rules

1. External ID must be unique per instance
2. Failed messages can be retried up to maxRetries
3. Status transitions are one-way
4. Outbound messages require active connection

### Lifecycle

```
Created → Sending → Sent → Delivered → Read
    ↓        ↓
  Failed → Retrying → Failed (max retries)
```

---

## Entity: Store (Commerce Core)

### Purpose
A commerce storefront within a workspace.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| workspaceId | FK | Parent workspace |
| name | String | Store display name |
| description | Text | Store description |
| phoneNumber | String | Primary WhatsApp number |
| catalogUrl | String | Optional external catalog URL |
| currency | String | ISO 4217 currency code |
| isActive | Boolean | Whether store is accepting orders |
| settings | JSON | Store configuration |
| metadata | JSON | Store-specific data |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

### Relationships

- Belongs to: Workspace
- Has many: Product
- Has many: Order
- Has many: Customer
- Has many: Conversation

### Business Rules

1. Store name must be unique within a workspace
2. Phone number must be valid E.164 format
3. Inactive stores cannot receive new orders

### Lifecycle

```
Created → Active ↔ Inactive → Archived
```

---

## Entity: Conversation (Commerce Core)

### Purpose
Represents a chat thread between the business and a customer.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| instanceId | FK | WhatsApp instance handling this conversation |
| customerId | FK | Customer participant |
| storeId | FK | Store context |
| status | Enum | Conversation status |
| priority | Enum | LOW, NORMAL, HIGH, URGENT |
| assigneeId | FK | Assigned agent (nullable) |
| tags | Array | Categorization tags |
| lastMessageAt | DateTime | Timestamp of last message |
| lastMessagePreview | String | Truncated last message |
| unreadCount | Integer | Unread message count |
| metadata | JSON | Additional data |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

### Business Rules

1. One active conversation per customer per instance
2. Auto-close after 30 days of inactivity
3. Priority can be auto-assigned based on keywords

### Lifecycle

```
Created → Active → Waiting → Resolved → Closed
              ↑         ↓         ↓
              └─── Reopened ←────┘
```

---

## Entity: Customer (Commerce Core)

### Purpose
Represents a WhatsApp user who has interacted with the business.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| workspaceId | FK | Parent workspace |
| phoneNumber | String | WhatsApp phone number |
| name | String | Contact name |
| pushName | String | WhatsApp push name |
| profilePictureUrl | String | Profile picture URL |
| isBusiness | Boolean | Whether business account |
| businessName | String | Business name if applicable |
| tags | Array | Customer segmentation tags |
| notes | Text | Internal notes |
| totalOrders | Integer | Lifetime order count |
| totalSpent | Decimal | Lifetime spend amount |
| lastInteractionAt | DateTime | Last message timestamp |
| metadata | JSON | Additional data |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

### Business Rules

1. Phone number unique per workspace
2. Created automatically on first inbound message
3. Stats auto-update on order creation

### Lifecycle

```
Created → Active → Inactive → Archived
```

---

## Entity: Product (Commerce Core)

### Purpose
Product catalog item.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| storeId | FK | Parent store |
| externalId | String | External system ID |
| name | String | Product name |
| description | Text | Product description |
| sku | String | Stock keeping unit |
| price | Decimal | Current price |
| compareAtPrice | Decimal | Original price |
| costPrice | Decimal | Cost price |
| currency | String | ISO 4217 currency code |
| inventoryQuantity | Integer | Current stock |
| trackInventory | Boolean | Whether to track stock |
| isActive | Boolean | Available for sale |
| media | JSON | Product images |
| attributes | JSON | Variant attributes |
| tags | Array | Product tags |
| weight | Decimal | Weight for shipping |
| metadata | JSON | Additional data |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

### Business Rules

1. SKU unique within store
2. Price must be positive
3. Inventory cannot go negative (if tracked)

### Lifecycle

```
Draft → Active ↔ Inactive → Archived
```

---

## Entity: Order (Commerce Core)

### Purpose
Represents a customer purchase.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| storeId | FK | Parent store |
| customerId | FK | Customer placing order |
| conversationId | FK | Conversation where order originated |
| orderNumber | String | Human-readable order number |
| status | Enum | Order status |
| paymentStatus | Enum | Payment status |
| fulfillmentStatus | Enum | Fulfillment status |
| subtotal | Decimal | Sum of item prices |
| tax | Decimal | Tax amount |
| shipping | Decimal | Shipping cost |
| discount | Decimal | Discount amount |
| total | Decimal | Final total |
| currency | String | ISO 4217 currency code |
| shippingAddress | JSON | Delivery address |
| billingAddress | JSON | Billing address |
| notes | Text | Order notes |
| metadata | JSON | Additional data |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

### Business Rules

1. Order number auto-generated: `{storeCode}-{YYYYMMDD}-{sequence}`
2. Total = subtotal + tax + shipping - discount
3. Status transitions follow defined workflow
4. Cancelled orders restore inventory

### Status Workflow

```
Order:      PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED → COMPLETED
Payment:    PENDING → AUTHORIZED → CAPTURED → REFUNDED
Fulfillment: UNFULFILLED → PARTIALLY_FULFILLED → FULFILLED → DELIVERED
```

---

## Entity: OrderItem (Commerce Core)

### Purpose
Line item within an order.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| orderId | FK | Parent order |
| productId | FK | Product reference |
| quantity | Integer | Quantity ordered |
| unitPrice | Decimal | Price at time of order |
| total | Decimal | quantity × unitPrice |
| productName | String | Product name snapshot |
| productSku | String | SKU snapshot |
| metadata | JSON | Additional data |
| createdAt | DateTime | Creation timestamp |

### Business Rules

1. Quantity must be at least 1
2. Unit price is snapshot from Product.price
3. Total = quantity × unitPrice

---

## Entity: Workspace (Shared)

### Purpose
Top-level tenant boundary. Shared between wa-core and commerce-core.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| name | String | Workspace name |
| slug | String | URL-safe identifier |
| plan | Enum | FREE, PRO, ENTERPRISE |
| settings | JSON | Workspace configuration |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

### Business Rules

1. Slug must be unique
2. Default plan is FREE
3. Deleting cascades to all resources

---

## Entity: Event (Shared)

### Purpose
Audit log for all significant system events.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| eventType | Enum | Event type |
| aggregateType | String | Entity type |
| aggregateId | UUID | Entity ID |
| workspaceId | FK | Workspace scope |
| source | Enum | WA_CORE, COMMERCE_CORE |
| payload | JSON | Event data |
| metadata | JSON | Request context |
| processedAt | DateTime | When processed |
| createdAt | DateTime | Creation timestamp |

### Business Rules

1. Events are immutable
2. All business operations emit events
3. Events enable replay for debugging

---

# Event Catalog

## Event Categories

Events are categorized by source:

1. **WA Core Events** - WhatsApp connection and messaging
2. **Commerce Core Events** - Business operations
3. **Cross-Boundary Events** - Communication between packages

---

## WA Core Events (Outbound)

These events are emitted BY wa-core:

### INSTANCE_CREATED
```typescript
{
  type: 'INSTANCE_CREATED';
  source: 'WA_CORE';
  aggregateType: 'WhatsAppInstance';
  aggregateId: string;
  payload: {
    instanceId: string;
    workspaceId: string;
    storeId?: string;
    name: string;
    phoneNumber: string;
    provider: ProviderType;
  };
}
```

### INSTANCE_CONNECTED
```typescript
{
  type: 'INSTANCE_CONNECTED';
  source: 'WA_CORE';
  aggregateType: 'WhatsAppInstance';
  aggregateId: string;
  payload: {
    instanceId: string;
    connectedAt: Date;
    sessionId: string;
  };
}
```

### INSTANCE_DISCONNECTED
```typescript
{
  type: 'INSTANCE_DISCONNECTED';
  source: 'WA_CORE';
  aggregateType: 'WhatsAppInstance';
  aggregateId: string;
  payload: {
    instanceId: string;
    reason: string;
    willReconnect: boolean;
  };
}
```

### QR_GENERATED
```typescript
{
  type: 'QR_GENERATED';
  source: 'WA_CORE';
  aggregateType: 'WhatsAppInstance';
  aggregateId: string;
  payload: {
    instanceId: string;
    sessionId: string;
    qrCode: string;
    expiresAt: Date;
  };
}
```

### QR_SCANNED
```typescript
{
  type: 'QR_SCANNED';
  source: 'WA_CORE';
  aggregateType: 'WhatsAppInstance';
  aggregateId: string;
  payload: {
    instanceId: string;
    sessionId: string;
  };
}
```

### QR_EXPIRED
```typescript
{
  type: 'QR_EXPIRED';
  source: 'WA_CORE';
  aggregateType: 'WhatsAppInstance';
  aggregateId: string;
  payload: {
    instanceId: string;
    sessionId: string;
  };
}
```

### MESSAGE_RECEIVED
```typescript
{
  type: 'MESSAGE_RECEIVED';
  source: 'WA_CORE';
  aggregateType: 'Message';
  aggregateId: string;
  payload: {
    messageId: string;
    instanceId: string;
    externalId: string;
    from: string;
    to: string;
    type: MessageType;
    content: MessageContent;
    timestamp: Date;
  };
}
```

### MESSAGE_SENT
```typescript
{
  type: 'MESSAGE_SENT';
  source: 'WA_CORE';
  aggregateType: 'Message';
  aggregateId: string;
  payload: {
    messageId: string;
    instanceId: string;
    externalId: string;
    to: string;
    timestamp: Date;
  };
}
```

### MESSAGE_DELIVERED
```typescript
{
  type: 'MESSAGE_DELIVERED';
  source: 'WA_CORE';
  aggregateType: 'Message';
  aggregateId: string;
  payload: {
    messageId: string;
    externalId: string;
    deliveredAt: Date;
  };
}
```

### MESSAGE_READ
```typescript
{
  type: 'MESSAGE_READ';
  source: 'WA_CORE';
  aggregateType: 'Message';
  aggregateId: string;
  payload: {
    messageId: string;
    externalId: string;
    readAt: Date;
  };
}
```

### MESSAGE_FAILED
```typescript
{
  type: 'MESSAGE_FAILED';
  source: 'WA_CORE';
  aggregateType: 'Message';
  aggregateId: string;
  payload: {
    messageId: string;
    instanceId: string;
    error: string;
    retryable: boolean;
  };
}
```

---

## Commerce Core Events (Outbound)

These events are emitted BY commerce-core:

### CONVERSATION_CREATED
```typescript
{
  type: 'CONVERSATION_CREATED';
  source: 'COMMERCE_CORE';
  aggregateType: 'Conversation';
  aggregateId: string;
  payload: {
    conversationId: string;
    instanceId: string;
    customerId: string;
    storeId: string;
  };
}
```

### CUSTOMER_CREATED
```typescript
{
  type: 'CUSTOMER_CREATED';
  source: 'COMMERCE_CORE';
  aggregateType: 'Customer';
  aggregateId: string;
  payload: {
    customerId: string;
    workspaceId: string;
    phoneNumber: string;
    name?: string;
  };
}
```

### ORDER_CREATED
```typescript
{
  type: 'ORDER_CREATED';
  source: 'COMMERCE_CORE';
  aggregateType: 'Order';
  aggregateId: string;
  payload: {
    orderId: string;
    orderNumber: string;
    storeId: string;
    customerId: string;
    items: Array<{ productId: string; quantity: number }>;
    total: number;
    currency: string;
  };
}
```

### PRODUCT_CREATED
```typescript
{
  type: 'PRODUCT_CREATED';
  source: 'COMMERCE_CORE';
  aggregateType: 'Product';
  aggregateId: string;
  payload: {
    productId: string;
    storeId: string;
    name: string;
    sku: string;
    price: number;
  };
}
```

### MESSAGE_SEND_REQUEST
```typescript
{
  type: 'MESSAGE_SEND_REQUEST';
  source: 'COMMERCE_CORE';
  aggregateType: 'Message';
  aggregateId: string;  // Will be set by wa-core
  payload: {
    instanceId: string;
    to: string;
    type: MessageType;
    content: MessageContent;
    conversationId: string;
    metadata?: Record<string, any>;
  };
}
```

---

## Cross-Boundary Event Flow

### Inbound Message Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           INBOUND MESSAGE FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│  WhatsApp    │
│  Server      │
└──────┬───────┘
       │ Raw WebSocket Message
       ▼
┌──────────────┐
│   Baileys    │ Receives raw message
│   Provider   │ Translates to domain format
└──────┬───────┘ Emits MESSAGE_RECEIVED
       │
       ▼
┌──────────────┐
│  WA Core     │ Processes message
│  (Internal)  │ Stores in database
└──────┬───────┘
       │
       │ MESSAGE_RECEIVED event
       ▼
┌──────────────┐
│  Event Bus   │ Routes to commerce-core
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                     COMMERCE CORE PROCESSING                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────┐
│ Conversation │ Finds/creates conversation
│ Engine       │ Updates conversation state
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Command    │ Parses message for commands
│   Parser     │ Routes to appropriate handler
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Business    │ Processes order/inquiry/etc.
│  Logic       │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Repositories │ Persists to database
└──────────────┘
```

### Outbound Message Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           OUTBOUND MESSAGE FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│  Commerce    │ Business logic determines reply
│  Core        │ Creates MESSAGE_SEND_REQUEST event
└──────┬───────┘
       │
       │ MESSAGE_SEND_REQUEST event
       ▼
┌──────────────┐
│  Event Bus   │ Routes to wa-core
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        WA CORE PROCESSING                                           │
└─────────────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────┐
│  Message     │ Validates request
│  Dispatcher  │ Creates message record
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Connection  │ Gets provider connection
│  Manager     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Baileys    │ Translates to provider format
│   Provider   │ Sends via WebSocket
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  WA Core     │ Updates message status
│  (Internal)  │ Emits MESSAGE_SENT event
└──────────────┘
```

---

## Event Handler Registry

```typescript
// wa-core handlers (listens to outbound events from commerce-core)
const waCoreHandlers = {
  'MESSAGE_SEND_REQUEST': [MessageDispatcher.handleSendRequest],
  'PRESENCE_UPDATE': [PresenceHandler.handleUpdate],
  'READ_RECEIPT': [ReadReceiptHandler.handleReceipt],
};

// commerce-core handlers (listens to outbound events from wa-core)
const commerceCoreHandlers = {
  'MESSAGE_RECEIVED': [
    ConversationEngine.processIncomingMessage,
    AnalyticsService.trackMessage
  ],
  'MESSAGE_SENT': [
    ConversationEngine.processOutgoingMessage,
    AnalyticsService.trackMessage
  ],
  'MESSAGE_DELIVERED': [
    ConversationEngine.updateDeliveryStatus
  ],
  'MESSAGE_READ': [
    ConversationEngine.updateReadStatus
  ],
  'MESSAGE_FAILED': [
    NotificationService.notifyFailedMessage
  ],
};
```

---

# Contracts & Interfaces

## WA Core Interfaces

### IWhatsAppProvider

```typescript
interface IWhatsAppProvider extends EventEmitter {
  readonly providerType: ProviderType;
  
  // Connection
  connect(options?: ConnectionOptions): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;
  getConnectionStatus(): ConnectionStatus;
  
  // QR Code
  getQRCode(): Promise<QRCodeResult>;
  
  // Messaging
  sendMessage(options: SendMessageOptions): Promise<SendMessageResult>;
  
  // Presence
  sendPresenceUpdate(presence: PresenceType, to: string): Promise<void>;
  
  // Read Receipts
  sendReadReceipt(messageId: string): Promise<void>;
  
  // Session
  saveAuthState(): Promise<AuthState>;
  loadAuthState(state: AuthState): Promise<void>;
  logout(): Promise<void>;
  
  // Media
  downloadMedia(messageId: string): Promise<Buffer>;
  uploadMedia(buffer: Buffer, type: MediaType): Promise<string>;
  
  // Cleanup
  destroy(): Promise<void>;
}
```

### IProviderRegistry

```typescript
interface IProviderRegistry {
  register(type: ProviderType, factory: IProviderFactory): void;
  unregister(type: ProviderType): void;
  getFactory(type: ProviderType): IProviderFactory | null;
  getSupportedProviders(): ProviderType[];
  isProviderSupported(type: ProviderType): boolean;
}
```

### IProviderFactory

```typescript
interface IProviderFactory {
  createProvider(instanceId: string): IWhatsAppProvider;
  getCapabilities(): ProviderCapabilities;
}
```

### IProviderHealth

```typescript
interface IProviderHealth {
  checkHealth(instanceId: string): Promise<HealthStatus>;
  getMetrics(instanceId: string): Promise<ProviderMetrics>;
  resetMetrics(instanceId: string): Promise<void>;
}

interface HealthStatus {
  healthy: boolean;
  latency?: number;
  error?: string;
  lastChecked: Date;
}

interface ProviderMetrics {
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  uptime: number;
  lastActivity: Date;
}
```

### IProviderCapabilities

```typescript
interface IProviderCapabilities {
  providerType: ProviderType;
  features: {
    text: boolean;
    media: boolean;
    location: boolean;
    contacts: boolean;
    reactions: boolean;
    replies: boolean;
    groups: boolean;
    presence: boolean;
    readReceipts: boolean;
  };
  limits: {
    maxMessageLength: number;
    maxMediaSize: number;
    supportedMimeTypes: string[];
  };
}
```

### ISessionManager

```typescript
interface ISessionManager {
  createInstance(data: CreateInstanceData): Promise<WhatsAppInstance>;
  connectInstance(instanceId: string): Promise<ConnectionResult>;
  disconnectInstance(instanceId: string): Promise<void>;
  deleteInstance(instanceId: string): Promise<void>;
  getInstance(instanceId: string): Promise<WhatsAppInstance | null>;
  listInstances(workspaceId: string): Promise<WhatsAppInstance[]>;
  getInstanceStatus(instanceId: string): Promise<ConnectionStatus>;
  getActiveSession(instanceId: string): Promise<WhatsAppSession | null>;
  restoreSession(instanceId: string): Promise<boolean>;
  revokeSession(instanceId: string): Promise<void>;
}
```

### IConnectionManager

```typescript
interface IConnectionManager {
  getConnection(instanceId: string): Promise<IWhatsAppProvider | null>;
  hasConnection(instanceId: string): boolean;
  initializeConnection(instanceId: string): Promise<IWhatsAppProvider>;
  removeConnection(instanceId: string): Promise<void>;
  reconnectAll(): Promise<void>;
  getConnectionStatus(instanceId: string): ConnectionStatus;
  getAllConnectionStatuses(): Map<string, ConnectionStatus>;
  healthCheck(): Promise<ConnectionHealthReport>;
}
```

### IMessageDispatcher

```typescript
interface IMessageDispatcher {
  sendText(instanceId: string, to: string, text: string): Promise<Message>;
  sendImage(instanceId: string, to: string, image: Buffer, caption?: string): Promise<Message>;
  sendFile(instanceId: string, to: string, file: Buffer, fileName: string): Promise<Message>;
  sendAudio(instanceId: string, to: string, audio: Buffer): Promise<Message>;
  sendVideo(instanceId: string, to: string, video: Buffer, caption?: string): Promise<Message>;
  handleIncomingMessage(instanceId: string, rawMessage: any): Promise<void>;
  retryMessage(messageId: string): Promise<void>;
  updateMessageStatus(externalId: string, status: MessageStatus): Promise<void>;
}
```

---

## Commerce Core Interfaces

### IConversationEngine

```typescript
interface IConversationEngine {
  getOrCreateConversation(instanceId: string, phoneNumber: string, storeId: string): Promise<Conversation>;
  closeConversation(conversationId: string): Promise<void>;
  reopenConversation(conversationId: string): Promise<void>;
  processIncomingMessage(message: Message): Promise<void>;
  processOutgoingMessage(message: Message): Promise<void>;
  parseCommand(text: string): Promise<CommandResult | null>;
  getConversation(conversationId: string): Promise<Conversation | null>;
  listConversations(storeId: string, filters?: ConversationFilters): Promise<Conversation[]>;
}
```

### ICustomerEngine

```typescript
interface ICustomerEngine {
  getOrCreateCustomer(workspaceId: string, phoneNumber: string, data?: Partial<Customer>): Promise<Customer>;
  updateCustomer(customerId: string, data: UpdateCustomerData): Promise<Customer>;
  getCustomer(customerId: string): Promise<Customer | null>;
  listCustomers(workspaceId: string, filters?: CustomerFilters): Promise<Customer[]>;
}
```

### IOrderEngine

```typescript
interface IOrderEngine {
  createOrder(data: CreateOrderData): Promise<Order>;
  updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order>;
  cancelOrder(orderId: string, reason?: string): Promise<Order>;
  completeOrder(orderId: string): Promise<Order>;
  getOrder(orderId: string): Promise<Order | null>;
  listOrders(storeId: string, filters?: OrderFilters): Promise<Order[]>;
}
```

### IProductEngine

```typescript
interface IProductEngine {
  createProduct(data: CreateProductData): Promise<Product>;
  updateProduct(productId: string, data: UpdateProductData): Promise<Product>;
  getProduct(productId: string): Promise<Product | null>;
  listProducts(storeId: string, filters?: ProductFilters): Promise<Product[]>;
  searchProducts(storeId: string, query: string): Promise<Product[]>;
  updateInventory(productId: string, quantityChange: number): Promise<Product>;
}
```

### ICommandParser

```typescript
interface ICommandParser {
  parse(text: string): Promise<CommandResult | null>;
  registerCommand(pattern: string, handler: CommandHandler): void;
  getRegisteredCommands(): string[];
}

interface CommandResult {
  command: string;
  args: Record<string, any>;
  raw: string;
  confidence: number;
}

type CommandHandler = (args: Record<string, any>, context: CommandContext) => Promise<void>;
```

---

## Repository Interfaces

### WA Core Repositories

```typescript
interface IInstanceRepository {
  findById(id: string): Promise<WhatsAppInstance | null>;
  findByWorkspaceId(workspaceId: string): Promise<WhatsAppInstance[]>;
  findByPhoneNumber(workspaceId: string, phoneNumber: string): Promise<WhatsAppInstance | null>;
  create(data: CreateInstanceData): Promise<WhatsAppInstance>;
  updateStatus(id: string, status: InstanceStatus): Promise<WhatsAppInstance>;
  incrementErrorCount(id: string): Promise<WhatsAppInstance>;
  resetErrorCount(id: string): Promise<WhatsAppInstance>;
  softDelete(id: string): Promise<void>;
}

interface ISessionRepository {
  findById(id: string): Promise<WhatsAppSession | null>;
  findByInstanceId(instanceId: string): Promise<WhatsAppSession | null>;
  findActiveByInstanceId(instanceId: string): Promise<WhatsAppSession | null>;
  create(data: CreateSessionData): Promise<WhatsAppSession>;
  update(id: string, data: UpdateSessionData): Promise<WhatsAppSession>;
  deactivate(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}

interface IMessageRepository {
  findById(id: string): Promise<Message | null>;
  findByConversationId(conversationId: string, pagination?: PaginationOptions): Promise<Message[]>;
  findByExternalId(instanceId: string, externalId: string): Promise<Message | null>;
  create(data: CreateMessageData): Promise<Message>;
  updateStatus(id: string, status: MessageStatus): Promise<Message>;
  countByConversation(conversationId: string): Promise<number>;
}
```

### Commerce Core Repositories

```typescript
interface IStoreRepository {
  findById(id: string): Promise<Store | null>;
  findByWorkspaceId(workspaceId: string): Promise<Store[]>;
  create(data: CreateStoreData): Promise<Store>;
  update(id: string, data: UpdateStoreData): Promise<Store>;
  softDelete(id: string): Promise<void>;
}

interface IConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findByInstanceAndCustomer(instanceId: string, customerId: string): Promise<Conversation | null>;
  findByStoreId(storeId: string, filters?: ConversationFilters): Promise<Conversation[]>;
  create(data: CreateConversationData): Promise<Conversation>;
  update(id: string, data: UpdateConversationData): Promise<Conversation>;
  incrementUnreadCount(id: string): Promise<void>;
  resetUnreadCount(id: string): Promise<void>;
}

interface ICustomerRepository {
  findById(id: string): Promise<Customer | null>;
  findByPhoneNumber(workspaceId: string, phoneNumber: string): Promise<Customer | null>;
  create(data: CreateCustomerData): Promise<Customer>;
  update(id: string, data: UpdateCustomerData): Promise<Customer>;
  incrementOrderStats(id: string, orderTotal: number): Promise<void>;
}

interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  findByOrderNumber(storeId: string, orderNumber: string): Promise<Order | null>;
  findByStoreId(storeId: string, filters?: OrderFilters): Promise<Order[]>;
  create(data: CreateOrderData): Promise<Order>;
  update(id: string, data: UpdateOrderData): Promise<Order>;
  getNextOrderNumber(storeId: string): Promise<string>;
}

interface IProductRepository {
  findById(id: string): Promise<Product | null>;
  findByStoreId(storeId: string, filters?: ProductFilters): Promise<Product[]>;
  findBySku(storeId: string, sku: string): Promise<Product | null>;
  search(storeId: string, query: string): Promise<Product[]>;
  create(data: CreateProductData): Promise<Product>;
  update(id: string, data: UpdateProductData): Promise<Product>;
  updateInventory(id: string, quantityChange: number): Promise<Product>;
  getLowStockProducts(storeId: string, threshold: number): Promise<Product[]>;
}
```

---

## Shared Interfaces

### IEventBus

```typescript
interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
  publishMany(events: DomainEvent[]): Promise<void>;
  subscribe<T extends EventType>(eventType: T, handler: EventHandler<T>): Subscription;
  subscribeAll(handler: EventHandler<EventType>): Subscription;
  start(): Promise<void>;
  stop(): Promise<void>;
}

interface DomainEvent {
  type: EventType;
  source: 'WA_CORE' | 'COMMERCE_CORE' | 'SHARED';
  aggregateType: string;
  aggregateId: string;
  workspaceId: string;
  payload: Record<string, any>;
  metadata?: EventMetadata;
  timestamp: Date;
}

interface EventMetadata {
  userId?: string;
  correlationId?: string;
  causationId?: string;
}
```

---

# Database Design

## Database Ownership

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE OWNERSHIP                                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐   │
│  │          WA CORE TABLES             │  │       COMMERCE CORE TABLES          │   │
│  ├─────────────────────────────────────┤  ├─────────────────────────────────────┤   │
│  │  whatsapp_instances                 │  │  stores                            │   │
│  │  whatsapp_sessions                  │  │  customers                         │   │
│  │  messages                           │  │  conversations                     │   │
│  │                                     │  │  products                          │   │
│  │                                     │  │  orders                            │   │
│  │                                     │  │  order_items                       │   │
│  └─────────────────────────────────────┘  └─────────────────────────────────────┘   │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                           SHARED TABLES                                     │   │
│  ├─────────────────────────────────────────────────────────────────────────────┤   │
│  │  workspaces                                                                │   │
│  │  events                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Prisma Schema (Unified)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ============================================
// SHARED TABLES
// ============================================

model Workspace {
  id            String           @id @default(cuid())
  name          String
  slug          String           @unique
  plan          WorkspacePlan    @default(FREE)
  settings      Json             @default("{}")
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  deletedAt     DateTime?

  // WA Core relations
  instances     WhatsAppInstance[]
  
  // Commerce Core relations
  stores        Store[]
  customers     Customer[]

  @@index([slug])
  @@map("workspaces")
}

model Event {
  id            String           @id @default(cuid())
  eventType     String
  aggregateType String
  aggregateId   String
  workspaceId   String
  source        EventSource
  payload       Json
  metadata      Json             @default("{}")
  processedAt   DateTime?
  createdAt     DateTime         @default(now())

  workspace     Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@index([eventType])
  @@index([aggregateType, aggregateId])
  @@index([source])
  @@index([createdAt(sort: Desc)])
  @@index([processedAt])
  @@map("events")
}

enum WorkspacePlan {
  FREE
  PRO
  ENTERPRISE
}

enum EventSource {
  WA_CORE
  COMMERCE_CORE
  SHARED
}

// ============================================
// WA CORE TABLES
// ============================================

model WhatsAppInstance {
  id                    String           @id @default(cuid())
  workspaceId           String
  storeId               String?
  name                  String
  phoneNumber           String
  provider              ProviderType     @default(BAILEYS)
  status                InstanceStatus   @default(DISCONNECTED)
  authState             Json?
  lastConnectedAt       DateTime?
  lastDisconnectedAt    DateTime?
  errorCount            Int              @default(0)
  maxErrors             Int              @default(10)
  lastError             String?          @db.Text
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt
  deletedAt             DateTime?

  workspace             Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  store                 Store?           @relation(fields: [storeId], references: [id], onDelete: SetNull)
  sessions              WhatsAppSession[]
  messages              Message[]

  @@unique([workspaceId, phoneNumber])
  @@index([workspaceId])
  @@index([storeId])
  @@index([status])
  @@map("whatsapp_instances")
}

model WhatsAppSession {
  id            String           @id @default(cuid())
  instanceId    String
  sessionId     String           @unique
  status        SessionStatus    @default(INACTIVE)
  qrCode        String?          @db.Text
  qrGeneratedAt DateTime?
  qrExpiresAt   DateTime?
  authData      Json?
  isActive      Boolean          @default(false)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  deletedAt     DateTime?

  instance      WhatsAppInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)

  @@index([instanceId])
  @@index([status])
  @@map("whatsapp_sessions")
}

model Message {
  id                String           @id @default(cuid())
  instanceId        String
  externalId        String?
  conversationId    String?
  direction         MessageDirection
  type              MessageType
  content           Json
  mediaUrl          String?          @db.Text
  mimeType          String?
  status            MessageStatus    @default(PENDING)
  error             String?          @db.Text
  retryCount        Int              @default(0)
  maxRetries        Int              @default(3)
  quotedMessageId   String?
  timestamp         DateTime
  metadata          Json             @default("{}")
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  deletedAt         DateTime?

  instance          WhatsAppInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)
  conversation      Conversation?    @relation(fields: [conversationId], references: [id], onDelete: SetNull)
  quotedMessage     Message?         @relation("QuotedMessages", fields: [quotedMessageId], references: [id])
  quotedBy          Message[]        @relation("QuotedMessages")

  @@unique([instanceId, externalId])
  @@index([conversationId])
  @@index([status])
  @@index([direction])
  @@index([timestamp(sort: Desc)])
  @@map("messages")
}

enum ProviderType {
  BAILEYS
  META
  TWILIO
  EVOLUTION
  GREEN
}

enum InstanceStatus {
  DISCONNECTED
  CONNECTING
  QR_PENDING
  CONNECTED
  ERROR
  DISABLED
}

enum SessionStatus {
  INACTIVE
  QR_PENDING
  QR_SCANNED
  ACTIVE
  EXPIRED
  REVOKED
  FAILED
}

enum MessageType {
  TEXT
  IMAGE
  VIDEO
  AUDIO
  FILE
  LOCATION
  CONTACT
}

enum MessageDirection {
  INBOUND
  OUTBOUND
}

enum MessageStatus {
  PENDING
  SENDING
  SENT
  DELIVERED
  READ
  FAILED
}

// ============================================
// COMMERCE CORE TABLES
// ============================================

model Store {
  id            String           @id @default(cuid())
  workspaceId   String
  name          String
  description   String?          @db.Text
  phoneNumber   String
  catalogUrl    String?          @db.Text
  currency      String           @default("USD")
  isActive      Boolean          @default(true)
  settings      Json             @default("{}")
  metadata      Json             @default("{}")
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  deletedAt     DateTime?

  workspace     Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  instances     WhatsAppInstance[]
  products      Product[]
  orders        Order[]
  customers     Customer[]
  conversations Conversation[]

  @@unique([workspaceId, name])
  @@unique([workspaceId, phoneNumber])
  @@index([workspaceId])
  @@map("stores")
}

model Conversation {
  id                String           @id @default(cuid())
  instanceId        String
  customerId        String
  storeId           String
  status            ConversationStatus @default(ACTIVE)
  priority          ConversationPriority @default(NORMAL)
  assigneeId        String?
  tags              String[]
  lastMessageAt     DateTime?
  lastMessagePreview String?         @db.VarChar(100)
  unreadCount       Int              @default(0)
  metadata          Json             @default("{}")
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  deletedAt         DateTime?

  instance          WhatsAppInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)
  customer          Customer         @relation(fields: [customerId], references: [id], onDelete: Cascade)
  store             Store            @relation(fields: [storeId], references: [id], onDelete: Cascade)
  messages          Message[]

  @@unique([instanceId, customerId])
  @@index([storeId])
  @@index([status])
  @@index([priority])
  @@index([lastMessageAt(sort: Desc)])
  @@map("conversations")
}

model Customer {
  id                String           @id @default(cuid())
  workspaceId       String
  phoneNumber       String
  name              String?          @db.VarChar(100)
  pushName          String?          @db.VarChar(100)
  profilePictureUrl String?          @db.Text
  isBusiness        Boolean          @default(false)
  businessName      String?          @db.VarChar(100)
  tags              String[]
  notes             String?          @db.Text
  totalOrders       Int              @default(0)
  totalSpent        Decimal          @default(0) @db.Decimal(12, 2)
  lastInteractionAt DateTime?
  metadata          Json             @default("{}")
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  deletedAt         DateTime?

  workspace         Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  stores            Store[]          @relation("StoreCustomers")
  conversations     Conversation[]
  orders            Order[]

  @@unique([workspaceId, phoneNumber])
  @@index([workspaceId])
  @@index([lastInteractionAt(sort: Desc)])
  @@map("customers")
}

model Product {
  id                String           @id @default(cuid())
  storeId           String
  externalId        String?
  name              String           @db.VarChar(200)
  description       String?          @db.Text
  sku               String           @db.VarChar(50)
  price             Decimal          @db.Decimal(12, 2)
  compareAtPrice    Decimal?         @db.Decimal(12, 2)
  costPrice         Decimal?         @db.Decimal(12, 2)
  currency          String           @default("USD")
  inventoryQuantity Int              @default(0)
  trackInventory    Boolean          @default(true)
  isActive          Boolean          @default(true)
  media             Json             @default("[]")
  attributes        Json             @default("{}")
  tags              String[]
  weight            Decimal?         @db.Decimal(8, 2)
  metadata          Json             @default("{}")
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  deletedAt         DateTime?

  store             Store            @relation(fields: [storeId], references: [id], onDelete: Cascade)
  orderItems        OrderItem[]

  @@unique([storeId, sku])
  @@index([storeId])
  @@index([price])
  @@index([isActive])
  @@map("products")
}

model Order {
  id                String           @id @default(cuid())
  storeId           String
  customerId        String
  conversationId    String?
  orderNumber       String           @db.VarChar(30)
  status            OrderStatus      @default(PENDING)
  paymentStatus     PaymentStatus    @default(PENDING)
  fulfillmentStatus FulfillmentStatus @default(UNFULFILLED)
  subtotal          Decimal          @db.Decimal(12, 2)
  tax               Decimal          @default(0) @db.Decimal(12, 2)
  shipping          Decimal          @default(0) @db.Decimal(12, 2)
  discount          Decimal          @default(0) @db.Decimal(12, 2)
  total             Decimal          @db.Decimal(12, 2)
  currency          String           @default("USD")
  shippingAddress   Json?
  billingAddress    Json?
  notes             String?          @db.Text
  metadata          Json             @default("{}")
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  deletedAt         DateTime?

  store             Store            @relation(fields: [storeId], references: [id], onDelete: Cascade)
  customer          Customer         @relation(fields: [customerId], references: [id], onDelete: Cascade)
  conversation      Conversation?    @relation(fields: [conversationId], references: [id], onDelete: SetNull)
  items             OrderItem[]

  @@unique([storeId, orderNumber])
  @@index([storeId])
  @@index([customerId])
  @@index([status])
  @@index([createdAt(sort: Desc)])
  @@map("orders")
}

model OrderItem {
  id            String           @id @default(cuid())
  orderId       String
  productId     String
  quantity      Int
  unitPrice     Decimal          @db.Decimal(12, 2)
  total         Decimal          @db.Decimal(12, 2)
  productName   String           @db.VarChar(200)
  productSku    String           @db.VarChar(50)
  metadata      Json             @default("{}")
  createdAt     DateTime         @default(now())

  order         Order            @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product       Product          @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@index([productId])
  @@map("order_items")
}

enum ConversationStatus {
  ACTIVE
  WAITING
  RESOLVED
  CLOSED
  ARCHIVED
}

enum ConversationPriority {
  LOW
  NORMAL
  HIGH
  URGENT
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PROCESSING
  SHIPPED
  DELIVERED
  COMPLETED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  AUTHORIZED
  CAPTURED
  FAILED
  REFUNDED
}

enum FulfillmentStatus {
  UNFULFILLED
  PARTIALLY_FULFILLED
  FULFILLED
  DELIVERED
}
```

---

# Application Layer

## WA Core Services

### Session Manager
- Creates WhatsApp instances
- Manages session lifecycle
- Handles QR code generation
- Coordinates with Connection Manager

### Connection Manager
- Maintains connection pool
- Handles reconnection logic
- Provides health checks
- Manages provider lifecycle

### Message Dispatcher
- Routes outbound messages
- Handles retries with exponential backoff
- Updates message status
- Manages media upload/download

### QR Manager
- Generates QR codes
- Handles QR expiration
- Refreshes QR codes

### Media Manager
- Downloads media from WhatsApp
- Uploads media to storage
- Handles media transformation

---

## Commerce Core Services

### Conversation Engine
- Creates/retrieves conversations
- Processes incoming messages
- Updates conversation state
- Manages unread counts

### Customer Engine
- Creates/retrieves customers
- Updates customer profiles
- Manages customer statistics

### Order Engine
- Creates orders
- Manages order lifecycle
- Handles inventory updates
- Processes cancellations

### Product Engine
- Manages product catalog
- Handles inventory tracking
- Processes product search

### Command Parser
- Detects commands in messages
- Routes to appropriate handlers
- Manages command registry

---

# Provider Layer

## Provider Registry Pattern

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           PROVIDER REGISTRY                                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                         ProviderRegistry                                    │   │
│  ├─────────────────────────────────────────────────────────────────────────────┤   │
│  │  - providers: Map<ProviderType, ProviderFactory>                            │   │
│  │  - register(type, factory)                                                  │   │
│  │  - getFactory(type)                                                         │   │
│  │  - getSupportedProviders()                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                         ProviderHealth                                       │   │
│  ├─────────────────────────────────────────────────────────────────────────────┤   │
│  │  - checkHealth(instanceId)                                                   │   │
│  │  - getMetrics(instanceId)                                                    │   │
│  │  - resetMetrics(instanceId)                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                         ProviderCapabilities                                 │   │
│  ├─────────────────────────────────────────────────────────────────────────────┤   │
│  │  - providerType: ProviderType                                               │   │
│  │  - features: { text, media, location, ... }                                 │   │
│  │  - limits: { maxMessageLength, maxMediaSize, ... }                          │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                         ProviderMetrics                                      │   │
│  ├─────────────────────────────────────────────────────────────────────────────┤   │
│  │  - messagesSent: number                                                     │   │
│  │  - messagesReceived: number                                                 │   │
│  │  - errors: number                                                           │   │
│  │  - uptime: number                                                           │   │
│  │  - lastActivity: Date                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Adding a New Provider

To add a new provider (e.g., Meta Cloud API):

1. Create `packages/wa-core/src/infrastructure/providers/meta/`
2. Implement `IWhatsAppProvider` interface
3. Create `MetaProviderFactory` implementing `IProviderFactory`
4. Register with `ProviderRegistry`:

```typescript
// Registration
providerRegistry.register('META', new MetaProviderFactory());

// Usage - no changes to business logic
const provider = providerFactory.createProvider('META', instanceId);
```

---

# Future SaaS Considerations

## Entity: Tenant (Future)

### Fields
- id
- workspaceId
- name
- settings
- createdAt

### Relationships
- Belongs to: Workspace
- Has many: User

---

## Entity: User (Future)

### Fields
- id
- tenantId
- email
- name
- role
- permissions
- createdAt

### Relationships
- Belongs to: Tenant
- Has many: Session

---

## Entity: Subscription (Future)

### Fields
- id
- workspaceId
- plan
- status
- currentPeriodStart
- currentPeriodEnd
- cancelAt
- createdAt

### Relationships
- Belongs to: Workspace
- Has one: Billing

---

## Entity: Billing (Future)

### Fields
- id
- subscriptionId
- amount
- currency
- status
- invoiceUrl
- paidAt
- createdAt

### Relationships
- Belongs to: Subscription

---

## Entity: FeatureFlag (Future)

### Fields
- id
- workspaceId
- name
- isEnabled
- rolloutPercentage
- createdAt

### Relationships
- Belongs to: Workspace

---

## Entity: UsageMetric (Future)

### Fields
- id
- workspaceId
- metricType
- value
- period
- recordedAt

### Relationships
- Belongs to: Workspace

---

# Implementation Order

## Sprint 0: Foundation

**Goal:** Project structure, packages, types, interfaces, events

### Tasks
1. Initialize monorepo with pnpm workspaces
2. Create package structure
3. Set up shared package with types, errors, validators
4. Set up event bus in shared package
5. Define all domain types in wa-core
6. Define all domain types in commerce-core
7. Define all repository interfaces
8. Define all service interfaces
9. Define all provider interfaces

### Deliverables
- Monorepo structure
- All TypeScript types
- All interfaces
- Event definitions
- No implementation

---

## Sprint 1: Database

**Goal:** Database schema, repositories

### Tasks
1. Create Prisma schema
2. Run migrations
3. Implement wa-core repositories
4. Implement commerce-core repositories
5. Set up Prisma client singleton

### Deliverables
- Working database
- All repositories implemented
- No provider implementation

---

## Sprint 2: Event Bus & Services

**Goal:** Event bus, application services

### Tasks
1. Implement event bus (in-memory initially)
2. Implement wa-core services (skeletons)
3. Implement commerce-core services (skeletons)
4. Wire up event handlers

### Deliverables
- Working event bus
- Service skeletons
- Event flow working

---

## Sprint 3: Baileys Provider

**Goal:** Baileys integration

### Tasks
1. Implement Baileys provider
2. Implement provider factory
3. Implement provider registry
4. Implement provider health
5. Implement provider metrics

### Deliverables
- Working Baileys connection
- Provider system complete
- QR code generation

---

## Sprint 4: QR & Messaging

**Goal:** QR display, message send/receive

### Tasks
1. Implement QR generation and display
2. Implement message sending
3. Implement message receiving
4. Implement message status updates
5. Implement read receipts

### Deliverables
- Working QR flow
- Messages send and receive
- Status tracking

---

## Sprint 5: Commerce Engine

**Goal:** Commerce features

### Tasks
1. Implement conversation engine
2. Implement customer engine
3. Implement order engine
4. Implement product engine
5. Implement command parser

### Deliverables
- Full commerce flow
- Orders can be created
- Products managed

---

## Sprint 6: Dashboard

**Goal:** UI

### Tasks
1. Set up Next.js dashboard
2. Implement instance management
3. Implement QR display
4. Implement conversation view
5. Implement order management
6. Implement product management

### Deliverables
- Working dashboard
- All features accessible

---

## Sprint 7: Automation

**Goal:** Automation features

### Tasks
1. Implement automation engine
2. Create workflow builder
3. Add triggers and actions
4. Add templates

### Deliverables
- Basic automation
- Workflow builder

---

## Sprint 8: AI

**Goal:** AI features

### Tasks
1. Implement AI engine
2. Add response suggestions
3. Add sentiment analysis
4. Add smart replies

### Deliverables
- AI-powered features

---

# Summary

## Architecture Principles

1. **Strict Package Boundaries** - No cross-imports between wa-core and commerce-core
2. **Event-Driven Communication** - All cross-boundary communication via events
3. **Provider Isolation** - Business logic never knows which provider is used
4. **Domain-Driven Design** - Entities, value objects, aggregates properly modeled
5. **Clean Architecture** - Dependencies point inward, domain has no external dependencies

## Key Design Decisions

1. **Monorepo** - Maximum separation while enabling shared code
2. **Dual Domain Boundaries** - WA Core and Commerce Core are separate bounded contexts
3. **Event Bus** - Only way for packages to communicate
4. **Provider Registry** - Pluggable provider system
5. **Future SaaS Ready** - Designed for multi-tenancy from day one

## Success Criteria

- ✅ Replace Baileys with any provider without changing commerce-core
- ✅ Add new features to commerce-core without touching wa-core
- ✅ Scale WA Core and Commerce Core independently
- ✅ Support multiple tenants with isolated data
- ✅ Maintain type safety across all packages

---

**Awaiting approval before proceeding to Sprint 0 implementation.**


---

## Entity: Workspace

### Purpose
Top-level tenant boundary. Every resource belongs to a workspace. Enables future multi-tenancy for SaaS.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier (cuid) |
| name | String | Human-readable workspace name |
| slug | String | URL-safe unique identifier |
| plan | Enum | FREE, PRO, ENTERPRISE |
| settings | JSON | Workspace-level configuration |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

### Relationships

- Has many: WhatsAppInstance
- Has many: Store
- Has many: User (future - auth layer)

### Business Rules

1. Slug must be unique across all workspaces
2. Slug must be URL-safe (lowercase alphanumeric + hyphens)
3. Workspace name cannot exceed 100 characters
4. Default plan is FREE on creation
5. Deleting a workspace cascades to all child resources

### Validation Rules

```
name: required, min(1), max(100)
slug: required, min(3), max(50), pattern(/^[a-z0-9-]+$/)
plan: required, enum(WorkspacePlan)
```

### Lifecycle

```
Created → Active → Suspended → Deleted
```

---

## Entity: Store

### Purpose
A commerce storefront within a workspace. Each store has its own product catalog, order management, and customer base. One workspace can have multiple stores (e.g., different brands or regions).

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| workspaceId | FK | Parent workspace |
| name | String | Store display name |
| description | Text | Store description |
| phoneNumber | String | Primary WhatsApp number |
| catalogUrl | String | Optional external catalog URL |
| currency | String | ISO 4217 currency code |
| isActive | Boolean | Whether store is accepting orders |
| metadata | JSON | Store-specific configuration |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

### Relationships

- Belongs to: Workspace
- Has many: Product
- Has many: Order
- Has many: Customer
- Has one: WhatsAppInstance (primary)

### Business Rules

1. Store name must be unique within a workspace
2. Phone number must be valid E.164 format
3. Currency must be valid ISO 4217 code
4. Inactive stores cannot receive new orders
5. Store deletion soft-deletes all products and archives orders

### Validation Rules

```
workspaceId: required, UUID
name: required, min(1), max(100)
description: optional, max(500)
phoneNumber: required, pattern(/^\+[1-9]\d{1,14}$/)
currency: required, length(3), uppercase
isActive: required, boolean
```

### Lifecycle

```
Created → Active ↔ Inactive → Archived
```

---

## Entity: WhatsAppInstance

### Purpose
Represents a single WhatsApp Web connection. Manages the technical connection to WhatsApp servers. Each instance has its own authentication state and connection lifecycle.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| workspaceId | FK | Parent workspace |
| storeId | FK | Associated store (nullable) |
| name | String | Instance display name |
| phoneNumber | String | Linked WhatsApp number |
| provider | Enum | BAILEYS, META, TWILIO, etc. |
| status | Enum | Connection status |
| authState | JSON | Encrypted authentication credentials |
| lastConnectedAt | DateTime | Last successful connection |
| lastDisconnectedAt | DateTime | Last disconnection |
| errorCount | Integer | Consecutive error count |
| lastError | Text | Last error message |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

### Relationships

- Belongs to: Workspace
- Belongs to: Store (optional)
- Has one: WhatsAppSession
- Has many: Conversation
- Has many: Message (sent/received through this instance)

### Business Rules

1. One instance per phone number per workspace
2. Instance can be associated with only one store
3. Error count resets on successful connection
4. Error count increments on each connection failure
5. Auto-disable after 10 consecutive errors
6. Auth state must be encrypted at rest

### Validation Rules

```
workspaceId: required, UUID
name: required, min(1), max(100)
phoneNumber: required, pattern(/^\+[1-9]\d{1,14}$/)
provider: required, enum(ProviderType)
status: required, enum(InstanceStatus)
```

### Lifecycle

```
Created → Connecting → Connected → Disconnected
    ↓                    ↓            ↓
  Error ←────────────── Error      Reconnecting
    ↓
  Disabled (after max errors)
```

---

## Entity: WhatsAppSession

### Purpose
Tracks the authentication session for a WhatsApp instance. Manages QR code state, session persistence, and reconnection logic. Separated from WhatsAppInstance to allow session management without modifying the instance entity.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| instanceId | FK | Parent instance |
| sessionId | String | Provider-specific session identifier |
| status | Enum | Session status |
| qrCode | Text | Current QR code data (base64) |
| qrGeneratedAt | DateTime | When QR was generated |
| qrExpiresAt | DateTime | When QR expires |
| authData | JSON | Encrypted auth state from provider |
| isActive | Boolean | Whether session is currently active |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

### Relationships

- Belongs to: WhatsAppInstance

### Business Rules

1. Only one active session per instance
2. QR codes expire after 20 seconds
3. Expired QR codes must be regenerated
4. Session data must be encrypted at rest
5. Old sessions are soft-deleted, not hard-deleted
6. Session restoration requires valid auth data

### Validation Rules

```
instanceId: required, UUID
sessionId: required, min(1)
status: required, enum(SessionStatus)
qrCode: optional, string
authData: optional, JSON
```

### Lifecycle

```
Created → QR_PENDING → QR_SCANNED → ACTIVE → EXPIRED
    ↓                              ↓         ↓
  FAILED                        REVOKED   RESTORED
```

---

## Entity: Conversation

### Purpose
Represents a chat thread between the business and a customer. Tracks conversation state, assigns priority, and enables routing logic. A conversation is bound to one instance and one customer.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| instanceId | FK | WhatsApp instance handling this conversation |
| customerId | FK | Customer participant |
| storeId | FK | Store context for this conversation |
| status | Enum | Conversation status |
| priority | Enum | LOW, NORMAL, HIGH, URGENT |
| assigneeId | FK | Assigned agent (nullable - for future) |
| tags | Array | Categorization tags |
| lastMessageAt | DateTime | Timestamp of last message |
| lastMessagePreview | String | Truncated last message |
| unreadCount | Integer | Unread message count |
| metadata | JSON | Additional conversation data |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

### Relationships

- Belongs to: WhatsAppInstance
- Belongs to: Customer
- Belongs to: Store
- Has many: Message
- Has many: Order (future)

### Business Rules

1. One active conversation per customer per instance
2. Auto-close conversations after 30 days of inactivity
3. Priority can be set manually or auto-assigned based on keywords
4. Unread count resets when customer reads messages
5. Tags enable filtering and automation rules

### Validation Rules

```
instanceId: required, UUID
customerId: required, UUID
storeId: required, UUID
status: required, enum(ConversationStatus)
priority: required, enum(ConversationPriority)
tags: optional, array of strings, max 10 tags
```

### Lifecycle

```
Created → Active → Waiting → Resolved → Closed
              ↑         ↓         ↓
              └─── Reopened ←────┘
```

---

## Entity: Message

### Purpose
Individual message within a conversation. Supports multiple content types (text, media, documents). Tracks delivery status, read receipts, and direction.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| conversationId | FK | Parent conversation |
| instanceId | FK | Instance that handled this message |
| externalId | String | WhatsApp message ID |
| direction | Enum | INBOUND, OUTBOUND |
| type | Enum | TEXT, IMAGE, VIDEO, AUDIO, FILE, LOCATION, CONTACT |
| content | JSON | Message content (type-specific structure) |
| mediaUrl | String | URL for media messages |
| mimeType | String | MIME type for media |
| status | Enum | PENDING, SENT, DELIVERED, READ, FAILED |
| error | Text | Error details if failed |
| quotedMessageId | FK | Message being replied to (nullable) |
| timestamp | DateTime | WhatsApp server timestamp |
| metadata | JSON | Additional message data |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

### Relationships

- Belongs to: Conversation
- Belongs to: WhatsAppInstance
- BelongsTo (self): QuotedMessage

### Business Rules

1. Outbound messages must be sent through an active instance
2. Failed messages can be retried up to 3 times
3. Media messages require valid MIME types
4. Quoted messages must belong to same conversation
5. External ID must be unique per instance
6. Status transitions are one-way (PENDING → SENT → DELIVERED → READ)

### Validation Rules

```
conversationId: required, UUID
instanceId: required, UUID
direction: required, enum(MessageDirection)
type: required, enum(MessageType)
content: required, JSON
status: required, enum(MessageStatus)
timestamp: required, DateTime
```

### Content Structure (by type)

```typescript
// TEXT
{ text: string }

// IMAGE
{ caption?: string }

// VIDEO
{ caption?: string }

// AUDIO
{ duration?: number }

// FILE
{ fileName: string, fileSize: number }

// LOCATION
{ latitude: number, longitude: number, name?: string }

// CONTACT
{ name: string, phone: string }
```

### Lifecycle

```
Created → Sending → Sent → Delivered → Read
    ↓        ↓
  Failed → Retrying → Failed (max retries)
```

---

## Entity: Customer

### Purpose
Represents a WhatsApp user who has interacted with the business. Stores contact information and interaction history. Created automatically on first message received.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| workspaceId | FK | Parent workspace |
| phoneNumber | String | WhatsApp phone number |
| name | String | Contact name (from WhatsApp) |
| pushName | String | WhatsApp push name |
| profilePictureUrl | String | Profile picture URL |
| isBusiness | Boolean | Whether customer is a business account |
| businessName | String | Business name if applicable |
| tags | Array | Customer segmentation tags |
| notes | Text | Internal notes about customer |
| totalOrders | Integer | Lifetime order count |
| totalSpent | Decimal | Lifetime spend amount |
| lastInteractionAt | DateTime | Last message timestamp |
| metadata | JSON | Additional customer data |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

### Relationships

- Belongs to: Workspace
- Has many: Conversation
- Has many: Order

### Business Rules

1. Phone number unique per workspace
2. Customer created automatically on first inbound message
3. Profile updates merge with existing data (don't overwrite)
4. totalOrders and totalSpent auto-update on order creation
5. Tags enable customer segmentation for marketing

### Validation Rules

```
workspaceId: required, UUID
phoneNumber: required, pattern(/^\+[1-9]\d{1,14}$/), unique per workspace
name: optional, max(100)
pushName: optional, max(100)
isBusiness: required, boolean
tags: optional, array of strings, max 20 tags
```

### Lifecycle

```
Created → Active → Inactive → Archived
```

---

## Entity: Product

### Purpose
Product catalog item. Supports variants, pricing, inventory tracking, and media. Products are scoped to a store.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| storeId | FK | Parent store |
| externalId | String | External system ID (optional) |
| name | String | Product name |
| description | Text | Product description |
| sku | String | Stock keeping unit |
| price | Decimal | Current price |
| compareAtPrice | Decimal | Original/compare price (optional) |
| costPrice | Decimal | Cost price for margin calculation |
| currency | String | ISO 4217 currency code |
| inventoryQuantity | Integer | Current stock level |
| trackInventory | Boolean | Whether to track stock |
| isActive | Boolean | Whether product is available for sale |
| media | JSON | Array of product images/media |
| attributes | JSON | Variant attributes (size, color, etc.) |
| tags | Array | Product tags for filtering |
| weight | Decimal | Weight for shipping calculation |
| metadata | JSON | Additional product data |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

### Relationships

- Belongs to: Store
- Has many: OrderItem

### Business Rules

1. SKU must be unique within a store
2. Price must be positive
3. compareAtPrice must be greater than price (optional)
4. inventoryQuantity cannot go negative (if trackInventory is true)
5. Inactive products cannot be added to new orders
6. Price changes don't affect existing orders

### Validation Rules

```
storeId: required, UUID
name: required, min(1), max(200)
description: optional, max(2000)
sku: required, min(1), max(50)
price: required, positive decimal
compareAtPrice: optional, positive decimal, greater than price
costPrice: optional, positive decimal
currency: required, length(3)
inventoryQuantity: required, integer, min(0)
trackInventory: required, boolean
isActive: required, boolean
tags: optional, array of strings, max 30 tags
```

### Lifecycle

```
Draft → Active ↔ Inactive → Archived
```

---

## Entity: Order

### Purpose
Represents a customer purchase. Links customer, products, and payment status. Orders are created through conversation (customer sends message, business creates order).

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| storeId | FK | Parent store |
| customerId | FK | Customer placing order |
| conversationId | FK | Conversation where order originated |
| orderNumber | String | Human-readable order number |
| status | Enum | Order status |
| paymentStatus | Enum | Payment status |
| fulfillmentStatus | Enum | Fulfillment status |
| subtotal | Decimal | Sum of item prices |
| tax | Decimal | Tax amount |
| shipping | Decimal | Shipping cost |
| discount | Decimal | Discount amount |
| total | Decimal | Final total |
| currency | String | ISO 4217 currency code |
| shippingAddress | JSON | Delivery address |
| billingAddress | JSON | Billing address |
| notes | Text | Order notes |
| metadata | JSON | Additional order data |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

### Relationships

- Belongs to: Store
- Belongs to: Customer
- Belongs to: Conversation
- Has many: OrderItem

### Business Rules

1. Order number auto-generated: `{storeCode}-{YYYYMMDD}-{sequence}`
2. Order must have at least one item
3. Total = subtotal + tax + shipping - discount
4. Status transitions follow defined workflow
5. Cancelled orders restore inventory
6. Completed orders cannot be modified
7. Payment status and fulfillment status are independent

### Validation Rules

```
storeId: required, UUID
customerId: required, UUID
conversationId: optional, UUID
orderNumber: required, unique per store
status: required, enum(OrderStatus)
paymentStatus: required, enum(PaymentStatus)
subtotal: required, positive decimal
tax: required, min(0)
shipping: required, min(0)
discount: required, min(0)
total: required, positive decimal
currency: required, length(3)
shippingAddress: optional, JSON
```

### Status Workflow

```
Order Status:
  PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED → COMPLETED
      ↓         ↓            ↓
    CANCELLED  CANCELLED   CANCELLED

Payment Status:
  PENDING → AUTHORIZED → CAPTURED → REFUNDED
      ↓
   FAILED

Fulfillment Status:
  UNFULFILLED → PARTIALLY_FULFILLED → FULFILLED → DELIVERED
```

---

## Entity: OrderItem

### Purpose
Line item within an order. Links order to product with quantity and pricing snapshot.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| orderId | FK | Parent order |
| productId | FK | Product reference |
| quantity | Integer | Quantity ordered |
| unitPrice | Decimal | Price at time of order |
| total | Decimal | quantity × unitPrice |
| productName | String | Product name snapshot |
| productSku | String | SKU snapshot |
| metadata | JSON | Additional item data |
| createdAt | DateTime | Creation timestamp |

### Relationships

- Belongs to: Order
- Belongs to: Product

### Business Rules

1. Quantity must be at least 1
2. unitPrice is snapshot from Product.price at order creation
3. total = quantity × unitPrice
4. Product snapshot ensures order integrity if product changes
5. Updating quantity recalculates total

### Validation Rules

```
orderId: required, UUID
productId: required, UUID
quantity: required, integer, min(1)
unitPrice: required, positive decimal
total: required, computed (quantity × unitPrice)
productName: required, string
productSku: required, string
```

---

## Entity: Event

### Purpose
Audit log for all significant system events. Enables event sourcing, debugging, and analytics. Immutable once created.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| eventType | Enum | Event type |
| aggregateType | String | Entity type (Workspace, Order, etc.) |
| aggregateId | UUID | Entity ID |
| workspaceId | FK | Workspace scope |
| payload | JSON | Event data |
| metadata | JSON | Request context (IP, user agent, etc.) |
| processedAt | DateTime | When event was processed |
| createdAt | DateTime | Creation timestamp |

### Relationships

- Belongs to: Workspace (via workspaceId)

### Business Rules

1. Events are immutable - never update or delete
2. All business operations emit events
3. Events enable event replay for debugging
4. Events older than 90 days can be archived
5. Failed events remain for retry

### Validation Rules

```
eventType: required, enum(EventType)
aggregateType: required, string
aggregateId: required, UUID
workspaceId: required, UUID
payload: required, JSON
```

---

## Value Objects

### Money
```
amount: Decimal (always stored in minor units - cents)
currency: ISO 4217 string
```

### PhoneNumber
```
number: E.164 formatted string
countryCode: ISO 3166-1 alpha-2
```

### Address
```
line1: String
line2: String (optional)
city: String
state: String
postalCode: String
country: ISO 3166-1 alpha-2
```

### Timestamps
```
createdAt: DateTime (auto-set on creation)
updatedAt: DateTime (auto-set on modification)
deletedAt: DateTime (nullable, for soft deletes)
```

---

# Step 2: Event Catalog

## Event Categories

Events are categorized by domain boundary:

1. **Instance Events** - WhatsApp connection lifecycle
2. **Message Events** - Message lifecycle
3. **Conversation Events** - Conversation lifecycle
4. **Customer Events** - Customer lifecycle
5. **Order Events** - Order lifecycle
6. **Product Events** - Product lifecycle
7. **System Events** - System-level events

---

## Instance Events

### INSTANCE_CREATED
```typescript
{
  type: 'INSTANCE_CREATED';
  aggregateType: 'WhatsAppInstance';
  aggregateId: string;
  payload: {
    instanceId: string;
    workspaceId: string;
    storeId?: string;
    name: string;
    phoneNumber: string;
    provider: ProviderType;
  };
}
```
**When:** New instance is created
**Triggers:** Initialize connection manager, create session

### INSTANCE_CONNECTING
```typescript
{
  type: 'INSTANCE_CONNECTING';
  aggregateType: 'WhatsAppInstance';
  aggregateId: string;
  payload: {
    instanceId: string;
    attempt: number;
    maxAttempts: number;
  };
}
```
**When:** Connection attempt starts
**Triggers:** Update instance status

### INSTANCE_CONNECTED
```typescript
{
  type: 'INSTANCE_CONNECTED';
  aggregateType: 'WhatsAppInstance';
  aggregateId: string;
  payload: {
    instanceId: string;
    connectedAt: Date;
    sessionId: string;
    deviceInfo?: {
      platform: string;
      osVersion: string;
      buildVersion: string;
    };
  };
}
```
**When:** Successfully connected to WhatsApp
**Triggers:** Update status, start message polling, notify dashboard

### INSTANCE_DISCONNECTED
```typescript
{
  type: 'INSTANCE_DISCONNECTED';
  aggregateType: 'WhatsAppInstance';
  aggregateId: string;
  payload: {
    instanceId: string;
    reason: DisconnectReason;
    willReconnect: boolean;
    disconnectedAt: Date;
  };
}
```
**When:** Connection lost
**Triggers:** Update status, attempt reconnect if allowed

### INSTANCE_ERROR
```typescript
{
  type: 'INSTANCE_ERROR';
  aggregateType: 'WhatsAppInstance';
  aggregateId: string;
  payload: {
    instanceId: string;
    error: string;
    errorCode?: string;
    errorCount: number;
    shouldDisable: boolean;
  };
}
```
**When:** Connection error occurs
**Triggers:** Increment error count, disable if max errors reached

### INSTANCE_DISABLED
```typescript
{
  type: 'INSTANCE_DISABLED';
  aggregateType: 'WhatsAppInstance';
  aggregateId: string;
  payload: {
    instanceId: string;
    reason: string;
    totalErrors: number;
  };
}
```
**When:** Instance auto-disabled due to errors
**Triggers:** Notify workspace admin, stop connection attempts

### INSTANCE_DELETED
```typescript
{
  type: 'INSTANCE_DELETED';
  aggregateType: 'WhatsAppInstance';
  aggregateId: string;
  payload: {
    instanceId: string;
    workspaceId: string;
    deletedBy?: string;
  };
}
```
**When:** Instance is deleted
**Triggers:** Cleanup session, remove auth state, archive messages

---

## QR Code Events

### QR_GENERATED
```typescript
{
  type: 'QR_GENERATED';
  aggregateType: 'WhatsAppInstance';
  aggregateId: string;
  payload: {
    instanceId: string;
    sessionId: string;
    qrCode: string; // Base64 encoded QR
    expiresAt: Date;
    attempt: number;
  };
}
```
**When:** New QR code received from provider
**Triggers:** Store QR, notify frontend via WebSocket

### QR_SCANNED
```typescript
{
  type: 'QR_SCANNED';
  aggregateType: 'WhatsAppInstance';
  aggregateId: string;
  payload: {
    instanceId: string;
    sessionId: string;
    scannedAt: Date;
  };
}
```
**When:** User scans QR code
**Triggers:** Update session status, wait for authentication

### QR_EXPIRED
```typescript
{
  type: 'QR_EXPIRED';
  aggregateType: 'WhatsAppInstance';
  aggregateId: string;
  payload: {
    instanceId: string;
    sessionId: string;
    expiredAt: Date;
  };
}
```
**When:** QR code expires without scan
**Triggers:** Clear QR, generate new one if auto-refresh enabled

---

## Session Events

### SESSION_CREATED
```typescript
{
  type: 'SESSION_CREATED';
  aggregateType: 'WhatsAppSession';
  aggregateId: string;
  payload: {
    sessionId: string;
    instanceId: string;
    createdAt: Date;
  };
}
```
**When:** New session created for instance
**Triggers:** Initialize session storage

### SESSION_RESTORED
```typescript
{
  type: 'SESSION_RESTORED';
  aggregateType: 'WhatsAppSession';
  aggregateId: string;
  payload: {
    sessionId: string;
    instanceId: string;
    restoredAt: Date;
    previousState: SessionStatus;
  };
}
```
**When:** Session restored from storage
**Triggers:** Skip QR, connect directly

### SESSION_REVOKED
```typescript
{
  type: 'SESSION_REVOKED';
  aggregateType: 'WhatsAppSession';
  aggregateId: string;
  payload: {
    sessionId: string;
    instanceId: string;
    reason: string;
    revokedAt: Date;
  };
}
```
**When:** Session explicitly revoked
**Triggers:** Disconnect, require new QR scan

### SESSION_DELETED
```typescript
{
  type: 'SESSION_DELETED';
  aggregateType: 'WhatsAppSession';
  aggregateId: string;
  payload: {
    sessionId: string;
    instanceId: string;
    deletedAt: Date;
  };
}
```
**When:** Session data deleted
**Triggers:** Cleanup storage

---

## Message Events

### MESSAGE_RECEIVED
```typescript
{
  type: 'MESSAGE_RECEIVED';
  aggregateType: 'Message';
  aggregateId: string;
  payload: {
    messageId: string;
    conversationId: string;
    instanceId: string;
    externalId: string;
    from: string;
    to: string;
    type: MessageType;
    content: MessageContent;
    timestamp: Date;
  };
}
```
**When:** Inbound message received
**Triggers:** Update conversation, detect commands, notify dashboard

### MESSAGE_SENT
```typescript
{
  type: 'MESSAGE_SENT';
  aggregateType: 'Message';
  aggregateId: string;
  payload: {
    messageId: string;
    conversationId: string;
    instanceId: string;
    externalId: string;
    to: string;
    type: MessageType;
    timestamp: Date;
  };
}
```
**When:** Outbound message sent successfully
**Triggers:** Update message status, update conversation

### MESSAGE_DELIVERED
```typescript
{
  type: 'MESSAGE_DELIVERED';
  aggregateType: 'Message';
  aggregateId: string;
  payload: {
    messageId: string;
    externalId: string;
    deliveredAt: Date;
  };
}
```
**When:** Message delivery confirmed
**Triggers:** Update message status

### MESSAGE_READ
```typescript
{
  type: 'MESSAGE_READ';
  aggregateType: 'Message';
  aggregateId: string;
  payload: {
    messageId: string;
    externalId: string;
    readAt: Date;
  };
}
```
**When:** Message read receipt received
**Triggers:** Update message status, reset unread count

### MESSAGE_FAILED
```typescript
{
  type: 'MESSAGE_FAILED';
  aggregateType: 'Message';
  aggregateId: string;
  payload: {
    messageId: string;
    conversationId: string;
    instanceId: string;
    error: string;
    errorCode?: string;
    retryable: boolean;
    attempt: number;
  };
}
```
**When:** Message send fails
**Triggers:** Update status, retry if retryable, notify if max retries

### MESSAGE_RETRYING
```typescript
{
  type: 'MESSAGE_RETRYING';
  aggregateType: 'Message';
  aggregateId: string;
  payload: {
    messageId: string;
    attempt: number;
    maxAttempts: number;
    nextRetryAt: Date;
  };
}
```
**When:** Message retry scheduled
**Triggers:** Log retry attempt

---

## Conversation Events

### CONVERSATION_CREATED
```typescript
{
  type: 'CONVERSATION_CREATED';
  aggregateType: 'Conversation';
  aggregateId: string;
  payload: {
    conversationId: string;
    instanceId: string;
    customerId: string;
    storeId: string;
    createdAt: Date;
  };
}
```
**When:** New conversation started
**Triggers:** Initialize conversation, notify dashboard

### CONVERSATION_UPDATED
```typescript
{
  type: 'CONVERSATION_UPDATED';
  aggregateType: 'Conversation';
  aggregateId: string;
  payload: {
    conversationId: string;
    changes: Partial<{
      status: ConversationStatus;
      priority: ConversationPriority;
      assigneeId: string;
      tags: string[];
    }>;
    updatedAt: Date;
  };
}
```
**When:** Conversation properties change
**Triggers:** Notify dashboard, trigger automations

### CONVERSATION_CLOSED
```typescript
{
  type: 'CONVERSATION_CLOSED';
  aggregateType: 'Conversation';
  aggregateId: string;
  payload: {
    conversationId: string;
    closedBy?: string;
    reason?: string;
    closedAt: Date;
  };
}
```
**When:** Conversation manually or automatically closed
**Triggers:** Update status, trigger follow-up if needed

### CONVERSATION_REOPENED
```typescript
{
  type: 'CONVERSATION_REOPENED';
  aggregateType: 'Conversation';
  aggregateId: string;
  payload: {
    conversationId: string;
    reopenedBy?: string;
    reopenedAt: Date;
  };
}
```
**When:** Closed conversation reopened
**Triggers:** Update status, restore unread count

---

## Customer Events

### CUSTOMER_CREATED
```typescript
{
  type: 'CUSTOMER_CREATED';
  aggregateType: 'Customer';
  aggregateId: string;
  payload: {
    customerId: string;
    workspaceId: string;
    phoneNumber: string;
    name?: string;
    pushName?: string;
    createdAt: Date;
  };
}
```
**When:** First message from new number
**Triggers:** Create customer record, notify dashboard

### CUSTOMER_UPDATED
```typescript
{
  type: 'CUSTOMER_UPDATED';
  aggregateType: 'Customer';
  aggregateId: string;
  payload: {
    customerId: string;
    changes: Partial<{
      name: string;
      pushName: string;
      profilePictureUrl: string;
      tags: string[];
      notes: string;
    }>;
    updatedAt: Date;
  };
}
```
**When:** Customer profile updated
**Triggers:** Sync data, update analytics

### CUSTOMER_FIRST_ORDER
```typescript
{
  type: 'CUSTOMER_FIRST_ORDER';
  aggregateType: 'Customer';
  aggregateId: string;
  payload: {
    customerId: string;
    orderId: string;
    orderTotal: number;
    currency: string;
    orderedAt: Date;
  };
}
```
**When:** Customer completes first order
**Triggers:** Update customer stats, trigger welcome automation

---

## Order Events

### ORDER_CREATED
```typescript
{
  type: 'ORDER_CREATED';
  aggregateType: 'Order';
  aggregateId: string;
  payload: {
    orderId: string;
    orderNumber: string;
    storeId: string;
    customerId: string;
    conversationId?: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
    }>;
    total: number;
    currency: string;
    createdAt: Date;
  };
}
```
**When:** New order placed
**Triggers:** Reserve inventory, notify store, send confirmation

### ORDER_UPDATED
```typescript
{
  type: 'ORDER_UPDATED';
  aggregateType: 'Order';
  aggregateId: string;
  payload: {
    orderId: string;
    changes: Partial<{
      status: OrderStatus;
      paymentStatus: PaymentStatus;
      fulfillmentStatus: FulfillmentStatus;
      shippingAddress: Address;
      notes: string;
    }>;
    updatedAt: Date;
  };
}
```
**When:** Order details changed
**Triggers:** Notify customer if status changed, sync inventory

### ORDER_CANCELLED
```typescript
{
  type: 'ORDER_CANCELLED';
  aggregateType: 'Order';
  aggregateId: string;
  payload: {
    orderId: string;
    reason?: string;
    cancelledBy?: string;
    cancelledAt: Date;
    restoredInventory: Array<{
      productId: string;
      quantity: number;
    }>;
  };
}
```
**When:** Order cancelled
**Triggers:** Restore inventory, notify customer, process refund if paid

### ORDER_COMPLETED
```typescript
{
  type: 'ORDER_COMPLETED';
  aggregateType: 'Order';
  aggregateId: string;
  payload: {
    orderId: string;
    completedAt: Date;
    total: number;
    currency: string;
  };
}
```
**When:** Order fully delivered and paid
**Triggers:** Update customer stats, trigger post-purchase automation

### ORDER_PAYMENT_UPDATED
```typescript
{
  type: 'ORDER_PAYMENT_UPDATED';
  aggregateType: 'Order';
  aggregateId: string;
  payload: {
    orderId: string;
    previousStatus: PaymentStatus;
    newStatus: PaymentStatus;
    amount?: number;
    transactionId?: string;
    updatedAt: Date;
  };
}
```
**When:** Payment status changes
**Triggers:** Update order status, notify customer

---

## Product Events

### PRODUCT_CREATED
```typescript
{
  type: 'PRODUCT_CREATED';
  aggregateType: 'Product';
  aggregateId: string;
  payload: {
    productId: string;
    storeId: string;
    name: string;
    sku: string;
    price: number;
    currency: string;
    createdAt: Date;
  };
}
```
**When:** New product added
**Triggers:** Index for search, notify if catalog changes

### PRODUCT_UPDATED
```typescript
{
  type: 'PRODUCT_UPDATED';
  aggregateType: 'Product';
  aggregateId: string;
  payload: {
    productId: string;
    changes: Partial<{
      name: string;
      price: number;
      inventoryQuantity: number;
      isActive: boolean;
    }>;
    updatedAt: Date;
  };
}
```
**When:** Product details changed
**Triggers:** Update search index, notify if price changed

### PRODUCT_LOW_STOCK
```typescript
{
  type: 'PRODUCT_LOW_STOCK';
  aggregateType: 'Product';
  aggregateId: string;
  payload: {
    productId: string;
    storeId: string;
    currentQuantity: number;
    threshold: number;
    detectedAt: Date;
  };
}
```
**When:** Inventory drops below threshold
**Triggers:** Alert store admin, optionally pause product

### PRODUCT_OUT_OF_STOCK
```typescript
{
  type: 'PRODUCT_OUT_OF_STOCK';
  aggregateType: 'Product';
  aggregateId: string;
  payload: {
    productId: string;
    storeId: string;
    detectedAt: Date;
  };
}
```
**When:** Inventory reaches zero
**Triggers:** Deactivate product, notify store admin

---

## System Events

### SYSTEM_ERROR
```typescript
{
  type: 'SYSTEM_ERROR';
  aggregateType: 'System';
  aggregateId: string;
  payload: {
    source: string;
    error: string;
    stack?: string;
    context?: Record<string, any>;
    occurredAt: Date;
  };
}
```
**When:** Unhandled system error
**Triggers:** Log error, alert if critical

### SYSTEM_HEALTH_CHECK
```typescript
{
  type: 'SYSTEM_HEALTH_CHECK';
  aggregateType: 'System';
  aggregateId: string;
  payload: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, {
      status: 'ok' | 'error';
      latency?: number;
      error?: string;
    }>;
    checkedAt: Date;
  };
}
```
**When:** Periodic health check
**Triggers:** Update dashboard, alert if unhealthy

---

# Step 3: Contracts & Interfaces

## Design Principles

1. **Domain defines contracts** - Interfaces live in Domain layer
2. **Infrastructure implements contracts** - Concrete implementations outside Domain
3. **Dependency Inversion** - Application depends on abstractions
4. **Interface Segregation** - Small, focused interfaces

---

## Repository Interfaces

### IWorkspaceRepository

```typescript
interface IWorkspaceRepository {
  findById(id: string): Promise<Workspace | null>;
  findBySlug(slug: string): Promise<Workspace | null>;
  create(data: CreateWorkspaceData): Promise<Workspace>;
  update(id: string, data: UpdateWorkspaceData): Promise<Workspace>;
  delete(id: string): Promise<void>;
  exists(slug: string): Promise<boolean>;
}

interface CreateWorkspaceData {
  name: string;
  slug: string;
  plan?: WorkspacePlan;
}

interface UpdateWorkspaceData {
  name?: string;
  plan?: WorkspacePlan;
  settings?: Record<string, any>;
}
```

### IStoreRepository

```typescript
interface IStoreRepository {
  findById(id: string): Promise<Store | null>;
  findByWorkspaceId(workspaceId: string): Promise<Store[]>;
  create(data: CreateStoreData): Promise<Store>;
  update(id: string, data: UpdateStoreData): Promise<Store>;
  softDelete(id: string): Promise<void>;
  existsInWorkspace(workspaceId: string, name: string): Promise<boolean>;
}

interface CreateStoreData {
  workspaceId: string;
  name: string;
  description?: string;
  phoneNumber: string;
  currency: string;
}

interface UpdateStoreData {
  name?: string;
  description?: string;
  currency?: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
}
```

### IWhatsAppInstanceRepository

```typescript
interface IWhatsAppInstanceRepository {
  findById(id: string): Promise<WhatsAppInstance | null>;
  findByWorkspaceId(workspaceId: string): Promise<WhatsAppInstance[]>;
  findByPhoneNumber(workspaceId: string, phoneNumber: string): Promise<WhatsAppInstance | null>;
  create(data: CreateInstanceData): Promise<WhatsAppInstance>;
  updateStatus(id: string, status: InstanceStatus): Promise<WhatsAppInstance>;
  incrementErrorCount(id: string): Promise<WhatsAppInstance>;
  resetErrorCount(id: string): Promise<WhatsAppInstance>;
  softDelete(id: string): Promise<void>;
}

interface CreateInstanceData {
  workspaceId: string;
  storeId?: string;
  name: string;
  phoneNumber: string;
  provider: ProviderType;
}
```

### IWhatsAppSessionRepository

```typescript
interface IWhatsAppSessionRepository {
  findById(id: string): Promise<WhatsAppSession | null>;
  findByInstanceId(instanceId: string): Promise<WhatsAppSession | null>;
  findActiveByInstanceId(instanceId: string): Promise<WhatsAppSession | null>;
  create(data: CreateSessionData): Promise<WhatsAppSession>;
  update(id: string, data: UpdateSessionData): Promise<WhatsAppSession>;
  deactivate(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}

interface CreateSessionData {
  instanceId: string;
  sessionId: string;
  qrCode?: string;
  expiresAt?: Date;
}

interface UpdateSessionData {
  status?: SessionStatus;
  qrCode?: string;
  qrGeneratedAt?: Date;
  qrExpiresAt?: Date;
  authData?: Record<string, any>;
  isActive?: boolean;
}
```

### IConversationRepository

```typescript
interface IConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findByInstanceAndCustomer(instanceId: string, customerId: string): Promise<Conversation | null>;
  findByInstanceId(instanceId: string, filters?: ConversationFilters): Promise<Conversation[]>;
  findByStoreId(storeId: string, filters?: ConversationFilters): Promise<Conversation[]>;
  create(data: CreateConversationData): Promise<Conversation>;
  update(id: string, data: UpdateConversationData): Promise<Conversation>;
  updateLastMessage(id: string, message: Message): Promise<void>;
  incrementUnreadCount(id: string): Promise<void>;
  resetUnreadCount(id: string): Promise<void>;
  closeInactiveConversations(daysInactive: number): Promise<number>;
}

interface ConversationFilters {
  status?: ConversationStatus;
  priority?: ConversationPriority;
  assigneeId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

interface CreateConversationData {
  instanceId: string;
  customerId: string;
  storeId: string;
  priority?: ConversationPriority;
}

interface UpdateConversationData {
  status?: ConversationStatus;
  priority?: ConversationPriority;
  assigneeId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}
```

### IMessageRepository

```typescript
interface IMessageRepository {
  findById(id: string): Promise<Message | null>;
  findByConversationId(conversationId: string, pagination?: PaginationOptions): Promise<Message[]>;
  findByExternalId(instanceId: string, externalId: string): Promise<Message | null>;
  create(data: CreateMessageData): Promise<Message>;
  updateStatus(id: string, status: MessageStatus): Promise<Message>;
  updateExternalId(id: string, externalId: string): Promise<void>;
  countByConversation(conversationId: string): Promise<number>;
  getConversationStats(conversationId: string): Promise<ConversationStats>;
}

interface PaginationOptions {
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
}

interface CreateMessageData {
  conversationId: string;
  instanceId: string;
  direction: MessageDirection;
  type: MessageType;
  content: MessageContent;
  mediaUrl?: string;
  mimeType?: string;
  quotedMessageId?: string;
  timestamp: Date;
}

interface ConversationStats {
  totalMessages: number;
  inboundCount: number;
  outboundCount: number;
  lastMessageAt: Date | null;
}
```

### ICustomerRepository

```typescript
interface ICustomerRepository {
  findById(id: string): Promise<Customer | null>;
  findByPhoneNumber(workspaceId: string, phoneNumber: string): Promise<Customer | null>;
  findByWorkspaceId(workspaceId: string, filters?: CustomerFilters): Promise<Customer[]>;
  create(data: CreateCustomerData): Promise<Customer>;
  update(id: string, data: UpdateCustomerData): Promise<Customer>;
  incrementOrderStats(id: string, orderTotal: number): Promise<void>;
  existsInWorkspace(workspaceId: string, phoneNumber: string): Promise<boolean>;
}

interface CustomerFilters {
  tags?: string[];
  search?: string;
  hasOrders?: boolean;
  limit?: number;
  offset?: number;
}

interface CreateCustomerData {
  workspaceId: string;
  phoneNumber: string;
  name?: string;
  pushName?: string;
  profilePictureUrl?: string;
  isBusiness?: boolean;
  businessName?: string;
}

interface UpdateCustomerData {
  name?: string;
  pushName?: string;
  profilePictureUrl?: string;
  tags?: string[];
  notes?: string;
  metadata?: Record<string, any>;
}
```

### IProductRepository

```typescript
interface IProductRepository {
  findById(id: string): Promise<Product | null>;
  findByStoreId(storeId: string, filters?: ProductFilters): Promise<Product[]>;
  findBySku(storeId: string, sku: string): Promise<Product | null>;
  search(storeId: string, query: string): Promise<Product[]>;
  create(data: CreateProductData): Promise<Product>;
  update(id: string, data: UpdateProductData): Promise<Product>;
  updateInventory(id: string, quantityChange: number): Promise<Product>;
  softDelete(id: string): Promise<void>;
  getLowStockProducts(storeId: string, threshold: number): Promise<Product[]>;
}

interface ProductFilters {
  isActive?: boolean;
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  limit?: number;
  offset?: number;
}

interface CreateProductData {
  storeId: string;
  externalId?: string;
  name: string;
  description?: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  currency: string;
  inventoryQuantity: number;
  trackInventory?: boolean;
  media?: ProductMedia[];
  attributes?: Record<string, any>;
  tags?: string[];
  weight?: number;
}

interface UpdateProductData {
  name?: string;
  description?: string;
  price?: number;
  compareAtPrice?: number;
  costPrice?: number;
  inventoryQuantity?: number;
  isActive?: boolean;
  media?: ProductMedia[];
  attributes?: Record<string, any>;
  tags?: string[];
  weight?: number;
  metadata?: Record<string, any>;
}

interface ProductMedia {
  url: string;
  type: 'image' | 'video';
  alt?: string;
  isPrimary?: boolean;
}
```

### IOrderRepository

```typescript
interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  findByOrderNumber(storeId: string, orderNumber: string): Promise<Order | null>;
  findByStoreId(storeId: string, filters?: OrderFilters): Promise<Order[]>;
  findByCustomerId(customerId: string): Promise<Order[]>;
  create(data: CreateOrderData): Promise<Order>;
  update(id: string, data: UpdateOrderData): Promise<Order>;
  updateStatus(id: string, status: OrderStatus): Promise<Order>;
  updatePaymentStatus(id: string, status: PaymentStatus): Promise<Order>;
  getNextOrderNumber(storeId: string): Promise<string>;
}

interface OrderFilters {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  dateFrom?: Date;
  dateTo?: Date;
  customerId?: string;
  limit?: number;
  offset?: number;
}

interface CreateOrderData {
  storeId: string;
  customerId: string;
  conversationId?: string;
  items: CreateOrderItemData[];
  currency: string;
  tax?: number;
  shipping?: number;
  discount?: number;
  shippingAddress?: Address;
  billingAddress?: Address;
  notes?: string;
}

interface CreateOrderItemData {
  productId: string;
  quantity: number;
}

interface UpdateOrderData {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  shippingAddress?: Address;
  billingAddress?: Address;
  notes?: string;
  metadata?: Record<string, any>;
}
```

### IEventRepository

```typescript
interface IEventRepository {
  create(data: CreateEventData): Promise<Event>;
  findById(id: string): Promise<Event | null>;
  findByAggregateId(aggregateType: string, aggregateId: string): Promise<Event[]>;
  findByWorkspaceId(workspaceId: string, filters?: EventFilters): Promise<Event[]>;
  findUnprocessed(limit: number): Promise<Event[]>;
  markProcessed(id: string): Promise<void>;
  archiveOlderThan(days: number): Promise<number>;
}

interface EventFilters {
  eventType?: EventType;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

interface CreateEventData {
  eventType: EventType;
  aggregateType: string;
  aggregateId: string;
  workspaceId: string;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}
```

---

## Provider Interfaces

### IWhatsAppProvider

```typescript
interface IWhatsAppProvider extends EventEmitter {
  readonly providerType: ProviderType;
  
  // Connection Management
  connect(options?: ConnectionOptions): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;
  getConnectionStatus(): ConnectionStatus;
  
  // QR Code
  getQRCode(): Promise<QRCodeResult>;
  
  // Messaging
  sendMessage(options: SendMessageOptions): Promise<SendMessageResult>;
  sendPresenceUpdate(presence: PresenceType, to: string): Promise<void>;
  
  // Session Management
  saveAuthState(): Promise<AuthState>;
  loadAuthState(state: AuthState): Promise<void>;
  logout(): Promise<void>;
  
  // Cleanup
  destroy(): Promise<void>;
}

interface ConnectionOptions {
  authState?: AuthState;
  qrTimeout?: number;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
}

interface ConnectionResult {
  success: boolean;
  status: ConnectionStatus;
  error?: string;
}

interface QRCodeResult {
  qr: string | null;
  expiryRemaining?: number;
  error?: string;
}

interface SendMessageOptions {
  to: string;
  type: MessageType;
  content: MessageContent;
  quotedMessageId?: string;
}

interface SendMessageResult {
  success: boolean;
  messageId?: string;
  timestamp?: Date;
  error?: string;
  retryable?: boolean;
}

interface ConnectionStatus {
  state: 'disconnected' | 'connecting' | 'connected' | 'qr_pending';
  error?: string;
  lastConnectedAt?: Date;
  reconnectAttempts?: number;
}

interface AuthState {
  creds: Record<string, any>;
  keys: Record<string, any>;
}

type PresenceType = 'composing' | 'recording' | 'paused' | 'available' | 'unavailable';
```

### IProviderFactory

```typescript
interface IProviderFactory {
  createProvider(type: ProviderType, instanceId: string): IWhatsAppProvider;
  getSupportedProviders(): ProviderType[];
  isProviderSupported(type: ProviderType): boolean;
}
```

---

## Service Interfaces

### ISessionManager

```typescript
interface ISessionManager {
  // Instance Lifecycle
  createInstance(data: CreateInstanceData): Promise<WhatsAppInstance>;
  connectInstance(instanceId: string): Promise<ConnectionResult>;
  disconnectInstance(instanceId: string): Promise<void>;
  deleteInstance(instanceId: string): Promise<void>;
  
  // Instance Queries
  getInstance(instanceId: string): Promise<WhatsAppInstance | null>;
  listInstances(workspaceId: string): Promise<WhatsAppInstance[]>;
  getInstanceStatus(instanceId: string): Promise<ConnectionStatus>;
  
  // Session Management
  getActiveSession(instanceId: string): Promise<WhatsAppSession | null>;
  restoreSession(instanceId: string): Promise<boolean>;
  revokeSession(instanceId: string): Promise<void>;
}
```

### IConnectionManager

```typescript
interface IConnectionManager {
  // Connection Pool
  getConnection(instanceId: string): Promise<IWhatsAppProvider | null>;
  hasConnection(instanceId: string): boolean;
  
  // Lifecycle
  initializeConnection(instanceId: string): Promise<IWhatsAppProvider>;
  removeConnection(instanceId: string): Promise<void>;
  reconnectAll(): Promise<void>;
  
  // Status
  getConnectionStatus(instanceId: string): ConnectionStatus;
  getAllConnectionStatuses(): Map<string, ConnectionStatus>;
  
  // Health
  healthCheck(): Promise<ConnectionHealthReport>;
}

interface ConnectionHealthReport {
  total: number;
  connected: number;
  disconnected: number;
  error: number;
  details: Array<{
    instanceId: string;
    status: ConnectionStatus;
    lastActivity?: Date;
  }>;
}
```

### IMessageDispatcher

```typescript
interface IMessageDispatcher {
  // Send Messages
  sendText(instanceId: string, to: string, text: string): Promise<Message>;
  sendImage(instanceId: string, to: string, image: Buffer, caption?: string): Promise<Message>;
  sendFile(instanceId: string, to: string, file: Buffer, fileName: string): Promise<Message>;
  sendAudio(instanceId: string, to: string, audio: Buffer): Promise<Message>;
  sendVideo(instanceId: string, to: string, video: Buffer, caption?: string): Promise<Message>;
  
  // Message Handling
  handleIncomingMessage(instanceId: string, rawMessage: any): Promise<void>;
  retryMessage(messageId: string): Promise<void>;
  
  // Status Updates
  updateMessageStatus(externalId: string, status: MessageStatus): Promise<void>;
}
```

### IConversationEngine

```typescript
interface IConversationEngine {
  // Conversation Management
  getOrCreateConversation(instanceId: string, phoneNumber: string, storeId: string): Promise<Conversation>;
  closeConversation(conversationId: string): Promise<void>;
  reopenConversation(conversationId: string): Promise<void>;
  
  // Message Processing
  processIncomingMessage(message: Message): Promise<void>;
  processOutgoingMessage(message: Message): Promise<void>;
  
  // Commands (Future)
  parseCommand(text: string): Promise<CommandResult | null>;
  
  // Queries
  getConversation(conversationId: string): Promise<Conversation | null>;
  listConversations(storeId: string, filters?: ConversationFilters): Promise<Conversation[]>;
}

interface CommandResult {
  command: string;
  args: Record<string, any>;
  raw: string;
}
```

### IOrderEngine

```typescript
interface IOrderEngine {
  // Order Lifecycle
  createOrder(data: CreateOrderData): Promise<Order>;
  updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order>;
  cancelOrder(orderId: string, reason?: string): Promise<Order>;
  completeOrder(orderId: string): Promise<Order>;
  
  // Order Items
  addItem(orderId: string, productId: string, quantity: number): Promise<OrderItem>;
  updateItemQuantity(orderItemId: string, quantity: number): Promise<OrderItem>;
  removeItem(orderItemId: string): Promise<void>;
  
  // Calculations
  calculateTotals(orderId: string): Promise<OrderTotals>;
  validateOrder(data: CreateOrderData): Promise<ValidationResult>;
}

interface OrderTotals {
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

---

## Infrastructure Interfaces

### IEventBus

```typescript
interface IEventBus {
  // Publish
  publish(event: DomainEvent): Promise<void>;
  publishMany(events: DomainEvent[]): Promise<void>;
  
  // Subscribe
  subscribe<T extends EventType>(
    eventType: T,
    handler: EventHandler<T>
  ): Subscription;
  
  subscribeAll(handler: EventHandler<EventType>): Subscription;
  
  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
}

interface DomainEvent {
  type: EventType;
  aggregateType: string;
  aggregateId: string;
  workspaceId: string;
  payload: Record<string, any>;
  metadata?: EventMetadata;
  timestamp: Date;
}

interface EventMetadata {
  userId?: string;
  correlationId?: string;
  causationId?: string;
  source?: string;
}

type EventHandler<T extends EventType> = (event: DomainEvent & { type: T }) => Promise<void>;

interface Subscription {
  id: string;
  unsubscribe(): void;
}
```

### ICacheService

```typescript
interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  flush(pattern?: string): Promise<void>;
}
```

### IEncryptionService

```typescript
interface IEncryptionService {
  encrypt(data: string): Promise<string>;
  decrypt(encryptedData: string): Promise<string>;
  encryptObject<T>(data: T): Promise<string>;
  decryptObject<T>(encryptedData: string): Promise<T>;
}
```

### INotificationService

```typescript
interface INotificationService {
  notifyWorkspace(workspaceId: string, notification: Notification): Promise<void>;
  notifyUser(userId: string, notification: Notification): Promise<void>;
}

interface Notification {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  data?: Record<string, any>;
  actionUrl?: string;
}
```

---

# Step 4: Database Design

## ERD Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              WORKSPACE (Aggregate Root)                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ id (PK) │ name │ slug (UNIQUE) │ plan │ settings │ createdAt │ updatedAt          │
└─────────────────┬───────────────────────────────────────────────────────────────────┘
                  │
    ┌─────────────┴─────────────┐
    │                           │
    ▼                           ▼
┌───────────────────┐     ┌───────────────────┐
│      STORE        │     │  CUSTOMER         │
│  (Aggregate Root) │     │ (Aggregate Root)  │
├───────────────────┤     ├───────────────────┤
│ id (PK)           │     │ id (PK)           │
│ workspaceId (FK)  │     │ workspaceId (FK)  │
│ name              │     │ phoneNumber       │
│ description       │     │ name              │
│ phoneNumber       │     │ pushName          │
│ currency          │     │ profilePictureUrl │
│ isActive          │     │ isBusiness        │
│ createdAt         │     │ totalOrders       │
│ updatedAt         │     │ totalSpent        │
└────────┬──────────┘     │ createdAt         │
         │                 │ updatedAt         │
         │                 └────────┬──────────┘
         │                          │
    ┌────┴────────────────────────┬─┘
    │                             │
    ▼                             ▼
┌───────────────────┐     ┌───────────────────┐
│     PRODUCT       │     │   CONVERSATION    │
│  (Aggregate Root) │     │  (Aggregate Root) │
├───────────────────┤     ├───────────────────┤
│ id (PK)           │     │ id (PK)           │
│ storeId (FK)      │     │ instanceId (FK)   │
│ externalId        │     │ customerId (FK)   │
│ name              │     │ storeId (FK)      │
│ sku (UNIQUE/Store)│     │ status            │
│ price             │     │ priority          │
│ inventoryQuantity │     │ assigneeId        │
│ isActive          │     │ tags              │
│ createdAt         │     │ lastMessageAt     │
│ updatedAt         │     │ unreadCount       │
└────────┬──────────┘     │ createdAt         │
         │                 │ updatedAt         │
         │                 └────────┬──────────┘
         │                          │
         │    ┌─────────────────────┤
         │    │                     │
         ▼    │                     ▼
┌───────────────────┐     ┌───────────────────┐
│    ORDER_ITEM     │     │     MESSAGE       │
│                   │     │  (Aggregate Root) │
├───────────────────┤     ├───────────────────┤
│ id (PK)           │     │ id (PK)           │
│ orderId (FK)      │     │ conversationId(FK)│
│ productId (FK)    │     │ instanceId (FK)   │
│ quantity          │     │ externalId        │
│ unitPrice         │     │ direction         │
│ total             │     │ type              │
│ productName       │     │ content           │
│ productSku        │     │ status            │
│ createdAt         │     │ timestamp         │
└────────┬──────────┘     │ createdAt         │
         │                 │ updatedAt         │
         │                 └───────────────────┘
         │
         ▼
┌───────────────────┐
│      ORDER        │
│  (Aggregate Root) │
├───────────────────┤
│ id (PK)           │
│ storeId (FK)      │
│ customerId (FK)   │
│ conversationId(FK)│
│ orderNumber       │
│ status            │
│ paymentStatus     │
│ fulfillmentStatus │
│ subtotal          │
│ tax               │
│ shipping          │
│ discount          │
│ total             │
│ currency          │
│ shippingAddress   │
│ billingAddress    │
│ notes             │
│ createdAt         │
│ updatedAt         │
└───────────────────┘

┌───────────────────┐     ┌───────────────────┐
│ WHATSAPP_INSTANCE │     │ WHATSAPP_SESSION  │
│  (Aggregate Root) │     │                   │
├───────────────────┤     ├───────────────────┤
│ id (PK)           │◄────│ instanceId (FK/UK)│
│ workspaceId (FK)  │     │ sessionId (UNIQUE)│
│ storeId (FK)?     │     │ status            │
│ name              │     │ qrCode            │
│ phoneNumber       │     │ qrGeneratedAt     │
│ provider          │     │ qrExpiresAt       │
│ status            │     │ authData          │
│ authState         │     │ isActive          │
│ errorCount        │     │ createdAt         │
│ createdAt         │     │ updatedAt         │
│ updatedAt         │     └───────────────────┘
└───────────────────┘

┌───────────────────┐
│      EVENT        │
├───────────────────┤
│ id (PK)           │
│ eventType         │
│ aggregateType     │
│ aggregateId       │
│ workspaceId (FK)  │
│ payload           │
│ metadata          │
│ processedAt       │
│ createdAt         │
└───────────────────┘
```

---

## Table Definitions

### workspaces

```sql
CREATE TABLE workspaces (
    id VARCHAR(30) PRIMARY KEY,                    -- CUID
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    plan VARCHAR(20) NOT NULL DEFAULT 'FREE',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_workspaces_slug ON workspaces(slug);
CREATE INDEX idx_workspaces_plan ON workspaces(plan);
CREATE INDEX idx_workspaces_created_at ON workspaces(created_at);
```

### stores

```sql
CREATE TABLE stores (
    id VARCHAR(30) PRIMARY KEY,
    workspace_id VARCHAR(30) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    phone_number VARCHAR(20) NOT NULL,
    catalog_url VARCHAR(500),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT uq_stores_workspace_name UNIQUE (workspace_id, name),
    CONSTRAINT uq_stores_workspace_phone UNIQUE (workspace_id, phone_number),
    CONSTRAINT ck_stores_currency CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_stores_phone CHECK (phone_number ~ '^\+[1-9]\d{1,14}$')
);

-- Indexes
CREATE INDEX idx_stores_workspace_id ON stores(workspace_id);
CREATE INDEX idx_stores_phone_number ON stores(phone_number);
CREATE INDEX idx_stores_is_active ON stores(is_active);
CREATE INDEX idx_stores_created_at ON stores(created_at);
```

### whatsapp_instances

```sql
CREATE TABLE whatsapp_instances (
    id VARCHAR(30) PRIMARY KEY,
    workspace_id VARCHAR(30) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    store_id VARCHAR(30) REFERENCES stores(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    provider VARCHAR(20) NOT NULL DEFAULT 'BAILEYS',
    status VARCHAR(20) NOT NULL DEFAULT 'DISCONNECTED',
    auth_state JSONB,
    last_connected_at TIMESTAMP WITH TIME ZONE,
    last_disconnected_at TIMESTAMP WITH TIME ZONE,
    error_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT uq_instances_workspace_phone UNIQUE (workspace_id, phone_number),
    CONSTRAINT ck_instances_provider CHECK (provider IN ('BAILEYS', 'META', 'TWILIO', 'EVOLUTION', 'GREEN')),
    CONSTRAINT ck_instances_status CHECK (status IN ('DISCONNECTED', 'CONNECTING', 'QR_PENDING', 'CONNECTED', 'ERROR', 'DISABLED')),
    CONSTRAINT ck_instances_phone CHECK (phone_number ~ '^\+[1-9]\d{1,14}$'),
    CONSTRAINT ck_instances_error_count CHECK (error_count >= 0)
);

-- Indexes
CREATE INDEX idx_instances_workspace_id ON whatsapp_instances(workspace_id);
CREATE INDEX idx_instances_store_id ON whatsapp_instances(store_id);
CREATE INDEX idx_instances_phone_number ON whatsapp_instances(phone_number);
CREATE INDEX idx_instances_status ON whatsapp_instances(status);
CREATE INDEX idx_instances_provider ON whatsapp_instances(provider);
CREATE INDEX idx_instances_created_at ON whatsapp_instances(created_at);
```

### whatsapp_sessions

```sql
CREATE TABLE whatsapp_sessions (
    id VARCHAR(30) PRIMARY KEY,
    instance_id VARCHAR(30) NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'INACTIVE',
    qr_code TEXT,
    qr_generated_at TIMESTAMP WITH TIME ZONE,
    qr_expires_at TIMESTAMP WITH TIME ZONE,
    auth_data JSONB,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT ck_sessions_status CHECK (status IN ('INACTIVE', 'QR_PENDING', 'QR_SCANNED', 'ACTIVE', 'EXPIRED', 'REVOKED', 'FAILED'))
);

-- Indexes
CREATE INDEX idx_sessions_instance_id ON whatsapp_sessions(instance_id);
CREATE INDEX idx_sessions_session_id ON whatsapp_sessions(session_id);
CREATE INDEX idx_sessions_status ON whatsapp_sessions(status);
CREATE INDEX idx_sessions_is_active ON whatsapp_sessions(is_active);
```

### customers

```sql
CREATE TABLE customers (
    id VARCHAR(30) PRIMARY KEY,
    workspace_id VARCHAR(30) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    push_name VARCHAR(100),
    profile_picture_url VARCHAR(500),
    is_business BOOLEAN NOT NULL DEFAULT false,
    business_name VARCHAR(100),
    tags VARCHAR(50)[] DEFAULT '{}',
    notes TEXT,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_spent DECIMAL(12,2) NOT NULL DEFAULT 0,
    last_interaction_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT uq_customers_workspace_phone UNIQUE (workspace_id, phone_number),
    CONSTRAINT ck_customers_phone CHECK (phone_number ~ '^\+[1-9]\d{1,14}$'),
    CONSTRAINT ck_customers_total_orders CHECK (total_orders >= 0),
    CONSTRAINT ck_customers_total_spent CHECK (total_spent >= 0)
);

-- Indexes
CREATE INDEX idx_customers_workspace_id ON customers(workspace_id);
CREATE INDEX idx_customers_phone_number ON customers(phone_number);
CREATE INDEX idx_customers_last_interaction ON customers(last_interaction_at DESC);
CREATE INDEX idx_customers_tags ON customers USING GIN(tags);
CREATE INDEX idx_customers_created_at ON customers(created_at);
```

### conversations

```sql
CREATE TABLE conversations (
    id VARCHAR(30) PRIMARY KEY,
    instance_id VARCHAR(30) NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
    customer_id VARCHAR(30) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    store_id VARCHAR(30) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    priority VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
    assignee_id VARCHAR(30),
    tags VARCHAR(50)[] DEFAULT '{}',
    last_message_at TIMESTAMP WITH TIME ZONE,
    last_message_preview VARCHAR(100),
    unread_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT uq_conversations_instance_customer UNIQUE (instance_id, customer_id),
    CONSTRAINT ck_conversations_status CHECK (status IN ('ACTIVE', 'WAITING', 'RESOLVED', 'CLOSED', 'ARCHIVED')),
    CONSTRAINT ck_conversations_priority CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    CONSTRAINT ck_conversations_unread_count CHECK (unread_count >= 0)
);

-- Indexes
CREATE INDEX idx_conversations_instance_id ON conversations(instance_id);
CREATE INDEX idx_conversations_customer_id ON conversations(customer_id);
CREATE INDEX idx_conversations_store_id ON conversations(store_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_priority ON conversations(priority);
CREATE INDEX idx_conversations_assignee_id ON conversations(assignee_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_tags ON conversations USING GIN(tags);
```

### messages

```sql
CREATE TABLE messages (
    id VARCHAR(30) PRIMARY KEY,
    conversation_id VARCHAR(30) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    instance_id VARCHAR(30) NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    direction VARCHAR(10) NOT NULL,
    type VARCHAR(20) NOT NULL,
    content JSONB NOT NULL,
    media_url VARCHAR(500),
    mime_type VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    error TEXT,
    quoted_message_id VARCHAR(30) REFERENCES messages(id),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT uq_messages_instance_external UNIQUE (instance_id, external_id),
    CONSTRAINT ck_messages_direction CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    CONSTRAINT ck_messages_type CHECK (type IN ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'LOCATION', 'CONTACT')),
    CONSTRAINT ck_messages_status CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED'))
);

-- Indexes
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_instance_id ON messages(instance_id);
CREATE INDEX idx_messages_external_id ON messages(external_id);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_direction ON messages(direction);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
```

### products

```sql
CREATE TABLE products (
    id VARCHAR(30) PRIMARY KEY,
    store_id VARCHAR(30) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    sku VARCHAR(50) NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    compare_at_price DECIMAL(12,2),
    cost_price DECIMAL(12,2),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    inventory_quantity INTEGER NOT NULL DEFAULT 0,
    track_inventory BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    media JSONB DEFAULT '[]',
    attributes JSONB DEFAULT '{}',
    tags VARCHAR(50)[] DEFAULT '{}',
    weight DECIMAL(8,2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT uq_products_store_sku UNIQUE (store_id, sku),
    CONSTRAINT ck_products_price CHECK (price > 0),
    CONSTRAINT ck_products_compare_price CHECK (compare_at_price IS NULL OR compare_at_price > price),
    CONSTRAINT ck_products_cost_price CHECK (cost_price IS NULL OR cost_price >= 0),
    CONSTRAINT ck_products_inventory CHECK (inventory_quantity >= 0),
    CONSTRAINT ck_products_currency CHECK (currency ~ '^[A-Z]{3}$')
);

-- Indexes
CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_tags ON products USING GIN(tags);
CREATE INDEX idx_products_name_search ON products USING GIN(to_tsvector('english', name));
```

### orders

```sql
CREATE TABLE orders (
    id VARCHAR(30) PRIMARY KEY,
    store_id VARCHAR(30) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_id VARCHAR(30) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    conversation_id VARCHAR(30) REFERENCES conversations(id) ON DELETE SET NULL,
    order_number VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    fulfillment_status VARCHAR(20) NOT NULL DEFAULT 'UNFULFILLED',
    subtotal DECIMAL(12,2) NOT NULL,
    tax DECIMAL(12,2) NOT NULL DEFAULT 0,
    shipping DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    shipping_address JSONB,
    billing_address JSONB,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT uq_orders_store_number UNIQUE (store_id, order_number),
    CONSTRAINT ck_orders_status CHECK (status IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT ck_orders_payment CHECK (payment_status IN ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED')),
    CONSTRAINT ck_orders_fulfillment CHECK (fulfillment_status IN ('UNFULFILLED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'DELIVERED')),
    CONSTRAINT ck_orders_subtotal CHECK (subtotal >= 0),
    CONSTRAINT ck_orders_tax CHECK (tax >= 0),
    CONSTRAINT ck_orders_shipping CHECK (shipping >= 0),
    CONSTRAINT ck_orders_discount CHECK (discount >= 0),
    CONSTRAINT ck_orders_total CHECK (total > 0),
    CONSTRAINT ck_orders_currency CHECK (currency ~ '^[A-Z]{3}$')
);

-- Indexes
CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_conversation_id ON orders(conversation_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```

### order_items

```sql
CREATE TABLE order_items (
    id VARCHAR(30) PRIMARY KEY,
    order_id VARCHAR(30) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(30) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    product_sku VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT ck_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT ck_order_items_unit_price CHECK (unit_price > 0),
    CONSTRAINT ck_order_items_total CHECK (total > 0)
);

-- Indexes
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
```

### events

```sql
CREATE TABLE events (
    id VARCHAR(30) PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id VARCHAR(30) NOT NULL,
    workspace_id VARCHAR(30) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT ck_events_event_type CHECK (event_type IN (
        'INSTANCE_CREATED', 'INSTANCE_CONNECTING', 'INSTANCE_CONNECTED', 
        'INSTANCE_DISCONNECTED', 'INSTANCE_ERROR', 'INSTANCE_DISABLED', 'INSTANCE_DELETED',
        'QR_GENERATED', 'QR_SCANNED', 'QR_EXPIRED',
        'SESSION_CREATED', 'SESSION_RESTORED', 'SESSION_REVOKED', 'SESSION_DELETED',
        'MESSAGE_RECEIVED', 'MESSAGE_SENT', 'MESSAGE_DELIVERED', 'MESSAGE_READ', 
        'MESSAGE_FAILED', 'MESSAGE_RETRYING',
        'CONVERSATION_CREATED', 'CONVERSATION_UPDATED', 'CONVERSATION_CLOSED', 'CONVERSATION_REOPENED',
        'CUSTOMER_CREATED', 'CUSTOMER_UPDATED', 'CUSTOMER_FIRST_ORDER',
        'ORDER_CREATED', 'ORDER_UPDATED', 'ORDER_CANCELLED', 'ORDER_COMPLETED', 'ORDER_PAYMENT_UPDATED',
        'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_LOW_STOCK', 'PRODUCT_OUT_OF_STOCK',
        'SYSTEM_ERROR', 'SYSTEM_HEALTH_CHECK'
    ))
);

-- Indexes
CREATE INDEX idx_events_workspace_id ON events(workspace_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_aggregate ON events(aggregate_type, aggregate_id);
CREATE INDEX idx_events_created_at ON events(created_at DESC);
CREATE INDEX idx_events_unprocessed ON events(processed_at) WHERE processed_at IS NULL;
```

---

## Schema Summary

| Table | Records (Est. Year 1) | Growth Rate |
|-------|----------------------|-------------|
| workspaces | 100 | Low |
| stores | 500 | Low |
| whatsapp_instances | 1,000 | Medium |
| whatsapp_sessions | 2,000 | Medium |
| customers | 100,000 | High |
| conversations | 200,000 | High |
| messages | 10,000,000 | Very High |
| products | 10,000 | Medium |
| orders | 50,000 | High |
| order_items | 200,000 | High |
| events | 50,000,000 | Very High |

---

# Step 5: Application Layer

## Service Architecture

Application services orchestrate business logic by coordinating:
- Domain entities and value objects
- Repository interfaces
- Provider interfaces
- Event bus
- External services

Services contain NO:
- Database queries (delegated to repositories)
- Provider-specific logic (delegated to providers)
- HTTP concerns (delegated to API routes)

---

## Conversation Engine

### Purpose
Manages the lifecycle of conversations between businesses and customers. Processes incoming/outgoing messages, detects commands, and maintains conversation state.

### Responsibilities
1. Create or retrieve existing conversation for a customer
2. Process incoming messages and update conversation state
3. Detect and route commands to appropriate handlers
4. Manage conversation priority and status
5. Emit events for conversation state changes

### Dependencies
- IConversationRepository
- IMessageRepository
- ICustomerRepository
- IEventBus

### Operations

```
getOrCreateConversation(instanceId, phoneNumber, storeId)
  ↓
  Find existing active conversation OR
  Create new conversation
  
processIncomingMessage(rawMessage)
  ↓
  Find or create conversation
  ↓
  Create message record
  ↓
  Update conversation last message
  ↓
  Increment unread count
  ↓
  Parse command (if applicable)
  ↓
  Emit MESSAGE_RECEIVED event

processOutgoingMessage(message)
  ↓
  Create message record
  ↓
  Update conversation last message
  ↓
  Emit MESSAGE_SENT event

closeConversation(conversationId)
  ↓
  Update status to CLOSED
  ↓
  Emit CONVERSATION_CLOSED event

reopenConversation(conversationId)
  ↓
  Update status to ACTIVE
  ↓
  Emit CONVERSATION_REOPENED event
```

---

## Order Engine

### Purpose
Manages the complete order lifecycle from creation to completion. Handles order items, inventory, calculations, and status transitions.

### Responsibilities
1. Create orders with items and calculations
2. Manage order status transitions
3. Handle inventory updates
4. Process order cancellations and refunds
5. Validate order data

### Dependencies
- IOrderRepository
- IProductRepository
- ICustomerRepository
- IEventBus

### Operations

```
createOrder(data)
  ↓
  Validate order data
  ↓
  Check product availability
  ↓
  Calculate totals
  ↓
  Create order record
  ↓
  Create order items
  ↓
  Update inventory (if trackInventory)
  ↓
  Update customer stats
  ↓
  Emit ORDER_CREATED event

updateOrderStatus(orderId, newStatus)
  ↓
  Validate status transition
  ↓
  Update order status
  ↓
  Handle side effects (e.g., inventory on cancel)
  ↓
  Emit ORDER_UPDATED event

cancelOrder(orderId, reason)
  ↓
  Validate cancellation allowed
  ↓
  Restore inventory
  ↓
  Update status to CANCELLED
  ↓
  Emit ORDER_CANCELLED event

completeOrder(orderId)
  ↓
  Validate all items fulfilled
  ↓
  Update status to COMPLETED
  ↓
  Update customer lifetime stats
  ↓
  Emit ORDER_COMPLETED event
```

---

## Message Dispatcher

### Purpose
Routes messages through the system, handles delivery, retries, and status updates. Acts as the central message processing hub.

### Responsibilities
1. Dispatch outgoing messages through provider
2. Process incoming messages from provider
3. Handle message retries with exponential backoff
4. Update message status
5. Manage message queue

### Dependencies
- IConnectionManager
- IMessageRepository
- IEventBus
- IEncryptionService

### Operations

```
sendText(instanceId, to, text)
  ↓
  Get connection from ConnectionManager
  ↓
  Create message record (status: PENDING)
  ↓
  Call provider.sendMessage()
  ↓
  Update status (SENT/FAILED)
  ↓
  Emit MESSAGE_SENT or MESSAGE_FAILED event

handleIncomingMessage(instanceId, rawMessage)
  ↓
  Parse raw message to domain format
  ↓
  Deduplicate (check externalId)
  ↓
  Emit MESSAGE_RECEIVED event
  ↓
  Route to Conversation Engine

retryMessage(messageId)
  ↓
  Check retry count < maxRetries
  ↓
  Increment retry count
  ↓
  Re-attempt send
  ↓
  Update status
  ↓
  Emit MESSAGE_RETRYING or MESSAGE_FAILED event

updateMessageStatus(externalId, status)
  ↓
  Find message by external ID
  ↓
  Update status
  ↓
  Emit MESSAGE_DELIVERED or MESSAGE_READ event
```

---

## Session Manager

### Purpose
Manages WhatsApp session lifecycle including creation, restoration, and revocation. Coordinates with Connection Manager for actual connections.

### Responsibilities
1. Create and manage session records
2. Handle QR code generation and expiration
3. Restore sessions from saved auth state
4. Coordinate with Connection Manager

### Dependencies
- IWhatsAppSessionRepository
- IWhatsAppInstanceRepository
- IConnectionManager
- IEventBus

### Operations

```
createSession(instanceId)
  ↓
  Generate unique session ID
  ↓
  Create session record (status: QR_PENDING)
  ↓
  Emit SESSION_CREATED event
  ↓
  Return session

restoreSession(instanceId)
  ↓
  Find active session with auth data
  ↓
  Load auth state into provider
  ↓
  Update status to ACTIVE
  ↓
  Emit SESSION_RESTORED event
  ↓
  Return success

revokeSession(instanceId)
  ↓
  Find active session
  ↓
  Update status to REVOKED
  ↓
  Clear auth data
  ↓
  Emit SESSION_REVOKED event
  ↓
  Disconnect from provider

handleQRGenerated(instanceId, qrData)
  ↓
  Update session with QR code
  ↓
  Set expiration time
  ↓
  Emit QR_GENERATED event

handleQRScanned(instanceId)
  ↓
  Update session status to QR_SCANNED
  ↓
  Emit QR_SCANNED event

handleQRExpired(instanceId)
  ↓
  Clear QR code
  ↓
  Update status back to QR_PENDING
  ↓
  Emit QR_EXPIRED event
  ↓
  Generate new QR if auto-refresh enabled
```

---

## Connection Manager

### Purpose
Manages the pool of active WhatsApp connections. Handles provider lifecycle, health checks, and reconnection logic.

### Responsibilities
1. Initialize and destroy provider connections
2. Maintain connection pool
3. Handle reconnection logic
4. Provide connection health status
5. Manage provider-specific resources

### Dependencies
- IProviderFactory
- IWhatsAppInstanceRepository
- IWhatsAppSessionRepository
- IEventBus

### Operations

```
initializeConnection(instanceId)
  ↓
  Load instance configuration
  ↓
  Get or create provider from factory
  ↓
  Load session auth state (if exists)
  ↓
  Call provider.connect()
  ↓
  Register in connection pool
  ↓
  Return provider

removeConnection(instanceId)
  ↓
  Get provider from pool
  ↓
  Call provider.disconnect()
  ↓
  Call provider.destroy()
  ↓
  Remove from pool

reconnect(instanceId)
  ↓
  Get provider from pool
  ↓
  Call provider.reconnect()
  ↓
  Update status

reconnectAll()
  ↓
  For each disconnected instance
    ↓
    Attempt reconnection
    ↓
    Emit appropriate events

healthCheck()
  ↓
  For each connection in pool
    ↓
    Check connection status
    ↓
    Collect health metrics
  ↓
  Return health report

handleConnectionLost(instanceId, reason)
  ↓
  Update instance status
  ↓
  Remove from connection pool
  ↓
  Emit INSTANCE_DISCONNECTED event
  ↓
  Schedule reconnection (if allowed)
```

---

# Step 6: Provider Layer

## Provider Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    IWhatsAppProvider                             │
│  (Interface defined in Domain layer)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐      │
│  │  Baileys      │  │  Meta Cloud   │  │  Twilio       │      │
│  │  Provider     │  │  Provider     │  │  Provider     │      │
│  │  (Current)    │  │  (Future)     │  │  (Future)     │      │
│  └───────────────┘  └───────────────┘  └───────────────┘      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                    IProviderFactory                              │
│  (Creates providers based on type)                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Baileys Provider

### Purpose
Adapts Baileys library to our IWhatsAppProvider interface. Translates between WhatsApp Web protocol and our domain events.

### Responsibilities
1. Connect to WhatsApp Web via WebSocket
2. Handle QR code generation and scanning
3. Send and receive messages
4. Manage authentication state
5. Emit events (via IEventBus)

### What It Does NOT Do
- ❌ Business logic
- ❌ Database operations
- ❌ Order processing
- ❌ Customer management
- ❌ Command parsing

### Event Translation

| Baileys Event | Internal Event |
|---------------|----------------|
| connection.update (open) | INSTANCE_CONNECTED |
| connection.update (close) | INSTANCE_DISCONNECTED |
| connection.update (qr) | QR_GENERATED |
| messages.upsert | MESSAGE_RECEIVED |
| messages.update (status) | MESSAGE_DELIVERED / MESSAGE_READ |

### Implementation Pattern

```typescript
// Pseudocode - not actual implementation
class BaileysProvider implements IWhatsAppProvider {
  private socket: WASocket;
  private eventBus: IEventBus;
  
  async connect(options?: ConnectionOptions): Promise<ConnectionResult> {
    // 1. Create Baileys socket
    // 2. Load auth state if provided
    // 3. Register event handlers
    // 4. Return connection result
  }
  
  private handleConnectionUpdate(update: ConnectionUpdate) {
    // Translate Baileys status to our events
    // Emit via eventBus
  }
  
  private handleMessageUpsert(messages: WebMessageInfo[]) {
    // Translate Baileys message to our format
    // Emit MESSAGE_RECEIVED event
  }
  
  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    // 1. Convert our format to Baileys format
    // 2. Call socket.sendMessage()
    // 3. Convert result back to our format
    // 4. Return result
  }
}
```

---

## Provider Factory

### Purpose
Creates the appropriate provider based on instance configuration. Enables adding new providers without changing existing code.

### Pattern

```typescript
// Pseudocode
class ProviderFactory implements IProviderFactory {
  private providers: Map<ProviderType, ProviderClass>;
  
  register(type: ProviderType, ProviderClass: ProviderClass) {
    this.providers.set(type, ProviderClass);
  }
  
  createProvider(type: ProviderType, instanceId: string): IWhatsAppProvider {
    const ProviderClass = this.providers.get(type);
    if (!ProviderClass) {
      throw new Error(`Unsupported provider: ${type}`);
    }
    return new ProviderClass(instanceId, this.eventBus);
  }
}
```

---

# Step 7: Event Bus Flow

## Complete Message Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INBOUND MESSAGE FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│  WhatsApp    │
│  Web Server  │
└──────┬───────┘
       │ Raw WebSocket Message
       ▼
┌──────────────┐
│   Baileys    │ 1. Receives raw message
│   Provider   │ 2. Translates to domain format
└──────┬───────┘ 3. Emits MESSAGE_RECEIVED event
       │
       ▼
┌──────────────┐
│  Event Bus   │ 4. Routes event to handlers
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MESSAGE PROCESSING PIPELINE                         │
└─────────────────────────────────────────────────────────────────────────────┘

       │
       ▼
┌──────────────┐
│  Connection  │ 5. Validates instance is connected
│  Manager     │ 6. Updates connection health
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Session    │ 7. Validates session is active
│   Manager    │ 8. Updates session activity
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Conversation │ 9.  Finds or creates conversation
│   Engine     │ 10. Creates message record
└──────┬───────┘ 11. Updates conversation state
       │
       ▼
┌──────────────┐
│   Command    │ 12. Parses message for commands
│   Parser     │ 13. Routes to command handler
└──────┬───────┘ (if command detected)
       │
       ▼
┌──────────────┐
│  Business    │ 14. Executes business logic
│  Logic       │ 15. Processes order/inquiry/etc.
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Repositories │ 16. Persists to database
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Supabase    │ 17. Data stored
│  PostgreSQL  │
└──────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                           OUTBOUND MESSAGE FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│  API Route   │ 1. Receives send request
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Message     │ 2. Validates request
│  Dispatcher  │ 3. Creates message record
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Connection  │ 4. Gets provider connection
│  Manager     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Baileys    │ 5. Translates to provider format
│   Provider   │ 6. Sends via WebSocket
└──────┬───────┘ 7. Returns result
       │
       ▼
┌──────────────┐
│  Message     │ 8. Updates message status
│  Dispatcher  │ 9. Emits MESSAGE_SENT event
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Event Bus   │ 10. Routes event
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Repositories│ 11. Persists status
└──────────────┘
```

---

## Event Handler Registry

```typescript
// Handler registration pattern
const eventHandlers = {
  // Instance lifecycle
  'INSTANCE_CREATED': [ConnectionManager.handleInstanceCreated],
  'INSTANCE_CONNECTED': [SessionManager.handleInstanceConnected],
  'INSTANCE_DISCONNECTED': [ConnectionManager.handleInstanceDisconnected],
  
  // QR Code
  'QR_GENERATED': [SessionManager.handleQRGenerated],
  'QR_SCANNED': [SessionManager.handleQRScanned],
  'QR_EXPIRED': [SessionManager.handleQRExpired],
  
  // Messages
  'MESSAGE_RECEIVED': [
    ConversationEngine.processIncomingMessage,
    AnalyticsService.trackMessage
  ],
  'MESSAGE_SENT': [
    ConversationEngine.processOutgoingMessage,
    AnalyticsService.trackMessage
  ],
  'MESSAGE_FAILED': [
    MessageDispatcher.handleFailedMessage,
    NotificationService.notifyFailedMessage
  ],
  
  // Orders
  'ORDER_CREATED': [
    InventoryService.reserveStock,
    NotificationService.notifyNewOrder,
    AnalyticsService.trackOrder
  ],
  'ORDER_CANCELLED': [
    InventoryService.restoreStock,
    NotificationService.notifyOrderCancelled
  ],
};
```

---

# Step 8: API Layer

## Design Principles

1. **Thin routes** - Only HTTP concerns
2. **Service delegation** - All logic in application services
3. **Consistent responses** - Standardized response format
4. **Validation at boundary** - Validate before service call

---

## API Structure

```
/api
├── /workspaces
│   ├── GET    /                    - List workspaces
│   ├── POST   /                    - Create workspace
│   ├── GET    /:id                 - Get workspace
│   ├── PATCH  /:id                 - Update workspace
│   └── DELETE /:id                 - Delete workspace
│
├── /stores
│   ├── GET    /?workspaceId=       - List stores
│   ├── POST   /                    - Create store
│   ├── GET    /:id                 - Get store
│   ├── PATCH  /:id                 - Update store
│   └── DELETE /:id                 - Delete store
│
├── /instances
│   ├── GET    /?workspaceId=       - List instances
│   ├── POST   /                    - Create instance
│   ├── GET    /:id                 - Get instance
│   ├── POST   /:id/connect        - Connect instance
│   ├── POST   /:id/disconnect     - Disconnect instance
│   ├── GET    /:id/qr             - Get QR code
│   ├── GET    /:id/status         - Get connection status
│   └── DELETE /:id                 - Delete instance
│
├── /conversations
│   ├── GET    /?storeId=           - List conversations
│   ├── GET    /:id                 - Get conversation
│   ├── GET    /:id/messages        - Get conversation messages
│   ├── PATCH  /:id                 - Update conversation
│   ├── POST   /:id/close          - Close conversation
│   └── POST   /:id/reopen         - Reopen conversation
│
├── /messages
│   ├── POST   /send               - Send message
│   ├── GET    /:id                 - Get message
│   └── POST   /:id/retry          - Retry failed message
│
├── /customers
│   ├── GET    /?workspaceId=       - List customers
│   ├── GET    /:id                 - Get customer
│   ├── GET    /:id/orders          - Get customer orders
│   └── PATCH  /:id                 - Update customer
│
├── /products
│   ├── GET    /?storeId=           - List products
│   ├── POST   /                    - Create product
│   ├── GET    /:id                 - Get product
│   ├── PATCH  /:id                 - Update product
│   ├── DELETE /:id                 - Delete product
│   └── GET    /search?storeId=&q=  - Search products
│
├── /orders
│   ├── GET    /?storeId=           - List orders
│   ├── POST   /                    - Create order
│   ├── GET    /:id                 - Get order
│   ├── PATCH  /:id                 - Update order
│   ├── POST   /:id/cancel         - Cancel order
│   └── GET    /:id/items           - Get order items
│
├── /webhooks
│   └── POST   /whatsapp           - Receive provider webhooks
│
└── /health
    └── GET    /                    - System health check
```

---

## Response Format

```typescript
// Success Response
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// Error Response
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

// Example Success
{
  "success": true,
  "data": {
    "id": "clx1234...",
    "name": "My Store",
    "status": "ACTIVE"
  }
}

// Example Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": {
      "phoneNumber": "Must be valid E.164 format"
    }
  }
}
```

---

# Step 9: Presentation Layer

## Dashboard Structure

```
/presentation
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx                 # Dashboard layout
│   │   ├── page.tsx                   # Overview/Stats
│   │   │
│   │   ├── instances/
│   │   │   ├── page.tsx               # Instance list
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx           # Instance details
│   │   │   │   └── qr/page.tsx       # QR code display
│   │   │   └── new/page.tsx           # Create instance
│   │   │
│   │   ├── conversations/
│   │   │   ├── page.tsx               # Conversation list
│   │   │   └── [id]/page.tsx          # Chat view
│   │   │
│   │   ├── customers/
│   │   │   ├── page.tsx               # Customer list
│   │   │   └── [id]/page.tsx          # Customer details
│   │   │
│   │   ├── products/
│   │   │   ├── page.tsx               # Product list
│   │   │   └── [id]/page.tsx          # Product details
│   │   │
│   │   └── orders/
│   │       ├── page.tsx               # Order list
│   │       └── [id]/page.tsx          # Order details
│   │
│   └── api/                           # API routes (from Step 8)
│
├── components/
│   ├── ui/                            # shadcn/ui components
│   ├── instances/                     # Instance components
│   ├── conversations/                 # Chat components
│   ├── customers/                     # Customer components
│   ├── products/                      # Product components
│   └── orders/                        # Order components
│
└── hooks/                             # React hooks
    ├── useInstance.ts
    ├── useConversation.ts
    ├── useMessages.ts
    └── useRealtime.ts
```

---

## Implementation Order

1. **Dashboard Layout** - Shell with sidebar navigation
2. **Instance Management** - List, create, connect, QR
3. **Conversation View** - List, chat, real-time updates
4. **Customer Management** - List, details, history
5. **Product Management** - List, create, edit
6. **Order Management** - List, create, status updates

---

# Summary

## Milestone 1: Domain Foundation ✅
- Entities designed
- Value objects defined
- Business rules documented
- Validation rules specified

## Milestone 2: Event System ✅
- Event catalog complete
- Event payloads defined
- Event handlers mapped

## Milestone 3: Contracts ✅
- Repository interfaces defined
- Provider interfaces defined
- Service interfaces defined
- Infrastructure interfaces defined

## Milestone 4: Database ✅
- ERD designed
- Tables defined
- Indexes planned
- Constraints specified

## Milestone 5: Application Layer ✅
- Service responsibilities defined
- Service operations documented
- Dependencies mapped

## Milestone 6: Provider Layer ✅
- Provider architecture designed
- Baileys adapter pattern defined
- Factory pattern established

## Milestone 7: Event Bus Flow ✅
- Inbound flow documented
- Outbound flow documented
- Handler registry defined

## Milestone 8: API Layer ✅
- Routes designed
- Response format defined
- Validation strategy set

## Milestone 9: Presentation Layer ✅
- Dashboard structure defined
- Component hierarchy designed
- Implementation order set

---

**Awaiting approval before proceeding to implementation.**


