/**
 * Parser minimale di zone in formato BIND e confronto tra due zone.
 * Serve a MOSTRARE la zona e a confrontarne due versioni.
 */

export interface ZoneRecord {
  /** Host scritto nel file della zona ("@", "www", "example.com.", ...) */
  host: string;
  /** Nome assoluto, minuscolo */
  owner: string;
  type: string;
  /** TTL in secondi (null se la zona non ne definisce uno) */
  ttl: number | null;
  /** Campi del valore, senza commenti */
  fields: string[];
  /** Identifica il record nel confronto tra zone */
  key: string;
  line: number;
}

export interface ParsedZone {
  records: ZoneRecord[];
  errors: string[];
}

export type RowStatus = 'same' | 'added' | 'removed';

export interface ZoneRow {
  record: ZoneRecord;
  status: RowStatus;
}

const CLASSES = new Set(['IN', 'CH', 'HS', 'CS']);
const RR_TYPES = new Set([
  'A', 'AAAA', 'AFSDB', 'CAA', 'CNAME', 'DNAME', 'DNSKEY', 'DS', 'HINFO', 'LOC', 'MX',
  'NAPTR', 'NS', 'NSEC', 'NSEC3', 'PTR', 'RRSIG', 'SOA', 'SPF', 'SRV', 'SSHFP', 'SVCB',
  'HTTPS', 'TLSA', 'TXT', 'URI',
]);
const UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };

/** Posizioni dei campi che contengono nomi di host (resi assoluti nella chiave di confronto) */
const NAME_FIELDS: Record<string, number[]> = {
  NS: [0], CNAME: [0], PTR: [0], DNAME: [0], MX: [1], SRV: [3], SOA: [0, 1],
};

/** "3600", "1h", "1d12h" -> secondi. null se il token non è un TTL. */
export function parseTtl(token: string): number | null {
  if (!/^(\d+[smhdw]?)+$/i.test(token)) return null;
  let total = 0;
  for (const m of token.matchAll(/(\d+)([smhdw]?)/gi)) {
    total += Number(m[1]) * UNITS[(m[2] || 's').toLowerCase()];
  }
  return total;
}

/** Toglie il commento (da ";" a fine riga) ignorando i ";" tra virgolette. */
function stripComment(line: string): string {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '\\' && quoted) {
      i++;
    } else if (c === '"') {
      quoted = !quoted;
    } else if (c === ';' && !quoted) {
      return line.slice(0, i);
    }
  }
  return line;
}

/** Parole, stringhe tra virgolette (un solo token) e parentesi (token a sé). */
function tokenize(line: string): string[] {
  return line.match(/"(?:[^"\\]|\\.)*"|[()]|[^\s()";]+/g) ?? [];
}

interface LogicalLine {
  no: number;
  inherit: boolean;
  toks: string[];
}

/** Unisce le righe racchiuse tra parentesi (tipicamente il SOA) in un'unica riga logica. */
function logicalLines(text: string): LogicalLine[] {
  const lines: LogicalLine[] = [];
  const raws = text.split(/\r?\n/);
  let current: LogicalLine | null = null;
  let depth = 0;

  for (let i = 0; i < raws.length; i++) {
    const raw = raws[i];
    const toks = tokenize(stripComment(raw));

    if (depth === 0) {
      if (toks.length === 0) continue;
      current = { no: i + 1, inherit: /^[ \t]/.test(raw), toks: [] };
    }
    if (current === null) continue;

    for (const t of toks) {
      if (t === '(') depth++;
      else if (t === ')') depth = Math.max(0, depth - 1);
      else current.toks.push(t);
    }
    if (depth === 0) {
      lines.push(current);
      current = null;
    }
  }
  if (current !== null) lines.push(current);
  return lines;
}

export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.+$/, '') + '.';
}

function absolute(name: string, origin: string): string {
  if (name === '@') return origin;
  return name.endsWith('.') ? name.toLowerCase() : `${name.toLowerCase()}.${origin}`;
}

function makeKey(owner: string, type: string, rdata: string[], origin: string, ttl: number | null): string {
  const data = [...rdata];
  for (const i of NAME_FIELDS[type] ?? []) {
    if (i < data.length) data[i] = absolute(data[i], origin);
  }
  let value = data.join(' ');
  if (type !== 'TXT' && type !== 'SPF') value = value.toLowerCase();
  // il serial del SOA fa parte della chiave: cambiarlo conta come modifica
  return `${owner}|${type}|${value}|${ttl ?? ''}`;
}

export function parseZone(text: string, domainName: string): ParsedZone {
  const domain = normalizeDomain(domainName);
  const result: ParsedZone = { records: [], errors: [] };
  let origin = domain;
  let defaultTtl: number | null = null;
  let lastOwner: string | null = null;
  let lastHost = '';

  for (const ll of logicalLines(text)) {
    const toks = ll.toks;
    if (toks.length === 0) continue; // es. riga con sole parentesi
    const head = toks[0].toUpperCase();

    if (head === '$ORIGIN') {
      if (toks.length > 1) origin = absolute(toks[1], origin);
      continue;
    }
    if (head === '$TTL') {
      defaultTtl = toks.length > 1 ? parseTtl(toks[1]) : null;
      if (defaultTtl === null) result.errors.push(`Riga ${ll.no}: $TTL non valido`);
      continue;
    }
    if (head.startsWith('$')) continue;

    let owner: string | null;
    let host: string;
    let i: number;
    if (ll.inherit) {
      owner = lastOwner;
      host = lastHost; // riga che comincia con uno spazio: stesso host del record precedente
      i = 0;
    } else {
      owner = absolute(toks[0], origin);
      host = toks[0];
      i = 1;
    }
    if (owner === null) {
      result.errors.push(`Riga ${ll.no}: record senza nome host`);
      continue;
    }

    let ttl: number | null = null;
    while (i < toks.length && !RR_TYPES.has(toks[i].toUpperCase())) {
      const up = toks[i].toUpperCase();
      if (CLASSES.has(up)) {
        // classe: ignorata
      } else if (ttl === null && parseTtl(toks[i]) !== null) {
        ttl = parseTtl(toks[i]);
      } else {
        break;
      }
      i++;
    }

    if (i >= toks.length) {
      result.errors.push(`Riga ${ll.no}: tipo di record mancante`);
      continue;
    }
    const type = toks[i].toUpperCase();
    const rdata = toks.slice(i + 1);
    if (!RR_TYPES.has(type)) {
      result.errors.push(`Riga ${ll.no}: tipo di record sconosciuto`);
      continue;
    }
    if (rdata.length === 0) {
      result.errors.push(`Riga ${ll.no}: record senza valore`);
      continue;
    }

    lastOwner = owner;
    lastHost = host;
    const finalTtl = ttl ?? defaultTtl;
    result.records.push({
      host,
      owner,
      type,
      ttl: finalTtl,
      fields: rdata,
      key: makeKey(owner, type, rdata, origin, finalTtl),
      line: ll.no,
    });
  }
  return result;
}

const SOA_LABELS = ['Serial', 'Refresh', 'Retry', 'Expire', 'Minimum TTL'];

/** Valore da mostrare in tabella; il SOA è disposto su più righe, con un commento per campo. */
export function formatValue(r: ZoneRecord): string {
  if (r.type === 'SOA' && r.fields.length >= 7) {
    const [primary, admin, ...numbers] = r.fields;
    const cells = numbers.slice(0, 5).map((n, i) => (i === 4 ? `${n} )` : n));
    const width = Math.max(...cells.map((c) => c.length));
    const rows = cells.map((c, i) => `${c.padEnd(width)} ; ${SOA_LABELS[i]}`);
    return `${primary} ${admin} (\n${rows.join('\n')}`;
  }
  return r.fields.join(' ');
}

/** Il record come riga BIND (per "copia record"). */
export function recordLine(r: ZoneRecord): string {
  const ttl = r.ttl === null ? '' : `${r.ttl} `;
  return `${r.host} ${ttl}IN ${r.type} ${r.fields.join(' ')}`;
}

export function toRows(zone: ParsedZone): ZoneRow[] {
  return zone.records.map((record) => ({ record, status: 'same' as RowStatus }));
}

/**
 * Confronta due zone record per record (a insiemi con ripetizioni):
 * i record spariti sono "removed" nella zona di partenza, quelli nuovi "added" in quella finale.
 */
export function diffZones(before: ParsedZone, after: ParsedZone): { before: ZoneRow[]; after: ZoneRow[] } {
  const count = (zone: ParsedZone): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of zone.records) m.set(r.key, (m.get(r.key) ?? 0) + 1);
    return m;
  };
  const mark = (zone: ParsedZone, other: Map<string, number>, missing: RowStatus): ZoneRow[] =>
    zone.records.map((record) => {
      const n = other.get(record.key) ?? 0;
      if (n > 0) {
        other.set(record.key, n - 1);
        return { record, status: 'same' as RowStatus };
      }
      return { record, status: missing };
    });

  return {
    before: mark(before, count(after), 'removed'),
    after: mark(after, count(before), 'added'),
  };
}
