import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle.component';
import { SurveyButtonComponent } from '../../shared/components/survey-button/survey-button.component';
import { ThemeService } from '../../core/services/theming/theme.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ThemeToggleComponent, SurveyButtonComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  isDarkMode = false;
  
  constructor(private router: Router, private themeService: ThemeService) {
    // Get initial theme state synchronously if possible
    this.isDarkMode = this.themeService.isDarkMode;
  }
  
  ngOnInit(): void {
    // Use setTimeout to ensure this runs after Angular's change detection
    setTimeout(() => {
      this.themeService.darkMode$.subscribe(isDark => {
        this.isDarkMode = isDark;
      });
    }, 0);
  }
  
  navigateToCalculator(): void {
    this.router.navigate(['/fourier-calculator']);
  }
  
  navigateToDFT(): void {
    this.router.navigate(['/fourier-calculator'], { queryParams: { type: 'dft' } });
  }
}