FROM node:18-alpine AS base
RUN apk add --no-cache dumb-init curl
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN rm -rf node_modules/.cache

EXPOSE 5000
USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
