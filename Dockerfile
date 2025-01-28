# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

#Vars
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL


# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies including Prisma
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN pnpm prisma generate

# Copy source files and build
COPY . .
RUN pnpm build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

#Vars
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ARG DISCORD_TOKEN
ENV DISCORD_TOKEN=$DISCORD_TOKEN
ARG DISCORD_CLIENT_ID
ENV DISCORD_CLIENT_ID=$DISCORD_CLIENT_ID

# Copy necessary files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production
RUN chmod 755 entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]