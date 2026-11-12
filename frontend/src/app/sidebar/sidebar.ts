import { Component, inject, output } from '@angular/core';
import { ChatStore } from '../core/chat-store';
import { ZoneStore } from '../core/zone-store';
import { cleanTitle } from '../core/text';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  protected readonly store = inject(ChatStore);
  protected readonly zones = inject(ZoneStore);
  readonly picked = output<void>();

  protected readonly shortcut = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘ K' : 'Ctrl K';
  protected readonly title = cleanTitle;

  protected newChat(): void {
    this.store.newChat();
    this.picked.emit();
  }

  protected open(id: string): void {
    this.store.open(id);
    this.picked.emit();
  }

  protected remove(event: Event, id: string, titolo: string): void {
    event.stopPropagation();
    if (confirm(`Eliminare la chat "${cleanTitle(titolo)}"?`)) this.store.remove(id);
  }
}
