# Klendoo Architecture

## Overview

Klendoo is a micropayment-driven scheduling platform built on Algorand x402. The system enables hosts to monetize their time in small increments, with every action (booking, follow-up, reminder) triggering a micropayment settlement.

## System Diagram

```
Visitor (Web/Chat)
        ↓
   Chat Interface
   (Next.js App)
        ↓
Orchestration Agent
(Intent detection)
        ↓
   [Routes to]
        ↓
┌──────────────────────────────────────┐
│   Microagents (Lambda/Cloud Run)     │
├──────────────────────────────────────┤
│ • Booking Agent                      │
│ • Follow-up Agent                    │
│ • Reminder Agent                     │
└──────────────────────────────────────┘
        ↓
┌──────────────────────────────────────┐
│   Core Services                      │
├──────────────────────────────────────┤
│ • Google Calendar (OAuth)            │
│ • Email (SendGrid)                   │
│ • Payment SDK (x402)                 │
└──────────────────────────────────────┘
        ↓
┌──────────────────────────────────────┐
│   x402 Payment Flow                  │
│ (GoPlausible Facilitator)            │
└──────────────────────────────────────┘
        ↓
Algorand Mainnet (Micropayment)
```

## Component Architecture

### Frontend (apps/web)

**Next.js** application hosting:
- **Visitor UI**: Chat interface, booking page (`/book/{host-slug}`), calendar widget
- **Host Dashboard**: Booking management, follow-up/reminder triggers, settlement history
- **Authentication**: NextAuth.js with Google OAuth + fallback email magic-link

### Backend Services

#### 1. Orchestration Agent
- Receives visitor/host messages
- Rule-based intent detection (MVP: no ML/LLM)
- Routes to appropriate microagent
- Maintains conversation state
- Returns messages + action buttons

**Endpoints:**
- `POST /api/chat` — Send message
- `GET /api/chat/:sessionId` — Retrieve message history

#### 2. Booking Microagent
**Triggered by**: Orchestration agent when visitor says "book a session"

**Flow**:
1. Extract: visitor name, email, preferred time, session type
2. Query: host's Google Calendar (OAuth)
3. Find: first available slot matching preference
4. Create: calendar event (Google Calendar API)
5. Send: confirmation email to visitor
6. Settle: $0.05 USDC micropayment to host via x402
7. Return: booking confirmation + calendar invite link

**Handles failure gracefully**:
- Calendar sync fails → queue event, retry next invocation
- Settlement fails → mark booking as "pending settlement", alert host
- Email fails → log, retry async

#### 3. Follow-up Microagent
**Triggered by**:
- Manual: host clicks "Send Follow-up" button
- Automatic: 24h after booking (cron job)

**Flow**:
1. Fetch: booking context (visitor name, email, session details)
2. Compose: contextual follow-up email (template)
3. Send: via SendGrid
4. Settle: $0.02 USDC to host via x402
5. Return: confirmation

#### 4. Reminder Microagent
**Triggered by**: 1 hour before session (cron)

**Flow**:
1. Calculate: reminder time from calendar event
2. Send: reminder emails to visitor + host
3. Update: calendar event with alarm
4. Settle: $0.03 USDC to host via x402
5. Handle rescheduling: cancel pending reminder, schedule new one

### Payment Core (packages/payment-core)

**Responsibilities**:
- x402 request builder (amount, recipient, action type)
- GoPlausible API integration
- Algorand Mainnet RPC interaction
- Transaction confirmation polling
- Retry logic with exponential backoff
- Idempotency (no duplicate settlements)

**Interface**:
```typescript
async settle(
  hostWalletAddress: string,
  actionType: "booking" | "follow-up" | "reminder",
  amountUSDC: number,
  idempotencyKey: string
): Promise<{ txnHash: string; confirmed: boolean }>
```

### Database (packages/db)

**Prisma schema** with PostgreSQL:
- **Users**: Host profiles, wallet addresses, OAuth tokens, settings
- **SessionTypes**: Booking type definitions (1:1, group, free, paid)
- **Bookings**: Visitor bookings, calendar references, status
- **Settlements**: All micropayments, tx hashes, confirmation status
- **ChatMessages**: Conversation history

### Google Integration (packages/google-integration)

**Scopes**:
- `calendar.readonly` — Read host's availability
- `calendar` — Create events on host's calendar
- `gmail.send` — Send confirmation, follow-up, reminder emails
- `gmail.readonly` — Fallback for session context (optional)

**Handles**:
- OAuth token refresh
- Calendar timezone normalization
- Email template rendering

## Data Flow: Visitor Books a Session

```
1. Visitor opens /book/{host-slug}
   ↓
2. Frontend fetches host profile + available session types
   ↓
3. Visitor selects time (calendar widget fetches Google Calendar)
   ↓
4. Visitor submits booking form (name, email, time, session type)
   ↓
5. Frontend POST /api/bookings
   ↓
6. API calls Booking Microagent (orchestration-agent/booking)
   ↓
7. Booking Agent:
   a. Queries Google Calendar
   b. Creates calendar event
   c. Sends confirmation email (SendGrid)
   d. Calls settlement SDK: settle($0.05, "booking")
   ↓
8. Settlement SDK:
   a. Builds x402 request (host wallet, $0.05 USDC)
   b. POSTs to GoPlausible facilitator
   c. Polls Algorand RPC for confirmation
   d. Stores tx hash in database (Settlements table)
   ↓
9. API returns booking confirmation + calendar event URL
   ↓
10. Frontend displays success message to visitor
    Host receives email + sees booking in dashboard
```

## x402 Payment Mechanics

### HTTP 402 Payment Required Flow

```
Client Request (without payment proof):
  POST /api/bookings
  { visitorName, visitorEmail, sessionTypeId, startTime }

Server Response (402 Payment Required):
  HTTP 402 Payment Required
  X-Payment-Required: true
  X-Payment-Token: <x402-token>
  X-Payment-Amount: 0.05 USDC
  X-Payment-Recipient: <host-wallet>

Client (Payment SDK):
  POST https://x402.goplausible.xyz/request
  { token, amount, recipient, memo }
  
  Receives: { txn_id, transaction_hash }

Client Retry:
  POST /api/bookings
  X-Payment-Proof: <txn_id>
  { visitorName, visitorEmail, ... }

Server (Verification):
  1. Check tx hash on Algorand Mainnet
  2. Verify amount + recipient
  3. Execute booking logic
  4. Return 200 OK + booking confirmation
```

### Testnet vs Mainnet

**Environment variable**: `ALGORAND_ENVIRONMENT=mainnet|testnet`

- **Testnet**: For development, no real USDC spent
  - RPC: https://testnet-api.algonode.cloud
  - x402 facilitator: testnet endpoint (if available)
- **Mainnet**: Production, real USDC settlements
  - RPC: https://mainnet-api.algonode.cloud
  - x402 facilitator: https://x402.goplausible.xyz

### Settlement Amounts

- **Booking**: $0.05 USDC (covers calendar event creation + email)
- **Follow-up**: $0.02 USDC (email only)
- **Reminder**: $0.03 USDC (email + calendar alarm)

**Klendoo Fee**: 10% of settlement (host receives 90%)

**Example**: Booking settlement of $0.05
- Klendoo takes: $0.005
- Host receives: $0.045 (in their USDC wallet)

## Scalability Considerations

### Horizontal Scaling
- **Microagents**: Stateless, can deploy multiple instances (Lambda auto-scaling)
- **Chat service**: Stateless (session state in database)
- **Database**: PostgreSQL with read replicas for monitoring queries

### Performance Targets
- **Chat latency**: p95 < 2 seconds
- **Booking creation**: p95 < 3 seconds (includes Google Calendar + settlement)
- **Settlement confirmation**: < 5 seconds (Algorand block time)

### Rate Limiting
- Per-user: 10 bookings/day (prevent spam)
- Per-host: No limit (but monitor for anomalies)
- Per-email: 3 booking attempts/hour

## Security

### OAuth Token Management
- Access tokens: 1-hour expiry, refreshed automatically
- Refresh tokens: Stored encrypted in database
- Tokens cleared: On user logout or account deletion

### Wallet Address Validation
- Algorand wallet: Must be valid Ed25519 address
- Validation: On host setup and before settlement

### Settlement Idempotency
- Settlement SDK uses idempotency key (booking ID + action type)
- Prevents duplicate charges if request retried

### Email Validation
- Visitor email must be unique per booking (prevent duplicate confirmations)
- Host email verified before first settlement

## Monitoring & Observability

### Key Metrics
- Settlement success rate (target: >99%)
- Settlement confirmation time (target: <5s)
- Email delivery rate (target: >99%)
- Calendar sync latency (target: <2s)
- Chat response latency (target: p95 <2s)

### Logging
- CloudWatch/Stackdriver for all microagents
- Database logs for settlement operations
- Email delivery logs (SendGrid webhooks)

### Alerts
- Settlement failure rate > 5% (hour window)
- Email delivery failure > 2%
- Calendar sync timeout > 3 times in 1 hour
- Microagent unhealthy (HTTP 5xx rate > 10%)

## Phase 2 Roadmap (Post-MVP)

- **LLM-based NLU**: Replace rule-based routing with Claude API for better conversational UX
- **Visitor Payment**: Allow visitors to pay directly via Wallet/PayPal for premium sessions
- **Group Sessions**: Support booking slots for multiple visitors
- **Advanced Settlement**: Split payments (e.g., 50/50 revenue share with co-hosts)
- **Claude MCP Server**: Integrate Klendoo into Claude AI as a native scheduling tool
- **Public API**: Partner integrations for calendar sync + booking webhooks

---

**Last updated**: 2026-07-20  
**Author**: Veer Varma + Claude  
**Status**: MVP Architecture (Sprints 0-4 implementation in progress)
