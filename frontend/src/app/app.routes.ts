import { Routes } from '@angular/router';
import { TestsComponent } from './pages/tests/tests.component';
import { Text2maxComponent } from './pages/tests/text2max/text2max.component';
import { CanvaComponent } from './pages/tests/canva/canva.component';
import { MathquillComponent } from './pages/tests/mathquill/mathquill.component';
import { FourierMainComponent } from './pages/fourier-main/fourier-main.component'; 
export const routes: Routes = [
  {
    path: 'main',
    component: FourierMainComponent
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
        component: CanvaComponent,
      },
      {
        path: 'mathquill',
        component: MathquillComponent,
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
