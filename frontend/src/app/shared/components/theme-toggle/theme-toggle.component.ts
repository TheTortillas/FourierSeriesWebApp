import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theming/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      (click)="toggleTheme()"
      class="fixed top-5 right-5 w-12 h-12 rounded-full flex items-center justify-center cursor-pointer z-40 focus:outline-none transition-all duration-300 shadow-lg"
      [ngClass]="
        isDarkMode
          ? 'bg-gradient-to-r from-teal-500 to-green-500 hover:shadow-teal-500/50 text-white'
          : 'bg-gradient-to-r from-blue-400 to-sky-500 hover:shadow-blue-500/50 text-white'
      "
    >
      <svg
        *ngIf="isDarkMode"
        xmlns="http://www.w3.org/2000/svg"
        class="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
      <svg
        *ngIf="!isDarkMode"
        xmlns="http://www.w3.org/2000/svg"
        class="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
    </button>
  `,
  styles: [
    `
      button {
        transform: scale(1);
        transition: transform 0.3s ease, box-shadow 0.3s ease;
      }

      button:hover {
        transform: scale(1.1);
      }

      button:active {
        transform: scale(0.95);
      }
    `,
  ],
})
export class ThemeToggleComponent implements OnInit {
  isDarkMode = false;

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    this.themeService.darkMode$.subscribe((isDark) => {
      this.isDarkMode = isDark;
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
