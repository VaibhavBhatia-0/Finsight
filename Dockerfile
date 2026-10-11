# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS production-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --omit=dev --workspace=backend --include-workspace-root=false

FROM node:20-bookworm-slim AS backend-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace=backend --include-workspace-root=false
COPY backend ./backend
RUN npm run build --workspace=backend

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHON_PATH=/opt/venv/bin/python \
    ANALYTICS_DIR=/app/analytics

RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates python3 python3-venv \
    && python3 -m venv /opt/venv \
    && rm -rf /var/lib/apt/lists/*

COPY analytics/requirements.txt /tmp/analytics-requirements.txt
RUN /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r /tmp/analytics-requirements.txt \
    && rm /tmp/analytics-requirements.txt

COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node backend/package.json ./backend/package.json
COPY --chown=node:node frontend/package.json ./frontend/package.json
COPY --from=backend-build --chown=node:node /app/backend/dist ./backend/dist
COPY --chown=node:node database ./database
COPY --chown=node:node analytics ./analytics

USER node
EXPOSE 10000

CMD ["npm", "run", "start", "--workspace=backend"]
