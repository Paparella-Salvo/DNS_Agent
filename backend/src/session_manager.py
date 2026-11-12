import os
import json
from langchain_ollama import ChatOllama
#######################################NEW###########################
#from backend.src.config import BASE_DIR
from config import DATA_DIR

#DATA_DIR = os.getenv("DATA_DIR", str(BASE_DIR / "data"))
FILE = os.path.join(DATA_DIR, "chat_history.json")
"""
print(f"[DEBUG] DATA_DIR env = {os.getenv('DATA_DIR')!r}")
print(f"[DEBUG] FILE = {os.path.abspath(FILE)} | esiste: {os.path.exists(FILE)}")
"""
#############################

def lettura_file():
    if not os.path.exists(FILE):
        return {}
    with open(FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def scrittura_file(dati):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(FILE, "w", encoding="utf-8") as f:
        json.dump(dati, f, ensure_ascii=False, indent=4)

def generazione_titolo(domanda, model_name):
    llm = ChatOllama(model=model_name)
    prompt = f"Review the questions and give this conversation a short title. Write only the title and do not add explanations. Question: {domanda}"
    return llm.invoke(prompt).content.strip()

def carica_storico(n_id=None, titolo=None):
    conversazioni = lettura_file()
    
    if n_id and str(n_id) in conversazioni:
        return str(n_id), conversazioni[str(n_id)]
        
    if titolo:
        for k, dati in conversazioni.items():
            if dati.get("titolo") == titolo:
                return k, dati
                
    return None, None

def salva_messaggio(domanda, risposta, tempo_risposta, model_name, n_id=None, titolo=None):
    conversazioni = lettura_file()
    key_trovata, dati_esistenti = carica_storico(n_id, titolo)

    if dati_esistenti:
        dati_esistenti["chat"].append({
            "tempo": tempo_risposta,
            "modello": model_name,
            "domanda": domanda,
            "risposta": risposta
        })
        conversazioni[key_trovata] = dati_esistenti
        scrittura_file(conversazioni)
        return key_trovata, dati_esistenti["titolo"]
    
    # Nuova conversazione
    titolo_generato = generazione_titolo(domanda, model_name)
    
    id_esistenti = [int(k) for k in conversazioni.keys() if k.isdigit()]
    nuovo_id_str = str(max(id_esistenti, default=0) + 1)
    
    conversazioni[nuovo_id_str] = {
        "id": nuovo_id_str,
        "titolo": titolo_generato,
        "chat": [{
            "tempo": tempo_risposta,
            "modello": model_name,
            "domanda": domanda,
            "risposta": risposta
        }]
    }
    
    scrittura_file(conversazioni)
    return nuovo_id_str, titolo_generato

def elenco_conversazioni():
    conv = lettura_file()
    return [{"id": k, "titolo": v["titolo"]} for k, v in conv.items()]

def elimina_conversazione(n_id):
    conv = lettura_file()
    if str(n_id) in conv:
        del conv[str(n_id)]
        scrittura_file(conv)
        return True
    return False