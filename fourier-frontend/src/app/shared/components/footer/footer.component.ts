import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-footer',
  imports: [TranslocoPipe],
  template: `
    <footer class="shrink-0 border-t border-border dark:border-dark-border px-6 py-3">
      <p class="text-center text-[10px] font-mono text-muted dark:text-dark-muted">
        Fourier Web Calculator · {{ 'nav.footerText' | transloco }}
      </p>
    </footer>
  `,
})
export class FooterComponent {}
