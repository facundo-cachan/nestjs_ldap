# Stage 1: Install build dependencies (all dependencies)
FROM node:25-alpine AS build_deps
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install

# Stage 2: Build the application
FROM node:25-alpine AS builder
WORKDIR /usr/src/app
COPY --from=build_deps /usr/src/app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Stage 3: Production dependencies
FROM node:25-alpine AS prod-deps
WORKDIR /usr/src/app
COPY package*.json ./

ENV NODE_ENV production

RUN npm install --omit=dev

# Stage 4: Production image
FROM node:25-alpine AS runner
WORKDIR /usr/src/app

ENV NODE_ENV production

# Create a non-root user and install migration tools
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs && \
    npm install ts-node typescript tsconfig-paths --no-save

COPY --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/ormconfig.ts ./
COPY --from=builder /usr/src/app/tsconfig.json ./
# Copy source code for migrations (required because ormconfig points to src and we use ts-node)
COPY --from=builder /usr/src/app/src ./src

USER nestjs

EXPOSE 3000

CMD ["sh", "-c", "pnpm migration:run && pnpm start:prod"]
