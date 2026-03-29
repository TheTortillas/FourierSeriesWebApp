import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api/api.service';
import { CoordinateTransformService } from '../../../core/services/canvas/coordinate-transform.service';
import { CanvasViewport, Curve } from '../../../core/services/canvas/canvas.types';
import { DftCoefficient, DftPoint, DftResponse } from '../../../domain/types/dft.types';
import {
  FunctionPlotComponent,
  PlotLayer,
} from '../../../shared/components/function-plot/function-plot.component';

interface SignalPreset {
  id: string;
  label: string;
  generator: (n: number, t: number) => number;
}

type WindowType = 'rectangular' | 'hann' | 'hamming' | 'blackman';
type PhaseCFilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch';
type ImagePresetId = 'dot' | 'bars' | 'checker';
type LabView = 'full' | 'signal' | 'filter' | 'image';
type ImageSourceType = 'preset' | 'upload';

interface SpectrumBin {
  coeff: DftCoefficient;
  xBin: number;
}

interface LeakageStats {
  dominantK: number;
  dominantAmplitude: number;
  leakageRatio: number;
}

interface PhaseCStats {
  keptBins: number;
  keptEnergyRatio: number;
  rmsError: number;
}

interface ComplexValue {
  re: number;
  im: number;
}

const TAU = Math.PI * 2;

@Component({
  selector: 'app-dft-signal-lab-panel',
  imports: [FormsModule, FunctionPlotComponent],
  template: `
    <div class="flex flex-col h-full gap-4">
      <h2 class="text-yellow-400 font-bold text-lg border-b border-gray-700 pb-2 shrink-0">
        {{ panelTitle() }}
      </h2>

      <div class="grid grid-cols-1 xl:grid-cols-[25rem_1fr] gap-4 min-h-0 flex-1">
        <section class="border border-gray-700 rounded p-4 space-y-4 overflow-auto">
          <div class="space-y-2">
            <p class="text-gray-500 text-xs">Fuente de señal</p>
            <div class="flex flex-wrap gap-2">
              <button
                (click)="sourceMode.set('preset')"
                [class]="
                  sourceMode() === 'preset'
                    ? 'bg-yellow-500 text-gray-900 text-xs px-2.5 py-1 rounded font-semibold cursor-pointer'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-100 text-xs px-2.5 py-1 rounded cursor-pointer'
                "
              >
                Presets
              </button>
              <button
                (click)="sourceMode.set('manual')"
                [class]="
                  sourceMode() === 'manual'
                    ? 'bg-yellow-500 text-gray-900 text-xs px-2.5 py-1 rounded font-semibold cursor-pointer'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-100 text-xs px-2.5 py-1 rounded cursor-pointer'
                "
              >
                Función manual
              </button>
            </div>
          </div>

          @if (sourceMode() === 'preset') {
            <div class="space-y-2">
              <p class="text-gray-500 text-xs">Preset de señal</p>
              <div class="flex flex-wrap gap-2">
                @for (preset of presets; track preset.id) {
                  <button
                    (click)="presetId.set(preset.id)"
                    [class]="
                      presetId() === preset.id
                        ? 'bg-cyan-500 text-gray-900 text-xs px-2.5 py-1 rounded font-semibold cursor-pointer'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-100 text-xs px-2.5 py-1 rounded cursor-pointer'
                    "
                  >
                    {{ preset.label }}
                  </button>
                }
              </div>
            </div>
          } @else {
            <div class="space-y-2">
              <p class="text-gray-500 text-xs">f(t) con t en [0, 1)</p>
              <textarea
                [ngModel]="manualExpression()"
                (ngModelChange)="manualExpression.set($event)"
                rows="4"
                class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 font-mono"
              ></textarea>
              <p class="text-[11px] text-gray-500">
                Usa: sin, cos, tan, sqrt, abs, exp, log, pow, pi. Ej:
                sin(2*pi*7*t)+0.4*cos(2*pi*15*t+0.8)
              </p>
            </div>
          }

          <div class="grid grid-cols-2 gap-3 text-xs">
            <label class="space-y-1">
              <span class="text-gray-400">N muestras</span>
              <input
                type="number"
                min="32"
                max="4096"
                step="1"
                [ngModel]="sampleCount()"
                (ngModelChange)="sampleCount.set(clampInt($event, 32, 4096))"
                class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-100"
              />
            </label>
            <label class="space-y-1">
              <span class="text-gray-400">Ruido</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                [ngModel]="noiseLevel()"
                (ngModelChange)="noiseLevel.set(clampNum($event, 0, 1))"
                class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-100"
              />
            </label>
          </div>

          <div class="space-y-2">
            <label class="text-gray-500 text-xs block">Top-K reconstrucción: {{ topK() }}</label>
            <input
              type="range"
              min="1"
              [max]="maxTopK()"
              [ngModel]="topK()"
              (ngModelChange)="topK.set(clampInt($event, 1, maxTopK()))"
              class="w-full accent-yellow-500"
            />
          </div>

          <div class="space-y-2">
            <label class="text-gray-500 text-xs block">
              Umbral de fase (en % del pico): {{ phaseThresholdPercent().toFixed(1) }}%
            </label>
            <input
              type="range"
              min="0"
              max="20"
              step="0.5"
              [ngModel]="phaseThresholdPercent()"
              (ngModelChange)="phaseThresholdPercent.set(clampNum($event, 0, 20))"
              class="w-full accent-cyan-500"
            />
          </div>

          <div class="space-y-2 rounded border border-gray-700 p-2">
            <p class="text-gray-500 text-xs">Capas visibles (señal temporal)</p>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="showOriginalFunction()"
                (ngModelChange)="showOriginalFunction.set($event)"
              />
              Función original (continua)
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="showNegativeOriginalFunction()"
                (ngModelChange)="showNegativeOriginalFunction.set($event)"
              />
              Mostrar f(-t) en eje x negativo
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="showSampledSignal()"
                (ngModelChange)="showSampledSignal.set($event)"
              />
              Señal muestreada
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="showWindowedSignal()"
                (ngModelChange)="showWindowedSignal.set($event)"
              />
              Señal ventaneada
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="showReconstructedFull()"
                (ngModelChange)="showReconstructedFull.set($event)"
              />
              Reconstrucción full
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="showReconstructedTopK()"
                (ngModelChange)="showReconstructedTopK.set($event)"
              />
              Reconstrucción top-K
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="showPhaseCFilteredSignal()"
                (ngModelChange)="showPhaseCFilteredSignal.set($event)"
              />
              Reconstrucción filtrada (Fase C)
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="showSampledPoints()"
                (ngModelChange)="showSampledPoints.set($event)"
              />
              Marcar puntos discretos
            </label>
          </div>

          <div class="space-y-2 rounded border border-gray-700 p-2">
            <p class="text-gray-500 text-xs">Espectro</p>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="shiftedSpectrum()"
                (ngModelChange)="shiftedSpectrum.set($event)"
              />
              Centrar frecuencias (tipo fftshift)
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="showZeroBins()"
                (ngModelChange)="showZeroBins.set($event)"
              />
              Mostrar bins en cero
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="compareWithRectangular()"
                (ngModelChange)="compareWithRectangular.set($event)"
              />
              Comparar contra rectangular
            </label>
          </div>

          @if (showLeakageControls()) {
            <div class="space-y-2 rounded border border-gray-700 p-2">
              <p class="text-gray-500 text-xs">Fase B - Leakage y Windowing</p>
              <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
                <input
                  type="checkbox"
                  [ngModel]="applyWindow()"
                  (ngModelChange)="applyWindow.set($event)"
                />
                Aplicar ventana al analizar DFT
              </label>
              <label class="space-y-1 text-xs block">
                <span class="text-gray-400">Tipo de ventana</span>
                <select
                  [ngModel]="windowType()"
                  (ngModelChange)="windowType.set($event)"
                  class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-100"
                >
                  <option value="rectangular">Rectangular</option>
                  <option value="hann">Hann</option>
                  <option value="hamming">Hamming</option>
                  <option value="blackman">Blackman</option>
                </select>
              </label>
              <p class="text-[11px] text-gray-500">
                Usa el preset Leakage para notar cómo cambia el ensanchamiento espectral.
              </p>
              <div class="flex flex-wrap gap-2">
                <button
                  (click)="applyLeakageDemoConfig()"
                  [disabled]="loading()"
                  class="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-gray-100 text-xs px-2.5 py-1 rounded cursor-pointer"
                >
                  Demo leakage
                </button>
                <button
                  (click)="restoreLabDefaults()"
                  [disabled]="loading()"
                  class="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-100 text-xs px-2.5 py-1 rounded cursor-pointer"
                >
                  Restaurar defaults
                </button>
              </div>
            </div>
          }

          @if (showLeakageControls()) {
            <div class="space-y-2 rounded border border-cyan-900/70 bg-cyan-950/30 p-2">
              <p class="text-cyan-200 text-xs font-semibold">
                Guia rapida: que mirar en Demo leakage
              </p>
              <p class="text-[11px] text-cyan-100/90">
                Si no tienes datos cargados, pulsa Demo leakage una vez para autoconfigurar y
                calcular.
              </p>
              <ol class="list-decimal ml-4 space-y-1 text-[11px] text-cyan-100/90">
                <li>
                  En amplitud, compara azul (ventaneada) contra gris (rectangular): busca menos
                  energia lejos del pico principal.
                </li>
                <li>
                  En metricas leakage, observa el porcentaje: al aplicar Hann/Hamming/Blackman
                  deberia bajar respecto a rectangular.
                </li>
                <li>
                  Cambia solo Tipo de ventana y recalcula: veras el intercambio entre lobulo
                  principal mas ancho y sidelobes mas bajos.
                </li>
              </ol>
            </div>
          }

          @if (showPhaseCControls()) {
            <div class="space-y-2 rounded border border-fuchsia-900/70 bg-fuchsia-950/20 p-2">
              <p class="text-fuchsia-200 text-xs font-semibold">Fase C - Filtrado en frecuencia</p>
              <label class="space-y-1 text-xs block">
                <span class="text-gray-400">Tipo de filtro</span>
                <select
                  [ngModel]="phaseCFilterType()"
                  (ngModelChange)="phaseCFilterType.set($event)"
                  class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-100"
                >
                  <option value="lowpass">Pasa-bajas</option>
                  <option value="highpass">Pasa-altas</option>
                  <option value="bandpass">Pasa-banda</option>
                  <option value="notch">Rechaza-banda</option>
                </select>
              </label>
              <div class="grid grid-cols-2 gap-3 text-xs">
                <label class="space-y-1">
                  <span class="text-gray-400">k1</span>
                  <input
                    type="number"
                    min="0"
                    [max]="maxTopK()"
                    step="1"
                    [ngModel]="phaseCK1()"
                    (ngModelChange)="phaseCK1.set(clampInt($event, 0, maxTopK()))"
                    class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-100"
                  />
                </label>
                <label class="space-y-1">
                  <span class="text-gray-400">k2</span>
                  <input
                    type="number"
                    min="0"
                    [max]="maxTopK()"
                    step="1"
                    [ngModel]="phaseCK2()"
                    (ngModelChange)="phaseCK2.set(clampInt($event, 0, maxTopK()))"
                    class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-100"
                  />
                </label>
              </div>
              <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
                <input
                  type="checkbox"
                  [ngModel]="phaseCPreserveDC()"
                  (ngModelChange)="phaseCPreserveDC.set($event)"
                />
                Preservar componente DC
              </label>
              <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
                <input
                  type="checkbox"
                  [ngModel]="phaseCAutoApply()"
                  (ngModelChange)="phaseCAutoApply.set($event)"
                />
                Autoaplicar al recalcular DFT
              </label>
              <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
                <input
                  type="checkbox"
                  [ngModel]="showPhaseCFilteredSpectrum()"
                  (ngModelChange)="showPhaseCFilteredSpectrum.set($event)"
                />
                Mostrar espectro filtrado (magenta)
              </label>
              <button
                (click)="applyPhaseCFilter()"
                [disabled]="loading()"
                class="bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-gray-100 text-xs px-2.5 py-1 rounded cursor-pointer"
              >
                Aplicar filtro Fase C
              </button>
            </div>
          }

          @if (showImageControls()) {
            <div class="space-y-2 rounded border border-emerald-900/70 bg-emerald-950/20 p-2">
              <p class="text-emerald-200 text-xs font-semibold">
                Fase D - DFT 2D en imagen pequena
              </p>
              <div class="grid grid-cols-2 gap-3 text-xs">
                <label class="space-y-1">
                  <span class="text-gray-400">Fuente</span>
                  <select
                    [ngModel]="imageSourceType()"
                    (ngModelChange)="imageSourceType.set($event)"
                    class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-100"
                  >
                    <option value="preset">Preset</option>
                    <option value="upload">Imagen cargada</option>
                  </select>
                </label>
                <label class="space-y-1">
                  <span class="text-gray-400">Preset imagen</span>
                  <select
                    [disabled]="imageSourceType() !== 'preset'"
                    [ngModel]="imagePreset()"
                    (ngModelChange)="imagePreset.set($event)"
                    class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-100"
                  >
                    <option value="dot">Punto central</option>
                    <option value="bars">Barras verticales</option>
                    <option value="checker">Checkerboard</option>
                  </select>
                </label>
              </div>
              <div class="grid grid-cols-2 gap-3 text-xs">
                <label class="space-y-1">
                  <span class="text-gray-400">Tamano N x N</span>
                  <input
                    type="number"
                    min="8"
                    max="20"
                    step="1"
                    [ngModel]="imageSize()"
                    (ngModelChange)="imageSize.set(clampInt($event, 8, 20))"
                    class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-100"
                  />
                </label>
                <label class="space-y-1">
                  <span class="text-gray-400">Cargar imagen</span>
                  <input
                    type="file"
                    accept="image/*"
                    (change)="onImageFileSelected($event)"
                    class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-100 file:mr-2 file:px-2 file:py-0.5 file:border-0 file:rounded file:bg-emerald-700 file:text-gray-100"
                  />
                </label>
              </div>
              @if (imageSourceType() === 'upload' && !uploadedImageLoaded()) {
                <p class="text-[11px] text-amber-300">
                  Aun no hay imagen cargada. Selecciona un archivo para usarlo como entrada.
                </p>
              }
              @if (imageError()) {
                <p class="text-[11px] text-red-300">{{ imageError() }}</p>
              }
              <label class="space-y-1 text-xs block">
                <span class="text-gray-400"
                  >Radio low-pass (frecuencia centrada): {{ imageLowPassRadius() }}</span
                >
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  [ngModel]="imageLowPassRadius()"
                  (ngModelChange)="imageLowPassRadius.set(clampInt($event, 0, 10))"
                  class="w-full accent-emerald-500"
                />
              </label>
              <div class="flex flex-wrap gap-2">
                <button
                  (click)="runImageDftDemo()"
                  class="bg-emerald-600 hover:bg-emerald-500 text-gray-100 text-xs px-2.5 py-1 rounded cursor-pointer"
                >
                  Ejecutar DFT 2D
                </button>
                <button
                  (click)="applyImageDemoPreset()"
                  class="bg-gray-700 hover:bg-gray-600 text-gray-100 text-xs px-2.5 py-1 rounded cursor-pointer"
                >
                  Demo imagen
                </button>
              </div>
              @if (imageRmsError() > 0) {
                <p class="text-[11px] font-mono text-gray-300">
                  RMS imagen (original vs reconstruida low-pass):
                  {{ imageRmsError().toExponential(3) }}
                </p>
              }
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <p class="text-[11px] text-gray-400 mb-1">Imagen original</p>
                  <div
                    class="grid gap-px bg-gray-900 border border-gray-700 p-1 rounded"
                    [style.gridTemplateColumns]="imageGridTemplate()"
                  >
                    @for (v of imageOriginalFlat(); track $index) {
                      <div class="aspect-square rounded-sm" [style.background]="grayCell(v)"></div>
                    }
                  </div>
                </div>
                <div>
                  <p class="text-[11px] text-gray-400 mb-1">Reconstruida low-pass</p>
                  <div
                    class="grid gap-px bg-gray-900 border border-gray-700 p-1 rounded"
                    [style.gridTemplateColumns]="imageGridTemplate()"
                  >
                    @for (v of imageFilteredFlat(); track $index) {
                      <div class="aspect-square rounded-sm" [style.background]="grayCell(v)"></div>
                    }
                  </div>
                </div>
                <div>
                  <p class="text-[11px] text-gray-400 mb-1">|DFT| original (log)</p>
                  <div
                    class="grid gap-px bg-gray-900 border border-gray-700 p-1 rounded"
                    [style.gridTemplateColumns]="imageGridTemplate()"
                  >
                    @for (v of imageSpectrumFlat(); track $index) {
                      <div class="aspect-square rounded-sm" [style.background]="heatCell(v)"></div>
                    }
                  </div>
                </div>
                <div>
                  <p class="text-[11px] text-gray-400 mb-1">|DFT| filtrada (log)</p>
                  <div
                    class="grid gap-px bg-gray-900 border border-gray-700 p-1 rounded"
                    [style.gridTemplateColumns]="imageGridTemplate()"
                  >
                    @for (v of imageFilteredSpectrumFlat(); track $index) {
                      <div class="aspect-square rounded-sm" [style.background]="heatCell(v)"></div>
                    }
                  </div>
                </div>
              </div>
            </div>
          }

          @if (showSignalControls()) {
            <div class="flex items-center gap-2 flex-wrap">
              <button
                (click)="calculate()"
                [disabled]="loading()"
                class="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-gray-900 text-sm font-semibold px-4 py-1.5 rounded transition-colors cursor-pointer"
              >
                @if (loading()) {
                  Calculando...
                } @else {
                  Calcular DFT señal
                }
              </button>
            </div>
          }

          @if (showSignalControls() && error()) {
            <pre class="bg-red-950 text-red-300 rounded p-2 text-xs overflow-auto">{{
              error()
            }}</pre>
          }

          @if (showSignalControls() && result(); as res) {
            <div class="grid grid-cols-2 gap-2 text-xs font-mono">
              <div class="border border-gray-700 rounded p-2">
                <p class="text-gray-500">N</p>
                <p class="text-gray-100 text-sm">{{ res.N }}</p>
              </div>
              <div class="border border-gray-700 rounded p-2">
                <p class="text-gray-500">RMS full</p>
                <p class="text-gray-100 text-sm">{{ res.rmsError.toExponential(3) }}</p>
              </div>
              <div class="border border-gray-700 rounded p-2">
                <p class="text-gray-500">RMS top-K</p>
                <p class="text-gray-100 text-sm">{{ rmsTopK().toExponential(3) }}</p>
              </div>
              <div class="border border-gray-700 rounded p-2">
                <p class="text-gray-500">Tiempo</p>
                <p class="text-gray-100 text-sm">{{ res.executionTimeMs }} ms</p>
              </div>
            </div>

            @if (leakageCurrent(); as lc) {
              <div
                [class]="
                  leakageHighlightActive()
                    ? 'space-y-1 rounded border border-cyan-300 shadow-[0_0_0_1px_rgba(103,232,249,0.55)] bg-cyan-900/20 p-2 transition-all duration-300'
                    : 'space-y-1 rounded border border-gray-700 p-2 transition-all duration-300'
                "
              >
                <p class="text-gray-500 text-xs">Métricas leakage</p>
                <p class="text-[11px] font-mono text-gray-300">
                  Actual: k={{ lc.dominantK }} · pico={{ lc.dominantAmplitude.toFixed(6) }} ·
                  leakage={{ (lc.leakageRatio * 100).toFixed(2) }}%
                </p>
                @if (leakageBaseline(); as lb) {
                  <p class="text-[11px] font-mono text-cyan-300">
                    Rectangular: {{ (lb.leakageRatio * 100).toFixed(2) }}% · mejora:
                    {{ leakageImprovementPercent().toFixed(2) }}%
                  </p>
                }
              </div>
            }

            @if (phaseCStats(); as stats) {
              <div class="space-y-1 rounded border border-fuchsia-700/70 bg-fuchsia-950/20 p-2">
                <p class="text-fuchsia-200 text-xs">Métricas Fase C</p>
                <p class="text-[11px] font-mono text-gray-300">
                  bins activos={{ stats.keptBins }} · energia retenida={{
                    (stats.keptEnergyRatio * 100).toFixed(2)
                  }}%
                </p>
                <p class="text-[11px] font-mono text-gray-300">
                  RMS (senal analizada vs filtrada)={{ stats.rmsError.toExponential(3) }}
                </p>
              </div>
            }
          }
        </section>

        @if (showSignalControls()) {
          <section class="grid grid-rows-3 gap-3 min-h-0">
            <div class="border border-gray-700 rounded overflow-hidden bg-gray-950 min-h-0">
              <div class="text-[11px] px-2 py-1 border-b border-gray-800 text-gray-400">
                Señal temporal
              </div>
              <app-function-plot [layers]="timeLayers()" [initialUnit]="38"></app-function-plot>
            </div>

            <div class="border border-gray-700 rounded overflow-hidden bg-gray-950 min-h-0">
              <div class="text-[11px] px-2 py-1 border-b border-gray-800 text-gray-400">
                Espectro de amplitud (stems)
              </div>
              <app-function-plot
                [layers]="amplitudeLayers()"
                [initialUnit]="55"
              ></app-function-plot>
            </div>

            <div class="border border-gray-700 rounded overflow-hidden bg-gray-950 min-h-0">
              <div class="text-[11px] px-2 py-1 border-b border-gray-800 text-gray-400">
                Espectro de fase en fracción de pi (stems)
              </div>
              <app-function-plot [layers]="phaseLayers()" [initialUnit]="55"></app-function-plot>
            </div>
          </section>
        }
      </div>
    </div>
  `,
})
export class DftSignalLabPanelComponent {
  private readonly api = inject(ApiService);
  private readonly coords = inject(CoordinateTransformService);
  private readonly route = inject(ActivatedRoute);
  private leakageHighlightTimer: ReturnType<typeof setTimeout> | null = null;

  readonly labView = signal<LabView>('full');
  readonly panelTitle = computed(() => {
    switch (this.labView()) {
      case 'signal':
        return 'DFT Lab - Senal 1D (Fase A/B)';
      case 'filter':
        return 'DFT Lab - Filtrado espectral (Fase C)';
      case 'image':
        return 'DFT Lab - Imagen pequena (Fase D)';
      default:
        return 'DFT Lab - Senal 1D (Fase A/B/C)';
    }
  });
  readonly showLeakageControls = computed(
    () => this.labView() === 'full' || this.labView() === 'signal',
  );
  readonly showPhaseCControls = computed(
    () => this.labView() === 'full' || this.labView() === 'filter',
  );
  readonly showImageControls = computed(
    () => this.labView() === 'full' || this.labView() === 'image',
  );
  readonly showSignalControls = computed(() => this.labView() !== 'image');

  constructor() {
    const dataView = this.route.snapshot.data['labView'];
    if (dataView === 'signal' || dataView === 'filter' || dataView === 'image') {
      this.labView.set(dataView);
    }
  }

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<DftResponse | null>(null);
  readonly baselineResult = signal<DftResponse | null>(null);
  readonly leakageHighlightActive = signal(false);

  readonly sourceMode = signal<'preset' | 'manual'>('preset');
  readonly presetId = signal('mix');
  readonly manualExpression = signal(
    'sin(2*pi*5*t) + 0.55*cos(2*pi*13*t + 0.8) + 0.35*sin(2*pi*29*t - 0.35)',
  );
  readonly sampleCount = signal(256);
  readonly noiseLevel = signal(0.02);
  readonly topK = signal(16);
  readonly phaseThresholdPercent = signal(1.5);

  readonly showOriginalFunction = signal(true);
  readonly showNegativeOriginalFunction = signal(false);
  readonly showSampledSignal = signal(true);
  readonly showWindowedSignal = signal(false);
  readonly showReconstructedFull = signal(true);
  readonly showReconstructedTopK = signal(true);
  readonly showSampledPoints = signal(false);

  readonly shiftedSpectrum = signal(false);
  readonly showZeroBins = signal(true);
  readonly compareWithRectangular = signal(true);

  readonly applyWindow = signal(false);
  readonly windowType = signal<WindowType>('hann');

  readonly phaseCFilterType = signal<PhaseCFilterType>('lowpass');
  readonly phaseCK1 = signal(14);
  readonly phaseCK2 = signal(24);
  readonly phaseCPreserveDC = signal(true);
  readonly phaseCAutoApply = signal(true);
  readonly showPhaseCFilteredSignal = signal(true);
  readonly showPhaseCFilteredSpectrum = signal(true);

  readonly phaseCFilteredCoefficients = signal<DftCoefficient[] | null>(null);
  readonly phaseCFilteredReconstruction = signal<DftPoint[]>([]);
  readonly phaseCStats = signal<PhaseCStats | null>(null);

  readonly imagePreset = signal<ImagePresetId>('dot');
  readonly imageSourceType = signal<ImageSourceType>('preset');
  readonly imageSize = signal(12);
  readonly imageLowPassRadius = signal(2);
  readonly uploadedImage = signal<number[][] | null>(null);
  readonly uploadedImageLoaded = signal(false);
  readonly imageError = signal<string | null>(null);
  readonly imageOriginal = signal<number[][]>([]);
  readonly imageFiltered = signal<number[][]>([]);
  readonly imageSpectrum = signal<number[][]>([]);
  readonly imageFilteredSpectrum = signal<number[][]>([]);
  readonly imageRmsError = signal(0);

  readonly originalFunctionCurve = signal<DftPoint[]>([]);
  readonly negativeOriginalFunctionCurve = signal<DftPoint[]>([]);
  readonly sampledSignal = signal<DftPoint[]>([]);
  readonly analyzedSignal = signal<DftPoint[]>([]);

  readonly presets: SignalPreset[] = [
    {
      id: 'single',
      label: 'Seno puro (f=8)',
      generator: (_n, t) => 1.0 * Math.sin(TAU * 8 * t),
    },
    {
      id: 'mix',
      label: 'Mezcla 5+13+29',
      generator: (_n, t) =>
        1.0 * Math.sin(TAU * 5 * t) +
        0.55 * Math.cos(TAU * 13 * t + 0.8) +
        0.35 * Math.sin(TAU * 29 * t - 0.35),
    },
    {
      id: 'close',
      label: 'Frecuencias cercanas',
      generator: (_n, t) => 1.0 * Math.sin(TAU * 18 * t) + 0.95 * Math.sin(TAU * 20 * t + 0.35),
    },
    {
      id: 'cos-phase',
      label: 'Coseno + fase',
      generator: (_n, t) =>
        0.9 * Math.cos(TAU * 11 * t + Math.PI / 3) + 0.4 * Math.cos(TAU * 3 * t - 0.6),
    },
    {
      id: 'leakage',
      label: 'Leakage (f fraccional)',
      generator: (_n, t) => 1.0 * Math.sin(TAU * 10.5 * t) + 0.55 * Math.sin(TAU * 22.25 * t + 0.2),
    },
  ];

  readonly maxTopK = computed(() => {
    const n = this.result()?.N ?? this.sampleCount();
    return Math.max(1, Math.floor(n / 2));
  });

  readonly spectrumBins = computed(() => this.buildSpectrumBins(this.result()));
  readonly baselineSpectrumBins = computed(() => this.buildSpectrumBins(this.baselineResult()));
  readonly phaseCSpectrumBins = computed(() => {
    const coeffs = this.phaseCFilteredCoefficients();
    const res = this.result();
    if (!coeffs || !res) return [] as SpectrumBin[];
    return this.buildSpectrumBinsFromCoefficients(coeffs, res.N);
  });
  readonly imageGridTemplate = computed(() => `repeat(${this.imageSize()}, minmax(0, 1fr))`);
  readonly imageOriginalFlat = computed(() => this.flattenMatrix(this.imageOriginal()));
  readonly imageFilteredFlat = computed(() => this.flattenMatrix(this.imageFiltered()));
  readonly imageSpectrumFlat = computed(() => this.flattenMatrix(this.imageSpectrum()));
  readonly imageFilteredSpectrumFlat = computed(() =>
    this.flattenMatrix(this.imageFilteredSpectrum()),
  );

  readonly topKCoefficients = computed(() => {
    const res = this.result();
    if (!res) return [] as DftCoefficient[];

    const count = Math.max(1, Math.min(this.topK(), this.maxTopK()));
    return [...res.coefficients].sort((a, b) => b.amplitude - a.amplitude).slice(0, count);
  });

  readonly reconstructedTopK = computed<DftPoint[]>(() => {
    const res = this.result();
    const analyzed = this.analyzedSignal();
    if (!res || analyzed.length === 0) return [];

    const coeffs = this.topKCoefficients();
    const N = res.N;

    return analyzed.map((p, n) => {
      let y = 0;
      for (const c of coeffs) {
        const angle = (TAU * c.k * n) / N;
        y += c.re * Math.cos(angle) - c.im * Math.sin(angle);
      }
      return { x: p.x, y };
    });
  });

  readonly rmsTopK = computed(() => {
    const original = this.analyzedSignal();
    const recon = this.reconstructedTopK();
    const n = Math.min(original.length, recon.length);
    if (n === 0) return 0;

    let sum = 0;
    for (let i = 0; i < n; i++) {
      const e = (original[i]?.y ?? 0) - (recon[i]?.y ?? 0);
      sum += e * e;
    }
    return Math.sqrt(sum / n);
  });

  readonly leakageCurrent = computed(() => this.computeLeakage(this.result()));
  readonly leakageBaseline = computed(() => this.computeLeakage(this.baselineResult()));
  readonly leakageImprovementPercent = computed(() => {
    const baseline = this.leakageBaseline();
    const current = this.leakageCurrent();
    if (!baseline || !current || baseline.leakageRatio <= 0) return 0;
    return ((baseline.leakageRatio - current.leakageRatio) / baseline.leakageRatio) * 100;
  });

  readonly timeLayers = computed<PlotLayer[]>(() => {
    const originalFn = this.originalFunctionCurve();
    const negativeOriginal = this.negativeOriginalFunctionCurve();
    const sampled = this.sampledSignal();
    const analyzed = this.analyzedSignal();
    const fullRecon = this.result()?.reconstructed ?? [];
    const topRecon = this.reconstructedTopK();
    const phaseCRecon = this.phaseCFilteredReconstruction();

    const curves: Curve[] = [];

    if (this.showOriginalFunction() && originalFn.length > 1) {
      curves.push({ points: originalFn, color: '#94a3b8', lineWidth: 1.5 });
    }
    if (this.showNegativeOriginalFunction() && negativeOriginal.length > 1) {
      curves.push({ points: negativeOriginal, color: '#fca5a5', lineWidth: 1.2, dashed: true });
    }
    if (this.showSampledSignal() && sampled.length > 1) {
      curves.push({ points: sampled, color: '#f8fafc', lineWidth: 1.2, dashed: true });
    }
    if (this.showWindowedSignal() && analyzed.length > 1) {
      curves.push({ points: analyzed, color: '#22d3ee', lineWidth: 1.2, dashed: true });
    }
    if (this.showReconstructedFull() && fullRecon.length > 1) {
      curves.push({ points: fullRecon, color: '#22c55e', lineWidth: 1.4 });
    }
    if (this.showReconstructedTopK() && topRecon.length > 1) {
      curves.push({ points: topRecon, color: '#f59e0b', lineWidth: 1.8 });
    }
    if (this.showPhaseCFilteredSignal() && phaseCRecon.length > 1) {
      curves.push({ points: phaseCRecon, color: '#e879f9', lineWidth: 1.8 });
    }

    return [
      {
        curves,
        onDraw: (ctx, vp) => {
          if (!this.showSampledPoints() || !this.showSampledSignal()) return;
          this.drawPoints(ctx, vp, sampled, '#f8fafc', 1.6);
        },
      },
    ];
  });

  readonly amplitudeLayers = computed<PlotLayer[]>(() => {
    const bins = this.spectrumBins();
    const baselineBins = this.baselineSpectrumBins();
    const phaseCBins = this.phaseCSpectrumBins();
    const topSet = new Set(this.topKCoefficients().map((c) => c.k));

    return [
      {
        curves: [],
        onDraw: (ctx, vp) => {
          if (bins.length === 0) return;

          if (this.compareWithRectangular() && baselineBins.length > 0) {
            for (const b of baselineBins) {
              const amp = b.coeff.amplitude;
              if (amp === 0 && !this.showZeroBins()) continue;
              this.drawStem(ctx, vp, b.xBin, amp, '#64748b', 1.1);
            }
          }

          if (this.showPhaseCFilteredSpectrum() && phaseCBins.length > 0) {
            for (const b of phaseCBins) {
              const amp = b.coeff.amplitude;
              if (amp === 0 && !this.showZeroBins()) continue;
              this.drawStem(ctx, vp, b.xBin, amp, '#e879f9', 1.3);
            }
          }

          const zeros: DftPoint[] = [];
          for (const b of bins) {
            const amp = b.coeff.amplitude;
            const highlight = topSet.has(b.coeff.k);
            if (amp === 0 && !this.showZeroBins()) continue;

            this.drawStem(ctx, vp, b.xBin, amp, highlight ? '#f59e0b' : '#60a5fa', 2);
            if (Math.abs(amp) < 1e-12) {
              zeros.push({ x: b.xBin, y: 0 });
            }
          }

          if (this.showZeroBins()) {
            this.drawPoints(ctx, vp, zeros, '#93c5fd', 1.8);
          }
        },
      },
    ];
  });

  readonly phaseLayers = computed<PlotLayer[]>(() => {
    const bins = this.spectrumBins();

    return [
      {
        curves: [],
        onDraw: (ctx, vp) => {
          if (bins.length === 0) return;

          const maxAmp = bins.reduce((m, b) => Math.max(m, b.coeff.amplitude), 0);
          const threshold = (this.phaseThresholdPercent() / 100) * maxAmp;
          const phasePoints: DftPoint[] = [];

          for (const b of bins) {
            const amp = b.coeff.amplitude;
            if (amp === 0 && !this.showZeroBins()) continue;

            const reliable = amp >= threshold;
            const phaseInPi = reliable ? b.coeff.phase / Math.PI : 0;
            const color = reliable ? '#22d3ee' : '#64748b';
            this.drawStem(ctx, vp, b.xBin, phaseInPi, color, 1.8);
            phasePoints.push({ x: b.xBin, y: phaseInPi });
          }

          this.drawPoints(ctx, vp, phasePoints, '#22d3ee', 2.2);
        },
      },
    ];
  });

  async calculate(): Promise<void> {
    if (this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const generator = this.resolveGenerator();
      const sampled = this.generateSampledSignal(generator);
      const analyzed = this.applyWindow()
        ? this.applyWindowToSignal(sampled, this.windowType())
        : sampled;
      const originalFn = this.generateContinuousFunction(generator);
      const negativeOriginalFn = this.generateNegativeContinuousFunction(generator);

      this.sampledSignal.set(sampled);
      this.analyzedSignal.set(analyzed);
      this.originalFunctionCurve.set(originalFn);
      this.negativeOriginalFunctionCurve.set(negativeOriginalFn);

      const shouldCompareRect =
        this.compareWithRectangular() && this.applyWindow() && this.windowType() !== 'rectangular';

      const [mainRes, baseRes] = await Promise.all([
        firstValueFrom(this.api.calculateDFT({ mode: 'signal', points: analyzed })),
        shouldCompareRect
          ? firstValueFrom(this.api.calculateDFT({ mode: 'signal', points: sampled }))
          : Promise.resolve(null),
      ]);

      this.result.set(mainRes);
      this.baselineResult.set(baseRes);
      this.topK.set(Math.min(16, Math.max(1, Math.floor(mainRes.N / 2))));

      if (this.phaseCAutoApply()) {
        this.applyPhaseCFilterToCurrentResult();
      } else {
        this.phaseCFilteredCoefficients.set(null);
        this.phaseCFilteredReconstruction.set([]);
        this.phaseCStats.set(null);
      }
    } catch (err) {
      const anyErr = err as { error?: { error?: string }; message?: string };
      this.error.set(anyErr?.error?.error ?? anyErr?.message ?? 'No se pudo calcular la DFT.');
      this.result.set(null);
      this.baselineResult.set(null);
      this.phaseCFilteredCoefficients.set(null);
      this.phaseCFilteredReconstruction.set([]);
      this.phaseCStats.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  applyPhaseCFilter(): void {
    this.applyPhaseCFilterToCurrentResult();
  }

  async applyLeakageDemoConfig(): Promise<void> {
    this.sourceMode.set('preset');
    this.presetId.set('leakage');
    this.sampleCount.set(96);
    this.noiseLevel.set(0);
    this.topK.set(12);
    this.phaseThresholdPercent.set(1.5);

    this.showOriginalFunction.set(true);
    this.showNegativeOriginalFunction.set(false);
    this.showSampledSignal.set(true);
    this.showWindowedSignal.set(true);
    this.showReconstructedFull.set(false);
    this.showReconstructedTopK.set(false);
    this.showSampledPoints.set(true);

    this.shiftedSpectrum.set(true);
    this.showZeroBins.set(false);
    this.compareWithRectangular.set(true);

    this.applyWindow.set(true);
    this.windowType.set('hann');

    await this.calculate();
    this.activateLeakageHighlight();
  }

  applyImageDemoPreset(): void {
    this.imagePreset.set('bars');
    this.imageSourceType.set('preset');
    this.imageSize.set(12);
    this.imageLowPassRadius.set(2);
    this.imageError.set(null);
    this.runImageDftDemo();
  }

  runImageDftDemo(): void {
    const n = this.imageSize();
    const original =
      this.imageSourceType() === 'upload' && this.uploadedImageLoaded() && this.uploadedImage()
        ? this.resizeImageMatrix(this.uploadedImage() ?? [], n)
        : this.generateImagePreset(this.imagePreset(), n);
    const spectrum = this.dft2d(original);
    const filteredSpectrum = this.applyLowPass2d(spectrum, this.imageLowPassRadius());
    const reconstructed = this.idft2d(filteredSpectrum).map((row) =>
      row.map((v) => this.clampNum(v, 0, 1)),
    );

    const spectrumLog = this.magnitudeLogNormalized(spectrum);
    const filteredSpectrumLog = this.magnitudeLogNormalized(filteredSpectrum);
    const rms = this.matrixRms(original, reconstructed);

    this.imageOriginal.set(original);
    this.imageFiltered.set(reconstructed);
    this.imageSpectrum.set(spectrumLog);
    this.imageFilteredSpectrum.set(filteredSpectrumLog);
    this.imageRmsError.set(rms);
  }

  async onImageFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    this.imageError.set(null);

    try {
      const matrix = await this.readImageAsGrayscaleMatrix(file);
      this.uploadedImage.set(matrix);
      this.uploadedImageLoaded.set(true);
      this.imageSourceType.set('upload');
      this.runImageDftDemo();
    } catch {
      this.imageError.set('No se pudo cargar la imagen. Prueba con PNG o JPG pequeno.');
      this.uploadedImage.set(null);
      this.uploadedImageLoaded.set(false);
    }
  }

  async restoreLabDefaults(): Promise<void> {
    this.sourceMode.set('preset');
    this.presetId.set('mix');
    this.sampleCount.set(256);
    this.noiseLevel.set(0.02);
    this.topK.set(16);
    this.phaseThresholdPercent.set(1.5);

    this.showOriginalFunction.set(true);
    this.showNegativeOriginalFunction.set(false);
    this.showSampledSignal.set(true);
    this.showWindowedSignal.set(false);
    this.showReconstructedFull.set(true);
    this.showReconstructedTopK.set(true);
    this.showSampledPoints.set(false);

    this.shiftedSpectrum.set(false);
    this.showZeroBins.set(true);
    this.compareWithRectangular.set(true);

    this.applyWindow.set(false);
    this.windowType.set('hann');

    this.phaseCFilterType.set('lowpass');
    this.phaseCK1.set(14);
    this.phaseCK2.set(24);
    this.phaseCPreserveDC.set(true);
    this.phaseCAutoApply.set(true);
    this.showPhaseCFilteredSignal.set(true);
    this.showPhaseCFilteredSpectrum.set(true);

    await this.calculate();
  }

  private buildSpectrumBins(res: DftResponse | null): SpectrumBin[] {
    if (!res) return [];
    const shifted = this.shiftedSpectrum();

    return res.coefficients
      .map((coeff) => ({
        coeff,
        xBin: shifted ? this.signedK(coeff.k, res.N) : coeff.k,
      }))
      .sort((a, b) => a.xBin - b.xBin);
  }

  private buildSpectrumBinsFromCoefficients(coeffs: DftCoefficient[], n: number): SpectrumBin[] {
    const shifted = this.shiftedSpectrum();

    return coeffs
      .map((coeff) => ({
        coeff,
        xBin: shifted ? this.signedK(coeff.k, n) : coeff.k,
      }))
      .sort((a, b) => a.xBin - b.xBin);
  }

  private applyPhaseCFilterToCurrentResult(): void {
    const res = this.result();
    const analyzed = this.analyzedSignal();
    if (!res || analyzed.length === 0) {
      this.phaseCFilteredCoefficients.set(null);
      this.phaseCFilteredReconstruction.set([]);
      this.phaseCStats.set(null);
      return;
    }

    const filteredCoeffs = res.coefficients.map((c) => {
      const keep = this.shouldKeepCoefficient(c.k, res.N);
      if (keep) return c;

      return {
        ...c,
        re: 0,
        im: 0,
        amplitude: 0,
        amplitudePercent: 0,
        phase: 0,
        phaseInPi: '0',
      };
    });

    const reconstruction = analyzed.map((p, n) => {
      let y = 0;
      for (const c of filteredCoeffs) {
        const angle = (TAU * c.k * n) / res.N;
        y += c.re * Math.cos(angle) - c.im * Math.sin(angle);
      }
      return { x: p.x, y };
    });

    let originalEnergy = 0;
    let keptEnergy = 0;
    let keptBins = 0;
    for (let i = 0; i < res.coefficients.length; i++) {
      const e0 = res.coefficients[i]?.amplitude ?? 0;
      const e1 = filteredCoeffs[i]?.amplitude ?? 0;
      originalEnergy += e0 * e0;
      keptEnergy += e1 * e1;
      if (e1 > 0) keptBins++;
    }

    let rmsSum = 0;
    const n = Math.min(analyzed.length, reconstruction.length);
    for (let i = 0; i < n; i++) {
      const d = (analyzed[i]?.y ?? 0) - (reconstruction[i]?.y ?? 0);
      rmsSum += d * d;
    }
    const rmsError = n > 0 ? Math.sqrt(rmsSum / n) : 0;

    this.phaseCFilteredCoefficients.set(filteredCoeffs);
    this.phaseCFilteredReconstruction.set(reconstruction);
    this.phaseCStats.set({
      keptBins,
      keptEnergyRatio: originalEnergy > 0 ? keptEnergy / originalEnergy : 0,
      rmsError,
    });
  }

  private shouldKeepCoefficient(k: number, n: number): boolean {
    const kAbs = Math.abs(this.signedK(k, n));
    if (this.phaseCPreserveDC() && kAbs === 0) return true;

    const k1 = this.clampInt(this.phaseCK1(), 0, Math.floor(n / 2));
    const k2 = this.clampInt(this.phaseCK2(), 0, Math.floor(n / 2));
    const low = Math.min(k1, k2);
    const high = Math.max(k1, k2);

    switch (this.phaseCFilterType()) {
      case 'lowpass':
        return kAbs <= low;
      case 'highpass':
        return kAbs >= low;
      case 'bandpass':
        return kAbs >= low && kAbs <= high;
      case 'notch':
        return !(kAbs >= low && kAbs <= high);
      default:
        return true;
    }
  }

  private activateLeakageHighlight(): void {
    if (this.leakageHighlightTimer) {
      clearTimeout(this.leakageHighlightTimer);
      this.leakageHighlightTimer = null;
    }

    this.leakageHighlightActive.set(true);
    this.leakageHighlightTimer = setTimeout(() => {
      this.leakageHighlightActive.set(false);
      this.leakageHighlightTimer = null;
    }, 2800);
  }

  private generateImagePreset(preset: ImagePresetId, n: number): number[][] {
    const img = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    const center = Math.floor(n / 2);

    if (preset === 'dot') {
      img[center][center] = 1;
      return img;
    }

    if (preset === 'bars') {
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          img[y][x] = x % 4 < 2 ? 0.95 : 0.1;
        }
      }
      return img;
    }

    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        img[y][x] = (x + y) % 2 === 0 ? 0.95 : 0.05;
      }
    }

    return img;
  }

  private dft2d(input: number[][]): ComplexValue[][] {
    const n = input.length;
    const out: ComplexValue[][] = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => ({ re: 0, im: 0 })),
    );

    for (let u = 0; u < n; u++) {
      for (let v = 0; v < n; v++) {
        let re = 0;
        let im = 0;
        for (let x = 0; x < n; x++) {
          for (let y = 0; y < n; y++) {
            const angle = (TAU * (u * x + v * y)) / n;
            const value = input[y]?.[x] ?? 0;
            re += value * Math.cos(angle);
            im -= value * Math.sin(angle);
          }
        }
        out[u][v] = { re: re / n, im: im / n };
      }
    }

    return out;
  }

  private idft2d(input: ComplexValue[][]): number[][] {
    const n = input.length;
    const out: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));

    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        let value = 0;
        for (let u = 0; u < n; u++) {
          for (let v = 0; v < n; v++) {
            const c = input[u]?.[v] ?? { re: 0, im: 0 };
            const angle = (TAU * (u * x + v * y)) / n;
            value += c.re * Math.cos(angle) - c.im * Math.sin(angle);
          }
        }
        out[y][x] = value / n;
      }
    }

    return out;
  }

  private applyLowPass2d(spectrum: ComplexValue[][], radius: number): ComplexValue[][] {
    const n = spectrum.length;
    const out: ComplexValue[][] = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => ({ re: 0, im: 0 })),
    );

    for (let u = 0; u < n; u++) {
      for (let v = 0; v < n; v++) {
        const us = this.signedK(u, n);
        const vs = this.signedK(v, n);
        const r = Math.sqrt(us * us + vs * vs);
        if (r <= radius) {
          out[u][v] = spectrum[u]?.[v] ?? { re: 0, im: 0 };
        }
      }
    }

    return out;
  }

  private magnitudeLogNormalized(spectrum: ComplexValue[][]): number[][] {
    const n = spectrum.length;
    const shifted: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    let maxValue = 0;

    for (let u = 0; u < n; u++) {
      for (let v = 0; v < n; v++) {
        const c = spectrum[u]?.[v] ?? { re: 0, im: 0 };
        const mag = Math.sqrt(c.re * c.re + c.im * c.im);
        const logMag = Math.log(1 + mag);
        const su = (u + Math.floor(n / 2)) % n;
        const sv = (v + Math.floor(n / 2)) % n;
        shifted[su][sv] = logMag;
        maxValue = Math.max(maxValue, logMag);
      }
    }

    if (maxValue <= 0) return shifted;
    return shifted.map((row) => row.map((v) => v / maxValue));
  }

  private matrixRms(a: number[][], b: number[][]): number {
    const n = Math.min(a.length, b.length);
    if (n === 0) return 0;

    let sum = 0;
    let count = 0;
    for (let y = 0; y < n; y++) {
      const rowA = a[y] ?? [];
      const rowB = b[y] ?? [];
      const m = Math.min(rowA.length, rowB.length);
      for (let x = 0; x < m; x++) {
        const d = (rowA[x] ?? 0) - (rowB[x] ?? 0);
        sum += d * d;
        count++;
      }
    }

    return count > 0 ? Math.sqrt(sum / count) : 0;
  }

  private flattenMatrix(matrix: number[][]): number[] {
    return matrix.flatMap((row) => row);
  }

  private resizeImageMatrix(input: number[][], n: number): number[][] {
    if (input.length === 0 || input[0]?.length === 0) {
      return this.generateImagePreset('dot', n);
    }

    const srcH = input.length;
    const srcW = input[0]?.length ?? 1;
    const out = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));

    for (let y = 0; y < n; y++) {
      const sy = Math.min(srcH - 1, Math.floor((y / Math.max(1, n - 1)) * (srcH - 1)));
      for (let x = 0; x < n; x++) {
        const sx = Math.min(srcW - 1, Math.floor((x / Math.max(1, n - 1)) * (srcW - 1)));
        out[y][x] = input[sy]?.[sx] ?? 0;
      }
    }

    return out;
  }

  private readImageAsGrayscaleMatrix(file: File): Promise<number[][]> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('read-failed'));
      fr.onload = () => {
        const dataUrl = fr.result;
        if (typeof dataUrl !== 'string') {
          reject(new Error('invalid-data-url'));
          return;
        }

        const img = new Image();
        img.onerror = () => reject(new Error('image-decode-failed'));
        img.onload = () => {
          const w = Math.max(1, img.width);
          const h = Math.max(1, img.height);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('no-2d-context'));
            return;
          }

          ctx.drawImage(img, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h).data;
          const matrix = Array.from({ length: h }, () => Array.from({ length: w }, () => 0));

          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = (y * w + x) * 4;
              const r = data[idx] ?? 0;
              const g = data[idx + 1] ?? 0;
              const b = data[idx + 2] ?? 0;
              matrix[y][x] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            }
          }

          resolve(matrix);
        };

        img.src = dataUrl;
      };

      fr.readAsDataURL(file);
    });
  }

  grayCell(value: number): string {
    const v = this.clampNum(value, 0, 1);
    const p = Math.round(v * 100);
    return `hsl(0 0% ${p}%)`;
  }

  heatCell(value: number): string {
    const v = this.clampNum(value, 0, 1);
    const hue = 210 - 180 * v;
    const lightness = 16 + 58 * v;
    return `hsl(${hue} 85% ${lightness}%)`;
  }

  private computeLeakage(res: DftResponse | null): LeakageStats | null {
    if (!res || res.coefficients.length === 0) return null;

    const bins = res.coefficients
      .map((c) => ({ coeff: c, kSigned: this.signedK(c.k, res.N) }))
      .filter((x) => x.kSigned >= 0 && x.kSigned <= Math.floor(res.N / 2));

    if (bins.length === 0) return null;

    const dominant = bins.reduce((best, cur) =>
      cur.coeff.amplitude > best.coeff.amplitude ? cur : best,
    );

    const totalEnergy = bins.reduce((s, x) => s + x.coeff.amplitude * x.coeff.amplitude, 0);
    if (totalEnergy <= 0) {
      return { dominantK: dominant.kSigned, dominantAmplitude: 0, leakageRatio: 0 };
    }

    const mainLobeEnergy = bins
      .filter((x) => Math.abs(x.kSigned - dominant.kSigned) <= 1)
      .reduce((s, x) => s + x.coeff.amplitude * x.coeff.amplitude, 0);

    return {
      dominantK: dominant.kSigned,
      dominantAmplitude: dominant.coeff.amplitude,
      leakageRatio: Math.max(0, (totalEnergy - mainLobeEnergy) / totalEnergy),
    };
  }

  private resolveGenerator(): (n: number, t: number) => number {
    if (this.sourceMode() === 'preset') {
      const preset = this.presets.find((p) => p.id === this.presetId()) ?? this.presets[0];
      if (!preset) throw new Error('No hay preset disponible.');
      return preset.generator;
    }

    const manual = this.buildManualGenerator(this.manualExpression());
    if (!manual) {
      throw new Error('Expresión manual inválida. Revisa sintaxis y funciones permitidas.');
    }
    return manual;
  }

  private generateSampledSignal(generator: (n: number, t: number) => number): DftPoint[] {
    const n = this.sampleCount();
    const noise = this.noiseLevel();
    const points: DftPoint[] = [];

    for (let i = 0; i < n; i++) {
      const t = i / n;
      const base = generator(i, t);
      const noisy = base + this.randomNoise(noise);
      points.push({ x: i, y: noisy });
    }

    return points;
  }

  private generateContinuousFunction(generator: (n: number, t: number) => number): DftPoint[] {
    const n = this.sampleCount();
    const dense = Math.max(512, Math.min(2400, n * 3));
    const points: DftPoint[] = [];

    for (let i = 0; i < dense; i++) {
      const t = i / (dense - 1);
      points.push({ x: t * (n - 1), y: generator(i, t) });
    }

    return points;
  }

  private generateNegativeContinuousFunction(
    generator: (n: number, t: number) => number,
  ): DftPoint[] {
    const n = this.sampleCount();
    const dense = Math.max(512, Math.min(2400, n * 3));
    const points: DftPoint[] = [];

    for (let i = 0; i < dense; i++) {
      const t = i / (dense - 1);
      points.push({ x: -t * (n - 1), y: generator(i, -t) });
    }

    return points.sort((a, b) => a.x - b.x);
  }

  private buildManualGenerator(rawExpression: string): ((n: number, t: number) => number) | null {
    const expression = rawExpression.trim().toLowerCase();
    if (!expression) return null;

    if (
      /constructor|window|global|process|require|import|function|=>|;|\{|\}|\[|\]|=/.test(
        expression,
      )
    ) {
      return null;
    }

    if (/[^0-9a-z_+\-*/^().,\s]/.test(expression)) {
      return null;
    }

    const jsExpr = expression.replace(/\^/g, '**');

    try {
      const fn = new Function(
        't',
        'pi',
        'sin',
        'cos',
        'tan',
        'sqrt',
        'abs',
        'exp',
        'log',
        'pow',
        `return (${jsExpr});`,
      ) as (
        t: number,
        pi: number,
        sin: typeof Math.sin,
        cos: typeof Math.cos,
        tan: typeof Math.tan,
        sqrt: typeof Math.sqrt,
        abs: typeof Math.abs,
        exp: typeof Math.exp,
        log: typeof Math.log,
        pow: typeof Math.pow,
      ) => number;

      const probe = fn(
        0.123,
        Math.PI,
        Math.sin,
        Math.cos,
        Math.tan,
        Math.sqrt,
        Math.abs,
        Math.exp,
        Math.log,
        Math.pow,
      );
      if (!Number.isFinite(probe)) return null;

      return (_n: number, t: number) => {
        const y = fn(
          t,
          Math.PI,
          Math.sin,
          Math.cos,
          Math.tan,
          Math.sqrt,
          Math.abs,
          Math.exp,
          Math.log,
          Math.pow,
        );
        return Number.isFinite(y) ? y : 0;
      };
    } catch {
      return null;
    }
  }

  private randomNoise(level: number): number {
    if (level <= 0) return 0;
    return (Math.random() * 2 - 1) * level;
  }

  private applyWindowToSignal(points: DftPoint[], type: WindowType): DftPoint[] {
    const n = points.length;
    if (n <= 1 || type === 'rectangular') return points;

    return points.map((p, i) => {
      const w = this.windowAt(type, i, n);
      return { x: p.x, y: p.y * w };
    });
  }

  private windowAt(type: WindowType, i: number, n: number): number {
    const denom = Math.max(1, n - 1);
    const x = (TAU * i) / denom;

    switch (type) {
      case 'hann':
        return 0.5 - 0.5 * Math.cos(x);
      case 'hamming':
        return 0.54 - 0.46 * Math.cos(x);
      case 'blackman':
        return 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x);
      case 'rectangular':
      default:
        return 1;
    }
  }

  signedK(k: number, n: number): number {
    return k > n / 2 ? k - n : k;
  }

  clampInt(value: unknown, min: number, max: number): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  clampNum(value: unknown, min: number, max: number): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  private drawStem(
    ctx: CanvasRenderingContext2D,
    vp: CanvasViewport,
    x: number,
    y: number,
    color: string,
    lineWidth: number,
  ): void {
    const x0 = this.coords.mathToScreenX(x, vp) / vp.dpr;
    const y0 = this.coords.mathToScreenY(0, vp) / vp.dpr;
    const y1 = this.coords.mathToScreenY(y, vp) / vp.dpr;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0, y1);
    ctx.stroke();
    ctx.restore();
  }

  private drawPoints(
    ctx: CanvasRenderingContext2D,
    vp: CanvasViewport,
    points: DftPoint[],
    color: string,
    radius: number,
  ): void {
    if (points.length === 0) return;

    ctx.save();
    ctx.fillStyle = color;

    for (const p of points) {
      const sx = this.coords.mathToScreenX(p.x, vp) / vp.dpr;
      const sy = this.coords.mathToScreenY(p.y, vp) / vp.dpr;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }
}
