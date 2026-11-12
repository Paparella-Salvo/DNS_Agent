import { Component, HostListener, inject, signal } from '@angular/core';
import { ZoneStore } from '../core/zone-store';
import { ZoneTable } from '../zone-table/zone-table';

@Component({
  selector: 'app-zone-view',
  imports: [ZoneTable],
  templateUrl: './zone-view.html',
  styleUrl: './zone-view.scss',
})
export class ZoneView {
  protected readonly zones = inject(ZoneStore);
  protected readonly menuOpen = signal(false);

  protected toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  protected pick(domain: string): void {
    this.menuOpen.set(false);
    this.zones.select(domain);
  }

  /** Scarica la zona salvata come file BIND (<dominio>.zone) */
  protected exportZone(): void {
    const blob = new Blob([this.zones.text()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.zones.domain()}.zone`;
    link.click();
    URL.revokeObjectURL(url);
  }

  @HostListener('document:click')
  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
