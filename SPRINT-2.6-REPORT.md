# Sprint 2.6 — QR Engine: Completion Report

## Files Created

```
packages/infrastructure/src/qr/
├── qr-events.ts        13 typed event types for QR lifecycle
├── qr-status.ts        7-state FSM for QR lifecycle with validated transitions
├── qr-generator.ts     Wraps IProvider.getQRCode() with timeout
├── qr-expiration.ts    Timer-based expiration with dual-check
├── qr-refresh.ts       Auto-refresh on expiry with attempt tracking
├── qr-storage.ts       File-based persistence of QR state
├── qr-manager.ts       Orchestrator — one active QR, expire, refresh, emit
└── index.ts             Barrel export
```

## Components Implemented

### QR Events (`qr-events.ts`)
13 event types for the full QR lifecycle:

| Event | Description |
|-------|-------------|
| `qr.requested` | QR generation requested |
| `qr.generated` | QR code generated from provider |
| `qr.delivered` | QR delivered to consumer |
| `qr.scanned` | User scanned QR code |
| `qr.expired` | QR expired after timeout |
| `qr.refresh_started` | Auto-refresh triggered |
| `qr.refresh_completed` | Auto-refresh succeeded |
| `qr.refresh_failed` | Auto-refresh failed |
| `qr.revoked` | QR manually revoked |
| `qr.storage.saved` | State persisted |
| `qr.storage.loaded` | State restored from disk |
| `qr.storage.cleared` | State cleared |
| `qr.status_changed` | Status transition occurred |

### QR Status Tracker (`qr-status.ts`)
7-state FSM with validated transitions:

```
         ┌───────────┐
         │    idle    │
         └─────┬─────┘
               │
        ┌──────▼──────┐
        │  generating  │
        └──┬───────┬──┘
           │       │
  ┌────────▼──┐  ┌─▼────────┐
  │   active   │  │  failed   │
  └──┬──┬──┬──┘  └──┬───────┘
     │  │  │         │
     │  │  └─────────┘ (generating)
     │  │
     │  └──────┐
  ┌──▼──┐  ┌───▼─────┐
  │scanned│  │ expired  │
  └──────┘  └────┬────┘
                 │
           ┌─────▼─────┐
           │  revoked   │
           └───────────┘
```

| From | To | Allowed |
|------|----|---------|
| idle | generating | ✅ |
| generating | active, failed | ✅ |
| active | scanned, expired, revoked, generating | ✅ |
| scanned | idle, generating, revoked | ✅ |
| expired | generating, idle, revoked | ✅ |
| failed | generating, idle | ✅ |
| revoked | _(none)_ | terminal |

### QR Generator (`qr-generator.ts`)
Wraps `IProvider.getQRCode()` with timeout protection:

| Method | Description |
|--------|-------------|
| `generate()` | Request QR from provider with timeout |

| Config | Default | Description |
|--------|---------|-------------|
| timeoutMs | 15000 | Max wait for provider response |

- Emits `requested`, `generated`, `failed`
- Returns `{ qr: string; expiresAt: Date } | null`
- Prevents concurrent generation

### QRExpiration (`qr-expiration.ts`)
Dual-check timer-based expiration:

| Method | Description |
|--------|-------------|
| `start(expiresAt)` | Begin tracking expiration |
| `stop()` | Stop tracking |
| `reset(newExpiresAt)` | Restart with new expiry |
| `isExpired()` | Check if expired |
| `timeRemaining` | Get remaining ms |

- Primary: setTimeout for exact expiry
- Secondary: setInterval for periodic check (drift protection)
- Emits `expired` on timeout

### QR Refresh (`qr-refresh.ts`)
Auto-refresh orchestrator with attempt tracking:

| Method | Description |
|--------|-------------|
| `refresh()` | Generate new QR, setup expiration |
| `reset()` | Clear attempt counter |

| Config | Default | Description |
|--------|---------|-------------|
| maxRefreshAttempts | 5 | Max refresh attempts |
| refreshDelayMs | 2000 | Delay between expiry and refresh |

- Auto-triggers on `expired` event
- Tracks attempts, emits `refreshStarted`, `refreshCompleted`, `failed`
- Prevents concurrent refreshes

### QR Storage (`qr-storage.ts`)
File-based persistence of QR state:

| Method | Description |
|--------|-------------|
| `save()` | Persist current state to disk |
| `load()` | Restore state from disk |
| `clear()` | Remove persisted state |

| Config | Default | Description |
|--------|---------|-------------|
| baseFolder | `./qr_state` | Storage directory |
| persistToFile | true | Enable file persistence |

Stored fields: `instanceId`, `status`, `qrCode`, `generatedAt`, `expiresAt`, `refreshCount`, `lastError`, `savedAt`

### QR Manager (`qr-manager.ts`)
Orchestrator enforcing **one active QR** rule:

| Method | Description |
|--------|-------------|
| `requestQR()` | Get or generate QR (deduplicates if active) |
| `markScanned()` | Mark QR as scanned by user |
| `revoke()` | Manually revoke QR |
| `reset()` | Full reset |
| `getInfo()` | Get current status info |
| `onQRDelivered(cb)` | Register QR delivery callback |

**Rules enforced:**
- One active QR at a time (returns existing if valid)
- Auto-expires after timeout
- Auto-refreshes on expiry (up to max attempts)
- Persists state automatically (when `autoPersist: true`)
- Terminal `revoked` state — no further QR until `reset()`

## Usage Example

```typescript
import { QRManager } from '@wacore/infrastructure';

const manager = new QRManager(instanceId, logger, {
  generator: { timeoutMs: 15000 },
  expiration: { timeoutMs: 20000 },
  refresh: { maxRefreshAttempts: 5, refreshDelayMs: 2000 },
  storage: { baseFolder: './qr_state', persistToFile: true },
  autoPersist: true,
});

// Bind to provider
manager.bindProvider(baileysProvider);

// Register delivery callback
manager.onQRDelivered((qr, expiresAt) => {
  console.log(`QR ready: ${qr} (expires ${expiresAt})`);
});

// Subscribe to events
manager.on('qrEvent', (event) => {
  console.log(`[${event.type}]`, event.metadata);
});

// Request QR — deduplicates if active
const qr = await manager.requestQR();

// When user scans
manager.markScanned();

// Or revoke manually
manager.revoke();
```

## Architecture Compliance

- All components in `packages/infrastructure/src/qr/`
- Uses `IProvider` from `@wacore/wa-core` for QR generation
- No React, no Dashboard, no Messaging
- File-based persistence (no database dependency)
- EventEmitter-based event propagation
- One active QR rule enforced by state machine

## Type Verification Results

| Package | Status |
|---------|--------|
| @wacore/shared | ✅ Zero errors |
| @wacore/wa-core | ✅ Zero errors |
| @wacore/commerce-core | ✅ Zero errors |
| @wacore/infrastructure | ✅ Zero errors |

## What's NOT Implemented (by design)

- React QR display components
- Dashboard integration
- Message sending/receiving
- QR image rendering (returns raw string)
- Multi-QR support (one active QR only)
- QR analytics
