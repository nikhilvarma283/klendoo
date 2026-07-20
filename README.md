# Klendoo

Micropayment-driven scheduling platform on Algorand x402.

**Hosts** connect their Google Calendar. **Visitors** book sessions via chat or public booking page. **Every action** (booking, follow-up, reminder) settles a small USDC micropayment ($0.02–$0.05) on **Algorand Mainnet** via **x402** (GoPlausible).

Built for the **Algorand Global x402 Challenge** — [Devcon 8 India](https://www.devcon.org/), $100K+ prize pool.

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (for local/production deployment)
- PostgreSQL 16+ (included in docker-compose)
- Google OAuth credentials
- Algorand Mainnet RPC endpoint

### Development

```bash
# Install dependencies
npm install

# Copy env template and configure
cp .env.example .env

# Run database migrations
npm run db:push

# Start dev server (all workspaces)
npm run dev
```

Visit http://localhost:3000 for the web app.

### Production (Docker)

```bash
# Set environment variables in .env
cp .env.example .env
# Edit .env with real credentials

# Build and start
docker-compose up -d

# Run migrations in container
docker-compose exec web npm run db:push
```

Klendoo will be accessible at https://klendoo.com (via Traefik reverse proxy on host VPS).

## Project Structure

```
klendoo/
├── apps/
│   └── web/                    # Next.js web app (chat, dashboard, booking page)
├── packages/
│   ├── db/                     # Prisma schema + database layer
│   ├── types/                  # Shared TypeScript types
│   ├── payment-core/           # x402 settlement SDK
│   ├── google-integration/     # Google Calendar + Gmail helpers
│   └── mcp-server/             # Claude MCP server (optional)
├── services/
│   ├── booking-agent/          # Microagent: booking + settlement
│   ├── follow-up-agent/        # Microagent: follow-up + settlement
│   ├── reminder-agent/         # Microagent: reminder + settlement
│   └── orchestration-agent/    # Conversation routing
├── docs/
│   ├── ARCHITECTURE.md         # System design + settlement flow
│   ├── DEPLOYMENT.md           # Deployment to VPS
│   ├── API.md                  # REST API reference
│   └── X402_ARCHITECTURE.md    # x402 payment mechanics
└── docker-compose.yml          # Docker setup (PostgreSQL + web + Traefik)
```

## Key Flows

### Visitor Booking
1. Visitor opens public booking page at `/book/{host-slug}`
2. Visitor enters name, email, selects time from host's Google Calendar
3. System triggers booking agent
4. Booking agent creates calendar event, sends confirmation email
5. System settles $0.05 USDC to host via x402
6. Visitor receives confirmation

### Host Dashboard
1. Host logs in, sees all bookings
2. Can send follow-ups (settles $0.02) or reminders (settles $0.03)
3. Views settlement history + on-chain transaction links
4. Can customize booking page colors, session types, pricing

### Chat Interface
1. Visitor starts chat conversation
2. Orchestration agent understands intent (book, check availability, etc.)
3. Routes to appropriate microagent or action
4. Returns response + action buttons
5. All transactions settle on Algorand

## Environment Variables

See `.env.example` for full reference. Key ones:

- `DATABASE_URL` — PostgreSQL connection string
- `GOOGLE_CLIENT_ID/SECRET` — OAuth for calendar access
- `ALGORAND_RPC_URL` — Mainnet RPC endpoint
- `GOPLAUSIBLE_API_KEY` — x402 payment facilitator
- `SENDGRID_API_KEY` — Transactional email

## Development Sprints

- **Sprint 0** (now): Infrastructure, database, core types
- **Sprint 1**: Payment SDK + x402 integration
- **Sprint 2**: 3 microagents (booking, follow-up, reminder)
- **Sprint 3**: Orchestration agent + chat web app
- **Sprint 4**: Booking page + pilot recruitment
- **Sprints 5-6**: Pilot execution, volume ramp for Oct measurement window
- **Sprint 7+**: Public launch, Phase 2 features

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) and [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed build guides.

## Testing

```bash
# Run tests across all packages
npm run test

# Type checking
npm run type-check

# Linting
npm run lint
```

## Contributing

- Fork the repo
- Create a feature branch (`git checkout -b feature/your-feature`)
- Commit changes (`git commit -m "add: your feature"`)
- Push to branch (`git push origin feature/your-feature`)
- Open a pull request

## License

MIT

## Contact

**Founder**: Veer Varma  
**Email**: veer@klendoo.com  
**GitHub**: [@veer-varma](https://github.com/veer-varma)

---

**Built with [Claude](https://claude.ai) + [Claude Code](https://claude.com/claude-code) for the Algorand x402 Challenge.**
