import { DestroyRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { ViewportScroller } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class NavigationScrollService {
  private readonly router = inject(Router);
  private readonly viewportScroller = inject(ViewportScroller);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly containers = new Set<HTMLElement>();
  private initialized = false;

  setup(): void {
    if (this.initialized) return;
    if (!isPlatformBrowser(this.platformId)) return;
    this.initialized = true;

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        const schedule = (cb: () => void): void => {
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => cb());
            return;
          }
          setTimeout(cb, 0);
        };

        schedule(() => {
          this.viewportScroller.scrollToPosition([0, 0]);
          this.containers.forEach((container) => {
            container.scrollTo({ top: 0, left: 0, behavior: 'auto' });
          });
        });
      });
  }

  registerContainer(container: HTMLElement): void {
    this.containers.add(container);
  }

  unregisterContainer(container: HTMLElement): void {
    this.containers.delete(container);
  }
}
