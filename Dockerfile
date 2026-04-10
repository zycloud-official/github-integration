FROM node:20-alpine

# Both vars must be present at build time for `prisma generate`.
# Defaults are placeholders — real values come from CapRover env vars at runtime.
ARG DATABASE_PROVIDER="postgres"
ENV DATABASE_PROVIDER=${DATABASE_PROVIDER}
ARG DATABASE_URL="postgresql://postgres:postgres@localhost:5432/zycloud"
ENV DATABASE_URL=${DATABASE_URL}

WORKDIR /app
ENV NODE_ENV production
ENV PORT 80

COPY package.json ./
COPY prisma ./prisma

RUN npm install
RUN npx prisma generate

COPY . .
RUN mkdir -p data
RUN chmod +x scripts/start.sh

EXPOSE 80
CMD ["./scripts/start.sh"]
