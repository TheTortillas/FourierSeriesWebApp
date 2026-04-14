import { inject, Injectable, signal } from '@angular/core';
import { PlatformService } from '../platform/platform.service';

export interface KeyBtn {
  label: string;
  typedText?: string;
  cmd?: string;
  write?: string;
  keystroke?: string;
}

export interface MathField {
  latex(): string;
  latex(value: string): void;
  focus(): void;
  reflow(): void;
  typedText(text: string): void;
  write(latex: string): void;
  cmd(latex: string): void;
  keystroke(keys: string): void;
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
  /** Replace MathQuill's hidden textarea with a custom element.
   *  On mobile we use a non-editable span so the native keyboard never appears. */
  substituteTextarea?: () => HTMLElement;
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

  // ── Active field tracking ──────────────────────────────────────────────────
  // Segment components call setActiveField() on focus; the section-level
  // keyboard panel reads activeField / activeFieldName to know where to insert.

  private _activeField: MathField | null = null;
  readonly activeFieldName = signal<string>('');

  setActiveField(field: MathField | null, name: string): void {
    this._activeField = field;
    this.activeFieldName.set(name);
  }

  clearActiveField(): void {
    this._activeField = null;
    this.activeFieldName.set('');
  }

  insertKey(btn: KeyBtn): void {
    const field = this._activeField;
    if (!field) return;
    field.focus();
    if (btn.label === 'δ(·)') { field.write('\\delta\\left(\\right)'); field.keystroke('Left'); return; }
    if (btn.label === 'Γ(·)') { field.write('\\Gamma\\left(\\right)'); field.keystroke('Left'); return; }
    if (btn.label === 'exp')   { field.write('\\operatorname{exp}\\left(\\right)'); field.keystroke('Left'); return; }
    if (btn.label === 'sgn')   { field.write('\\operatorname{sgn}\\left(\\right)'); field.keystroke('Left'); return; }
    if (btn.label === 'eˣ')   { field.typedText('e'); field.cmd('^'); return; }
    if (btn.label === '|·|')   { field.write('\\operatorname{abs}\\left(\\right)'); field.keystroke('Left'); return; }
    if (btn.typedText !== undefined) field.typedText(btn.typedText);
    else if (btn.cmd       !== undefined) field.cmd(btn.cmd);
    else if (btn.write     !== undefined) field.write(btn.write);
    else if (btn.keystroke !== undefined) field.keystroke(btn.keystroke);
  }

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

  /** True when the viewport width is below the lg Tailwind breakpoint (1024px). */
  get isMobileViewport(): boolean {
    return this.platform.isBrowser && window.matchMedia('(max-width: 1023px)').matches;
  }

  defaultConfig(): MathQuillConfig {
    const config: MathQuillConfig = {
      autoCommands: 'pi theta sqrt sum int',
      autoOperatorNames:
        'sin cos tan cot sec csc asin acos atan acot asec acsc ' +
        'sinh cosh tanh asinh acosh atanh log ln exp abs ' +
        'sen tg senh ctg arcsin arccos arctan ' +
        'gamma factorial ' +
        'delta sgn',
    };
    // On mobile viewports, replace MathQuill's hidden textarea with a non-editable
    // span so the native OS keyboard never appears. Input is handled exclusively
    // by the MobileMathKeyboardComponent.
    if (this.isMobileViewport) {
      config.substituteTextarea = () => {
        const el = document.createElement('span');
        el.setAttribute('tabindex', '0');
        return el;
      };
    }
    return config;
  }

  /**
   * Returns a capture-phase keypress listener that intercepts special characters
   * before MathQuill's internal textarea handler can see them.
   *
   * - `|`  → inserts abs(·) with cursor inside (MathQuill throws on bare pipe)
   * - `^`  → programmatic cmd('^') — bypasses dead-key composition issues on
   *           Spanish/Linux keyboards where the composed keypress may not reach
   *           MathQuill reliably
   *
   * Register with addEventListener('keypress', fn, true) on the host element.
   */
  createSpecialKeyCapture(getField: () => MathField | null): (e: KeyboardEvent) => void {
    return (e: KeyboardEvent) => {
      if (e.key !== '|' && e.key !== '^') return;
      const field = getField();
      if (!field) return;
      e.stopPropagation();
      e.preventDefault();
      if (e.key === '|') {
        field.write('\\operatorname{abs}\\left(\\right)');
        field.keystroke('Left');
      } else {
        field.cmd('^');
      }
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
