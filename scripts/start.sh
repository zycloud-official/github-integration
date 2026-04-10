#!/bin/sh

echo "Starting github-integration..."
echo "Syncing database schema (provider: ${DATABASE_PROVIDER})..."

if [ "$DATABASE_PROVIDER" = "sqlite" ]; then
  npx prisma db push --schema=prisma/schema.dev.prisma
else
  npx prisma db push
fi

echo "Starting server..."
node src/index.js
