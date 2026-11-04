import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatStore } from '../core/chat-store';

@Component({
  selector: 'app-composer',
  imports: [FormsModule],
  templateUrl: './composer.html',
  styleUrl: './composer.scss',
})
export class Composer {
  protected readonly store = inject(ChatStore);

  protected readonly request = signal('');
  protected readonly zone = signal('');
  protected readonly canSend = computed(() => this.request().trim().length > 0 && !this.store.sending());

  protected readonly zonePlaceholder =
    '$ORIGIN example.com.\n$TTL 3600\n@ IN SOA ns1.example.com. admin.example.com. ( 2026102601 7200 3600 1209600 3600 )\n@ IN NS ns1.example.com.\n…';

  protected send(): void {
    if (!this.canSend()) return;
    this.store.send(this.request(), this.zone());
    this.request.set('');
    // la zona resta compilata: in una conversazione si lavora spesso sulla stessa zona
    // (il backend riparte comunque dall'ultima zona presente nello storico)
  }

  protected clearZone(): void {
    this.zone.set('');
  }

  protected onRequestKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      this.send();
    }
  }

  protected onZoneKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.send();
    }
  }
}
