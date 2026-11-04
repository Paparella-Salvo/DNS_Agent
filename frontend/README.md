# DNS Assistant – frontend Angular

Interfaccia a chat per il backend FastAPI (`src/main.py`).

## Avvio

```bash
# 1) backend (dalla cartella src/ del tuo progetto Python)
uvicorn main:app --port 8000

# 2) frontend
npm install
npm start          # http://localhost:4200
```

In sviluppo le chiamate a `/api/*` sono girate a `http://localhost:8000` da `proxy.conf.json`
(timeout 10 min, perché il LLM + ricerca web può essere lento). Non serve toccare il backend.

## Produzione
Cambia `API_BASE` in `src/app/core/chat-api.ts` con l'URL del backend e aggiungi il CORS in FastAPI:

```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware, allow_origins=["https://tuo-frontend"],
                   allow_methods=["*"], allow_headers=["*"])
```

## Struttura
- `core/chat-api.ts` – chiamate HTTP (`/chat`, `/conversazioni`)
- `core/chat-store.ts` – stato (signals): lista chat, chat attiva, messaggi
- `core/models.ts` – tipi + unione/separazione richiesta e zona DNS
- `sidebar/` – elenco chat (id + titolo), nuova chat, elimina
- `message-list/` – messaggi; i blocchi ``` sono mostrati come codice con pulsante "Copia"
- `composer/` – barra richiesta + barra zona DNS
