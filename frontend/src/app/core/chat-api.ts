import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChatRequest, ChatResponse, ConversationDetail, ConversationSummary } from './models';

/**
 * In sviluppo `/api` viene girato a http://localhost:8000 da proxy.conf.json.
 * In produzione cambia questo valore con l'URL del backend (e abilita il CORS lato FastAPI).
 */
export const API_BASE = '/api';

@Injectable({ providedIn: 'root' })
export class ChatApi {
  private readonly http = inject(HttpClient);

  list(): Observable<ConversationSummary[]> {
    return this.http.get<ConversationSummary[]>(`${API_BASE}/conversazioni`);
  }

  detail(id: string): Observable<ConversationDetail> {
    return this.http.get<ConversationDetail>(`${API_BASE}/conversazioni/${encodeURIComponent(id)}`);
  }

  chat(body: ChatRequest): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${API_BASE}/chat`, body);
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${API_BASE}/conversazioni/${encodeURIComponent(id)}`);
  }
}
