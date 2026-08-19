import {
  Component,
  contentChild,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Wrapper estandarizado para todos los canvas de la aplicación.
 *
 * Encapsula:
 *  - Overlay de botones (fullscreen, settings, download, share, favorite)
 *  - Panel de configuración en tres variantes (desktop slide-in, mobile
 *    bottom-sheet fullscreen, mobile inline bajo el canvas)
 *  - Gestión de fullscreen con cleanup vía DestroyRef
 *  - isMobile reactivo vía BreakpointObserver
 *  - downloadCanvas centralizado
 *
 * Uso:
 * ```html
 * <app-canvas-shell
 *   [showSettings]="showCanvasSettings()"
 *   [hasResult]="hasComputedResult()"
 *   [showFavorite]="userStore.isAuthenticated()"
 *   [filename]="'ft-result.png'"
 *   (settingsToggle)="showCanvasSettings.set(!showCanvasSettings())"
 *   (shareRequested)="showShareDialog.set(true)"
 *   (favoriteRequested)="openFavoriteDialog()"
 * >
 *   <app-function-plot ... />
 *   <ng-template #settingsPanel> ... </ng-template>
 * </app-canvas-shell>
 * ```
 */
@Component({
  selector: 'app-canvas-shell',
  templateUrl: './canvas-shell.component.html',
  styles: [`:host { display: block; }`],
  imports: [NgTemplateOutlet, TranslocoPipe],
})
export class CanvasShellComponent implements OnInit {
  // ── Inputs ────────────────────────────────────────────────────────────────
  /** Si el panel de configuración debe estar abierto. */
  readonly showSettings = input<boolean>(false);
  /** Si ya hay un resultado calculado (habilita gear, share, favorite). */
  readonly hasResult = input<boolean>(false);
  /** Si se debe mostrar el botón de favorito (requiere autenticación). */
  readonly showFavorite   = input<boolean>(false);
  /** Si el cálculo actual está marcado como favorito (cambia el color del botón). */
  readonly isFavorited    = input<boolean>(false);
  /** Si la operación de favorito está en curso (muestra spinner). */
  readonly favoriteLoading = input<boolean>(false);
  /** Nombre del archivo para la descarga PNG. */
  readonly filename = input<string>('canvas.png');
  /** Optional capture function — when provided, used instead of canvas.toDataURL().
   *  Use this when the canvas is a WebGL composite (e.g. ComplexPlotComponent). */
  readonly captureImage = input<(() => string) | null>(null);
  /** Si se debe mostrar el botón de compartir (default true). */
  readonly showShare = input<boolean>(true);

  // ── Outputs ───────────────────────────────────────────────────────────────
  readonly settingsToggle    = output<void>();
  readonly fullscreenChange  = output<boolean>();
  readonly shareRequested    = output<void>();
  readonly favoriteRequested = output<void>();

  // ── Content child: ng-template proyectado desde el consumer ───────────────
  readonly settingsPanelTpl = contentChild<TemplateRef<unknown>>('settingsPanel');

  // ── Estado interno ────────────────────────────────────────────────────────
  readonly isFullscreen = signal(false);
  readonly isMobile     = signal(false);

  // ── Servicios ─────────────────────────────────────────────────────────────
  private readonly el         = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    if (typeof window === 'undefined') return;

    // isMobile — reactivo vía ResizeObserver sobre document.body
    const updateMobile = () => this.isMobile.set(window.innerWidth < 1024);
    updateMobile();
    const ro = new ResizeObserver(updateMobile);
    ro.observe(document.body);
    this.destroyRef.onDestroy(() => ro.disconnect());

    // fullscreenchange — con cleanup automático vía DestroyRef
    const onFsChange = () => this.isFullscreen.set(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    this.destroyRef.onDestroy(() => document.removeEventListener('fullscreenchange', onFsChange));
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      this.el.nativeElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  downloadCanvas(): void {
    const captureFn = this.captureImage();
    const dataUrl = captureFn
      ? captureFn()
      : (this.el.nativeElement.querySelector('canvas') as HTMLCanvasElement | null)?.toDataURL('image/png');
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = this.filename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
