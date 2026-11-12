import { Pipe, PipeTransform } from '@angular/core';
import { Block, Segment, inlineSegments, splitBlocks } from './text';

/** Spezza una risposta in blocchi di testo e blocchi di codice. */
@Pipe({ name: 'blocks' })
export class BlocksPipe implements PipeTransform {
  transform(text: string): Block[] {
    return splitBlocks(text);
  }
}

/** Riconosce **grassetto** e `codice` in una riga di testo. */
@Pipe({ name: 'inline' })
export class InlinePipe implements PipeTransform {
  transform(text: string): Segment[] {
    return inlineSegments(text);
  }
}
