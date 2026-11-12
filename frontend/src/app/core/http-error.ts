import { HttpErrorResponse } from '@angular/common/http';

/** Messaggio leggibile per un errore HTTP */
export function describeError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return 'Backend non raggiungibile. Controlla che FastAPI sia avviato su http://localhost:8000.';
    }
    const detail = err.error?.detail;
    if (typeof detail === 'string') return detail;
    return `Errore ${err.status}: ${err.statusText}`;
  }
  return 'Errore imprevisto.';
}