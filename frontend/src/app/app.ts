import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { ChatStore } from './core/chat-store';
import { ZoneStore } from './core/zone-store';
import { Sidebar } from './sidebar/sidebar';
import { ZoneView } from './zone-view/zone-view';
import { ChatPanel } from './chat-panel/chat-panel';

@Component({
  selector: 'app-root',
  imports: [Sidebar, ZoneView, ChatPanel],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly zones = inject(ZoneStore);
  protected readonly chats = inject(ChatStore);

  /** Su schermi stretti la barra laterale e la chat si aprono come pannelli sovrapposti */
  protected readonly sidebarOpen = signal(false);
  protected readonly chatOpen = signal(false);

  protected readonly domainWidth = computed(() => Math.max(10, this.zones.domain().length + 2));

  ngOnInit(): void {
    this.zones.init();
    this.chats.refreshList();
  }

  protected setDomain(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.zones.select(input.value);
    input.value = this.zones.domain();
  }

  protected closePanels(): void {
    this.sidebarOpen.set(false);
    this.chatOpen.set(false);
  }

  protected onPicked(): void {
    this.sidebarOpen.set(false);
    this.chatOpen.set(true);
  }

  /** Cmd/Ctrl + K = nuova chat */
  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.chats.newChat();
      this.chatOpen.set(true);
    }
  }
}
