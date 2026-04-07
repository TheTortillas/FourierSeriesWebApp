import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  // Auth
  AuthResponse,
  RegisterRequest,
  LoginRequest,
  GoogleLoginRequest,
  User,
  QuotaResponse,
  // Fourier
  FourierSeriesRequest,
  FourierTermsRequest,
  TrigonometricResponse,
  TrigonometricTermsResponse,
  HalfRangeResponse,
  ComplexResponse,
  ComplexTermsResponse,
  // DFT
  DftRequest,
  DftResponse,
  // Transforms
  FourierTransformRequest,
  FourierTransformResponse,
  InverseFourierTransformRequest,
  InverseFourierTransformResponse,
  // Simplify
  SimplifyRequest,
  SimplifyResponse,
  // History
  HistoryEntry,
  HistoryListResponse,
  HistoryQuery,
  // Admin
  AdminUser,
  AdminUsersQuery,
  AuditEntry,
  AuditQuery,
  AdminHistoryQuery,
  SystemStats,
  // Common
  PaginatedResponse,
} from '../../../domain';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  // ─── Auth ────────────────────────────────────────────────────────────────

  register(body: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/register`, body, { withCredentials: true });
  }

  login(body: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/login`, body, { withCredentials: true });
  }

  loginWithGoogle(body: GoogleLoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/google`, body, { withCredentials: true });
  }

  refreshToken(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/refresh`, {}, { withCredentials: true });
  }

  logout(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/logout`, {}, { withCredentials: true });
  }

  getMe(): Observable<{ user: User }> {
    return this.http.get<{ user: User }>(`${this.base}/auth/me`);
  }

  getQuota(): Observable<QuotaResponse> {
    return this.http.get<QuotaResponse>(`${this.base}/auth/quota`);
  }

  verifyEmail(token: string): Observable<{ message: string }> {
    return this.http.get<{ message: string }>(`${this.base}/auth/verify-email`, {
      params: new HttpParams().set('token', token),
    });
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/reset-password`, {
      token,
      newPassword,
    });
  }

  resendVerification(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/resend-verification`, { email });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/change-password`, {
      currentPassword,
      newPassword,
    });
  }

  // ─── Fourier Series ──────────────────────────────────────────────────────

  calculateTrigonometric(body: FourierSeriesRequest): Observable<TrigonometricResponse> {
    return this.http.post<TrigonometricResponse>(`${this.base}/fourier/trigonometric`, body);
  }

  calculateTrigonometricTerms(body: FourierTermsRequest): Observable<TrigonometricTermsResponse> {
    return this.http.post<TrigonometricTermsResponse>(
      `${this.base}/fourier/trigonometric/terms`,
      body,
    );
  }

  calculateHalfRange(body: FourierSeriesRequest): Observable<HalfRangeResponse> {
    return this.http.post<HalfRangeResponse>(`${this.base}/fourier/half-range`, body);
  }

  calculateHalfRangeTerms(body: FourierTermsRequest): Observable<TrigonometricTermsResponse> {
    return this.http.post<TrigonometricTermsResponse>(
      `${this.base}/fourier/half-range/terms`,
      body,
    );
  }

  calculateComplex(body: FourierSeriesRequest): Observable<ComplexResponse> {
    return this.http.post<ComplexResponse>(`${this.base}/fourier/complex`, body);
  }

  calculateComplexTerms(body: FourierTermsRequest): Observable<ComplexTermsResponse> {
    return this.http.post<ComplexTermsResponse>(`${this.base}/fourier/complex/terms`, body);
  }

  // ─── Transforms ──────────────────────────────────────────────────────────

  calculateFourierTransform(
    body: FourierTransformRequest,
  ): Observable<FourierTransformResponse> {
    return this.http.post<FourierTransformResponse>(`${this.base}/transforms/fourier`, body);
  }

  calculateInverseFourierTransform(
    body: InverseFourierTransformRequest,
  ): Observable<InverseFourierTransformResponse> {
    return this.http.post<InverseFourierTransformResponse>(
      `${this.base}/transforms/fourier/inverse`,
      body,
    );
  }

  calculateDFT(body: DftRequest): Observable<DftResponse> {
    return this.http.post<DftResponse>(`${this.base}/transforms/dft`, body);
  }

  // ─── Parse ───────────────────────────────────────────────────────────────

  parseLaTeX(latex: string, mode: 'series' | 'transform' = 'series'): Observable<{ maxima: string; ok: boolean; error?: string }> {
    return this.http.post<{ maxima: string; ok: boolean; error?: string }>(
      `${this.base}/parse/latex`,
      { latex, mode },
    );
  }

  compareIntervals(
    pairs: Array<{ a: string; b: string }>,
  ): Observable<{ results: Array<'equal' | 'different' | 'unknown'> }> {
    return this.http.post<{ results: Array<'equal' | 'different' | 'unknown'> }>(
      `${this.base}/parse/compare`,
      { pairs },
    );
  }

  // ─── Simplify ────────────────────────────────────────────────────────────

  simplify(body: SimplifyRequest): Observable<SimplifyResponse> {
    return this.http.post<SimplifyResponse>(`${this.base}/simplify`, body);
  }

  // ─── History ─────────────────────────────────────────────────────────────

  getHistory(query?: HistoryQuery): Observable<HistoryListResponse> {
    let params = new HttpParams();
    if (query?.limit !== undefined) params = params.set('limit', query.limit);
    if (query?.offset !== undefined) params = params.set('offset', query.offset);
    if (query?.favorites !== undefined) params = params.set('favorites', query.favorites);
    return this.http.get<HistoryListResponse>(`${this.base}/history`, { params });
  }

  getHistoryEntry(id: string): Observable<HistoryEntry> {
    return this.http.get<HistoryEntry>(`${this.base}/history/${id}`);
  }

  toggleFavorite(id: string, name?: string): Observable<HistoryEntry> {
    return this.http.patch<HistoryEntry>(`${this.base}/history/${id}/favorite`, { name });
  }

  deleteHistoryEntry(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/history/${id}`);
  }

  // ─── Admin ───────────────────────────────────────────────────────────────

  getAdminUsers(query?: AdminUsersQuery): Observable<PaginatedResponse<AdminUser>> {
    let params = new HttpParams();
    if (query?.limit !== undefined) params = params.set('limit', query.limit);
    if (query?.offset !== undefined) params = params.set('offset', query.offset);
    if (query?.role) params = params.set('role', query.role);
    if (query?.tier) params = params.set('tier', query.tier);
    if (query?.isActive !== undefined) params = params.set('isActive', query.isActive);
    return this.http.get<PaginatedResponse<AdminUser>>(`${this.base}/admin/users`, { params });
  }

  getAdminUser(id: string): Observable<AdminUser> {
    return this.http.get<AdminUser>(`${this.base}/admin/users/${id}`);
  }

  updateUserTier(id: string, tier: 'free' | 'premium'): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.base}/admin/users/${id}/tier`, { tier });
  }

  deactivateUser(id: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.base}/admin/users/${id}/deactivate`, {});
  }

  activateUser(id: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.base}/admin/users/${id}/activate`, {});
  }

  getAuditLog(query?: AuditQuery): Observable<PaginatedResponse<AuditEntry>> {
    let params = new HttpParams();
    if (query?.limit         !== undefined) params = params.set('limit',         query.limit);
    if (query?.offset        !== undefined) params = params.set('offset',        query.offset);
    if (query?.action)                      params = params.set('action',        query.action);
    if (query?.userId)                      params = params.set('userId',        query.userId);
    if (query?.dateFrom)                    params = params.set('dateFrom',      query.dateFrom);
    if (query?.dateTo)                      params = params.set('dateTo',        query.dateTo);
    if (query?.anonymousOnly)               params = params.set('anonymousOnly', query.anonymousOnly);
    return this.http.get<PaginatedResponse<AuditEntry>>(`${this.base}/admin/audit`, { params });
  }

  getAdminHistory(query?: AdminHistoryQuery): Observable<HistoryListResponse> {
    let params = new HttpParams();
    if (query?.limit          !== undefined) params = params.set('limit',          query.limit);
    if (query?.offset         !== undefined) params = params.set('offset',         query.offset);
    if (query?.userId)                       params = params.set('userId',         query.userId);
    if (query?.type)                         params = params.set('type',           query.type);
    if (query?.dateFrom)                     params = params.set('dateFrom',       query.dateFrom);
    if (query?.dateTo)                       params = params.set('dateTo',         query.dateTo);
    if (query?.favoritesOnly)                params = params.set('favoritesOnly',  query.favoritesOnly);
    if (query?.anonymousOnly)                params = params.set('anonymousOnly',  query.anonymousOnly);
    if (query?.minExecutionMs !== undefined) params = params.set('minExecutionMs', query.minExecutionMs);
    return this.http.get<HistoryListResponse>(`${this.base}/admin/history`, { params });
  }

  clearAuditLog(action: string, olderThanDays: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/admin/audit/clear`, {
      body: { action, olderThanDays },
    });
  }

  getAdminStats(): Observable<{ total: number; premium: number; free: number; inactive: number }> {
    return this.http.get<{ total: number; premium: number; free: number; inactive: number }>(`${this.base}/admin/stats`);
  }

  getSystemStats(): Observable<SystemStats> {
    return this.http.get<SystemStats>(`${this.base}/admin/system/stats`);
  }
}
