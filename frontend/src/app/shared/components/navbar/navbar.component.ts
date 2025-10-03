import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theming/theme.service';
import { SurveyService } from '../../../core/services/survey/survey.service';

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
  }

  ngOnInit(): void {
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

    // Opcionalmente, puedes mostrar un diálogo para confirmar que completaron la encuesta
    if (
      confirm(
        '¿Has completado la encuesta? El botón desaparecerá si confirmas.'
      )
    ) {
      this.surveyService.markSurveyCompleted();
    }
  }
}
