# FEATURE 2: RECEIVE MESSAGES — COMPLETION REPORT

## Status: COMPLETE
## Date: 2026-07-20

---

## Objective
Receive real incoming WhatsApp text messages from a connected account, process them through the internal architecture, store them in Supabase, and display them on the Dashboard.

## Message Flow
```
WhatsApp → Baileys → BaileysProvider ('message_received')
  → ConnectionOrchestrator (wires event)
  → InboundMessageOrchestrator (filter TEXT, find/create Customer, find/create Conversation, save Message)
  → Supabase (customers, conversations, messages tables)
  → Dashboard (GET /api/messages → Messages page)
```

## Business Rules Implemented
- **Text only:** Non-text messages (media, stickers, contacts, locations) are silently ignored
- **Auto-create Customer:** If sender phone number not in DB, creates new Customer record
- **Auto-create Conversation:** If no conversation exists between instance and customer, creates new one
- **Always save Message:** Every inbound text message is persisted with full metadata
- **Preserve raw payload:** Original message content stored in `metadata.rawPayload`
- **Message fields:** `message_id`, `conversation_id`, `customer_id` (via conversation), `workspace_id` (via instance), `direction=inbound`, `status=DELIVERED`, `timestamp`, `provider=baileys`

## What Was Built

### Step 1: Domain (verified existing)
- `Message` entity (wa-core) — already supports all required fields
- `MessageReceivedPayload` (wa-core) — event payload for received messages
- `ConversationCreatedPayload`, `CustomerCreatedPayload` (commerce-core) — domain events
- `IncomingMessage` (wa-core) — normalized incoming message shape

### Step 2: Infrastructure
- **`InboundMessageOrchestrator`** (`packages/infrastructure/src/messaging/inbound-message-orchestrator.ts`)
  - `handleIncomingMessage(IncomingMessage)` — main entry point
  - Filters to TEXT only
  - Extracts phone number from WhatsApp JID
  - Finds or creates Customer via `CustomerRepository`
  - Finds or creates Conversation via `ConversationRepository`
  - Saves Message via `MessageRepository` with conversationId
  - Updates conversation's `lastMessageAt` and `lastMessagePreview`

- **`ConnectionOrchestrator`** (modified)
  - Added `InboundMessageOrchestrator` as constructor dependency
  - Wired `message_received` event from `BaileysProvider` to orchestrator

- **`MessageRepository`** (modified)
  - Added `findRecentByInstanceId(instanceId, limit)` — fetches messages with joined conversation + customer data

### Step 3: Services/Orchestrators
- `InboundMessageOrchestrator` serves as both infrastructure wiring and business logic orchestrator (no separate service layer needed for this feature)

### Step 4: API
- **`GET /api/messages?instanceId=`** — returns last 100 messages with customer info

### Step 5: UI
- **`/messages` page** — Messages dashboard with:
  - Instance ID input + Refresh button
  - Auto-refresh every 5 seconds
  - Table: Customer, Phone, Message, Time, Status
  - Status badges with color coding (DELIVERED=green, READ=blue, FAILED=red, PENDING=yellow)

## Files Changed/Created
```
NEW: packages/infrastructure/src/messaging/inbound-message-orchestrator.ts
NEW: apps/dashboard/src/app/api/messages/route.ts
NEW: apps/dashboard/src/app/messages/page.tsx
NEW: apps/dashboard/src/app/messages/MessagesList.tsx
MOD: packages/infrastructure/src/messaging/index.ts (added export)
MOD: packages/infrastructure/src/connection/connection-orchestrator.ts (added messageOrchestrator dependency + message_received handler)
MOD: packages/infrastructure/src/repositories/message.repository.ts (added findRecentByInstanceId)
MOD: apps/dashboard/src/lib/orchestrator.ts (added CustomerRepo, ConversationRepo, MessageRepo, InboundMessageOrchestrator)
```

## Verification Results
- **Build:** `tsc --build` passes for all 4 packages
- **TypeScript:** 0 errors across all 5 packages
- **ESLint:** 0 errors, 244 warnings (all `no-explicit-any`)
- **Dependency boundaries:** Clean — no wa-core↔commerce-core, no reverse imports

## Known Limitations
- Only text messages processed; media/stickers/contacts/locations ignored
- No pagination — last 100 messages only
- Dashboard polls every 5s (no real-time push)
- pushName stored but not used for display if customer name exists
- Raw payload stored as JSON; only `text` extracted for display

## Next Feature Dependencies
- Feature 3 (Send Messages) — will need outbound message flow
- Feature 4 (Catalog Sync) — will need conversations to link orders
