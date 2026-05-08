import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-google-sign-in',
  template: `<div #btn class="w-full"></div>`,
})
export class GoogleSignInComponent implements AfterViewInit {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly credential = output<string>();
  readonly text = input<'signin_with' | 'signup_with' | 'continue_with'>('signin_with');
  readonly btn = viewChild.required<ElementRef<HTMLElement>>('btn');

  ngAfterViewInit(): void {
    if (!environment.googleClientId) return;

    if (window.google?.accounts?.id) {
      this.initAndRender();
    } else {
      // GSI script loads async — wait for it
      const script = document.querySelector(
        'script[src*="accounts.google.com/gsi"]',
      ) as HTMLScriptElement | null;
      script?.addEventListener('load', () => this.initAndRender(), { once: true });
    }
  }

  private initAndRender(): void {
    window.google!.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: ({ credential }) => this.credential.emit(credential),
      cancel_on_tap_outside: true,
    });

    window.google!.accounts.id.renderButton(this.btn().nativeElement, {
      theme: 'outline',
      size: 'large',
      width: this.host.nativeElement.offsetWidth || 360,
      locale: 'es',
      text: this.text(),
    });
  }
}
