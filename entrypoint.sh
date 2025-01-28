#!/bin/sh

# Exit script in case of error
set -e

echo "Running Prisma Migrations..."
npx prisma migrate deploy

echo "Setup complete, running node server..."
node dist/index.js