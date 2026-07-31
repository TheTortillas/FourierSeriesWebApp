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
  ParsevalResponse,
  // DFT
  DftRequest,
  DftResponse,
  DftFunctionRequest,
  DftFunctionResponse,
  DftSampleResponse,
  // Transforms
  FourierTransformRequest,
  FourierTransformResponse,
  InverseFourierTransformRequest,
  InverseFourierTransformResponse,
  FourierIntegralRequest,
  FourierIntegralReconstructRequest,
  FourierIntegralCoefficientsResponse,
  FourierIntegralReconstructResponse,
  // Laplace
  LaplaceDirectRequest,
  LaplaceInverseRequest,
  LaplaceOdeRequest,
  LaplaceDirectResponse,
  LaplaceInverseResponse,
  LaplaceOdeResponse,
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
  RateLimitMetricsSnapshot,
  CacheStats,
  // Common
  PaginatedResponse,
} from '../../../domain';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  // ─── Auth ────────────────────────────────────────────────────────────────

  register(body: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/register`, body, {
      withCredentials: true,
    });
  }

  login(body: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/login`, body, { withCredentials: true });
  }

  loginWithGoogle(body: GoogleLoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/google`, body, {
      withCredentials: true,
    });
  }

  refreshToken(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/refresh`, {}, { withCredentials: true });
  }

  logout(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.base}/auth/logout`,
      {},
      { withCredentials: true },
    );
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

  forgotPassword(email: string, lang?: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/forgot-password`, {
      email,
      lang,
    });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/reset-password`, {
      token,
      newPassword,
    });
  }

  resendVerification(email: string, lang?: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/resend-verification`, {
      email,
      lang,
    });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/change-password`, {
      currentPassword,
      newPassword,
    });
  }

  updateProfile(firstName: string, lastName: string): Observable<{ user: User }> {
    return this.http.patch<{ user: User }>(`${this.base}/auth/profile`, { firstName, lastName });
  }

  deleteAccount(): Observable<void> {
    return this.http.delete<void>(`${this.base}/auth/me`);
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

  calculateParseval(body: FourierSeriesRequest): Observable<ParsevalResponse> {
    return this.http.post<ParsevalResponse>(`${this.base}/fourier/parseval`, body);
  }

  // ─── Transforms ──────────────────────────────────────────────────────────

  calculateFourierTransform(body: FourierTransformRequest): Observable<FourierTransformResponse> {
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

  calculateFourierIntegralCoefficients(
    body: FourierIntegralRequest,
  ): Observable<FourierIntegralCoefficientsResponse> {
    return this.http.post<FourierIntegralCoefficientsResponse>(
      `${this.base}/transforms/fourier-integral/coefficients`,
      body,
    );
  }

  calculateFourierIntegralReconstruct(
    body: FourierIntegralReconstructRequest,
  ): Observable<FourierIntegralReconstructResponse> {
    return this.http.post<FourierIntegralReconstructResponse>(
      `${this.base}/transforms/fourier-integral/reconstruct`,
      body,
    );
  }

  calculateLaplaceDirect(body: LaplaceDirectRequest): Observable<LaplaceDirectResponse> {
    return this.http.post<LaplaceDirectResponse>(`${this.base}/transforms/laplace/direct`, body);
  }

  calculateLaplaceInverse(body: LaplaceInverseRequest): Observable<LaplaceInverseResponse> {
    return this.http.post<LaplaceInverseResponse>(`${this.base}/transforms/laplace/inverse`, body);
  }

  calculateLaplaceOde(body: LaplaceOdeRequest): Observable<LaplaceOdeResponse> {
    return this.http.post<LaplaceOdeResponse>(`${this.base}/transforms/laplace/ode`, body);
  }

  calculateDFT(body: DftRequest): Observable<DftResponse> {
    return this.http.post<DftResponse>(`${this.base}/transforms/dft`, body);
  }

  calculateDFTFromFunction(body: DftFunctionRequest): Observable<DftFunctionResponse> {
    return this.http.post<DftFunctionResponse>(`${this.base}/transforms/dft/function`, body);
  }

  sampleDFTFunction(body: DftFunctionRequest): Observable<DftSampleResponse> {
    return this.http.post<DftSampleResponse>(`${this.base}/transforms/dft/sample`, body);
  }

  // ─── Parse ───────────────────────────────────────────────────────────────

  parseLaTeX(
    latex: string,
    mode: 'series' | 'transform' = 'series',
  ): Observable<{ maxima: string; ok: boolean; error?: string }> {
    return this.http.post<{ maxima: string; ok: boolean; error?: string }>(
      `${this.base}/parse/latex`,
      { latex, mode },
    );
  }

  compareIntervals(body: {
    pairs?: Array<{ a: string; b: string }>;
    orderPairs?: Array<{ a: string; b: string }>;
  }): Observable<{
    results?: Array<'equal' | 'different' | 'unknown'>;
    orderResults?: Array<'valid' | 'invalid' | 'unknown'>;
  }> {
    return this.http.post<{
      results?: Array<'equal' | 'different' | 'unknown'>;
      orderResults?: Array<'valid' | 'invalid' | 'unknown'>;
    }>(`${this.base}/parse/compare`, body);
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
    if (query?.type) params = params.set('type', query.type);
    return this.http.get<HistoryListResponse>(`${this.base}/history`, { params });
  }

  getHistoryEntry(id: string): Observable<HistoryEntry> {
    return this.http.get<HistoryEntry>(`${this.base}/history/${id}`);
  }

  toggleFavorite(id: string, name?: string): Observable<HistoryEntry> {
    return this.http.patch<HistoryEntry>(`${this.base}/history/${id}/favorite`, { name });
  }

  renameFavorite(id: string, name: string | undefined): Observable<HistoryEntry> {
    return this.http.patch<HistoryEntry>(`${this.base}/history/${id}/favorite/name`, { name });
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
    if (query?.limit !== undefined) params = params.set('limit', query.limit);
    if (query?.offset !== undefined) params = params.set('offset', query.offset);
    if (query?.action) params = params.set('action', query.action);
    if (query?.userId) params = params.set('userId', query.userId);
    if (query?.ip)     params = params.set('ip',     query.ip);
    if (query?.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query?.dateTo) params = params.set('dateTo', query.dateTo);
    if (query?.anonymousOnly) params = params.set('anonymousOnly', query.anonymousOnly);
    return this.http.get<PaginatedResponse<AuditEntry>>(`${this.base}/admin/audit`, { params });
  }

  getAdminHistory(query?: AdminHistoryQuery): Observable<HistoryListResponse> {
    let params = new HttpParams();
    if (query?.limit !== undefined) params = params.set('limit', query.limit);
    if (query?.offset !== undefined) params = params.set('offset', query.offset);
    if (query?.userId) params = params.set('userId', query.userId);
    if (query?.ip)     params = params.set('ip',     query.ip);
    if (query?.type) params = params.set('type', query.type);
    if (query?.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query?.dateTo) params = params.set('dateTo', query.dateTo);
    if (query?.favoritesOnly) params = params.set('favoritesOnly', query.favoritesOnly);
    if (query?.anonymousOnly) params = params.set('anonymousOnly', query.anonymousOnly);
    if (query?.minExecutionMs !== undefined)
      params = params.set('minExecutionMs', query.minExecutionMs);
    return this.http.get<HistoryListResponse>(`${this.base}/admin/history`, { params });
  }

  clearAuditLog(action: string, olderThanDays: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/admin/audit/clear`, {
      body: { action, olderThanDays },
    });
  }

  getAdminStats(): Observable<{ total: number; premium: number; free: number; inactive: number }> {
    return this.http.get<{ total: number; premium: number; free: number; inactive: number }>(
      `${this.base}/admin/stats`,
    );
  }

  getSystemStats(): Observable<SystemStats> {
    return this.http.get<SystemStats>(`${this.base}/admin/system/stats`);
  }

  getRateLimitMetrics(windowHours?: number): Observable<RateLimitMetricsSnapshot> {
    let params = new HttpParams();
    if (windowHours !== undefined) params = params.set('windowHours', windowHours);
    return this.http.get<RateLimitMetricsSnapshot>(`${this.base}/admin/rate-limit/metrics`, { params });
  }

  getRateLimitHistory(params: { limit?: number; offset?: number; ip?: string; limiter?: string } = {}):
    Observable<import('../../../domain').RateLimitHistoryResponse> {
    let p = new HttpParams();
    if (params.limit)   p = p.set('limit',   params.limit);
    if (params.offset)  p = p.set('offset',  params.offset);
    if (params.ip)      p = p.set('ip',      params.ip);
    if (params.limiter) p = p.set('limiter', params.limiter);
    return this.http.get<import('../../../domain').RateLimitHistoryResponse>(
      `${this.base}/admin/rate-limit/history`, { params: p },
    );
  }

  // ── IP Blocklist ────────────────────────────────────────────────────────────

  getIpBlocks(params: {
    limit?: number; offset?: number;
    ip?: string; blockedBy?: string; activeOnly?: boolean;
  } = {}): Observable<import('../../../domain').IpBlockListResponse> {
    let p = new HttpParams();
    if (params.limit    != null) p = p.set('limit',      params.limit);
    if (params.offset   != null) p = p.set('offset',     params.offset);
    if (params.ip)               p = p.set('ip',         params.ip);
    if (params.blockedBy)        p = p.set('blockedBy',  params.blockedBy);
    if (params.activeOnly)       p = p.set('activeOnly', 'true');
    return this.http.get<import('../../../domain').IpBlockListResponse>(
      `${this.base}/admin/ip-blocks`, { params: p },
    );
  }

  getIpBlocksActive(): Observable<import('../../../domain').IpBlockActiveResponse> {
    return this.http.get<import('../../../domain').IpBlockActiveResponse>(
      `${this.base}/admin/ip-blocks/active`,
    );
  }

  blockIp(ip: string, reason: string, durationHours?: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.base}/admin/ip-blocks`,
      { ip, reason, ...(durationHours != null && { durationHours }) },
    );
  }

  unblockIp(ip: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.base}/admin/ip-blocks/${encodeURIComponent(ip)}`,
    );
  }

  getFeedbackStats(query?: { dateFrom?: string; dateTo?: string; tz?: string }): Observable<import('../../../domain').FeedbackStats> {
    let params = new HttpParams();
    if (query?.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query?.dateTo)   params = params.set('dateTo',   query.dateTo);
    if (query?.tz)       params = params.set('tz',       query.tz);
    return this.http.get<import('../../../domain').FeedbackStats>(`${this.base}/admin/feedback/stats`, { params });
  }

  getFeedbackList(
    limit: number = 50,
    offset: number = 0,
    category?: string,
  ): Observable<import('../../../domain').FeedbackListResponse> {
    let url = `${this.base}/admin/feedback/list?limit=${limit}&offset=${offset}`;
    if (category) url += `&category=${category}`;
    return this.http.get<import('../../../domain').FeedbackListResponse>(url);
  }

  getAllComments(
    limit: number = 50,
    offset: number = 0,
    source?: 'feedback' | 'survey',
  ): Observable<import('../../../domain').UnifiedCommentsResponse> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (source) params = params.set('source', source);
    return this.http.get<import('../../../domain').UnifiedCommentsResponse>(
      `${this.base}/admin/comments/all`, { params },
    );
  }

  getSurveyStats(query?: { dateFrom?: string; dateTo?: string; tz?: string }): Observable<import('../../../domain').SurveyStats> {
    let params = new HttpParams();
    if (query?.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query?.dateTo)   params = params.set('dateTo',   query.dateTo);
    if (query?.tz)       params = params.set('tz',       query.tz);
    return this.http.get<import('../../../domain').SurveyStats>(`${this.base}/admin/survey/stats`, { params });
  }

  getCalcStats(query?: { dateFrom?: string; dateTo?: string; topN?: number; tz?: string }): Observable<import('../../../domain').CalcStats> {
    let params = new HttpParams();
    if (query?.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query?.dateTo)   params = params.set('dateTo',   query.dateTo);
    if (query?.topN)     params = params.set('topN',     query.topN);
    if (query?.tz)       params = params.set('tz',       query.tz);
    return this.http.get<import('../../../domain').CalcStats>(`${this.base}/admin/calculations/stats`, { params });
  }

  // ─── Feedback ────────────────────────────────────────────────────────────

  submitFeedback(body: import('../../../domain').FeedbackRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/feedback`, body);
  }

  // ─── Cache ───────────────────────────────────────────────────────────────

  getCacheStats(): Observable<CacheStats> {
    return this.http.get<CacheStats>(`${this.base}/cache/stats`);
  }

  clearCache(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/cache/clear`, {});
  }
}
