import { Routes } from '@angular/router';
import { TestsComponent } from './pages/tests/tests.component';
import { Text2maxComponent } from './pages/tests/text2max/text2max.component';
import { CanvaFunctionPlotterComponent } from './pages/tests/canva-function-plotter/canva-function-plotter.component';
import { MathquillComponent } from './pages/tests/mathquill/mathquill.component';
import { CanvaSidenavComponent } from './pages/tests/canva-sidenav/canva-sidenav.component';
import { ApiTestComponent } from './pages/tests/api-test/api-test.component';
import { TrigonometricSeriesComponent } from './pages/tests/trigonometric-series/trigonometric-series.component';
import { ComplexSeriesComponent } from './pages/tests/complex-series/complex-series.component';
import { TrigonometricPiecewiseSeriesComponent } from './pages/tests/trigonometric-piecewise-series/trigonometric-piecewise-series.component';
import { ComplexPiecewiseSeriesComponent } from './pages/tests/complex-piecewise-series/complex-piecewise-series.component';
import { HalfRangeSeriesComponent } from './pages/tests/half-range-series/half-range-series.component';
import { MultiCanvasLayoutComponent } from './pages/tests/multi-canvas-layout/multi-canvas-layout.component';
import { FourierCalculatorComponent } from './pages/fourier-calculator/fourier-calculator.component';
import { FourierSeriesPlotComponent } from './pages/fourier-series-plot/fourier-series-plot.component';
import { TrigComponent } from './pages/fourier-series-plot/trig/trig.component';
import { HalfRangeComponent } from './pages/fourier-series-plot/half-range/half-range.component';
export const routes: Routes = [
  {
    path: 'fourier-calculator',
    component: FourierCalculatorComponent,
  },
  {
    path: 'fourier-series-plot',
    children: [
      {
        path: 'trig',
        component: TrigComponent,
      },
      {
        path: 'half-range',
        component: HalfRangeComponent,
      },
      {
        path: '',
        redirectTo: 'trig',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'tests',
    component: TestsComponent,
    children: [
      {
        path: 'text2max',
        component: Text2maxComponent,
      },
      {
        path: 'canva',
        component: CanvaFunctionPlotterComponent,
      },
      {
        path: 'mathquill',
        component: MathquillComponent,
      },
      {
        path: 'api-test',
        component: ApiTestComponent,
      },
      {
        path: 'trigonometric-series',
        component: TrigonometricSeriesComponent,
      },
      {
        path: 'complex-series',
        component: ComplexSeriesComponent,
      },
      {
        path: 'piecewise-trig-series',
        component: TrigonometricPiecewiseSeriesComponent,
      },
      {
        path: 'complex-piecewise-series',
        component: ComplexPiecewiseSeriesComponent,
      },
      {
        path: 'half-range-series',
        component: HalfRangeSeriesComponent,
      },
      {
        path: 'canva-sidenav',
        component: CanvaSidenavComponent,
      },
      {
        path: 'multi-canvas-layout',
        component: MultiCanvasLayoutComponent,
      },
    ],
  },
  {
    path: '',
    redirectTo: 'tests',
    pathMatch: 'full',
  },

  {
    path: '**',
    redirectTo: 'tests',
    pathMatch: 'full',
  },
];
