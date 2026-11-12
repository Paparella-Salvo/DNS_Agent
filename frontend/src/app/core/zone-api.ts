import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from './chat-api';
import { ZoneResponse } from './models';

/** Endpoint delle zone (backend: src/zones_api.py). La zona è un file BIND per dominio. */
@Injectable({ providedIn: 'root' })
export class ZoneApi {
  private readonly http = inject(HttpClient);

  /** Domini che hanno un file nella cartella zones */
  list(): Observable<string[]> {
    return this.http.get<string[]>(`${API_BASE}/zones`);
  }

  /** Zona originale; con `chat` la zona modificata in quella chat, se esiste. */
  get(domain: string, chat?: string | null): Observable<ZoneResponse> {
    const query = chat ? `?chat=${encodeURIComponent(chat)}` : '';
    return this.http.get<ZoneResponse>(`${API_BASE}/zones/${encodeURIComponent(domain)}${query}`);
  }

  /** Salva la zona così com'è (nessun controllo) nella copia della chat: l'originale non si tocca. */
  save(domain: string, text: string, chat: string): Observable<ZoneResponse> {
    const url = `${API_BASE}/zones/${encodeURIComponent(domain)}?chat=${encodeURIComponent(chat)}`;
    return this.http.put<ZoneResponse>(url, { text });
  }
}