FROM node:20-alpine AS builder
WORKDIR /app

# Copy monorepo manifests
COPY package*.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY apps/backend/package.json ./apps/backend/
COPY scripts ./scripts

# Install all dependencies from monorepo root
RUN npm ci --workspace=apps/backend --include-workspace-root

# Copy source files
COPY packages/types/src ./packages/types/src
COPY packages/tsconfig ./packages/tsconfig
COPY apps/backend/src ./apps/backend/src
COPY apps/backend/prisma ./apps/backend/prisma
COPY apps/backend/tsconfig.json ./apps/backend/tsconfig.json

# Generate Prisma client and build
WORKDIR /app/apps/backend
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/backend/package.json ./apps/backend/
COPY scripts ./scripts

RUN npm ci --workspace=apps/backend --include-workspace-root --omit=dev

COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY apps/backend/prisma ./apps/backend/prisma

WORKDIR /app/apps/backend
EXPOSE 3001
USER node
CMD ["node", "dist/index.js"]
