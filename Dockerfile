# ---------- stage 1: build del frontend Angular ----------
FROM node:22-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim

WORKDIR /app

# Librerie di sistema per compilare le dipendenze native
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential git && \
    rm -rf /var/lib/apt/lists/*

# Dipendenze (layer in cache finché requirements.txt non cambia)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Solo il contenuto di src/ -> /app (main.py e DNS_chatbot.py finiscono in /app)
COPY src/ .

# Frontend compilato -> /app/frontend
COPY --from=frontend-build /frontend/dist/dns-chat/browser ./frontend

EXPOSE 8000

ENV DATA_DIR=/app/data
ENV FRONTEND_DIR=/app/frontend

CMD ["uvicorn", "main:root", "--host", "0.0.0.0", "--port", "8000"]