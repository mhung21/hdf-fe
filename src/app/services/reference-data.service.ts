import { Injectable, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { StoreProvider } from '../api/api/store.service';
import { CustomerSourceProvider } from '../api/api/customer-source.service';
import { CustomerSource } from '../api/model/customer-source';

export interface StoreOption {
  storeId: string;
  storeName: string;
  storeCode?: string;
  isActive?: boolean;
}

/**
 * Loads reference / lookup data once after the user authenticates.
 * Inject this service in any component that needs store lists, etc.
 * — instead of each component calling the API independently.
 */
@Injectable({ providedIn: 'root' })
export class ReferenceDataService {
  private readonly storeProvider = inject(StoreProvider);
  private readonly customerSourceProvider = inject(CustomerSourceProvider);
  private readonly authService = inject(AuthService);

  /** Flat list of active stores, available app-wide. */
  readonly storeList = signal<StoreOption[]>([]);

  /** Flat list of all customer sources (luồng khách), available app-wide. */
  readonly customerSources = signal<CustomerSource[]>([]);

  private loaded = false;

  constructor() {
    effect(() => {
      const authed = this.authService.isAuthenticated();
      if (authed && !this.loaded) {
        this.loaded = true;
        this.loadStores();
        this.loadCustomerSources();
      }
      if (!authed) {
        // Reset on logout so next login gets fresh data
        this.loaded = false;
        this.storeList.set([]);
        this.customerSources.set([]);
      }
    });
  }

  /** Force-refresh stores (e.g. after creating a new store). */
  reloadStores(): void {
    this.loadStores();
  }

  /** Force-refresh customer sources (e.g. after adding/deleting a source). */
  reloadCustomerSources(): void {
    this.loadCustomerSources();
  }

  private loadStores(): void {
    this.storeProvider
      .apiStoreSearchPost({
        searchStoreRequest: { pageIndex: 0, pageSize: 500, sortBy: 'StoreName', sortDesc: false },
      })
      .subscribe({
        next: result => {
          if (result.status && result.data) {
            const data = result.data as { items?: unknown } | null;
            const rawItems = Array.isArray(data?.items) ? data!.items : [];
            const items: StoreOption[] = rawItems
              .map((x) => x as any)
              .map((x) => ({
                storeId: typeof x?.storeId === 'string' ? x.storeId : '',
                storeName: typeof x?.storeName === 'string' ? x.storeName : '',
                storeCode: typeof x?.storeCode === 'string' ? x.storeCode : undefined,
                isActive: typeof x?.isActive === 'boolean' ? x.isActive : true,
              }))
              .filter((s) => !!s.storeId && !!s.storeName)
              .filter((s) => s.isActive !== false);

            this.storeList.set(items);
          }
        },
      });
  }

  private loadCustomerSources(): void {
    this.customerSourceProvider.apiCustomerSourceGetAllGet().subscribe({
      next: result => {
        if (result.status && result.data) {
          this.customerSources.set(result.data as CustomerSource[]);
        }
      },
    });
  }
}
