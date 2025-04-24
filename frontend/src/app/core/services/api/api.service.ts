import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ComplexResponse } from '../../../interfaces/complex-response.interface';

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
  }): Observable<ComplexResponse> {
    return this.http.post<ComplexResponse>(
      `${this.baseUrl}/fourier-series/complex`,
      data
    );
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
  }): Observable<ComplexResponse> {
    return this.http.post<ComplexResponse>(
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
  }): Observable<ComplexResponse> {
    return this.http.post<ComplexResponse>(
      `${this.baseUrl}/series-expansion/complex`,
      data
    );
  }

  // Parse coefficient lists from complex series response
  parseCoefficients(coefficientList: string): { n: number; value: string }[] {
    try {
      // Remove line breaks and parse the list
      const cleanList = coefficientList.replace(/\\\n/g, '');
      // Extract from outer brackets [ ]
      const listContent = cleanList.substring(1, cleanList.length - 1);

      // Split by "]," and process each item
      return listContent
        .split('],')
        .filter((item) => item.trim())
        .map((item) => {
          // Clean up and extract n and value
          const cleanItem = item.replace(/^\[|\]$/g, '').trim();
          const [nStr, value] = cleanItem.split(',', 2);
          return {
            n: parseInt(nStr, 10),
            value: value.trim(),
          };
        });
    } catch (error) {
      console.error('Error parsing coefficients:', error);
      return [];
    }
  }

  // Parse amplitude and phase from complex series
  parseAmplitudePhase(
    amplitudePhaseList: string
  ): { n: number; amplitude: string; phase: string }[] {
    try {
      // Remove line breaks and parse the list
      const cleanList = amplitudePhaseList.replace(/\\\n/g, '');
      // Extract from outer brackets [ ]
      const listContent = cleanList.substring(1, cleanList.length - 1);

      // Split by "]," and process each item
      return listContent
        .split('],')
        .filter((item) => item.trim())
        .map((item) => {
          // Clean up and extract n, amplitude, and phase
          const cleanItem = item.replace(/^\[|\]$/g, '').trim();
          const parts = cleanItem.split(',', 3);
          return {
            n: parseInt(parts[0], 10),
            amplitude: parts[1].trim(),
            phase: parts[2].trim(),
          };
        });
    } catch (error) {
      console.error('Error parsing amplitude/phase:', error);
      return [];
    }
  }

  // Parse series terms from complex series
  parseSeriesTerms(terms: string): string[] {
    try {
      // Remove line breaks and parse the list
      const cleanTerms = terms.replace(/\\\n/g, '');
      // Extract from outer brackets [ ]
      const termsContent = cleanTerms.substring(1, cleanTerms.length - 1);

      // Split by "," considering nested expressions
      const result: string[] = [];
      let currentTerm = '';
      let bracketCount = 0;

      for (let i = 0; i < termsContent.length; i++) {
        const char = termsContent[i];

        if (char === '(' || char === '[') {
          bracketCount++;
          currentTerm += char;
        } else if (char === ')' || char === ']') {
          bracketCount--;
          currentTerm += char;
        } else if (char === ',' && bracketCount === 0) {
          result.push(currentTerm.trim());
          currentTerm = '';
        } else {
          currentTerm += char;
        }
      }

      if (currentTerm) {
        result.push(currentTerm.trim());
      }

      return result;
    } catch (error) {
      console.error('Error parsing series terms:', error);
      return [];
    }
  }
}
