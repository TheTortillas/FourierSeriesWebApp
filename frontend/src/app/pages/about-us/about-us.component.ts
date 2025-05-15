import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle.component';
import { ThemeService } from '../../core/services/theming/theme.service';
import { FooterComponent } from '../../shared/components/footer/footer.component';

@Component({
  selector: 'app-about-us',
  standalone: true,
  imports: [CommonModule, ThemeToggleComponent, RouterLink, FooterComponent],
  templateUrl: './about-us.component.html',
  styleUrl: './about-us.component.scss',
})
export class AboutUsComponent implements OnInit {
  isDarkMode = false;

  constructor(
    private themeService: ThemeService,
    @Inject(PLATFORM_ID) private platformId: Object
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

    // Check if we're in a browser environment before using window
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 0);
    }
  }
}
