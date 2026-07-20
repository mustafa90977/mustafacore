# FEATURE 2: RECEIVE MESSAGES — COMPLETION REPORT

## Status: COMPLETE
## Date: 2026-07-20

---

## Objective
Receive real incoming WhatsApp text messages from a connected account, process them through the internal architecture, store them in Supabase, and display them on the Dashboard.

## Message Flow (Refactored)
```
WhatsApp → Baileys → BaileysProvider ('message_received')
  → ConnectionOrchestrator.publishMessageReceived()
  → IEventBus.publish(MESSAGE_RECEIVED DomainEvent)
  → InboundMessageHandler (Commerce Core, subscribes to MESSAGE_RECEIVED)
    → finds/creates Customer via ICustomerRepository (adapter → Prisma)
    → finds/creates Conversation via IConversationRepository (adapter → Prisma)
    → saves Message via IMessageRepository (adapter → Prisma)
    → updates Conversation lastMessageAt/lastMessagePreview
  → Supabase (customers, conversations, messages tables)
  → Dashboard (GET /api/messages → Messages page)
```

## Architecture Rules Enforced
- **Zero business logic in Infrastructure** — all business logic (filter, findOrCreate, save) lives in Commerce Core
- **EventBus-only communication** between wa-core and commerce-core (no direct imports)
- **Adapter pattern** — Infrastructure adapters bridge Commerce Core ports (ICustomerRepository, IConversationRepository, IMessageRepository) to Prisma implementations
- **Provider replacement** requires ZERO changes inside Commerce Core

## Business Rules Implemented
- **Text only:** Non-text messages (media, stickers, contacts, locations) are silently ignored
- **Auto-create Customer:** If sender phone number not in DB, creates new Customer record
- **Auto-create Conversation:** If no conversation exists between instance and customer, creates new one
- **Always save Message:** Every inbound text message is persisted with full metadata
- **Preserve raw payload:** Original message content stored in `metadata.rawPayload`
- **Message fields:** `message_id`, `conversation_id`, `customer_id` (via conversation), `workspace_id` (via instance), `direction=inbound`, `status=DELIVERED`, `timestamp`, `provider=baileys`

## What Was Built

### Step 1: Commerce Core (Business Logic)
- **`IMessageRepository`** outbound port (`packages/commerce-core/src/infrastructure/repositories/interfaces/i-message-repository.ts`)
  - Defines `MessageData` interface and `IMessageRepository` interface for Commerce Core to persist messages
- **`InboundMessageHandler`** (`packages/commerce-core/src/application/handlers/inbound-message-handler.ts`)
  - Subscribes to `MESSAGE_RECEIVED` DomainEvent via EventBus
  - Contains ALL business logic: filter TEXT, extract phone, findOrCreate Customer/Conversation, save Message
  - Depends only on Commerce Core ports (ICustomerRepository, IConversationRepository, IMessageRepository)

### Step 2: Infrastructure (Adapter Layer)
- **`CustomerRepositoryAdapter`** (`packages/infrastructure/src/adapters/customer-repository-adapter.ts`)
  - Implements Commerce Core's `ICustomerRepository`, wraps infrastructure's `CustomerRepository`
  - Converts between Commerce Core `Customer` entity ↔ Prisma data
- **`ConversationRepositoryAdapter`** (`packages/infrastructure/src/adapters/conversation-repository-adapter.ts`)
  - Implements Commerce Core's `IConversationRepository`, wraps infrastructure's `ConversationRepository`
- **`MessageRepositoryAdapter`** (`packages/infrastructure/src/adapters/message-repository-adapter.ts`)
  - Implements Commerce Core's `IMessageRepository`, wraps infrastructure's `MessageRepository`

### Step 3: Connection Orchestrator (Event Publishing)
- **`ConnectionOrchestrator`** (refactored)
  - Now depends on `IEventBus` instead of `InboundMessageOrchestrator`
  - New `publishMessageReceived()` method: creates `MESSAGE_RECEIVED` DomainEvent and publishes to EventBus
  - Wires `message_received` from BaileysProvider → EventBus

### Step 4: Dashboard Wiring
- **`orchestrator.ts`** (refactored — now async)
  - Creates `InMemoryEventBus` and starts it
  - Creates adapter instances (CustomerRepositoryAdapter, ConversationRepositoryAdapter, MessageRepositoryAdapter)
  - Creates `InboundMessageHandler` with adapter dependencies
  - Subscribes handler to `EventNames.MESSAGE_RECEIVED` on EventBus
  - Passes EventBus to ConnectionOrchestrator

### Step 5: API
- **`GET /api/messages?instanceId=`** — returns last 100 messages with customer info

### Step 6: UI
- **`/messages` page** — Messages dashboard with:
  - Instance ID input + Refresh button
  - Auto-refresh every 5 seconds
  - Table: Customer, Phone, Message, Time, Status
  - Status badges with color coding (DELIVERED=green, READ=blue, FAILED=red, PENDING=yellow)

### Step 7: isolatedModules Compliance
- Fixed ALL barrel exports across all 4 packages for Next.js `isolatedModules: true` compliance
- Separated `export { X }` into `export { X }` + `export type { Y }` for every interface/type across ~30 barrel files

## Files Changed/Created
```
NEW: packages/commerce-core/src/infrastructure/repositories/interfaces/i-message-repository.ts
NEW: packages/commerce-core/src/application/handlers/inbound-message-handler.ts
NEW: packages/commerce-core/src/application/handlers/index.ts
NEW: packages/infrastructure/src/adapters/customer-repository-adapter.ts
NEW: packages/infrastructure/src/adapters/conversation-repository-adapter.ts
NEW: packages/infrastructure/src/adapters/message-repository-adapter.ts
NEW: packages/infrastructure/src/adapters/index.ts
DEL: packages/infrastructure/src/messaging/inbound-message-orchestrator.ts
MOD: packages/infrastructure/src/connection/connection-orchestrator.ts (IEventBus dependency, publishMessageReceived)
MOD: packages/infrastructure/src/messaging/index.ts (removed InboundMessageOrchestrator export)
MOD: packages/infrastructure/src/index.ts (added ./adapters export)
MOD: packages/infrastructure/package.json (added @wacore/commerce-core dependency)
MOD: packages/infrastructure/tsconfig.json (added commerce-core path + include)
MOD: apps/dashboard/src/lib/orchestrator.ts (async, EventBus + adapters + handler wiring)
MOD: apps/dashboard/src/app/api/connect/route.ts (await getOrchestrator())
MOD: apps/dashboard/src/app/api/disconnect/route.ts (await getOrchestrator())
MOD: apps/dashboard/src/app/api/status/route.ts (await getOrchestrator())
MOD: apps/dashboard/src/app/api/qr/route.ts (await getOrchestrator())
MOD: apps/dashboard/src/app/api/messages/route.ts (unchanged)
MOD: All barrel index.ts across shared, wa-core, commerce-core, infrastructure (isolatedModules)
```

## Verification Results
- **Build:** All 4 packages compile with `npx tsc` (0 errors)
- **Dashboard:** `next build` passes (0 errors)
- **TypeScript:** 0 errors across all packages
- **ESLint:** 0 errors (1 warning: no-explicit-any in messages route)
- **Dependency boundaries:** Clean — no wa-core↔commerce-core, no reverse imports
- **Architecture:** Commerce Core contains ALL business logic; Infrastructure only adapts

## Known Limitations
- Only text messages processed; media/stickers/contacts/locations ignored
- No pagination — last 100 messages only
- Dashboard polls every 5s (no real-time push)
- pushName stored but not used for display if customer name exists
- Raw payload stored as JSON; only `text` extracted for display

## Next Feature Dependencies
- Feature 3 (Send Messages) — will need outbound message flow
- Feature 4 (Catalog Sync) — will need conversations to link orders
