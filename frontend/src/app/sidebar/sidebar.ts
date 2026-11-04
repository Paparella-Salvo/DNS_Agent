import { Component, inject, output } from '@angular/core';
import { ChatStore } from '../core/chat-store';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  protected readonly store = inject(ChatStore);
  readonly picked = output<void>();

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
    if (confirm(`Eliminare la conversazione "${titolo}"?`)) this.store.remove(id);
  }
}
