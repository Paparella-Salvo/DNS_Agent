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
  /** Dominio a cui appartiene la chat (il backend attuale lo ignora) */
  domain?: string;
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

/** GET /zones/{dominio} e PUT /zones/{dominio} */
export interface ZoneResponse {
  domain: string;
  text: string;
  /** "originale" = file in zones/ (mai modificato); "chat" = copia modificata in una chat */
  source: 'originale' | 'chat';
}

/**
 * pending   modifica proposta dall'agente, in attesa di conferma
 * applying  salvataggio in corso
 * failed    il salvataggio non è riuscito (vedi `errors`)
 * applied   confermata e salvata
 * dismissed annullata
 * history   proposta di una chat riaperta: si mostra ma non si può più confermare
 */
export type ProposalState = 'pending' | 'applying' | 'failed' | 'applied' | 'dismissed' | 'history';

/** Messaggio così come lo mostra la UI */
export interface UiMessage {
  id: number;
  role: 'user' | 'assistant' | 'error';
  text: string;
  time?: string;
  model?: string;
  sources?: string[];
  /** Zona BIND completa proposta dall'agente (se la risposta ne contiene una che cambia qualcosa) */
  proposal?: string;
  state?: ProposalState;
  errors?: string[];
  /** Posizione del turno nella chat (serve a ricordare se la modifica è stata applicata) */
  turn?: number;
}

/** Iniziali mostrate nell'avatar dell'utente */
export const USER_INITIALS = 'SP';

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
