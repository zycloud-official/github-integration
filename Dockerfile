FROM node:20-alpine

ARG DATABASE_PROVIDER="postgres"
ENV DATABASE_PROVIDER=${DATABASE_PROVIDER}
ARG DATABASE_URL="postgresql://postgres:postgres@localhost:5432/zycloud"
ENV DATABASE_URL=${DATABASE_URL}

WORKDIR /app
ENV NODE_ENV production
ENV PORT 80

COPY package.json yarn.lock ./
COPY prisma ./prisma

RUN yarn install --production --frozen-lockfile
RUN yarn prisma generate

COPY . .
RUN mkdir -p data
RUN chmod +x scripts/start.sh

EXPOSE 80
CMD ["./scripts/start.sh"]
