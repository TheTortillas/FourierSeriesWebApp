import { Component, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { RouteScrollContainerDirective } from '../../../shared/directives/route-scroll-container.directive';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  imports: [NgClass, RouterLink, RouterLinkActive, RouterOutlet, RouteScrollContainerDirective],
})
export class AdminLayoutComponent {
  private readonly transloco = inject(TranslocoService);
  readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  readonly sidebarOpen = signal(false);
}
