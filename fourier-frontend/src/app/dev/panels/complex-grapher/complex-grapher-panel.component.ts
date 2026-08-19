import { Component, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComplexPlotComponent, ColorScheme, ComplexPoint } from '../../../shared/components/complex-plot/complex-plot.component';
import { ParamSlidersComponent, ParamValues } from '../../../shared/components/param-sliders/param-sliders.component';

@Component({
  selector: 'app-complex-grapher-panel',
  imports: [FormsModule, ComplexPlotComponent, ParamSlidersComponent],
  templateUrl: './complex-grapher-panel.component.html',
})
export class ComplexGrapherPanelComponent {

  readonly plotRef = viewChild(ComplexPlotComponent);

  readonly expr        = signal('gamma(z)');
  readonly mode        = signal<'2d' | '3d'>('2d');
  readonly colorScheme = signal<ColorScheme>('classic');
  readonly showModLines = signal(true);
  readonly showAxes    = signal(true);
  readonly showGrid2d  = signal(true);
  readonly range3d     = signal(4);
  readonly resolution  = signal(80);
  readonly heightScale = signal(1.0);
  readonly zClip       = signal(5.0);
  readonly showGrid3d  = signal(true);
  readonly wireframe   = signal(false);

  readonly compileError = signal('');
  readonly coordRe = signal('0.0000');
  readonly coordIm = signal('+0.0000');
  readonly coordFz = signal('—');

  // Free real parameters
  readonly detectedParams = signal<string[]>([]);
  readonly paramValues    = signal<ParamValues>({});

  readonly examples = [
    { label: 'Γ(z)',              fn: 'gamma(z)' },
    { label: '1/z',               fn: '1/z' },
    { label: 'z²',                fn: 'z^2' },
    { label: 'sin(z)',            fn: 'sin(z)' },
    { label: 'exp(z)',            fn: 'exp(z)' },
    { label: 'tan(z)',            fn: 'tan(z)' },
    { label: '1/(z²+1)',          fn: '1/(z^2+1)' },
    { label: '√z',                fn: 'sqrt(z)' },
    { label: '(z³−1)/(z³+1)',     fn: '(z^3-1)/(z^3+1)' },
    { label: 'log(z)',            fn: 'log(z)' },
    { label: 'sin(1/z)',          fn: 'sin(1/z)' },
    { label: 'z^z',               fn: 'z^z' },
    { label: 'Si(z)',             fn: 'Si(z)' },
    { label: 'si(z)',             fn: 'si(z)' },
    { label: 'Ci(z)',             fn: 'Ci(z)' },
    { label: 'Cin(z)',            fn: 'Cin(z)' },
    { label: 'erf(z)',            fn: 'erf(z)' },
    { label: 'erfc(z)',           fn: 'erfc(z)' },
    { label: 'erfi(z)',           fn: 'erfi(z)' },
  ];

  loadExample(fn: string): void {
    this.expr.set(fn);
    this.paramValues.set({});
  }

  onCompileError(msg: string): void {
    this.compileError.set(msg);
  }

  onParamsDetected(params: string[]): void {
    this.detectedParams.set(params);
    // Drop values for params that no longer exist
    const pv = this.paramValues();
    const next: ParamValues = {};
    for (const p of params) next[p] = pv[p] ?? 1;
    this.paramValues.set(next);
  }

  onParamChange(pv: ParamValues): void {
    this.paramValues.set(pv);
  }

  onPointerMove(pt: ComplexPoint | null): void {
    if (!pt) { this.coordFz.set('—'); return; }
    this.coordRe.set(pt.re.toFixed(4));
    this.coordIm.set((pt.im >= 0 ? '+' : '') + pt.im.toFixed(4));
    const fc = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(3);
    this.coordFz.set(isFinite(pt.fAbs) ? `${pt.fRe.toFixed(3)}${fc(pt.fIm)}i` : '∞');
  }

  resetView(): void {
    if (this.mode() === '2d') this.plotRef()?.resetView2D();
    else this.plotRef()?.resetView3D();
  }
}
