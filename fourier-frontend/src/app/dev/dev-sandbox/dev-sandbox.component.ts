import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface SandboxPanel {
  label: string;
  route: string;
  phase: string;
  ready: boolean;
}

@Component({
  selector: 'app-dev-sandbox',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dev-sandbox.component.html',
})
export class DevSandboxComponent {
  readonly panels: SandboxPanel[] = [
    // Fase 1 — API & Auth
    { label: 'Auth — Register / Login / Me', route: 'auth',    phase: 'F1', ready: true },
    { label: 'API — Fourier Series',         route: 'fourier', phase: 'F1', ready: true },
    // Fase 2 — Math input (próximamente)
    { label: 'LaTeX → Maxima',  route: 'latex-maxima', phase: 'F2', ready: false },
    { label: 'MathQuill fields', route: 'mathquill',   phase: 'F2', ready: false },
    // Fase 3 — Canvas (próximamente)
    { label: 'Canvas básico',       route: 'canvas',      phase: 'F3', ready: false },
    { label: 'Canvas — Plot función', route: 'canvas-plot', phase: 'F3', ready: false },
  ];
}
