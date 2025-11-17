import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-canvas-controls',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './canvas-controls.component.html',
  styleUrl: './canvas-controls.component.scss',
})
export class CanvasControlsComponent {
  @Input() isDarkMode = true;
  @Input() showAxisToggles = true;
  @Input() scaleXEnabled = true;
  @Input() scaleYEnabled = true;
  @Input() position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' =
    'top-right';

  @Output() resetScales = new EventEmitter<void>();
  @Output() centerPlane = new EventEmitter<void>();
  @Output() toggleScaleX = new EventEmitter<boolean>();
  @Output() toggleScaleY = new EventEmitter<boolean>();

  onResetScales(): void {
    this.resetScales.emit();
  }

  onCenterPlane(): void {
    this.centerPlane.emit();
  }

  onToggleScaleX(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.toggleScaleX.emit(checked);
  }

  onToggleScaleY(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.toggleScaleY.emit(checked);
  }

  getPositionClasses(): string {
    const positions = {
      'top-right': 'top-3 right-3',
      'top-left': 'top-3 left-3',
      'bottom-right': 'bottom-3 right-3',
      'bottom-left': 'bottom-3 left-3',
    };
    return positions[this.position];
  }
}
