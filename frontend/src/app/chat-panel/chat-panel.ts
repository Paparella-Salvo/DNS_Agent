import { Component, ElementRef, HostListener, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ChatStore } from '../core/chat-store';
import { ZoneStore } from '../core/zone-store';
import { USER_INITIALS } from '../core/models';
import { BlocksPipe, InlinePipe } from '../core/rich-text.pipe';
import { cleanTitle } from '../core/text';

@Component({
  selector: 'app-chat-panel',
  imports: [BlocksPipe, InlinePipe],
  templateUrl: './chat-panel.html',
  styleUrl: './chat-panel.scss',
})
export class ChatPanel {
  protected readonly store = inject(ChatStore);
  protected readonly zones = inject(ZoneStore);
  protected readonly initials = USER_INITIALS;

  protected readonly draft = signal('');
  protected readonly menuOpen = signal(false);

  protected readonly canSend = computed(
    () => this.draft().trim().length > 0 && !this.store.sending() && this.zones.text() !== '',
  );

  protected readonly status = computed(() => {
    if (this.zones.online() === false) return 'Backend non raggiungibile';
    return this.zones.domain() ? `Collegato a ${this.zones.domain()}` : 'In attesa di un dominio';
  });

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly input = viewChild.required<ElementRef<HTMLTextAreaElement>>('input');

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

  protected onInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.draft.set(el.value);
    this.autosize(el);
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.submit();
    }
  }

  protected submit(event?: Event): void {
    event?.preventDefault();
    if (!this.canSend()) return;
    this.store.send(this.draft());
    this.draft.set('');
    const el = this.input().nativeElement;
    el.value = '';
    this.autosize(el);
  }

  protected toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  protected newChat(): void {
    this.menuOpen.set(false);
    this.store.newChat();
    this.input().nativeElement.focus();
  }

  protected removeActive(): void {
    this.menuOpen.set(false);
    const id = this.store.activeId();
    if (id !== null && confirm(`Eliminare la chat "${cleanTitle(this.store.activeTitle())}"?`)) {
      this.store.remove(id);
    }
  }

  private autosize(el: HTMLTextAreaElement): void {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  @HostListener('document:click')
  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
