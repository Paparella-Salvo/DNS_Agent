from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import zone_store as zone_store

router = APIRouter(prefix="/zones", tags=["zone"])

MAX_CARATTERI = 500_000


class ZonaIn(BaseModel):
    text: str


def _dominio(domain):
    try:
        return zone_store.normalizza_dominio(domain)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _chat(chat):
    try:
        return zone_store.normalizza_chat(chat)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _risposta(dominio, testo, fonte):
    # fonte: "originale" (file in zones/) oppure "chat" (copia modificata nella chat)
    return {"domain": dominio, "text": testo, "source": fonte}


def _originale(d):
    try:
        return zone_store.carica_zona(d)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Zona non trovata: manca il file zones/{d}.zone")


@router.get("")
def elenco_zone():
    return zone_store.elenco_domini()


@router.get("/{domain}")
def leggi_zona(domain: str, chat: Optional[str] = None):
    """Con ?chat=<id> restituisce la zona modificata in quella chat, se esiste; altrimenti l'originale."""
    d = _dominio(domain)
    originale = _originale(d)
    if chat:
        modificata = zone_store.carica_zona_chat(d, _chat(chat))
        if modificata is not None:
            return _risposta(d, modificata, "chat")
    return _risposta(d, originale, "originale")


@router.put("/{domain}")
def salva_zona(domain: str, body: ZonaIn, chat: Optional[str] = None):
    """Salva la zona confermata nella copia della chat (?chat=<id>). L'originale non viene toccato."""
    d = _dominio(domain)
    if not chat:
        raise HTTPException(status_code=400, detail="Per salvare una modifica serve l'id della chat")
    c = _chat(chat)
    if len(body.text) > MAX_CARATTERI:
        raise HTTPException(status_code=413, detail="Zona troppo grande")
    _originale(d)  # il dominio deve avere una zona originale in zones/

    return _risposta(d, zone_store.salva_zona_chat(d, c, body.text), "chat")
