FROM node:20-bookworm-slim

WORKDIR /app

# Use a known-working mediasoup worker binary to skip heavy native build in postinstall.
COPY bin/mediasoup-worker /usr/local/bin/mediasoup-worker
RUN chmod +x /usr/local/bin/mediasoup-worker

ENV MEDIASOUP_WORKER_BIN=/usr/local/bin/mediasoup-worker

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3020

ENV NODE_ENV=production
ENV PORT=3020
ENV HOST=0.0.0.0

CMD ["node", "server.js"]
