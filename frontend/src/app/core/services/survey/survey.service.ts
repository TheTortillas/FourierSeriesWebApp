import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SurveyService {
  private readonly SURVEY_COMPLETED_KEY = 'survey_completed';
  private surveyCompletedSubject = new BehaviorSubject<boolean>(
    this.getInitialState()
  );

  public surveyCompleted$ = this.surveyCompletedSubject.asObservable();
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  private getInitialState(): boolean {
    // Verificación más robusta para el navegador
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const completed = localStorage.getItem(this.SURVEY_COMPLETED_KEY);
        return completed === 'true';
      } catch (error) {
        console.warn('Error accessing localStorage:', error);
        return false;
      }
    }
    return false;
  }

  public markSurveyCompleted(): void {
    if (this.isBrowser) {
      localStorage.setItem(this.SURVEY_COMPLETED_KEY, 'true');
      this.surveyCompletedSubject.next(true);
    }
  }

  public getCurrentSurveyStatus(): boolean {
    // Verificar directamente localStorage para asegurar sincronización
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const completed = localStorage.getItem(this.SURVEY_COMPLETED_KEY);
        const isCompleted = completed === 'true';
        console.log(
          'getCurrentSurveyStatus - localStorage value:',
          completed,
          'isCompleted:',
          isCompleted
        );

        // Sincronizar el BehaviorSubject si hay diferencia
        if (this.surveyCompletedSubject.value !== isCompleted) {
          console.log(
            'Synchronizing BehaviorSubject from',
            this.surveyCompletedSubject.value,
            'to',
            isCompleted
          );
          this.surveyCompletedSubject.next(isCompleted);
        }

        return isCompleted;
      } catch (error) {
        console.warn('Error accessing localStorage:', error);
      }
    }
    // console.log(
    //   'Fallback to BehaviorSubject value:',
    //   this.surveyCompletedSubject.value
    // );
    return this.surveyCompletedSubject.value;
  }

  public initializeSurveyStatus(): void {
    // Forzar la sincronización con localStorage
    this.getCurrentSurveyStatus();
  }
}
