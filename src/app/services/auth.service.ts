import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, shareReplay, finalize, timeout } from 'rxjs';
import {
  AuthResponse,
  ChangePasswordRequest,
  LoginRequest,
  CurrentUser,
} from '../models/auth.model';
import { normalizeRoleCode, RoleCode } from '../models/role.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly API_URL = `${environment.apiUrl}/api/auth`;
  private readonly AUTH_DEBUG_URL = `${environment.authUrl || environment.apiUrl}/api/auth`;
  private readonly ACCESS_TOKEN_KEY = 'access_token';
  private readonly USER_KEY = 'current_user';

  // Reactive state management with signals
  currentUser = signal<CurrentUser | null>(null);
  isAuthenticated = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  // Cache permissions to avoid repeated localStorage parses
  private permissions = signal<string[]>([]);

  // Shared observable to prevent concurrent refresh calls (race condition fix)
  private refreshTokenInFlight: Observable<AuthResponse> | null = null;
  private readonly requestTimeoutMs = 15000;

  constructor() {
    this.loadUserFromStorage();
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    this.isLoading.set(true);

    return this.http
      .post<AuthResponse>(`${this.AUTH_DEBUG_URL}/login`, credentials, { withCredentials: true })
      .pipe(
        timeout({ first: this.requestTimeoutMs }),
        tap((response) => this.handleAuthSuccess(response)),
        catchError((error) => {
          this.isLoading.set(false);
          return throwError(() => error);
        }),
      );
  }

  refreshToken(): Observable<AuthResponse> {
    if (this.refreshTokenInFlight) {
      return this.refreshTokenInFlight;
    }

    // Refresh token được gửi tự động qua HttpOnly cookie (withCredentials: true)
    // Không cần đọc từ localStorage nữa
    this.refreshTokenInFlight = this.http
      .post<AuthResponse>(`${this.AUTH_DEBUG_URL}/refresh`, {}, { withCredentials: true })
      .pipe(
        timeout({ first: this.requestTimeoutMs }),
        tap((response) => this.handleAuthSuccess(response)),
        finalize(() => {
          this.refreshTokenInFlight = null;
        }),
        shareReplay(1),
      );

    return this.refreshTokenInFlight;
  }

  logout(reason?: 'session-expired'): void {
    // Gửi request logout để server revoke session và xóa HttpOnly cookie
    // Cookie được gửi tự động nhờ withCredentials: true
    this.http
      .post(`${this.AUTH_DEBUG_URL}/logout`, {}, { withCredentials: true })
      .subscribe({ error: () => {} }); // fire-and-forget, lỗi network bỏ qua

    this.clearAuth();
    const currentUrl = this.router.url;
    const returnUrl =
      typeof currentUrl === 'string' && currentUrl.startsWith('/') && !currentUrl.startsWith('//')
        ? currentUrl
        : '/dashboard';

    this.router.navigate(['/login'], {
      queryParams:
        reason === 'session-expired'
          ? { reason: 'session-expired', returnUrl }
          : undefined,
    });
  }

  isTransientNetworkError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const e = error as { status?: number; name?: string; message?: string };
    return (
      e.status === 0 ||
      e.status === 408 ||
      e.status === 504 ||
      e.name === 'TimeoutError' ||
      (typeof e.message === 'string' && e.message.toLowerCase().includes('timed out'))
    );
  }

  getCurrentUser(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${this.AUTH_DEBUG_URL}/me`);
  }

  isLoggedIn(): boolean {
    const token = this.getAccessToken();
    if (!token || !this.currentUser()) return false;

    // Check token expiry from JWT payload
    // Không gọi clearAuth() ở đây vì có thể vẫn còn refresh token dùng được
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        return false;
      }
    } catch {
      return false;
    }

    return true;
  }

  isTokenExpired(): boolean {
    const token = this.getAccessToken();
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? Date.now() >= payload.exp * 1000 : false;
    } catch {
      return true;
    }
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  /** @deprecated Refresh token được lưu trong HttpOnly cookie, không đọc được từ JS */
  getRefreshToken(): null {
    return null;
  }

  /**
   * Trả về true nếu user từng đăng nhập và còn dữ liệu session trong localStorage.
   * Dùng thay cho getRefreshToken() trong guards vì refresh token nằm trong HttpOnly cookie,
   * không đọc được từ JS — nhưng nếu còn access token (dù hết hạn) thì rất có thể
   * refresh token cookie vẫn còn hạn.
   */
  hasStoredSession(): boolean {
    return !!localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  hasPermission(permissionCode: string): boolean {
    if (!this.currentUser()) return false;
    return this.permissions().includes(permissionCode);
  }

  hasAnyPermission(permissionCodes: string[]): boolean {
    return permissionCodes.some((code) => this.hasPermission(code));
  }

  hasAllPermissions(permissionCodes: string[]): boolean {
    return permissionCodes.every((code) => this.hasPermission(code));
  }

  getUserRole(): RoleCode | null {
    return this.currentUser()?.role ?? null;
  }

  hasRole(role: RoleCode): boolean {
    return this.getUserRole() === role;
  }

  hasAnyRole(roles: readonly RoleCode[]): boolean {
    const role = this.getUserRole();
    return !!role && roles.includes(role);
  }

  // =========================================================
  // PRIVATE HELPER METHODS
  // =========================================================

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;

      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      const decoded = atob(padded);

      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private resolveRoleCode(rawRole: unknown, accessToken?: string): RoleCode | null {
    const normalized = normalizeRoleCode(rawRole);
    if (normalized) {
      return normalized;
    }

    if (!accessToken) {
      return null;
    }

    const payload = this.decodeJwtPayload(accessToken);
    if (!payload) {
      return null;
    }

    // In .NET, ClaimTypes.Role is mapped to short-name 'role' in JWT by JwtSecurityTokenHandler.
    // The long MS claims URI key is usually NOT present in the actual JWT JSON payload.
    return (
      normalizeRoleCode(payload['roleCode']) ??
      normalizeRoleCode(payload['role']) ??
      normalizeRoleCode(payload['roles']) ??
      normalizeRoleCode(payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'])
    );
  }

  changePassword(request: ChangePasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.AUTH_DEBUG_URL}/change-password`, request, {
      withCredentials: true,
    });
  }

  private resolveStoreIds(rawStoreIds: unknown, accessToken?: string): string[] | undefined {
    const coerce = (v: unknown): string[] | undefined => {
      if (!v) return undefined;
      if (Array.isArray(v)) {
        const ids = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
        return ids.length ? ids : undefined;
      }
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if (!trimmed) return undefined;
        try {
          return coerce(JSON.parse(trimmed));
        } catch {
          const ids = trimmed
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean);
          return ids.length ? ids : undefined;
        }
      }
      return undefined;
    };

    const fromResponse = coerce(rawStoreIds);
    if (fromResponse) return fromResponse;

    if (!accessToken) return undefined;
    const payload = this.decodeJwtPayload(accessToken);
    if (!payload) return undefined;

    return (
      coerce(payload['storeIds']) ??
      coerce(payload['stores']) ??
      coerce(payload['managedStoreIds']) ??
      undefined
    );
  }

  private handleAuthSuccess(response: AuthResponse): void {
    const normalizedRole = this.resolveRoleCode(response.roleCode, response.accessToken);
    if (!normalizedRole) {
      this.clearAuth();
      throw new Error('Invalid role code returned from authentication response');
    }

    localStorage.setItem(this.ACCESS_TOKEN_KEY, response.accessToken);
    // Không lưu refresh token vào localStorage nữa (HttpOnly cookie do server set)
    const storeIds =
      normalizedRole === RoleCode.REGIONAL_MANAGER
        ? this.resolveStoreIds((response as any).storeIds, response.accessToken)
        : undefined;
    localStorage.setItem(this.USER_KEY, JSON.stringify({ ...response, storeIds }));

    const user: CurrentUser = {
      userId: response.userId,
      username: response.username,
      fullName: response.fullName,
      email: response.email,
      role: normalizedRole,
      storeId: response.storeId,
      storeName: response.storeName,
      storeIds,
    };

    this.currentUser.set(user);
    this.isAuthenticated.set(true);
    this.isLoading.set(false);
    this.permissions.set(response.permissions ?? []);
  }

  private clearAuth(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    // Refresh token cookie được server xóa qua endpoint /logout (đã gửi request trước đó)

    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.isLoading.set(false);
    this.permissions.set([]);
  }

  private loadUserFromStorage(): void {
    const userStr = localStorage.getItem(this.USER_KEY);
    const accessToken = this.getAccessToken();

    if (userStr && accessToken) {
      try {
        const response = JSON.parse(userStr) as AuthResponse;
        const normalizedRole = this.resolveRoleCode(response.roleCode, accessToken);

        if (!normalizedRole) {
          this.clearAuth();
          return;
        }

        const storeIds =
          normalizedRole === RoleCode.REGIONAL_MANAGER
            ? this.resolveStoreIds((response as any).storeIds, accessToken)
            : undefined;

        const user: CurrentUser = {
          userId: response.userId,
          username: response.username,
          fullName: response.fullName,
          email: response.email,
          role: normalizedRole,
          storeId: response.storeId,
          storeName: response.storeName,
          storeIds,
        };

        this.currentUser.set(user);
        this.isAuthenticated.set(true);
        this.permissions.set(response.permissions ?? []);
      } catch {
        this.clearAuth();
      }
    }
  }
}
