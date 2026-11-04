/** Elemento della lista laterale: GET /conversazioni */
export interface ConversationSummary {
  id: string;
  titolo: string;
}

/** Singolo turno salvato dal backend */
export interface ChatTurn {
  tempo: string;
  modello?: string;
  domanda: string;
  risposta: string;
}

/** GET /conversazioni/{id} */
export interface ConversationDetail {
  id: string;
  titolo: string;
  chat: ChatTurn[];
}

export interface ChatRequest {
  message: string;
  session_id: string | null;
}

/** POST /chat */
export interface ChatResponse {
  id: string;
  titolo: string;
  answer: string;
  sources: string[];
  'Tempo di risposta': string;
  modello?: string;
}

/** Messaggio così come lo mostra la UI */
export interface UiMessage {
  role: 'user' | 'assistant' | 'error';
  text: string;
  /** Zona DNS inviata insieme alla richiesta (solo messaggi utente) */
  zone?: string;
  sources?: string[];
  time?: string;
  model?: string;
}

/**
 * Il backend riceve un unico campo `message` e cerca la zona DNS al suo interno
 * (record SOA). Richiesta e zona vengono quindi unite con questo separatore e
 * ri-separate quando si riapre una conversazione salvata.
 */
export const ZONE_MARKER = '\n\nZONA DNS:\n';

export function composeMessage(request: string, zone: string): string {
  return zone ? request + ZONE_MARKER + zone : request;
}

export function splitMessage(raw: string): { request: string; zone?: string } {
  const i = raw.indexOf(ZONE_MARKER);
  if (i === -1) return { request: raw };
  return { request: raw.slice(0, i), zone: raw.slice(i + ZONE_MARKER.length) };
}
