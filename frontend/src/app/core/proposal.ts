import { splitBlocks } from './text';
import { parseZone } from './zone';

/**
 * Cerca nella risposta dell'agente la zona DNS proposta: l'ultimo blocco di codice
 * che si legge come zona BIND (ha un SOA e almeno un altro record). undefined se non c'è.
 */
export function extractZone(answer: string, domain: string): string | undefined {
  const codes = splitBlocks(answer).filter((b) => b.type === 'code');
  for (let i = codes.length - 1; i >= 0; i--) {
    try {
      const parsed = parseZone(codes[i].content, domain);
      if (parsed.records.length >= 2 && parsed.records.some((r) => r.type === 'SOA')) {
        return codes[i].content;
      }
    } catch {
      // blocco di codice che non è una zona: si passa al precedente
    }
  }
  return undefined;
}
