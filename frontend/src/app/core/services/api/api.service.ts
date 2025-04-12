import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Test connection endpoint
  testConnection(): Observable<any> {
    return this.http.get(`${this.baseUrl}/auxiliar-functions/test-connection`);
  }

  // Check integrability function
  checkIntegrability(data: {
    funcion: string;
    intVar: string;
    start?: string;
    end?: string;
  }): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/auxiliar-functions/check-integrability`,
      data
    );
  }

  // Calcular serie trigonométrica
  calculateTrigonometricSeries(data: {
    funcion: string;
    periodo: string;
    intVar: string;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/fourier-series/trigonometric`, data);
  }

  // Calcular serie compleja
  calculateComplexSeries(data: {
    funcion: string;
    periodo: string;
    intVar: string;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/fourier-series/complex`, data);
  }

  // Calcular serie trigonométrica a trozos
  calculateTrigonometricSeriesPiecewise(data: {
    funcionMatrix: string[][];
    intVar: string;
  }): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/fourier-series/trigonometric-piecewise`,
      data
    );
  }

  // Calcular serie compleja a trozos
  calculateComplexSeriesPiecewise(data: {
    funcionMatrix: string[][];
    intVar: string;
  }): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/fourier-series/complex-piecewise`,
      data
    );
  }

  // Calcular serie de medio rango
  calculateHalfRangeSeries(data: {
    funcionMatrix: string[][];
    intVar: string;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/fourier-series/half-range`, data);
  }

  // Expandir serie trigonométrica en términos
  expandTrigonometricSeries(data: {
    coefficients: {
      a0: string;
      an?: string;
      bn?: string;
    };
    w0: string;
    intVar: string;
    terms: number;
  }): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/series-expansion/trigonometric`,
      data
    );
  }

  // Expandir serie de medio rango en términos
  expandHalfRangeSeries(data: {
    coefficients: {
      a0: string;
      an?: string;
      bn?: string;
    };
    w0: string;
    intVar: string;
    terms: number;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/series-expansion/half-range`, data);
  }

  // Expandir serie compleja en términos
  expandComplexSeries(data: {
    coefficients: {
      c0?: string;
      cn?: string;
    };
    w0: string;
    intVar: string;
    terms: number;
    demoivre?: boolean;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/series-expansion/complex`, data);
  }
}
