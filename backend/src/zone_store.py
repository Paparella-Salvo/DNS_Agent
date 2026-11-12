import os
import re
import tempfile
from pathlib import Path
###################NEW###############################
from config import DATA_DIR, ZONES_DIR

# Copie delle zone modificate, una per chat. Sta dentro DATA_DIR
ZONES_CHAT_DIR = Path(os.getenv("ZONES_CHAT_DIR", DATA_DIR / "zone_chat",))
#############################
# etichette separate da punti, niente "/" né ".." -> impossibile uscire dalla cartella zones
DOMINIO_VALIDO = re.compile(r"^[a-z0-9_-]+(\.[a-z0-9_-]+)*$")
CHAT_VALIDA = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


#Normalizza il dominio (minuscolo, senza punto finale) e rifiuta nomi non validi
def normalizza_dominio(dominio):
    d = (dominio or "").strip().lower().rstrip(".")
    if len(d) == 0 or len(d) > 253 or not DOMINIO_VALIDO.match(d):
        raise ValueError(f"Nome di dominio non valido: {dominio!r}")
    return d


#Percorso del file della zona: zones/<dominio>.zone
def percorso_zona(dominio):
    return Path(ZONES_DIR) / f"{normalizza_dominio(dominio)}.zone"


#Elenco dei domini che hanno un file .zone nella cartella zones
def elenco_domini():
    cartella = Path(ZONES_DIR)
    if not cartella.is_dir():
        return []
    domini = []
    for file in cartella.glob("*.zone"):
        try:
            domini.append(normalizza_dominio(file.stem))
        except ValueError:
            continue
    return sorted(domini)


#Legge il testo BIND della zona (FileNotFoundError se il file non esiste)
def carica_zona(dominio):
    return percorso_zona(dominio).read_text(encoding="utf-8")


#Controlla l'id della chat 
def normalizza_chat(chat_id):
    c = str(chat_id or "").strip()
    if not CHAT_VALIDA.match(c):
        raise ValueError(f"Id chat non valido: {chat_id!r}")
    return c


#Percorso della copia della zona legata a una chat: data/zone_chat/<dominio>/<id chat>.zone
def percorso_zona_chat(dominio, chat_id):
    return Path(ZONES_CHAT_DIR) / normalizza_dominio(dominio) / f"{normalizza_chat(chat_id)}.zone"


#Zona modificata nella chat (None se in quella chat non è stato confermato nulla)
def carica_zona_chat(dominio, chat_id):
    percorso = percorso_zona_chat(dominio, chat_id)
    if not percorso.is_file():
        return None
    return percorso.read_text(encoding="utf-8")


#Salva la zona modificata nella copia della chat
def salva_zona_chat(dominio, chat_id, testo):
    return _scrivi(percorso_zona_chat(dominio, chat_id), testo)


#Elimina le copie delle zone di una chat (da chiamare quando la chat viene eliminata)
def elimina_zone_chat(chat_id):
    try:
        c = normalizza_chat(chat_id)
    except ValueError:
        return
    cartella = Path(ZONES_CHAT_DIR)
    if not cartella.is_dir():
        return
    for file in cartella.glob(f"*/{c}.zone"):
        file.unlink(missing_ok=True)


#Scrive il file in modo atomico (file temporaneo + rename) e restituisce il testo salvato
def _scrivi(percorso, testo):
    contenuto = testo.replace("\r\n", "\n").strip("\n") + "\n"

    percorso.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=percorso.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(contenuto)
        os.replace(tmp, percorso)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise
    return contenuto
