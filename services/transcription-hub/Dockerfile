FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./server.js

EXPOSE 3030

ENV NODE_ENV=production
ENV PORT=3030

CMD ["node", "server.js"]
