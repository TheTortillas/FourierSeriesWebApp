import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-share-dialog',
  templateUrl: './share-dialog.component.html',
  imports: [TranslocoPipe],
})
export class ShareDialogComponent {
  readonly visible    = input(false);
  readonly shareHref  = input('');
  readonly urlCopied  = input(false);

  readonly closed = output<void>();
  readonly copy   = output<void>();

  selectAll(event: Event): void {
    (event.target as HTMLInputElement).select();
  }
}
