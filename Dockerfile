# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and workspace files
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./

# Copy packages, services, and apps
COPY packages ./packages
COPY services ./services
COPY apps ./apps

# Install dependencies
RUN npm ci || npm install

# Build the app
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Copy built artifacts and node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/packages ./packages

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the app
CMD ["npm", "run", "start", "--workspace=apps/web"]
