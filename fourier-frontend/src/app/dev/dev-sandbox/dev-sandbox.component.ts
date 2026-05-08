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
    { label: 'Auth — Register / Login / Me', route: 'auth', phase: 'F1', ready: true },
    { label: 'API — Fourier Series', route: 'fourier', phase: 'F1', ready: true },
    // Fase 2 — Math input
    { label: 'LaTeX → Maxima', route: 'latex-maxima', phase: 'F2', ready: true },
    { label: 'MathQuill fields', route: 'mathquill', phase: 'F2', ready: true },
    // Fase 3 — Canvas
    { label: 'Canvas — Smoke test', route: 'canvas', phase: 'F3', ready: true },
    { label: 'Canvas — Función + Fourier', route: 'canvas-plot', phase: 'F3', ready: true },
    { label: 'Canvas — Epiciclos (DFT)', route: 'epicycles', phase: 'F4', ready: true },
    { label: 'DFT — Signal Lab (1D)', route: 'dft-signal-lab', phase: 'F4', ready: true },
    { label: 'DFT — Signal Lab A/B', route: 'dft-signal-lab-ab', phase: 'F4', ready: true },
    { label: 'DFT — Signal Lab C (Filtros)', route: 'dft-signal-lab-c', phase: 'F4', ready: true },
    {
      label: 'DFT — Signal Lab Imagen 2D',
      route: 'dft-signal-lab-image',
      phase: 'F4',
      ready: true,
    },
  ];
}
