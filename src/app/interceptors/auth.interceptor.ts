import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, switchMap, throwError } from 'rxjs';

function isAuthEndpoint(url: string): boolean {
  return url.includes('/auth/login')
    || url.includes('/auth/refresh')
    || url.includes('/auth/logout');
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const accessToken = authService.getAccessToken();

  // withCredentials: true trên mọi request để HttpOnly cookie (refresh_token)
  // được browser tự động đính kèm khi gửi đến identity server
  let authReq = req.clone({ withCredentials: true });

  // Thêm Bearer token cho các request tới API (không phải auth endpoints)
  if (accessToken && !req.url.includes('/auth/login') && !req.url.includes('/auth/refresh')) {
    authReq = authReq.clone({
      setHeaders: { Authorization: `Bearer ${accessToken}` }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Don't try to refresh auth endpoints themselves, especially /auth/refresh.
      // Otherwise a missing refresh cookie can recurse into refresh -> 401 -> refresh.
      if (error.status === 401 && req.url.includes('/auth/refresh')) {
        // Refresh endpoint itself returned 401: session is no longer valid.
        authService.logout('session-expired');
        return throwError(() => error);
      }

      if (error.status === 401 && !isAuthEndpoint(req.url)) {
        return authService.refreshToken().pipe(
          switchMap(() => {
            // Retry the original request with new token
            const newToken = authService.getAccessToken();
            const retryReq = req.clone({
              withCredentials: true,
              setHeaders: {
                Authorization: `Bearer ${newToken}`
              }
            });
            return next(retryReq);
          }),
          catchError(refreshError => {
            // Request gốc đã 401, coi phiên hiện tại không còn hợp lệ -> buộc về login.
            authService.logout('session-expired');
            return throwError(() => refreshError);
          })
        );
      }

      return throwError(() => error);
    })
  );
};
