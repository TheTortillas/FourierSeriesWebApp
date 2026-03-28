import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NavComponent } from '../../../shared/components/nav/nav.component';

@Component({
  selector: 'app-dft',
  templateUrl: './dft.component.html',
  imports: [NavComponent, RouterModule],
})
export class DftComponent {}
