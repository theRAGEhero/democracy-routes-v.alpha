FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
ENV DR_REMOTE_WORKER_PORT=3012
EXPOSE 3012
CMD ["npm","start"]
