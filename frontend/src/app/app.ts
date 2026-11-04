import { Component, OnInit, inject, signal } from '@angular/core';
import { ChatStore } from './core/chat-store';
import { Sidebar } from './sidebar/sidebar';
import { MessageList } from './message-list/message-list';
import { Composer } from './composer/composer';

@Component({
  selector: 'app-root',
  imports: [Sidebar, MessageList, Composer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly store = inject(ChatStore);
  protected readonly sidebarOpen = signal(false);

  ngOnInit(): void {
    this.store.refreshList();
  }
}
