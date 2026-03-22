import { inject, Injectable } from '@angular/core';
import { PlatformService } from '../platform/platform.service';

export interface MathField {
  latex(): string;
  latex(value: string): void;
  focus(): void;
  reflow(): void;
}

export interface MathQuillStatic {
  MathField(element: Element, config?: MathQuillConfig): MathField;
  StaticMath(element: Element): MathField;
}

export interface MathQuillConfig {
  spaceBehavesLikeTab?: boolean;
  leftRightIntoCmdGoes?: 'up' | 'down';
  autoCommands?: string;
  autoOperatorNames?: string;
  charsThatBreakOutOfSupSub?: string;
  handlers?: {
    edit?: (mathField: MathField) => void;
    enter?: (mathField: MathField) => void;
    upOutOf?: (mathField: MathField) => void;
    downOutOf?: (mathField: MathField) => void;
  };
}

/**
 * SSR-safe wrapper around MathQuill.
 *
 * MathQuill requires the DOM and jQuery; both are loaded lazily via
 * dynamic <script> injection so they never reach the SSR bundle.
 *
 * Usage:
 *   const mq = await this.mathquill.getMQ();
 *   const field = mq?.MathField(el, { handlers: { edit: f => ... } });
 */
@Injectable({ providedIn: 'root' })
export class MathquillService {
  private readonly platform = inject(PlatformService);

  private mq: MathQuillStatic | null = null;
  private loading: Promise<MathQuillStatic | null> | null = null;

  async getMQ(): Promise<MathQuillStatic | null> {
    if (!this.platform.isBrowser) return null;
    if (this.mq) return this.mq;
    if (this.loading) return this.loading;
    this.loading = this.loadMathQuill();
    this.mq = await this.loading;
    return this.mq;
  }

  async createField(element: Element, config?: MathQuillConfig): Promise<MathField | null> {
    const mq = await this.getMQ();
    return mq ? mq.MathField(element, config ?? this.defaultConfig()) : null;
  }

  defaultConfig(): MathQuillConfig {
    return {
      spaceBehavesLikeTab: true,
      autoCommands: 'pi theta sqrt sum int',
      autoOperatorNames: 'sin cos tan asin acos atan sinh cosh tanh log exp abs',
      charsThatBreakOutOfSupSub: '+-*/=<>',
    };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private loadMathQuill(): Promise<MathQuillStatic | null> {
    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;

      const done = () => {
        const MQ = win['MathQuill'] as
          | { getInterface: (v: number) => MathQuillStatic }
          | undefined;
        resolve(MQ ? MQ.getInterface(2) : null);
      };

      // If MathQuill is already on the page, nothing to do
      if (win['MathQuill']) { done(); return; }

      const injectScript = (src: string, onload: () => void) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = onload;
        s.onerror = () => {
          console.error(`[MathquillService] Failed to load script: ${src}`);
          resolve(null);
        };
        document.head.appendChild(s);
      };

      const injectMathQuill = () => {
        injectScript(
          '/assets/vendor/mathquill.min.js',
          () => {
            // Also inject MathQuill CSS if not already present
            if (!document.querySelector('link[href*="mathquill"]')) {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = '/assets/vendor/mathquill.css';
              document.head.appendChild(link);
            }
            done();
          },
        );
      };

      // jQuery must be loaded first
      if (win['jQuery']) {
        injectMathQuill();
      } else {
        injectScript('/assets/vendor/jquery.min.js', injectMathQuill);
      }
    });
  }
}
