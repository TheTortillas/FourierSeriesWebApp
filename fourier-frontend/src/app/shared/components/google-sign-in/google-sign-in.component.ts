import {
  AfterViewInit,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';

import { environment } from '../../../../environments/environment';
import { getGsiLocale } from '../../../core/config/languages';

@Component({
  selector: 'app-google-sign-in',
  template: `<div #btn class="w-full"></div>`,
})
export class GoogleSignInComponent implements AfterViewInit {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly transloco = inject(TranslocoService);

  readonly credential = output<string>();
  readonly text = input<'signin_with' | 'signup_with' | 'continue_with'>('signin_with');
  readonly btn = viewChild.required<ElementRef<HTMLElement>>('btn');

  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  private viewReady = false;

  constructor() {
    effect(() => {
      this.lang();
      if (this.viewReady) this.initAndRender();
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
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
    if (!environment.googleClientId || !window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: ({ credential }) => this.credential.emit(credential),
      cancel_on_tap_outside: true,
    });

    this.btn().nativeElement.replaceChildren();
    window.google.accounts.id.renderButton(this.btn().nativeElement, {
      theme: 'outline',
      size: 'large',
      width: this.host.nativeElement.offsetWidth || 360,
      locale: getGsiLocale(this.lang()),
      text: this.text(),
    });
  }
}
