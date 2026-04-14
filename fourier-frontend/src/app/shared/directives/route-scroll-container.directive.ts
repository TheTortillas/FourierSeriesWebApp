import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';
import { NavigationScrollService } from '../../core/services/navigation/navigation-scroll.service';

@Directive({
  selector: '[appRouteScrollContainer]',
  standalone: true,
})
export class RouteScrollContainerDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly scrollService = inject(NavigationScrollService);

  ngOnInit(): void {
    this.scrollService.registerContainer(this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.scrollService.unregisterContainer(this.elementRef.nativeElement);
  }
}
