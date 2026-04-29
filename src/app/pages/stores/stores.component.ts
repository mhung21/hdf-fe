import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TuiAlertService,
  TuiButton,
  TuiHint,
  TuiIcon,
  TuiTextfield,
  tuiDialog,
} from '@taiga-ui/core';

import { StoreProvider } from '../../api/api/store.service';
import { CUStoreModel } from '../../api/model/cu-store-model';
import { SearchStoreRequest } from '../../api/model/search-store-request';
import { AuthService } from '../../services/auth.service';
import { ReferenceDataService } from '../../services/reference-data.service';
import { RoleCode } from '../../models/role.model';
import { DataTableComponent, ColumnDef } from '../../shared/components/data-table/data-table.component';
import { StoreFormDialogComponent, StoreFormItem } from './store-form-dialog.component';

interface StoreItem {
  storeId: string;
  storeCode: string;
  storeName: string;
  address?: string | null;
  phone?: string | null;
  openedOn?: string | null;
  isActive: boolean;
}

@Component({
  selector: 'app-stores',
  imports: [
    CommonModule,
    FormsModule,
    TuiButton,
    TuiHint,
    TuiIcon,
    TuiTextfield,
    DataTableComponent,
  ],
  templateUrl: './stores.component.html',
  styleUrls: ['./stores.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoresComponent {
  private readonly storeProvider = inject(StoreProvider);
  private readonly authService = inject(AuthService);
  private readonly alerts = inject(TuiAlertService);
  private readonly injector = inject(Injector);
  private readonly refData = inject(ReferenceDataService);

  stores = signal<StoreItem[]>([]);
  loading = signal(false);
  totalCount = signal(0);

  keyword = signal('');
  page = 0;
  size = 10;

  readonly tableColumns: ColumnDef[] = [
    { key: 'code', label: 'Mã chi nhánh' },
    { key: 'name', label: 'Tên chi nhánh' },
    { key: 'contact', label: 'Liên hệ' },
    { key: 'openedOn', label: 'Ngày mở' },
    { key: 'status', label: 'Trạng thái', align: 'center' },
  ];

  /** Type-safe cast for row template context */
  asStore(item: unknown): StoreItem { return item as StoreItem; }

  canCreate = computed(() => this.authService.hasAnyRole([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER]));
  canDelete = computed(() => this.authService.hasRole(RoleCode.ADMIN));

  /** Kiểm tra quyền sửa theo từng dòng */
  canEditStore(store: StoreItem): boolean {
    if (this.authService.hasRole(RoleCode.ADMIN)) return true;
    if (this.authService.hasRole(RoleCode.REGIONAL_MANAGER)) {
      return this.authService.currentUser()?.storeIds?.includes(store.storeId) ?? false;
    }
    if (this.authService.hasRole(RoleCode.STORE_MANAGER)) {
      return store.storeId === this.authService.currentUser()?.storeId;
    }
    return false;
  }

  constructor() {
    this.loadStores();
  }

  loadStores(): void {
    this.loading.set(true);

    const request: SearchStoreRequest = {
      keyword: this.keyword() || null,
      pageIndex: this.page + 1,
      pageSize: this.size,
      sortBy: 'StoreCode',
      sortDesc: false,
    };

    this.storeProvider.apiStoreSearchPost({ searchStoreRequest: request }).subscribe({
      next: result => {
        const data = result.data;
        const items = this.extractItems(data);
        const totalCount = this.extractTotalCount(data, items.length);

        // STORE_MANAGER chỉ xem chi nhánh của mình
        const currentUser = this.authService.currentUser();
        const filteredItems = this.authService.hasRole(RoleCode.STORE_MANAGER) && currentUser?.storeId
          ? items.filter(s => s.storeId === currentUser.storeId)
          : items;

        this.stores.set(filteredItems);
        this.totalCount.set(this.authService.hasRole(RoleCode.STORE_MANAGER) ? filteredItems.length : totalCount);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.showAlert('Không thể tải danh sách chi nhánh', 'error');
      },
    });
  }

  onKeywordChange(value: string): void {
    this.keyword.set(value);
    this.page = 0;
    this.loadStores();
  }

  onPaginationChange(event: { page: number; size: number }): void {
    this.page = event.page;
    this.size = event.size;
    this.loadStores();
  }

  openCreateDialog(): void {
    tuiDialog(StoreFormDialogComponent, {
      injector: this.injector,
      label: 'Thêm Chi Nhánh',
      size: 'l',
    })(null).subscribe(() => {
      this.loadStores();
      this.refData.reloadStores();
    });
  }

  openEditDialog(store: StoreItem): void {
    tuiDialog(StoreFormDialogComponent, {
      injector: this.injector,
      label: 'Chỉnh Sửa Chi Nhánh',
      size: 'l',
    })(store as StoreFormItem).subscribe(() => {
      this.loadStores();
      this.refData.reloadStores();
    });
  }

  deleteStore(store: StoreItem): void {
    const model: CUStoreModel = {
      storeId: store.storeId,
      storeCode: store.storeCode,
      storeName: store.storeName,
      address: store.address ?? undefined,
      phone: store.phone ?? undefined,
      openedOn: store.openedOn ?? undefined,
      isActive: false,
    };

    this.storeProvider.apiStoreSavePost({ cUStoreModel: model }).subscribe({
      next: result => {
        if (result.status) {
          this.showAlert(`Đã xóa chi nhánh ${store.storeName}`, 'success');
          this.loadStores();
          this.refData.reloadStores();
          return;
        }

        this.showAlert(result.message ?? 'Không thể xóa chi nhánh', 'error');
      },
      error: () => this.showAlert('Có lỗi xảy ra khi xóa chi nhánh', 'error'),
    });
  }

  activateStore(store: StoreItem): void {
    const model: CUStoreModel = {
      storeId: store.storeId,
      storeCode: store.storeCode,
      storeName: store.storeName,
      address: store.address ?? undefined,
      phone: store.phone ?? undefined,
      openedOn: store.openedOn ?? undefined,
      isActive: true,
    };

    this.storeProvider.apiStoreSavePost({ cUStoreModel: model }).subscribe({
      next: result => {
        if (result.status) {
          this.showAlert(`Đã kích hoạt lại chi nhánh ${store.storeName}`, 'success');
          this.loadStores();
          this.refData.reloadStores();
          return;
        }

        this.showAlert(result.message ?? 'Không thể kích hoạt chi nhánh', 'error');
      },
      error: () => this.showAlert('Có lỗi xảy ra khi kích hoạt chi nhánh', 'error'),
    });
  }

  formatDate(dateIso?: string | null): string {
    if (!dateIso) {
      return '-';
    }

    const date = new Date(dateIso);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat('vi-VN').format(date);
  }

  private extractItems(data: unknown): StoreItem[] {
    const raw = data as {
      items?: unknown;
      data?: unknown;
      totalCount?: number;
    } | null;

    const list = Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(data)
          ? data
          : [];

    return list
      .map(item => this.toStoreItem(item))
      .filter((item): item is StoreItem => item !== null);
  }

  private extractTotalCount(data: unknown, fallback: number): number {
    const raw = data as { totalCount?: unknown; total?: unknown } | null;

    if (typeof raw?.totalCount === 'number') {
      return raw.totalCount;
    }

    if (typeof raw?.total === 'number') {
      return raw.total;
    }

    return fallback;
  }

  private toStoreItem(input: unknown): StoreItem | null {
    const raw = input as {
      storeId?: unknown;
      storeCode?: unknown;
      storeName?: unknown;
      address?: unknown;
      phone?: unknown;
      openedOn?: unknown;
      isActive?: unknown;
    } | null;

    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const storeId = typeof raw.storeId === 'string' ? raw.storeId : '';
    const storeCode = typeof raw.storeCode === 'string' ? raw.storeCode : '';
    const storeName = typeof raw.storeName === 'string' ? raw.storeName : '';

    if (!storeId || !storeCode || !storeName) {
      return null;
    }

    return {
      storeId,
      storeCode,
      storeName,
      address: typeof raw.address === 'string' ? raw.address : null,
      phone: typeof raw.phone === 'string' ? raw.phone : null,
      openedOn: typeof raw.openedOn === 'string' ? raw.openedOn : null,
      isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    };
  }

  private showAlert(message: string, type: 'success' | 'error'): void {
    this.alerts
      .open(message, { appearance: type === 'success' ? 'positive' : 'negative', autoClose: 3000 })
      .subscribe();
  }

}

