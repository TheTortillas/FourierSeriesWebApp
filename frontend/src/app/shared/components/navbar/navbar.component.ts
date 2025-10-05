import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theming/theme.service';
import { SurveyService } from '../../../core/services/survey/survey.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent implements OnInit {
  isDarkMode = false;
  surveyCompleted = false;
  private surveyUrl = 'https://forms.gle/PYZ4p3PajnSNawFn7';

  constructor(
    private themeService: ThemeService,
    private surveyService: SurveyService
  ) {
    // Get initial theme state synchronously if possible
    this.isDarkMode = this.themeService.isDarkMode;
    // Get initial survey completion state synchronously
    this.surveyCompleted = this.surveyService.getCurrentSurveyStatus();
    // console.log('Constructor - Survey completed:', this.surveyCompleted);
  }

  ngOnInit(): void {
    // Initialize survey status to ensure synchronization with localStorage
    this.surveyService.initializeSurveyStatus();
    // Subscribe to theme changes
    this.themeService.darkMode$.subscribe((isDark) => {
      this.isDarkMode = isDark;
    });

    // Subscribe to survey completion status
    this.surveyService.surveyCompleted$.subscribe((completed) => {
      this.surveyCompleted = completed;
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  openSurvey(): void {
    // Abre la URL de la encuesta en una nueva pestaña
    window.open(this.surveyUrl, '_blank');

    // Mostrar SweetAlert después de un breve delay para que el usuario vea que se abrió la pestaña
    setTimeout(() => {
      Swal.fire({
        title: 'Encuesta',
        text: '¿Ya completaste la encuesta?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sí, ya la completé',
        cancelButtonText: 'No, aún no',
        reverseButtons: true,
        backdrop: true,
        allowOutsideClick: false,
      }).then((result) => {
        if (result.isConfirmed) {
          this.surveyService.markSurveyCompleted();
          Swal.fire({
            title: '¡Gracias!',
            text: 'Tu participación es muy valiosa para nosotros.',
            icon: 'success',
            confirmButtonColor: '#f59e0b',
            timer: 3000,
            showConfirmButton: false,
          });
        } else {
          Swal.fire({
            title: 'Sin problema',
            text: 'El botón seguirá parpadeando hasta que completes la encuesta.',
            icon: 'info',
            confirmButtonColor: '#f59e0b',
            timer: 2500,
            showConfirmButton: false,
          });
        }
      });
    }, 500);
  }
}
