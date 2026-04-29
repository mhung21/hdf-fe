import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';

import { AuthService } from './auth.service';
import { RoleCode } from '../models/role.model';

@Injectable({ providedIn: 'root' })
export class StoreScopeService {
  private readonly authService = inject(AuthService);

  resolveStoreIds(selectedStoreId?: string | null): string[] | null {
    const user = this.authService.currentUser();
    if (!user) return [];

    if (this.authService.hasRole(RoleCode.ADMIN)) {
      return selectedStoreId ? [selectedStoreId] : null;
    }

    const managedStoreIds = (user.storeIds ?? []).filter((storeId): storeId is string => !!storeId);
    if (this.authService.hasRole(RoleCode.REGIONAL_MANAGER) && managedStoreIds.length > 0) {
      return managedStoreIds;
    }

    return user.storeId ? [user.storeId] : [];
  }

  fetchAcrossStores<T>(
    storeIds: string[] | null,
    fetch: (storeId: string | null) => Observable<T>,
    combine: (results: T[]) => T,
  ): Observable<T> {
    if (storeIds === null) {
      return fetch(null);
    }

    if (storeIds.length === 0) {
      return fetch(null);
    }

    if (storeIds.length === 1) {
      return fetch(storeIds[0] ?? null);
    }

    return forkJoin(storeIds.map((storeId) => fetch(storeId))).pipe(
      map((results) => combine(results)),
    );
  }
}
