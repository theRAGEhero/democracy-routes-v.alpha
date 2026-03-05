FROM node:18-bullseye-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip ffmpeg \
  && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir vosk

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}

RUN npm run build

EXPOSE 3011

ENV NODE_ENV=production
ENV PORT=3011
ENV VOSK_PYTHON=/usr/bin/python3

CMD ["npm", "run", "start"]
