FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./server.js

ENV NODE_ENV=production
ENV EVENT_HUB_PORT=3040
ENV EVENT_HUB_DB=/data/events.db

EXPOSE 3040

CMD ["npm", "start"]
