# Sprint 2.7 — Messaging Engine: Completion Report

## Files Created

```
packages/infrastructure/src/messaging/
├── message-events.ts                17 typed event types for messaging lifecycle
├── message-normalizer.ts            Normalize Baileys WAMessage → internal model (all types)
├── media-normalizer.ts              Normalize media attachments + MIME resolution
├── message-mapper.ts                Map between ISendMessageCommand ↔ IProvider.SendMessageOptions
├── inbound-message-handler.ts       Handle incoming: normalize → create Message entity → emit
├── outbound-message-handler.ts      Handle outgoing: map → send → update status → emit
├── message-repository-integration.ts Persist messages via pluggable adapter
└── index.ts                         Barrel export
```

## Components Implemented

### Message Events (`message-events.ts`)
17 event types for the full messaging lifecycle:

| Category | Events |
|----------|--------|
| **Inbound** | `message.inbound.received`, `message.inbound.normalized`, `message.inbound.stored`, `message.inbound.failed` |
| **Outbound** | `message.outbound.requested`, `message.outbound.mapped`, `message.outbound.sending`, `message.outbound.sent`, `message.outbound.failed`, `message.outbound.retry` |
| **Status** | `message.status.updated`, `message.status.delivered`, `message.status.read`, `message.status.failed` |
| **Media** | `message.media.downloaded`, `message.media.uploaded`, `message.media.failed` |

### Message Normalizer (`message-normalizer.ts`)
Normalizes Baileys `WAMessage` into the internal `NormalizedMessage` model:

| Baileys Type | Internal Type | Notes |
|--------------|---------------|-------|
| `conversation` | `TEXT` | Simple text message |
| `extendedTextMessage` | `TEXT` | Text with formatting |
| `imageMessage` | `IMAGE` | With caption + media |
| `videoMessage` | `VIDEO` | With caption + media |
| `audioMessage` | `AUDIO` | With PTT flag + duration |
| `documentMessage` | `FILE` | With fileName |
| `stickerMessage` | `IMAGE` | + `extensions.isSticker = true` |
| `reactionMessage` | `TEXT` | + `extensions.isReaction` + emoji + reactedTo |
| `locationMessage` | `LOCATION` | Lat/lng/name/address |
| `contactsArrayMessage` | `CONTACT` | Array of name/vcard |
| `templateMessage` | `TEXT` | + `extensions.isTemplate` + templateName |
| `protocolMessage` | `TEXT` | System message marker |

**Output shape:**
```typescript
interface NormalizedMessage {
  instanceId, externalId, from, to, direction, type, content,
  media?, timestamp, quotedMessageId?, pushName?,
  isForwarded, isStatus, extensions: {
    isSticker, isReaction, reactionEmoji?,
    reactedToExternalId?, isTemplate, templateName?,
    templateParams?, rawType
  }
}
```

### Media Normalizer (`media-normalizer.ts`)
Handles media attachment normalization:

| Method | Description |
|--------|-------------|
| `normalizeFromBaileys(msg, mediaType, mimetype?, fileLength?)` | Extract media metadata from Baileys message |
| `normalizeForUpload(buffer, mimetype, mediaType, fileName?, caption?)` | Prepare media for outbound upload |
| `resolveMimetype(fileName)` | Resolve MIME from file extension |
| `getMediaType(mimetype)` | Classify MIME to media category |

- Handles null/undefined mimetype safely
- Falls back to extension-based MIME detection
- Maps file extensions: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.mp4`, `.webm`, `.ogg`, `.mp3`, `.m4a`, `.pdf`, `.doc`, `.docx`

### Message Mapper (`message-mapper.ts`)
Bidirectional mapping:

| Method | Direction | Description |
|--------|-----------|-------------|
| `toSendOptions(command)` | Outbound | `ISendMessageCommand` → `IProvider.SendMessageOptions` |
| `toInternalContent(type, content)` | Both | `Record<string, unknown>` → `MessageContent` |
| `buildInboundContent(normalized)` | Inbound | `NormalizedMessage` → `Record<string, unknown>` for Message entity |
| `buildMetadata(normalized)` | Inbound | Extension metadata for storage |
| `mapStatus(externalStatus)` | Status | Provider status → internal status string |

**Type mapping (outbound):**
| MessageType | MessageContent Fields |
|-------------|----------------------|
| TEXT | `text` |
| IMAGE | `text` (caption), `buffer`, `mimetype` |
| VIDEO | `text` (caption), `buffer`, `mimetype` |
| AUDIO | `buffer`, `mimetype` |
| FILE | `fileName`, `buffer`, `mimetype`, `fileSize` |
| LOCATION | `latitude`, `longitude`, `contactName` |
| CONTACT | `contactName`, `contactPhone` |

### Inbound Message Handler (`inbound-message-handler.ts`)
Handles incoming messages from the provider:

| Method | Description |
|--------|-------------|
| `handleRawMessage(WAMessage)` | Normalize raw Baileys message → create Message entity |
| `handleNormalizedMessage(normalized)` | Create Message from pre-normalized data |
| `getMessage(externalId)` | Lookup by external ID |
| `hasMessage(externalId)` | Check existence |
| `clearStore()` | Clear in-memory store |

**Flow:**
```
WAMessage → MessageNormalizer → NormalizedMessage → Message.create() → store + emit
```

### Outbound Message Handler (`outbound-message-handler.ts`)
Handles outgoing messages to the provider:

| Method | Description |
|--------|-------------|
| `send(command)` | Create Message → map → send via provider → update status |
| `resend(messageId)` | Retry a failed message |
| `getMessage(messageId)` | Lookup by internal ID |
| `bindProvider(provider)` | Attach IProvider |
| `clearStore()` | Clear in-memory store |

**Flow:**
```
ISendMessageCommand → Message.create() → MessageMapper.toSendOptions() → IProvider.sendMessage() → markSent/markFailed → emit
```

**Resend logic:**
- Only failed messages with `retryCount < maxRetries` can be resent
- Increments retry counter
- Emits `message.outbound.retry`

### Message Repository Integration (`message-repository-integration.ts`)
Pluggable persistence adapter:

| Method | Description |
|--------|-------------|
| `bindPersistence(adapter)` | Attach persistence adapter |
| `persistInbound(message)` | Save inbound message |
| `persistOutbound(message)` | Save outbound message |
| `updateStatus(instanceId, externalId, status)` | Update message status |
| `findById(messageId)` | Lookup by ID |
| `findByExternalId(instanceId, externalId)` | Lookup by external ID |

**Adapter interface:**
```typescript
interface IMessagePersistenceAdapter {
  save(message: any): Promise<any>;
  update(id: UniqueId, data: any): Promise<any>;
  findByExternalId(instanceId: UniqueId, externalId: string): Promise<any | null>;
  findById(id: UniqueId): Promise<any | null>;
}
```

## Commerce Isolation

Commerce must never know Baileys — enforced by architecture:

- `MessageNormalizer` produces `NormalizedMessage` (provider-agnostic)
- `InboundMessageHandler` creates `Message` entity (domain model)
- `OutboundMessageHandler` uses `IProvider` interface (never imports BaileysProvider)
- Commerce layer only sees `Message`, `NormalizedMessage`, and events
- Provider swap requires changes ONLY in `packages/infrastructure/src/baileys/`

## Usage Example

```typescript
import {
  InboundMessageHandler,
  OutboundMessageHandler,
  MessageRepositoryIntegration,
} from '@wacore/infrastructure';

// Setup
const inbound = new InboundMessageHandler(instanceId, logger);
const outbound = new OutboundMessageHandler(instanceId, logger);
const persistence = new MessageRepositoryIntegration(instanceId, logger);

outbound.bindProvider(baileysProvider);
persistence.bindPersistence(prismaAdapter);

// Inbound flow
inbound.on('event', async (event) => {
  if (event.type === 'message.inbound.stored') {
    await persistence.persistInbound(inbound.getMessage(event.externalId!));
  }
});

const message = await inbound.handleRawMessage(waMessage);

// Outbound flow
const result = await outbound.send({
  instanceId,
  to: '5511999999999@s.whatsapp.net',
  type: MessageType.TEXT,
  content: { text: 'Hello!' },
});

// Status update
await persistence.updateStatus(instanceId, externalId, 'DELIVERED');
```

## Type Verification Results

| Package | Status |
|---------|--------|
| @wacore/shared | ✅ Zero errors |
| @wacore/wa-core | ✅ Zero errors |
| @wacore/commerce-core | ✅ Zero errors |
| @wacore/infrastructure | ✅ Zero errors |

## What's NOT Implemented (by design)

- React UI components
- Dashboard integration
- Order processing
- Customer management
- AI/automation
- Database queries (persistence is adapter-based)
- Group message handling
- Broadcast messages
