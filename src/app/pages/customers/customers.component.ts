import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TuiDay, TuiStringHandler, TuiStringMatcher } from '@taiga-ui/cdk';
import {
  TuiAlertService,
  TuiButton,
  TuiDataList,
  TuiHint,
  TuiIcon,
  TuiSelectLike,
  TuiTextfield,
  tuiDialog,
} from '@taiga-ui/core';
import { TuiChevron, TuiDataListWrapper, TuiInputChip, TuiMultiSelect } from '@taiga-ui/kit';

import { CustomerProvider } from '../../api/api/customer.service';
import { SearchCustomerRequest } from '../../api/model/search-customer-request';
import { AuthService } from '../../services/auth.service';
import { ReferenceDataService } from '../../services/reference-data.service';
import { RoleCode } from '../../models/role.model';
import {
  DataTableComponent,
  ColumnDef,
} from '../../shared/components/data-table/data-table.component';
import {
  CustomerFormDialogComponent,
  CustomerFormDialogData,
  CustomerFormItem,
} from './customer-form-dialog.component';
import {
  CustomerReassignDialogComponent,
  CustomerReassignDialogData,
} from './customer-reassign-dialog.component';

interface CustomerItem {
  customerId: string;
  customerCode?: string | null;
  nationalId?: string | null;
  fullName: string;
  phone: string | null;
  address?: string | null;
  firstSourceType?: string | null;
  hasBadHistory: boolean;
  badHistoryNote?: string | null;
  hasActiveLoan?: boolean;
  firstStoreId?: string | null;
  storeName?: string | null;
  dateOfBirth?: TuiDay | null;
  gender?: string | null;
  createdAt?: string | null;
  createdByName?: string | null;
}

const GENDER_LABELS: Record<string, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
};

@Component({
  selector: 'app-customers',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TuiButton,
    TuiChevron,
    TuiDataList,
    TuiDataListWrapper,
    TuiHint,
    TuiIcon,
    TuiInputChip,
    TuiMultiSelect,
    TuiSelectLike,
    TuiTextfield,
    DataTableComponent,
  ],
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.less'],
})
export class CustomersComponent {
  private readonly customerProvider = inject(CustomerProvider);
  private readonly authService = inject(AuthService);
  private readonly referenceDataService = inject(ReferenceDataService);
  private readonly alerts = inject(TuiAlertService);
  private readonly injector = inject(Injector);

  customers = signal<CustomerItem[]>([]);
  loading = signal(false);
  totalCount = signal(0);
  page = 0;
  size = 10;
  keyword = signal('');
  sortBy = signal<string | null>(null);
  sortDesc = signal(false);
  badDebtFilter = signal<boolean | null>(null);
  activeLoanFilter = signal<boolean | null>(null);
  readonly selectedFilterStoreIds = signal<string[]>([]);

  readonly storeList = computed(() => this.referenceDataService.storeList());
  readonly isRegionalManager = computed(() => this.authService.hasRole(RoleCode.REGIONAL_MANAGER));
  readonly canPickStoreFilter = computed(() =>
    this.authService.hasAnyRole([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER]),
  );
  readonly storeIdsForFilter = computed(() => {
    const ids = this.storeList()
      .map((s) => s.storeId)
      .filter((id): id is string => !!id);

    if (!this.isRegionalManager()) return ids;
    const allowed = new Set(this.authService.currentUser()?.storeIds ?? []);
    // Fallback: if backend doesn't provide managed store ids yet, show all stores so user can still select.
    if (allowed.size === 0) return ids;
    return ids.filter((id) => allowed.has(id));
  });

  readonly storeStringify: TuiStringHandler<string> = (id) => {
    if (!id) return '';
    return this.storeList().find((s) => s.storeId === id)?.storeName ?? id;
  };

  private normalizeVi(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  readonly tableColumns: ColumnDef[] = [
    { key: 'code', label: 'Mã KH', sortKey: 'customerCode' },
    { key: 'name', label: 'Họ tên & CCCD', sortKey: 'fullName' },
    { key: 'phone', label: 'Số điện thoại', sortKey: 'phone' },
    { key: 'address', label: 'Địa chỉ' },
    { key: 'loanStatus', label: 'HĐ vay', align: 'center' },
    { key: 'badHistory', label: 'Nợ xấu', align: 'center' },
    { key: 'createdAt', label: 'Ngày tạo', sortKey: 'createdAt' },
    { key: 'createdBy', label: 'Người tạo' },
  ];

  canCreate = computed(() =>
    this.authService.hasAnyRole([
      RoleCode.ADMIN,
      RoleCode.REGIONAL_MANAGER,
      RoleCode.STORE_MANAGER,
      RoleCode.STAFF,
    ]),
  );
  canEdit = computed(
    () =>
      this.authService.hasAnyRole([
        RoleCode.ADMIN,
        RoleCode.REGIONAL_MANAGER,
        RoleCode.STORE_MANAGER,
      ]) || this.authService.hasPermission('CUSTOMER_UPDATE'),
  );
  canReassign = computed(
    () =>
      this.authService.hasAnyRole([
        RoleCode.ADMIN,
        RoleCode.REGIONAL_MANAGER,
        RoleCode.STORE_MANAGER,
      ]) || this.authService.hasPermission('CUSTOMER_ASSIGN'),
  );

  asCustomer(item: unknown): CustomerItem {
    return item as CustomerItem;
  }

  getGenderLabel(code?: string | null): string {
    return GENDER_LABELS[code ?? ''] ?? code ?? '-';
  }

  constructor() {
    effect(() => {
      this.selectedFilterStoreIds();
      if (!this.filterStoreReady) return;
      this.page = 0;
      untracked(() => this.loadCustomers());
    });
  }

  private filterStoreReady = false;

  ngOnInit(): void {
    this.filterStoreReady = true;
    this.loadCustomers();
  }

  onKeywordChange(value: string): void {
    this.keyword.set(value);
    this.page = 0;
    this.loadCustomers();
  }

  setBadDebtFilter(value: boolean | null): void {
    this.badDebtFilter.set(value);
    this.page = 0;
    this.loadCustomers();
  }

  setActiveLoanFilter(value: boolean | null): void {
    this.activeLoanFilter.set(value);
    this.page = 0;
    this.loadCustomers();
  }

  onPaginationChange(event: { page: number; size: number }): void {
    this.page = event.page;
    this.size = event.size;
    this.loadCustomers();
  }

  onSortChange(event: { sortBy: string | null; sortDesc: boolean }): void {
    this.sortBy.set(event.sortBy);
    this.sortDesc.set(event.sortDesc);
    this.page = 0;
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.loading.set(true);
    const filterStoreIds = this.canPickStoreFilter() ? this.selectedFilterStoreIds() : [];

    const req: SearchCustomerRequest = {
      keyword: this.keyword() || null,
      pageIndex: this.page + 1,
      pageSize: this.size,
      sortBy: this.sortBy() || null,
      sortDesc: this.sortDesc(),
      hasBadDebt: this.badDebtFilter(),
      hasActiveLoan: this.activeLoanFilter(),
    };

    const body = (filterStoreIds.length ? { ...req, filterStoreIds } : req) as any;
    this.customerProvider.apiCustomerSearchPost({ searchCustomerRequest: body }).subscribe({
      next: (result) => {
        if (result.status && result.data) {
          const data = result.data as { items?: CustomerItem[]; totalCount?: number };
          const raw =
            data.items ?? (Array.isArray(result.data) ? (result.data as CustomerItem[]) : []);
          this.customers.set(
            raw.map((c) => ({
              ...c,
              dateOfBirth:
                c.dateOfBirth instanceof TuiDay
                  ? c.dateOfBirth
                  : typeof (c.dateOfBirth as unknown) === 'string' && c.dateOfBirth
                    ? TuiDay.jsonParse(c.dateOfBirth as unknown as string)
                    : null,
            })),
          );
          this.totalCount.set(data.totalCount ?? this.customers().length);
        } else {
          this.customers.set([]);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showAlert('Không thể tải danh sách khách hàng', 'error');
      },
    });
  }

  openCreateDialog(): void {
    tuiDialog(CustomerFormDialogComponent, {
      injector: this.injector,
      label: 'Thêm Khách Hàng',
      size: 'm',
    })({ customer: null } as CustomerFormDialogData).subscribe(() => this.loadCustomers());
  }

  openEditDialog(customer: CustomerItem): void {
    tuiDialog(CustomerFormDialogComponent, {
      injector: this.injector,
      label: 'Chỉnh Sửa Khách Hàng',
      size: 'm',
    })({ customer: customer as CustomerFormItem } as CustomerFormDialogData).subscribe(() =>
      this.loadCustomers(),
    );
  }

  openReassignDialog(customer: CustomerItem): void {
    tuiDialog(CustomerReassignDialogComponent, {
      injector: this.injector,
      label: 'Chuyển Phụ Trách Khách Hàng',
      size: 'm',
    })({
      customerId: customer.customerId,
      customerName: customer.fullName,
    } as CustomerReassignDialogData).subscribe(() => this.loadCustomers());
  }

  private showAlert(message: string, type: 'success' | 'error'): void {
    this.alerts
      .open(message, { appearance: type === 'success' ? 'positive' : 'negative', autoClose: 3000 })
      .subscribe();
  }
}
