import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
})
export class AdminLayoutComponent {}
