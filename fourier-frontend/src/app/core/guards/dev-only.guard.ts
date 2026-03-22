import { CanMatchFn } from '@angular/router';
import { environment } from '../../../environments/environment';

export const devOnlyGuard: CanMatchFn = () => !environment.production;
