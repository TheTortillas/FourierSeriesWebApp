import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NavComponent } from '../../../shared/components/nav/nav.component';
import { SeoService } from '../../../core/services/seo/seo.service';

@Component({
  selector: 'app-dft',
  templateUrl: './dft.component.html',
  imports: [NavComponent, RouterModule, TranslocoPipe],
})
export class DftComponent implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.setPage('seo.dft.title', 'seo.dft.description');
  }
}
