# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /usr/src/app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev || npm install --only=production

# Copy source
COPY src ./src

ENV NODE_ENV=production
ENV OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317

# Create non-root user and set permissions
RUN addgroup -S app && adduser -S app -G app \
    && chown -R app:app /usr/src/app
USER app

EXPOSE 3000
CMD ["node", "-r", "./src/tracing.js", "./src/index.js"]
