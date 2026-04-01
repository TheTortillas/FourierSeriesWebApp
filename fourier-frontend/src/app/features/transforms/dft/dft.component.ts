import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NavComponent } from '../../../shared/components/nav/nav.component';

@Component({
  selector: 'app-dft',
  templateUrl: './dft.component.html',
  imports: [NavComponent, RouterModule, TranslocoPipe],
})
export class DftComponent {}
