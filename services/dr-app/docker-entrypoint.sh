#!/bin/sh
set -e

echo "Running prisma db push..."
npx prisma db push

echo "Seeding database (idempotent)..."
npx prisma db seed

echo "Syncing Telegram webhook..."
node ./scripts/sync-telegram-webhook.js

exec npm run start
