import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SurveyService {
  private readonly SURVEY_COMPLETED_KEY = 'survey_completed';
  private surveyCompletedSubject = new BehaviorSubject<boolean>(this.getInitialState());
  
  public surveyCompleted$ = this.surveyCompletedSubject.asObservable();
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  private getInitialState(): boolean {
    if (this.isBrowser) {
      const completed = localStorage.getItem(this.SURVEY_COMPLETED_KEY);
      return completed === 'true';
    }
    return false;
  }
  
  public markSurveyCompleted(): void {
    if (this.isBrowser) {
      localStorage.setItem(this.SURVEY_COMPLETED_KEY, 'true');
      this.surveyCompletedSubject.next(true);
    }
  }
}