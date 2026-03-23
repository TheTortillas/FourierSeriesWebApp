import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  template: `
    <footer class="shrink-0 border-t border-border dark:border-dark-border px-6 py-3">
      <p class="text-center text-[10px] font-mono text-muted dark:text-dark-muted">
        Fourier Web Calculator · Herramienta de análisis matemático
      </p>
    </footer>
  `,
})
export class FooterComponent {}
