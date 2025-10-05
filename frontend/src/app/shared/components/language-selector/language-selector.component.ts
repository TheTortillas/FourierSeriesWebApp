import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import {
  LanguageService,
  Language,
} from '../../../core/services/language/language.service';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="language-selector">
      <button
        type="button"
        (click)="toggleDropdown()"
        class="language-button"
        [attr.aria-expanded]="isOpen"
        aria-haspopup="true"
        [attr.aria-label]="'Idioma actual: ' + currentLanguage.nativeName"
      >
        <span class="flag">{{ currentLanguage.flag }}</span>
        <span class="language-text">{{ currentLanguage.nativeName }}</span>
        <svg
          class="chevron"
          [class.rotated]="isOpen"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          ></path>
        </svg>
      </button>

      <div *ngIf="isOpen" class="dropdown-menu" role="menu">
        <button
          *ngFor="let language of allLanguages"
          type="button"
          (click)="selectLanguage(language.code)"
          class="dropdown-item"
          [class.active]="language.code === currentLanguage.code"
          role="menuitem"
        >
          <span class="flag">{{ language.flag }}</span>
          <span class="language-name">{{ language.nativeName }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .language-selector {
        position: relative;
        display: inline-block;
      }

      .language-button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: transparent;
        border: 1px solid var(--border-color);
        border-radius: 0.375rem;
        color: var(--text-color);
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 8rem;
      }

      .language-button:hover {
        background: var(--hover-bg);
      }

      .language-button:focus {
        outline: none;
        box-shadow: 0 0 0 2px var(--focus-ring);
      }

      .flag {
        font-size: 1rem;
        line-height: 1;
      }

      .language-text {
        font-weight: 500;
        flex: 1;
        text-align: left;
      }

      .chevron {
        width: 1rem;
        height: 1rem;
        transition: transform 0.2s ease;
      }

      .chevron.rotated {
        transform: rotate(180deg);
      }

      .dropdown-menu {
        position: absolute;
        top: 100%;
        right: 0;
        z-index: 50;
        min-width: 100%;
        margin-top: 0.25rem;
        background: var(--dropdown-bg);
        border: 1px solid var(--border-color);
        border-radius: 0.375rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }

      .dropdown-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        padding: 0.5rem 0.75rem;
        background: none;
        border: none;
        color: var(--text-color);
        font-size: 0.875rem;
        cursor: pointer;
        transition: background-color 0.2s ease;
        text-align: left;
      }

      .dropdown-item:hover {
        background: var(--hover-bg);
      }

      .dropdown-item.active {
        background: var(--active-bg);
        font-weight: 500;
      }

      .language-name {
        font-weight: inherit;
      }

      /* CSS Variables para tema claro */
      :host {
        --border-color: #d1d5db;
        --text-color: #374151;
        --hover-bg: #f9fafb;
        --focus-ring: #3b82f6;
        --dropdown-bg: #ffffff;
        --active-bg: #e5e7eb;
      }

      /* Soporte para tema oscuro */
      :host-context(.dark-theme) {
        --border-color: #4b5563;
        --text-color: #f9fafb;
        --hover-bg: #374151;
        --dropdown-bg: #1f2937;
        --active-bg: #374151;
      }

      /* Responsive: ocultar texto en pantallas pequeñas */
      @media (max-width: 640px) {
        .language-text {
          display: none;
        }

        .language-button {
          min-width: 3rem;
          justify-content: center;
        }
      }
    `,
  ],
})
export class LanguageSelectorComponent implements OnInit, OnDestroy {
  currentLanguage!: Language;
  allLanguages: readonly Language[] = [];
  isOpen = false;

  private readonly destroy$ = new Subject<void>();

  constructor(private readonly languageService: LanguageService) {}

  ngOnInit(): void {
    this.allLanguages = this.languageService.getSupportedLanguages();

    this.languageService.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe((language) => {
        this.currentLanguage = language;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
  }

  selectLanguage(languageCode: string): void {
    this.languageService.switchLanguage(languageCode);
    this.isOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const languageSelector = target.closest('.language-selector');

    if (!languageSelector && this.isOpen) {
      this.isOpen = false;
    }
  }

  @HostListener('keydown.escape')
  onEscapePress(): void {
    if (this.isOpen) {
      this.isOpen = false;
    }
  }
}
