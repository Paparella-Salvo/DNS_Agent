import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { ChatStore } from '../core/chat-store';
import { BlocksPipe } from '../core/blocks.pipe';

@Component({
  selector: 'app-message-list',
  imports: [BlocksPipe],
  templateUrl: './message-list.html',
  styleUrl: './message-list.scss',
})
export class MessageList {
  protected readonly store = inject(ChatStore);
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  constructor() {
    // scorre in fondo a ogni nuovo messaggio / cambio di stato
    effect(() => {
      this.store.messages();
      this.store.sending();
      queueMicrotask(() => {
        const el = this.scroller().nativeElement;
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      });
    });
  }

  protected async copy(text: string, btn: HTMLButtonElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      const old = btn.textContent;
      btn.textContent = 'Copiato ✓';
      setTimeout(() => (btn.textContent = old), 1500);
    } catch {
      /* clipboard non disponibile (es. http non sicuro) */
    }
  }
}
