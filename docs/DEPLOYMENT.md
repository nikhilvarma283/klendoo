# Klendoo Deployment Guide

## Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL 16+ (or use docker-compose)
- Google OAuth credentials
- Algorand testnet account with test USDC

### Quick Start

```bash
# Clone repo
git clone https://github.com/veer-varma/klendoo.git
cd klendoo

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local

# Start database
docker-compose up db -d

# Run migrations
npm run db:push

# Start dev server
npm run dev
```

Visit http://localhost:3000.

## Production Deployment (Hostinger VPS)

### Prerequisites
- Hostinger VPS with Ubuntu 24.04
- Docker + Docker Compose installed
- Domain (klendoo.com) already registered + DNS pointing to VPS IP (187.124.153.221)
- Traefik reverse proxy running on VPS (for HTTPS + routing)
- PostgreSQL data directory for persistence

### One-time Setup

#### 1. Prepare Environment on VPS

```bash
# SSH into VPS
ssh root@187.124.153.221

# Create klendoo deployment directory
mkdir -p /home/klendoo-deploy/klendoo
cd /home/klendoo-deploy/klendoo

# Clone repo (or copy files)
git clone https://github.com/veer-varma/klendoo.git .

# Copy env template
cp .env.example .env

# Edit .env with production values
nano .env
```

**Critical env values to set in production** (get from Google Cloud Console, SendGrid, etc.):
```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOPLAUSIBLE_API_KEY=your-goplausible-key
SENDGRID_API_KEY=your-sendgrid-key
POSTGRES_PASSWORD=<strong-password>
NEXTAUTH_SECRET=<generate-random-32-char-string>
```

#### 2. Create Database Directory

```bash
# Create persistent storage for PostgreSQL
mkdir -p /var/lib/klendoo-db
chmod 700 /var/lib/klendoo-db
```

Update `docker-compose.yml` to use host volume:
```yaml
volumes:
  klendoo-db-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/klendoo-db
```

#### 3. Build and Start Containers

```bash
cd /home/klendoo-deploy/klendoo

# Build Docker image
docker-compose build

# Start containers (PostgreSQL + web)
docker-compose up -d

# Run database migrations
docker-compose exec web npm run db:push

# Verify containers are running
docker-compose ps
```

**Expected output**:
```
NAME                COMMAND              STATUS
klendoo-db          "postgres"           Up 2 minutes (healthy)
klendoo-web         "npm run start"      Up 2 minutes
```

#### 4. Verify Traefik Routing

The `docker-compose.yml` includes Traefik labels that automatically:
- Route `klendoo.com` → klendoo-web container (port 3000)
- Redirect HTTP → HTTPS
- Auto-renew Let's Encrypt certificate

Test:
```bash
# Should return 200 OK
curl -I https://klendoo.com
```

### Monitoring & Logs

```bash
# View live logs
docker-compose logs -f web

# View specific errors
docker-compose logs web | grep ERROR

# Check database health
docker-compose exec db pg_isready

# Inspect Traefik routing
curl http://localhost:8080/api/routers # (if Traefik dashboard enabled)
```

### Database Backups

**Automated daily backups** (add to crontab):

```bash
# Create backup script
cat > /usr/local/bin/backup-klendoo-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/klendoo-db"
mkdir -p $BACKUP_DIR
DATE=$(date +%Y-%m-%d_%H-%M-%S)

# Backup database
docker-compose -f /home/klendoo-deploy/klendoo/docker-compose.yml exec -T db pg_dump -U klendoo klendoo > $BACKUP_DIR/klendoo-$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "klendoo-*.sql" -mtime +7 -delete

echo "Backup completed: klendoo-$DATE.sql"
EOF

chmod +x /usr/local/bin/backup-klendoo-db.sh

# Add to crontab (2 AM daily)
0 2 * * * /usr/local/bin/backup-klendoo-db.sh
```

### Zero-Downtime Deployments

When deploying new code:

```bash
cd /home/klendoo-deploy/klendoo

# Pull latest code
git pull origin main

# Rebuild Docker image
docker-compose build --no-cache

# Start new container (Docker handles graceful shutdown of old one)
docker-compose up -d --no-deps --build web

# Run any migrations
docker-compose exec web npm run db:push

# Verify health
docker-compose ps
curl -I https://klendoo.com
```

### Scaling

If traffic grows, scale the web service:

```bash
# Increase container replicas (with load balancer)
docker-compose up -d --scale web=3
```

Note: Requires updating Traefik config to load-balance across multiple containers.

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://klendoo:pass@db:5432/klendoo` |
| `GOOGLE_CLIENT_ID` | OAuth client ID | `xxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | `GOCSPX-xxxxx` |
| `ALGORAND_RPC_URL` | Algorand node URL | `https://mainnet-api.algonode.cloud` |
| `GOPLAUSIBLE_API_KEY` | x402 facilitator key | `xxxx-yyyy-zzzz` |
| `SENDGRID_API_KEY` | Email service key | `SG.xxxxx` |
| `NEXTAUTH_SECRET` | Session encryption key | (generate: `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | NextAuth callback | `https://klendoo.com` |
| `NODE_ENV` | Runtime mode | `production` |
| `POSTGRES_PASSWORD` | Database password | (strong random string) |

## CI/CD Pipeline

GitHub Actions automatically:
1. **On PR**: Lint + type-check + test
2. **On merge to main**: Build Docker image, push to Docker Hub (optional), deploy to VPS

See `.github/workflows/ci.yml` for full config.

### Manual Deployment Checklist

- [ ] Code reviewed and merged to `main`
- [ ] All tests pass
- [ ] Environment variables updated on VPS (if changed)
- [ ] Database migrations tested locally
- [ ] Backup created before deployment
- [ ] Traefik health check passing
- [ ] Booking flow tested end-to-end (visitor → chat → settlement)
- [ ] Logs monitored for errors post-deploy

## Troubleshooting

### Container won't start
```bash
docker-compose logs web
# Check: DATABASE_URL, Google OAuth secrets, port conflicts
```

### Database connection refused
```bash
docker-compose exec db pg_isready
# Ensure db container is healthy and migrations run
```

### Settlement failures
```bash
docker-compose logs web | grep "settlement\|payment\|x402"
# Check: Algorand RPC, GoPlausible API key, network connectivity
```

### Email not sending
```bash
# Check SendGrid API key and domain verification
docker-compose logs web | grep "SendGrid\|email"
```

### Certificate issues (HTTPS)
```bash
# Traefik auto-renews, but check logs:
docker-compose logs traefik | grep "letsencrypt"
```

## Production Monitoring

### Key Dashboards to Set Up

1. **Settlement Success Rate**
   ```sql
   SELECT
     (COUNT(CASE WHEN confirmed = true THEN 1 END) * 100.0 / COUNT(*)) as success_rate
   FROM settlements
   WHERE created_at > NOW() - INTERVAL '1 hour';
   ```

2. **Daily Volume**
   ```sql
   SELECT
     DATE(created_at) as date,
     COUNT(*) as settlements,
     SUM(amount_usdc) as total_volume
   FROM settlements
   WHERE confirmed = true
   GROUP BY DATE(created_at)
   ORDER BY date DESC;
   ```

3. **Microagent Performance**
   ```sql
   SELECT
     action_type,
     COUNT(*) as count,
     AVG(EXTRACT(EPOCH FROM (confirmed_at - created_at))) as avg_confirmation_seconds
   FROM settlements
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY action_type;
   ```

### Alerts

Set up PagerDuty / Datadog alerts for:
- Settlement failure rate > 5%
- Email delivery failure > 2%
- Database disk usage > 80%
- Container restart loop

## Measurement Window (October)

During the Algorand x402 competition measurement window (Oct 1-31), ensure:

1. **System stability**: Zero critical incidents
2. **Settlement reliability**: 99%+ success rate
3. **Volume tracking**: Daily settlement counts logged
4. **Transparency**: `/transparency` page updated weekly with volume proof

See [docs/ALGORAND-COMPETITION.md](ALGORAND-COMPETITION.md) for proof submission.

---

**Deployment Owner**: DevOps Lead  
**Last Updated**: 2026-07-20  
**Status**: Production-ready (Sprints 0-4 complete)
