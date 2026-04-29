import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { RoleCode } from '../models/role.model';
import { Observable, map, catchError, of } from 'rxjs';

/**
 * Thử refresh token nếu access token hết hạn còn refresh token còn hạn.
 * Trả về Observable<true> nếu thành công, hoặc redirect về login nếu thất bại.
 */
function tryRefreshOrRedirect(
  authService: AuthService,
  router: Router,
  returnUrl: string
): Observable<boolean | ReturnType<Router['createUrlTree']>> {
  return authService.refreshToken().pipe(
    map(() => true as const),
    catchError((error) => {
      if (authService.isTransientNetworkError(error)) {
        return of(true);
      }
      return of(router.createUrlTree(['/login'], { queryParams: { returnUrl } }));
    })
  );
}

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  // Access token hết hạn — thử refresh qua HttpOnly cookie trước khi đẩy về login
  if (authService.hasStoredSession()) {
    return tryRefreshOrRedirect(authService, router, state.url);
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  });
};

/**
 * Guard chỉ cho phép user chưa đăng nhập (dành cho trang login/register)
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};

/**
 * Guard kiểm tra permission
 */
export function permissionGuard(requiredPermissions: string[]): CanActivateFn {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.isLoggedIn()) {
      return authService.hasAllPermissions(requiredPermissions)
        ? true
        : router.createUrlTree(['/unauthorized']);
    }

    if (authService.hasStoredSession()) {
      return tryRefreshOrRedirect(authService, router, state.url).pipe(
        map(result => {
          if (result === true) {
            return authService.hasAllPermissions(requiredPermissions)
              ? true
              : router.createUrlTree(['/unauthorized']);
          }
          return result;
        })
      );
    }

    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url }
    });
  };
}

/**
 * Guard kiểm tra role
 */
export function roleGuard(allowedRoles: readonly RoleCode[]): CanActivateFn {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.isLoggedIn()) {
      return authService.hasAnyRole(allowedRoles)
        ? true
        : router.createUrlTree(['/unauthorized']);
    }

    if (authService.hasStoredSession()) {
      return tryRefreshOrRedirect(authService, router, state.url).pipe(
        map(result => {
          if (result === true) {
            return authService.hasAnyRole(allowedRoles)
              ? true
              : router.createUrlTree(['/unauthorized']);
          }
          return result;
        })
      );
    }

    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url }
    });
  };
}
