# ---------- stage 1: build del frontend Angular ----------
FROM node:22-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- stage 2: backend Python ----------
FROM python:3.11-slim

WORKDIR /app

# Librerie di sistema per compilare le dipendenze native
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential git && \
    rm -rf /var/lib/apt/lists/*

# Dipendenze (layer in cache finché requirements.txt non cambia)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Codice del backend: il contenuto di backend/src/ -> /app
COPY backend/src/ .

# Zone DNS in formato BIND (una per dominio: <dominio>.zone)
COPY zones/ ./zones

# Frontend compilato -> /app/frontend
COPY --from=frontend-build /frontend/dist/dns-chat/browser ./frontend

EXPOSE 8000

# In container config.py sta in /app: la radice del progetto va indicata a mano
ENV PROJECT_ROOT=/app
ENV DATA_DIR=/app/data
ENV ZONES_DIR=/app/zones
ENV FRONTEND_DIR=/app/frontend

CMD ["uvicorn", "main:root", "--host", "0.0.0.0", "--port", "8000"]