import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-favorite-dialog',
  templateUrl: './favorite-dialog.component.html',
  imports: [FormsModule, TranslocoPipe],
})
export class FavoriteDialogComponent {
  readonly visible = input(false);

  readonly confirmed = output<string>();
  readonly cancelled = output<void>();

  name = '';

  confirm(): void {
    this.confirmed.emit(this.name);
    this.name = '';
  }

  cancel(): void {
    this.name = '';
    this.cancelled.emit();
  }
}
