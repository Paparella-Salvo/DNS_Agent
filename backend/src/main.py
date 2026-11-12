from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import time

import os
from pathlib import Path
from fastapi.staticfiles import StaticFiles

from rag_engine import build_knowledge_base, ask
from config import CHAT_MODELS, BASE_DIR
import session_manager 
from zones_api import router as zones_router
import zone_store

FRONTEND_DIR = Path(os.getenv(
    "FRONTEND_DIR",
    BASE_DIR / "frontend" / "dist" / "dns-chat" / "browser",
))

app = FastAPI(title="Agente DNS con Persistenza")
app.include_router(zones_router)   

root = FastAPI(title="DNS Assistant")
root.mount("/api", app)
if FRONTEND_DIR.exists():
    root.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

# Inizializzazione Knowledge Base
store, embeddings, documents = build_knowledge_base()

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    titolo: Optional[str] = None

@app.post("/chat")
def chat(req: ChatRequest):
    modello = CHAT_MODELS[5]
    # 1. Recupero storico JSON
    key_trovata, dati = session_manager.carica_storico(req.session_id, req.titolo)
    
    history = []
    if dati:
        for turno in dati["chat"]:
            history.append(("human", turno["domanda"]))
            history.append(("ai", turno["risposta"]))
            
    history.append(("human", req.message))
    user_messages = [text for role, text in history if role == "human"]
    
    # 2. Invocazione RAG
    start_time = time.time()
    answer, docs = ask(user_messages, history, store, embeddings, modello, documents)
    time_response = f"{time.time() - start_time:.2f} sec"
    
    # 3. Salvataggio su JSON
    n_id, titolo_conv = session_manager.salva_messaggio(
        domanda=req.message,
        risposta=answer,
        tempo_risposta=time_response,
        model_name=modello,
        n_id=req.session_id,
        titolo=req.titolo
    )
    
    return {
        "id": n_id,
        "titolo": titolo_conv,
        "answer": answer,
        "sources": [d.metadata["source"] for d in docs],
        "Tempo di risposta": time_response,
        "modello": modello 
    }

@app.get("/conversazioni")
def ottieni_lista_conversazioni():
    return session_manager.elenco_conversazioni()

@app.get("/conversazioni/{id_or_title}")
def ottieni_dettaglio_conversazione(id_or_title: str):
    key, dati = session_manager.carica_storico(n_id=id_or_title, titolo=id_or_title)
    if not dati:
        raise HTTPException(status_code=404, detail="Conversazione non trovata")
    return dati

@app.delete("/conversazioni/{session_id}")
def close_chat(session_id: str):
    successo = session_manager.elimina_conversazione(session_id)
    if not successo:
        raise HTTPException(status_code=404, detail="Conversazione inesistente")
    zone_store.elimina_zone_chat(session_id)
    return {"status": f"Conversazione {session_id} eliminata dal JSON"}