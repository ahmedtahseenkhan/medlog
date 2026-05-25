FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy monorepo manifests
COPY package*.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY apps/backend/package.json ./apps/backend/
COPY scripts ./scripts

# Install production dependencies (tsx is in deps now)
RUN npm ci --workspace=apps/backend --include-workspace-root --omit=dev

# Copy source files
COPY packages/types/src ./packages/types/src
COPY packages/tsconfig ./packages/tsconfig
COPY apps/backend/src ./apps/backend/src
COPY apps/backend/prisma ./apps/backend/prisma
COPY apps/backend/tsconfig.json ./apps/backend/tsconfig.json

# Generate Prisma client
WORKDIR /app/apps/backend
RUN npx prisma generate

EXPOSE 3001
CMD ["npx", "tsx", "src/index.ts"]
