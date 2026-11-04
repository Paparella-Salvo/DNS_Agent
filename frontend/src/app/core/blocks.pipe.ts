import { Pipe, PipeTransform } from '@angular/core';

export interface Block {
  type: 'text' | 'code';
  content: string;
  lang?: string;
}

/** Spezza una risposta in blocchi di testo e blocchi di codice (```...```). */
@Pipe({ name: 'blocks' })
export class BlocksPipe implements PipeTransform {
  transform(text: string): Block[] {
    const out: Block[] = [];
    const re = /```([\w-]*)\n?([\s\S]*?)```/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) this.pushText(out, text.slice(last, m.index));
      out.push({ type: 'code', lang: m[1] || undefined, content: m[2].replace(/\n$/, '') });
      last = m.index + m[0].length;
    }
    if (last < text.length) this.pushText(out, text.slice(last));
    return out;
  }

  private pushText(out: Block[], s: string): void {
    const t = s.trim();
    if (t) out.push({ type: 'text', content: t });
  }
}
