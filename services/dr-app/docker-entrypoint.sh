#!/bin/sh
set -e

echo "Running prisma db push..."
npx prisma db push

echo "Seeding database (idempotent)..."
npx prisma db seed

exec npm run start
