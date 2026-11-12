/** Utilità pure (senza Angular) per mostrare le risposte dell'agente. */

export interface Line {
  text: string;
  /** Elenco puntato ("*", "-", "•") */
  bullet: boolean;
}

export interface Block {
  type: 'text' | 'code';
  /** Contenuto del blocco di codice (vuoto per i blocchi di testo) */
  content: string;
  /** Righe del blocco di testo (vuoto per i blocchi di codice) */
  lines: Line[];
  lang?: string;
}

export interface Segment {
  text: string;
  bold: boolean;
  code: boolean;
}

const BULLET = /^\s*[*\-•]\s+/;

function textBlock(raw: string): Block | null {
  const lines: Line[] = [];
  for (const row of raw.split('\n')) {
    const trimmed = row.trim();
    if (!trimmed) continue;
    const bullet = BULLET.test(row);
    lines.push({ text: bullet ? row.replace(BULLET, '').trim() : trimmed, bullet });
  }
  return lines.length > 0 ? { type: 'text', content: '', lines } : null;
}

/** Spezza una risposta in blocchi di testo e blocchi di codice (```...```). */
export function splitBlocks(text: string): Block[] {
  const out: Block[] = [];
  const re = /```([\w-]*)[ \t]*\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;

  const pushText = (s: string): void => {
    const b = textBlock(s);
    if (b) out.push(b);
  };

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) pushText(text.slice(last, m.index));
    out.push({ type: 'code', lang: m[1] || undefined, content: m[2].replace(/\n$/, ''), lines: [] });
    last = m.index + m[0].length;
  }
  if (last < text.length) pushText(text.slice(last));
  return out;
}

/** Riconosce **grassetto** e `codice` dentro una riga di testo. */
export function inlineSegments(text: string): Segment[] {
  const out: Segment[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false, code: false });
    if (m[1] !== undefined) out.push({ text: m[1], bold: true, code: false });
    else out.push({ text: m[2], bold: false, code: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false, code: false });
  return out;
}

/** Titolo di chat pulito (il modello a volte lo restituisce con **, virgolette o #). */
export function cleanTitle(title: string): string {
  return title.replace(/[*#`"]/g, '').trim() || 'Chat senza titolo';
}
