import { Component, HostListener, input, signal } from '@angular/core';
import { RowStatus, ZoneRecord, ZoneRow, formatValue, recordLine } from '../core/zone';

/** Tabella dei record di una zona. Le righe "added" sono verdi, quelle "removed" rosse. */
@Component({
  selector: 'app-zone-table',
  templateUrl: './zone-table.html',
  styleUrl: './zone-table.scss',
})
export class ZoneTable {
  readonly rows = input.required<ZoneRow[]>();

  protected readonly menuIndex = signal<number | null>(null);
  protected readonly copied = signal(false);

  protected readonly value = formatValue;

  protected marker(status: RowStatus): string {
    return status === 'added' ? '+' : status === 'removed' ? '−' : '';
  }

  protected statusLabel(status: RowStatus): string {
    return status === 'added' ? 'Record aggiunto o modificato' : status === 'removed' ? 'Record eliminato o modificato' : '';
  }

  protected toggle(event: Event, index: number): void {
    event.stopPropagation();
    this.copied.set(false);
    this.menuIndex.set(this.menuIndex() === index ? null : index);
  }

  protected async copy(record: ZoneRecord): Promise<void> {
    try {
      await navigator.clipboard.writeText(recordLine(record));
      this.copied.set(true);
      setTimeout(() => this.menuIndex.set(null), 900);
    } catch {
      this.menuIndex.set(null); // clipboard non disponibile (es. http non sicuro)
    }
  }

  @HostListener('document:click')
  protected closeMenu(): void {
    this.menuIndex.set(null);
  }
}
