import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ChatApi } from './chat-api';
import { ConversationSummary, UiMessage, composeMessage, splitMessage } from './models';

const NEW_TITLE = 'Nuova conversazione';

@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly api = inject(ChatApi);

  readonly conversations = signal<ConversationSummary[]>([]);
  readonly listLoading = signal(false);
  readonly listError = signal<string | null>(null);

  readonly activeId = signal<string | null>(null);
  readonly activeTitle = signal(NEW_TITLE);
  readonly messages = signal<UiMessage[]>([]);
  readonly sending = signal(false);
  readonly conversationLoading = signal(false);

  /** Incrementato a ogni cambio di conversazione: scarta le risposte "in ritardo". */
  private ticket = 0;

  refreshList(): void {
    this.listLoading.set(true);
    this.listError.set(null);
    this.api.list().subscribe({
      next: (list) => {
        // il backend restituisce in ordine di creazione: mostro le più recenti in alto
        this.conversations.set([...list].reverse());
        this.listLoading.set(false);
      },
      error: (err) => {
        this.listLoading.set(false);
        this.listError.set(this.describe(err));
      },
    });
  }

  newChat(): void {
    this.ticket++;
    this.activeId.set(null);
    this.activeTitle.set(NEW_TITLE);
    this.messages.set([]);
    this.conversationLoading.set(false);
  }

  open(id: string): void {
    if (id === this.activeId()) return;
    const ticket = ++this.ticket;
    this.activeId.set(id);
    this.messages.set([]);
    this.conversationLoading.set(true);
    const summary = this.conversations().find((c) => c.id === id);
    this.activeTitle.set(summary?.titolo ?? NEW_TITLE);

    this.api.detail(id).subscribe({
      next: (d) => {
        if (ticket !== this.ticket) return;
        this.activeTitle.set(d.titolo);
        this.messages.set(
          d.chat.flatMap<UiMessage>((turn) => {
            const { request, zone } = splitMessage(turn.domanda);
            return [
              { role: 'user', text: request, zone },
              { role: 'assistant', text: turn.risposta, time: turn.tempo, model: turn.modello },
            ];
          }),
        );
        this.conversationLoading.set(false);
      },
      error: (err) => {
        if (ticket !== this.ticket) return;
        this.conversationLoading.set(false);
        this.messages.set([{ role: 'error', text: this.describe(err) }]);
      },
    });
  }

  send(request: string, zone: string): void {
    const req = request.trim();
    const z = zone.trim();
    if (!req || this.sending()) return;

    const ticket = this.ticket;
    this.messages.update((m) => [...m, { role: 'user', text: req, zone: z || undefined }]);
    this.sending.set(true);

    this.api.chat({ message: composeMessage(req, z), session_id: this.activeId() }).subscribe({
      next: (res) => {
        this.sending.set(false);
        if (ticket === this.ticket) {
          this.activeId.set(res.id);
          this.activeTitle.set(res.titolo);
          this.messages.update((m) => [
            ...m,
            {
              role: 'assistant',
              text: res.answer,
              sources: res.sources,
              time: res['Tempo di risposta'],
              model: res.modello,
            },
          ]);
        }
        this.refreshList();
      },
      error: (err) => {
        this.sending.set(false);
        if (ticket === this.ticket) {
          this.messages.update((m) => [...m, { role: 'error', text: this.describe(err) }]);
        }
      },
    });
  }

  remove(id: string): void {
    this.api.remove(id).subscribe({
      next: () => {
        this.conversations.update((l) => l.filter((c) => c.id !== id));
        if (this.activeId() === id) this.newChat();
      },
      error: (err) => this.listError.set(this.describe(err)),
    });
  }

  private describe(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        return 'Backend non raggiungibile. Controlla che FastAPI sia avviato su http://localhost:8000.';
      }
      const detail = typeof err.error?.detail === 'string' ? err.error.detail : err.statusText;
      return `Errore ${err.status}: ${detail}`;
    }
    return 'Errore imprevisto.';
  }
}
