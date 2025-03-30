import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tests',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './tests.component.html',
  styleUrl: './tests.component.scss',
})
export class TestsComponent {
  apiDropdownOpen = false;
  
  toggleApiDropdown(): void {
    this.apiDropdownOpen = !this.apiDropdownOpen;
  }
  
  closeApiDropdown(): void {
    this.apiDropdownOpen = false;
  }
}