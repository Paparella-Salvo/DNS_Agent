import re
from datetime import date

PATTERN_SERIAL = r"(SOA\s+\S+\s+\S+\s+\(?\s*)(\d+)"

#Restituisce il serial della zona come numero intero, oppure None se non lo trova.
def leggi_serial(zona):
    if not zona:
        return None
    trovato = re.search(PATTERN_SERIAL, zona, re.IGNORECASE)
    if trovato is None:
        return None
    return int(trovato.group(2))

#Calcola il nuovo serial nel formato YYYYMMDDNN 
def calcola_nuovo_serial(serial_attuale, oggi=None):
    if oggi is None:
        oggi = date.today()

    inizio_di_oggi = int(oggi.strftime("%Y%m%d")) * 100   # 26 ottobre 2026 -> 2026102600

    if serial_attuale is None or serial_attuale < inizio_di_oggi:
        return inizio_di_oggi + 1
    return serial_attuale + 1

#Cerca il messaggio più recente che contiene la zona
def trova_zona_corrente(history):
    for ruolo, testo in reversed(history):
        if leggi_serial(testo) is not None:
            return testo
    return None

#Aggiorna nella zona prodotta il nuovo serial
def aggiorna_serial(zona_risposta, zona_originale, oggi=None):
    nuovo = calcola_nuovo_serial(leggi_serial(zona_originale), oggi)
    return re.sub(PATTERN_SERIAL, lambda m: m.group(1) + str(nuovo),
                  zona_risposta, count=1, flags=re.IGNORECASE)

#Controllo se il serial scritto nella zona è quello corretto
def serial_corretto(zona_risposta, zona_corrente, oggi=None):
    atteso = calcola_nuovo_serial(leggi_serial(zona_corrente), oggi)
    return leggi_serial(zona_risposta) == atteso

#Controlla e corregge il Serial
def controlla_e_correggi(risposta, zona_corrente, oggi=None):
    serial_modello = leggi_serial(risposta)

    if serial_modello is None:                       
        return risposta, "nessuna zona nella risposta"

    if serial_corretto(risposta, zona_corrente, oggi):
        return risposta, "serial gia' corretto"

    corretta = aggiorna_serial(risposta, zona_corrente, oggi)
    return corretta, f"serial corretto: {serial_modello} -> {leggi_serial(corretta)}"