import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-api-test',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './api-test.component.html',
  styleUrl: './api-test.component.scss',
})
export class ApiTestComponent implements OnInit {
  function: string = 'x^2';
  variable: string = 'x';
  start: string = '-1';
  end: string = '1';

  result: any = null;
  loading: boolean = false;
  error: string | null = null;

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {}

  testIntegrability(): void {
    this.loading = true;
    this.error = null;
    this.result = null;

    this.apiService
      .checkIntegrability({
        funcion: this.function,
        intVar: this.variable,
        start: this.start,
        end: this.end,
      })
      .subscribe({
        next: (data) => {
          this.result = data;
          this.loading = false;
        },
        error: (err) => {
          this.error = err.message || 'Error connecting to server';
          this.loading = false;
          console.error('API Error:', err);
        },
      });
  }
}
