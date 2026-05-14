import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { of, throwError, firstValueFrom } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router, provideRouter } from '@angular/router';

import { AuthService } from './services/auth.service';
import { authGuard } from './guards/auth.guard';
import { authInterceptor } from './interceptors/auth.interceptor';

@Component({
  standalone: true,
  selector: 'app-login-test',
  template: '<p>Login</p>',
})
class LoginTestComponent {}

@Component({
  standalone: true,
  selector: 'app-customers-test',
  template: '<p>Customers</p>',
})
class CustomersTestComponent {}

describe('Auth session smoke', () => {
  const routerMock = {
    createUrlTree: vi.fn((commands: unknown[], extras?: { queryParams?: Record<string, string> }) => ({
      commands,
      queryParams: extras?.queryParams ?? {},
    })),
    navigate: vi.fn(),
    url: '/dashboard',
  };

  const authServiceMock = {
    isLoggedIn: vi.fn(),
    hasStoredSession: vi.fn(),
    refreshToken: vi.fn(),
    hasAllPermissions: vi.fn(),
    hasAnyRole: vi.fn(),
    getAccessToken: vi.fn(),
    logout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    });
  });

  it('redirects to login when session refresh fails in authGuard', async () => {
    authServiceMock.isLoggedIn.mockReturnValue(false);
    authServiceMock.hasStoredSession.mockReturnValue(true);
    authServiceMock.refreshToken.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401 }))
    );

    const result = await TestBed.runInInjectionContext(async () => {
      const guardResult = authGuard({} as never, { url: '/dashboard' } as never);
      return await firstValueFrom(guardResult as ReturnType<typeof of>);
    });

    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/dashboard', reason: 'session-expired' },
    });
    expect(result).toEqual({
      commands: ['/login'],
      queryParams: { returnUrl: '/dashboard', reason: 'session-expired' },
    });
  });

  it('redirects to login when token is expired and no stored session exists', async () => {
    authServiceMock.isLoggedIn.mockReturnValue(false);
    authServiceMock.hasStoredSession.mockReturnValue(false);

    const result = await TestBed.runInInjectionContext(async () => {
      const guardResult = authGuard({} as never, { url: '/customers' } as never);
      return guardResult;
    });

    expect(authServiceMock.refreshToken).not.toHaveBeenCalled();
    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/customers', reason: 'session-expired' },
    });
    expect(result).toEqual({
      commands: ['/login'],
      queryParams: { returnUrl: '/customers', reason: 'session-expired' },
    });
  });

  it('logs out when original API request is 401 and refresh fails in interceptor', async () => {
    authServiceMock.getAccessToken.mockReturnValue('expired-token');
    authServiceMock.refreshToken.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401 }))
    );

    const req = new HttpRequest('GET', '/api/LoanContract/Search');
    const next = () => throwError(() => new HttpErrorResponse({ status: 401 }));

    await expect(
      TestBed.runInInjectionContext(async () => {
        await firstValueFrom(authInterceptor(req, next as never));
      })
    ).rejects.toBeTruthy();

    expect(authServiceMock.logout).toHaveBeenCalledWith('session-expired');
  });

  it('logs out when refresh endpoint itself returns 401 in interceptor', async () => {
    authServiceMock.getAccessToken.mockReturnValue('expired-token');

    const req = new HttpRequest('POST', '/api/auth/refresh', {});
    const next = () => throwError(() => new HttpErrorResponse({ status: 401 }));

    await expect(
      TestBed.runInInjectionContext(async () => {
        await firstValueFrom(authInterceptor(req, next as never));
      })
    ).rejects.toBeTruthy();

    expect(authServiceMock.logout).toHaveBeenCalledWith('session-expired');
    expect(authServiceMock.refreshToken).not.toHaveBeenCalled();
  });
});

describe('Auth session router smoke', () => {
  const authServiceMock = {
    isLoggedIn: vi.fn(),
    hasStoredSession: vi.fn(),
    refreshToken: vi.fn(),
    hasAllPermissions: vi.fn(),
    hasAnyRole: vi.fn(),
    getAccessToken: vi.fn(),
    logout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', component: LoginTestComponent },
          { path: 'customers', component: CustomersTestComponent, canActivate: [authGuard] },
        ]),
        provideLocationMocks(),
        { provide: AuthService, useValue: authServiceMock },
      ],
    });
  });

  it('updates browser URL to /login with query params when navigating to protected route with expired session', async () => {
    authServiceMock.isLoggedIn.mockReturnValue(false);
    authServiceMock.hasStoredSession.mockReturnValue(false);

    const router = TestBed.inject(Router);
    const location = TestBed.inject(Location);

    await router.navigateByUrl('/customers');

    const currentPath = location.path();
    expect(currentPath).toContain('/login?');

    const currentUrlTree = router.parseUrl(currentPath);
    expect(currentUrlTree.queryParams['returnUrl']).toBe('/customers');
    expect(currentUrlTree.queryParams['reason']).toBe('session-expired');
    expect(authServiceMock.refreshToken).not.toHaveBeenCalled();
  });
});
