import { Routes } from '@angular/router';
import { TestsComponent } from './pages/tests/tests.component';
import { Text2maxComponent } from './pages/tests/text2max/text2max.component';
import { CanvaComponent } from './pages/tests/canva/canva.component';

export const routes: Routes = [
    {
        path: 'tests',
        component: TestsComponent,
        children: [
          {
            path: 'text2max',
            component: Text2maxComponent
          },
          {
            path: 'canva',
            component: CanvaComponent
          }
        ]
      },
      {
        path: '',
        redirectTo: 'tests',
        pathMatch: 'full'
      },

      {
        path: '**',
        redirectTo: 'tests',
        pathMatch: 'full'
      }
];
