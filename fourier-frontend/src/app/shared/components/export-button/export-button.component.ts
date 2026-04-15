import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PlatformService } from '../../../core/services/platform/platform.service';

@Component({
  selector: 'app-export-button',
  templateUrl: './export-button.component.html',
  imports: [TranslocoPipe],
})
export class ExportButtonComponent implements OnInit, OnDestroy {
  private readonly platform = inject(PlatformService);
  private readonly elRef = inject(ElementRef<HTMLElement>);

  /** Raw LaTeX string (without display delimiters) — copied to clipboard. */
  readonly tex = input.required<string>();

  /**
   * The DOM element that contains the MathJax-rendered SVG.
   * Pass a template-reference variable: [mathEl]="myRef"
   */
  readonly mathEl = input<HTMLElement | undefined>(undefined);

  /** Base name for downloaded files (no extension). */
  readonly filename = input<string>('fourier-result');

  readonly isOpen = signal(false);
  readonly copiedLatex = signal(false);
  readonly exportingPng = signal(false);

  // ── Outside-click to close ─────────────────────────────────────────────────

  private readonly _outsideHandler = (e: PointerEvent): void => {
    if (!this.isOpen()) return;
    if (this.elRef.nativeElement.contains(e.target as Node)) return;
    this.isOpen.set(false);
  };

  ngOnInit(): void {
    if (this.platform.isBrowser) {
      document.addEventListener('pointerdown', this._outsideHandler);
    }
  }

  ngOnDestroy(): void {
    if (this.platform.isBrowser) {
      document.removeEventListener('pointerdown', this._outsideHandler);
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  toggle(): void {
    this.isOpen.update((v) => !v);
  }

  async copyLatex(): Promise<void> {
    if (!this.platform.isBrowser) return;
    await navigator.clipboard.writeText(this.tex());
    this.copiedLatex.set(true);
    this.isOpen.set(false);
    setTimeout(() => this.copiedLatex.set(false), 2000);
  }

  exportSvg(): void {
    const svgData = this.buildStandaloneSvg();
    if (!svgData) return;
    this.download(
      new Blob([svgData], { type: 'image/svg+xml' }),
      `${this.filename()}.svg`,
    );
    this.isOpen.set(false);
  }

  async exportPng(): Promise<void> {
    const svgData = this.buildStandaloneSvg();
    if (!svgData) return;
    this.exportingPng.set(true);
    this.isOpen.set(false);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    try {
      await this.svgToPng(url, `${this.filename()}.png`);
    } finally {
      URL.revokeObjectURL(url);
      this.exportingPng.set(false);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Builds a self-contained SVG string from the rendered MathJax element.
   *
   * MathJax v3 SVG output uses <use href="#MJX-..."> references to shared
   * glyph symbols stored in a hidden document-level <defs>. We collect only
   * the symbols actually used by this expression and inline them so the SVG
   * is portable (works outside the page context).
   */
  private buildStandaloneSvg(): string | null {
    const container = this.mathEl();
    if (!container) return null;

    const svgEl = container.querySelector('svg');
    if (!svgEl) return null;

    const clone = svgEl.cloneNode(true) as SVGElement;

    // Fix dimensions: MathJax uses ex/em — read actual pixel bbox
    const rect = svgEl.getBoundingClientRect();
    const w = Math.ceil(rect.width) || 300;
    const h = Math.ceil(rect.height) || 80;
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));

    // Force black-on-white for export (dark mode uses currentColor)
    clone.style.cssText = 'background:#ffffff;color:#000000;';

    // Collect all referenced symbol IDs in this expression
    const referencedIds = new Set<string>();
    clone.querySelectorAll('use').forEach((use) => {
      const href = use.getAttribute('href') ?? use.getAttribute('xlink:href');
      if (href?.startsWith('#')) referencedIds.add(href.slice(1));
    });

    // Inline only the needed symbols from the document-level defs
    if (referencedIds.size > 0) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      referencedIds.forEach((id) => {
        const symbol = document.getElementById(id);
        if (symbol) defs.appendChild(symbol.cloneNode(true));
      });
      clone.insertBefore(defs, clone.firstChild);
    }

    let str = new XMLSerializer().serializeToString(clone);
    // Guarantee xmlns attribute is present for standalone use
    if (!str.includes('xmlns="http://www.w3.org/2000/svg"')) {
      str = str.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    }
    return str;
  }

  /** Renders the SVG blob URL to a @2x canvas and downloads as PNG. */
  private svgToPng(svgUrl: string, filename: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = 2; // retina / high-DPI
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth * scale;
        canvas.height = img.naturalHeight * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
          this.download(blob, filename);
          resolve();
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('SVG image load failed'));
      img.src = svgUrl;
    });
  }

  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    // Small delay so the browser can initiate the download before revocation
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
