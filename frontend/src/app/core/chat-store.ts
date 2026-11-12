import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ChatApi } from './chat-api';
import { ZoneStore } from './zone-store';
import { describeError } from './http-error';
import { extractZone } from './proposal';
import { ConversationSummary, ProposalState, UiMessage, splitMessage, composeMessage } from './models';

const NEW_TITLE = 'Nuova chat';
const DOMAINS_KEY = 'dns-assistant.chat-domains';
const STATES_KEY = 'dns-assistant.proposal-states';

type Stored = Record<string, string>;

function readJson(key: string): Stored {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Stored) : {};
  } catch {
    return {};
  }
}

function writeJson(key: string, value: Stored): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage non disponibile */
  }
}

function clock(): string {
  return new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

/** Chat del dominio attivo e messaggi della chat aperta. */
@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly api = inject(ChatApi);
  private readonly zones = inject(ZoneStore);

  /** Tutte le conversazioni del backend (di tutti i domini) */
  private readonly all = signal<ConversationSummary[]>([]);
  /** id chat -> dominio. Il backend non lo conosce: lo ricorda il browser. */
  private readonly domainOf = signal<Stored>(readJson(DOMAINS_KEY));

  /**
   * Chat del dominio aperto. Quelle create prima di questa versione non hanno un dominio
   * registrato e vengono mostrate sotto il primo dominio dell'elenco.
   */
  readonly chats = computed(() => {
    const d = this.zones.domain();
    const fallback = this.zones.domains()[0];
    const map = this.domainOf();
    return this.all().filter((c) => (map[c.id] ?? fallback) === d);
  });

  readonly listLoading = signal(false);
  readonly listError = signal<string | null>(null);

  readonly activeId = signal<string | null>(null);
  readonly activeTitle = signal(NEW_TITLE);
  readonly messages = signal<UiMessage[]>([]);
  readonly sending = signal(false);
  readonly conversationLoading = signal(false);

  /** Incrementato a ogni cambio di chat: scarta le risposte "in ritardo". */
  private ticket = 0;
  private nextId = 1;

  constructor() {
    // cambiando dominio si riparte da una chat vuota
    effect(() => {
      this.zones.domain();
      untracked(() => this.newChat());
    });
  }

  refreshList(): void {
    this.listLoading.set(true);
    this.listError.set(null);
    this.api.list().subscribe({
      next: (list) => {
        // il backend restituisce in ordine di creazione: mostro le più recenti in alto
        this.all.set([...list].reverse());
        this.listLoading.set(false);
      },
      error: (err) => {
        this.listLoading.set(false);
        this.listError.set(describeError(err));
      },
    });
  }

  newChat(): void {
    this.ticket++;
    this.activeId.set(null);
    this.activeTitle.set(NEW_TITLE);
    this.messages.set([]);
    this.conversationLoading.set(false);
    this.zones.clearProposal();
    this.zones.useChat(null); // chat nuova: si riparte dalla zona originale
  }

  open(id: string): void {
    if (id === this.activeId()) return;
    const ticket = ++this.ticket;
    this.zones.clearProposal();
    this.activeId.set(id);
    this.zones.useChat(id); // mostra la zona modificata in questa chat, se c'è
    this.messages.set([]);
    this.conversationLoading.set(true);
    this.activeTitle.set(this.all().find((c) => c.id === id)?.titolo ?? NEW_TITLE);

    this.api.detail(id).subscribe({
      next: (d) => {
        if (ticket !== this.ticket) return;
        const states = readJson(STATES_KEY);
        const domain = this.zones.domain();
        const out: UiMessage[] = [];
        d.chat.forEach((turn, i) => {
          out.push({ id: this.nextId++, role: 'user', text: splitMessage(turn.domanda).request });
          const proposal = extractZone(turn.risposta, domain);
          const saved = states[`${id}:${i}`] as ProposalState | undefined;
          out.push({
            id: this.nextId++,
            role: 'assistant',
            text: turn.risposta,
            model: turn.modello,
            turn: i,
            proposal,
            state: proposal ? (saved ?? 'history') : undefined,
          });
        });
        this.activeTitle.set(d.titolo);
        this.messages.set(out);
        this.conversationLoading.set(false);
      },
      error: (err) => {
        if (ticket !== this.ticket) return;
        this.conversationLoading.set(false);
        this.messages.set([{ id: this.nextId++, role: 'error', text: describeError(err) }]);
      },
    });
  }

  /** Invia la richiesta insieme alla zona attualmente salvata. */
  send(request: string): void {
    const req = request.trim();
    const zone = this.zones.text();
    if (!req || !zone || this.sending()) return;

    // una nuova richiesta sostituisce la modifica ancora in attesa
    this.messages.update((list) => [
      ...list.map((m): UiMessage => (m.state === 'pending' || m.state === 'failed' ? { ...m, state: 'dismissed' } : m)),
      { id: this.nextId++, role: 'user', text: req },
    ]);
    this.zones.clearProposal();

    const ticket = this.ticket;
    const domain = this.zones.domain();
    this.sending.set(true);

    this.api.chat({ message: composeMessage(req, zone), session_id: this.activeId(), domain }).subscribe({
      next: (res) => {
        this.sending.set(false);
        this.remember(res.id, domain);

        if (ticket === this.ticket) {
          const proposal = extractZone(res.answer, domain);
          const changes = proposal !== undefined && this.zones.changesFor(proposal);
          const turn = this.messages().filter((m) => m.role === 'assistant').length;

          this.activeId.set(res.id);
          this.zones.attachChat(res.id);
          this.activeTitle.set(res.titolo);
          this.messages.update((list) => [
            ...list,
            {
              id: this.nextId++,
              role: 'assistant',
              text: res.answer,
              sources: res.sources,
              time: clock(),
              model: res.modello,
              turn,
              proposal: changes ? proposal : undefined,
              state: changes ? 'pending' : undefined,
            },
          ]);
          if (changes && proposal) this.zones.propose(proposal);
        }
        this.refreshList();
      },
      error: (err) => {
        this.sending.set(false);
        if (ticket === this.ticket) {
          this.messages.update((list) => [...list, { id: this.nextId++, role: 'error', text: describeError(err) }]);
        }
      },
    });
  }

  /** "Conferma modifica": salva la zona proposta nel backend. */
  confirm(messageId: number): void {
    const msg = this.messages().find((m) => m.id === messageId);
    if (!msg?.proposal || (msg.state !== 'pending' && msg.state !== 'failed')) return;

    this.patch(messageId, { state: 'applying', errors: undefined });
    this.zones.save(msg.proposal).subscribe({
      next: () => {
        this.patch(messageId, { state: 'applied' });
        this.persistState(msg, 'applied');
      },
      error: (err) => {
        this.patch(messageId, {
          state: 'failed',
          errors: [describeError(err)],
        });
      },
    });
  }

  /** "Annulla": scarta la modifica proposta, la zona resta com'è. */
  dismiss(messageId: number): void {
    const msg = this.messages().find((m) => m.id === messageId);
    if (!msg) return;
    this.patch(messageId, { state: 'dismissed', errors: undefined });
    this.persistState(msg, 'dismissed');
    this.zones.clearProposal();
  }

  remove(id: string): void {
    this.api.remove(id).subscribe({
      next: () => {
        this.all.update((l) => l.filter((c) => c.id !== id));
        if (this.activeId() === id) this.newChat();
      },
      error: (err) => this.listError.set(describeError(err)),
    });
  }

  private patch(messageId: number, changes: Partial<UiMessage>): void {
    this.messages.update((list) => list.map((m) => (m.id === messageId ? { ...m, ...changes } : m)));
  }

  private persistState(msg: UiMessage, state: ProposalState): void {
    const id = this.activeId();
    if (id === null || msg.turn === undefined) return;
    writeJson(STATES_KEY, { ...readJson(STATES_KEY), [`${id}:${msg.turn}`]: state });
  }

  private remember(id: string, domain: string): void {
    const next = { ...this.domainOf(), [id]: domain };
    this.domainOf.set(next);
    writeJson(DOMAINS_KEY, next);
  }
}
