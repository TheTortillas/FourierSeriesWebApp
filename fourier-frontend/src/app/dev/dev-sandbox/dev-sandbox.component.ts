import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface SandboxPanel {
  label: string;
  route: string;
  phase: string;
}

@Component({
  selector: 'app-dev-sandbox',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dev-sandbox.component.html',
})
export class DevSandboxComponent {
  readonly panels: SandboxPanel[] = [
    // Fase 1 — API & Auth
    { label: 'Auth — Register / Login', route: 'auth', phase: 'Fase 1' },
    { label: 'API — Fourier Trigonométrico', route: 'fourier-trig', phase: 'Fase 1' },
    { label: 'API — Fourier Complejo', route: 'fourier-complex', phase: 'Fase 1' },
    { label: 'API — Fourier Half-Range', route: 'fourier-half', phase: 'Fase 1' },
    { label: 'API — DFT', route: 'dft', phase: 'Fase 1' },
    { label: 'API — Transforms', route: 'transforms', phase: 'Fase 1' },
    { label: 'API — Simplify', route: 'simplify', phase: 'Fase 1' },
    // Fase 2 — Math input
    { label: 'LaTeX → Maxima', route: 'latex-maxima', phase: 'Fase 2' },
    { label: 'MathQuill fields', route: 'mathquill', phase: 'Fase 2' },
    // Fase 3 — Canvas
    { label: 'Canvas básico', route: 'canvas', phase: 'Fase 3' },
    { label: 'Canvas — Plot función', route: 'canvas-plot', phase: 'Fase 3' },
  ];
}
