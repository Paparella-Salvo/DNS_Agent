import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, tap, throwError } from 'rxjs';
import { ZoneApi } from './zone-api';
import { ZoneResponse } from './models';
import { describeError } from './http-error';
import { ParsedZone, ZoneRow, diffZones, parseZone, toRows } from './zone';

const STORAGE_KEY = 'dns-assistant.domain';
const EMPTY: ParsedZone = { records: [], errors: [] };

function readStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* storage non disponibile */
  }
}

/** Dominio attivo, zona salvata nel backend e modifica proposta in attesa di conferma. */
@Injectable({ providedIn: 'root' })
export class ZoneStore {
  private readonly api = inject(ZoneApi);

  /** Domini che hanno un file nella cartella zones */
  readonly domains = signal<string[]>([]);
  readonly domain = signal('');

  /** Chat aperta: la zona mostrata è quella modificata in quella chat (se esiste) */
  readonly chatId = signal<string | null>(null);
  /** Da dove viene la zona mostrata: file originale o copia modificata nella chat */
  readonly source = signal<'originale' | 'chat'>('originale');

  /** Zona mostrata, in formato BIND */
  readonly text = signal('');
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  /** null = non ancora noto */
  readonly online = signal<boolean | null>(null);

  /** Zona proposta dall'agente, non ancora confermata */
  readonly proposal = signal<string | null>(null);

  readonly current = computed<ParsedZone>(() =>
    this.text() ? parseZone(this.text(), this.domain()) : EMPTY,
  );

  private readonly diff = computed(() => {
    const p = this.proposal();
    return p ? diffZones(this.current(), parseZone(p, this.domain())) : null;
  });

  /** Righe della zona originale: con i record da eliminare evidenziati se c'è una proposta */
  readonly originalRows = computed<ZoneRow[]>(() => this.diff()?.before ?? toRows(this.current()));
  /** Righe della zona aggiornata (null se non c'è nessuna proposta) */
  readonly updatedRows = computed<ZoneRow[] | null>(() => this.diff()?.after ?? null);

  /** Carica l'elenco dei domini e apre l'ultimo usato (o il primo). */
  init(): void {
    this.api.list().subscribe({
      next: (list) => {
        this.online.set(true);
        this.domains.set(list);
        const saved = readStorage();
        const first = saved && list.includes(saved) ? saved : list[0];
        if (first) {
          this.select(first);
        } else {
          this.loadError.set('Nessuna zona trovata: aggiungi un file <dominio>.zone nella cartella zones.');
        }
      },
      error: (err) => {
        this.online.set(!(err instanceof HttpErrorResponse && err.status === 0));
        this.loadError.set(describeError(err));
      },
    });
  }

  /** Cambia dominio (nome libero: se non esiste il file .zone il backend risponde 404). */
  select(raw: string): void {
    const d = raw.trim().toLowerCase().replace(/\.+$/, '');
    if (!d) return;
    if (d === this.domain() && this.text()) return;

    this.domain.set(d);
    this.chatId.set(null);
    this.source.set('originale');
    this.proposal.set(null);
    this.text.set('');
    this.loadError.set(null);
    writeStorage(d);
    this.load(d);
  }

  /**
   * Apre una chat (o una chat nuova, null): mostra la zona modificata in quella chat, se c'è,
   * altrimenti l'originale.
   */
  useChat(id: string | null): void {
    if (id === this.chatId()) return;
    this.chatId.set(id);
    this.proposal.set(null);
    const d = this.domain();
    if (d) this.load(d);
  }

  /** Una chat nuova ha appena ricevuto il suo id: la zona mostrata non cambia. */
  attachChat(id: string): void {
    this.chatId.set(id);
  }

  private load(d: string): void {
    const chat = this.chatId();
    this.loading.set(true);
    this.api.get(d, chat).subscribe({
      next: (res) => {
        if (this.domain() !== d || this.chatId() !== chat) return;
        this.online.set(true);
        this.text.set(res.text);
        this.source.set(res.source);
        this.loading.set(false);
        if (!this.domains().includes(d)) this.domains.update((l) => [...l, d].sort());
      },
      error: (err) => {
        if (this.domain() !== d || this.chatId() !== chat) return;
        this.online.set(!(err instanceof HttpErrorResponse && err.status === 0));
        this.loading.set(false);
        this.loadError.set(describeError(err));
      },
    });
  }

  propose(text: string): void {
    this.proposal.set(text);
  }

  clearProposal(): void {
    this.proposal.set(null);
  }

  /**
   * True se la zona proposta cambia davvero qualcosa. Un nuovo Serial nel SOA da solo
   * non conta: l'agente lo aggiorna sempre, anche quando riscrive la zona identica.
   */
  changesFor(text: string): boolean {
    const d = diffZones(this.current(), parseZone(text, this.domain()));
    return [...d.before, ...d.after].some((r) => r.status !== 'same' && r.record.type !== 'SOA');
  }

  /** Salva la zona nella copia della chat aperta (la zona originale in zones/ resta intatta). */
  save(text: string): Observable<ZoneResponse> {
    const d = this.domain();
    const chat = this.chatId();
    if (chat === null) return throwError(() => new Error('Nessuna chat aperta'));
    return this.api.save(d, text, chat).pipe(
      tap((res) => {
        if (this.domain() !== d || this.chatId() !== chat) return;
        this.text.set(res.text);
        this.source.set(res.source);
        this.proposal.set(null);
      }),
    );
  }
}
