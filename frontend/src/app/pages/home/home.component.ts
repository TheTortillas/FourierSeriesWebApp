import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle.component';
import { SurveyButtonComponent } from '../../shared/components/survey-button/survey-button.component';
import { ThemeService } from '../../core/services/theming/theme.service';
import { MathquillService } from '../../core/services/mathquill/mathquill.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ThemeToggleComponent, SurveyButtonComponent, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, AfterViewInit {
  isDarkMode = false;

  trigSeriesTeX: string =
    '$$f(x) = \\frac{a_0}{2} + \\sum_{n=1}^{\\infty} a_n \\cos(n\\omega_{0}x) + b_n \\sin(n\\omega_{0}x)$$';
  complexSeriesTeX: string =
    '$$ f(x) = \\sum_{n=-\\infty}^{\\infty} c_n e^{in\\omega _{0}x}$$';
  dftTeX: string = '$$X[k] = \\sum_{n=0}^{N-1} x_n e^{-i\\frac{2\\pi kn}{N}}$$';

  constructor(
    private router: Router,
    private themeService: ThemeService,
    private mathquillService: MathquillService
  ) {
    // Get initial theme state synchronously if possible
    this.isDarkMode = this.themeService.isDarkMode;
  }

  ngOnInit(): void {
    // Use setTimeout to ensure this runs after Angular's change detection
    setTimeout(() => {
      this.themeService.darkMode$.subscribe((isDark) => {
        this.isDarkMode = isDark;
      });
    }, 0);
  }

  ngAfterViewInit(): void {
    // Render MathJax formulas after view is initialized
    setTimeout(() => {
      this.mathquillService.renderMathJax();
    }, 100);
  }

  navigateToCalculator(): void {
    this.router.navigate(['/fourier-calculator']);
  }

  navigateToDFT(): void {
    this.router.navigate(['/fourier-calculator'], {
      queryParams: { type: 'dft' },
    });
  }
}
