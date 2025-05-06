import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SurveyService } from '../../../core/services/survey/survey.service';
import { ThemeService } from '../../../core/services/theming/theme.service';

@Component({
  selector: 'app-survey-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      *ngIf="!surveyCompleted"
      (click)="openSurvey()"
      class="fixed bottom-5 right-5 rounded-lg flex items-center justify-center cursor-pointer z-40 focus:outline-none transition-all duration-300 shadow-lg"
      [ngClass]="[
        isDarkMode 
          ? 'bg-gradient-to-r from-purple-600 to-indigo-700 hover:shadow-purple-500/50 text-white' 
          : 'bg-gradient-to-r from-purple-400 to-indigo-500 hover:shadow-indigo-500/50 text-white',
        'pulse-animation'
      ]"
      style="width: 12rem; height: 3rem;"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5 mr-2"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <span class="font-medium">Completar encuesta</span>
    </button>
  `,
  styles: [
    `
      button {
        transform: scale(1);
        transition: transform 0.3s ease, box-shadow 0.3s ease;
      }

      button:hover {
        transform: scale(1.05);
      }

      button:active {
        transform: scale(0.95);
      }

      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(124, 58, 237, 0); }
        100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); }
      }

      .pulse-animation {
        animation: pulse 2s infinite;
      }
    `,
  ],
})
export class SurveyButtonComponent implements OnInit {
  surveyCompleted = false;
  isDarkMode = false;
  private surveyUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSd4f1PFz7KpLaxqcLoAyL8zKR_KyCpXQKzbEWPlUxvjlJmGjQ/viewform?usp=header'; 

  constructor(
    private surveyService: SurveyService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.surveyService.surveyCompleted$.subscribe((completed) => {
      this.surveyCompleted = completed;
    });
    
    this.themeService.darkMode$.subscribe((isDark) => {
      this.isDarkMode = isDark;
    });
  }

  openSurvey(): void {
    // Abre la URL de la encuesta en una nueva pestaña
    window.open(this.surveyUrl, '_blank');
    
    // Opcionalmente, puedes mostrar un diálogo para confirmar que completaron la encuesta
    if (confirm('¿Has completado la encuesta? El botón desaparecerá si confirmas.')) {
      this.surveyService.markSurveyCompleted();
    }
  }
}