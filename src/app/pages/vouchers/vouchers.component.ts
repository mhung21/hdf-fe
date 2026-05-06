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
import { FormsModule } from '@angular/forms';
import { catchError, map, of } from 'rxjs';
import {
  TuiAlertService,
  TuiButton,
  TuiDataList,
  TuiGroup,
  TuiHint,
  TuiIcon,
  TuiSelectLike,
  TuiTextfield,
  tuiDialog,
} from '@taiga-ui/core';
import {
  TuiChevron,
  TuiComboBox,
  TuiDataListWrapper,
  TuiHideSelectedPipe,
  TuiInputChip,
  TuiInputDateRange,
  TuiMultiSelect,
  TuiSkeleton,
} from '@taiga-ui/kit';
import { TuiDay, TuiDayRange, TuiStringHandler, TuiStringMatcher } from '@taiga-ui/cdk';
import { format } from 'date-fns';

import { CashVoucherProvider } from '../../api/api/cash-voucher.service';
import { SearchCashVoucherRequest } from '../../api/model/search-cash-voucher-request';
import { ReportProvider } from '../../api/api/report.service';
import { AuthService } from '../../services/auth.service';
import { ReferenceDataService } from '../../services/reference-data.service';
import { StoreScopeService } from '../../services/store-scope.service';
import { RoleCode } from '../../models/role.model';
import {
  DataTableComponent,
  ColumnDef,
} from '../../shared/components/data-table/data-table.component';
import { VoucherCreateDialogComponent } from './voucher-create-dialog.component';
import { VoucherViewDialogComponent, VoucherViewData } from './voucher-view-dialog.component';

interface VoucherItem {
  voucherId: string;
  voucherNo?: string | null;
  voucherType?: string | null;
  reasonCode?: string | null;
  contractNo?: string | null;
  reasonName?: string | null;
  businessDate?: string | null;
  voucherDatetime?: string | null;
  customerName?: string | null;
  customerId?: string | null;
  loanContractId?: string | null;
  contractCode?: string | null;
  payerReceiverName?: string | null;
  amount?: number | null;
  description?: string | null;
  storeName?: string | null;
  storeId?: string | null;
  isAdjustment?: boolean | null;
  paymentMethod?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
}

interface DailyCollectionRow {
  totalReceipt?: number | null;
  totalPayment?: number | null;
}

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  RECEIPT: 'Phiếu Thu',
  PAYMENT: 'Phiếu Chi',
};

const REASON_LABELS: Record<string, string> = {
  LOAN_COLLECTION: 'Thu khoản cầm cố/thuê lại/cầm đồ',
  LOAN_DISBURSEMENT: 'Giải ngân',
  FILE_FEE: 'Phí hồ sơ',
  INSURANCE: 'Bảo hiểm',
  LATE_PENALTY: 'Phạt chậm nộp',
  EARLY_SETTLEMENT_PENALTY: 'Phạt tất toán sớm',
  OVERPAYMENT: 'Thu dư',
  OTHER_INCOME: 'Thu khác',
  OTHER_EXPENSE: 'Chi khác',
  EARLY_SETTLEMENT: 'Tất toán sớm',
};

@Component({
  selector: 'app-vouchers',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TuiButton,
    TuiChevron,
    TuiComboBox,
    TuiDataList,
    TuiHint,
    TuiIcon,
    TuiTextfield,
    TuiInputChip,
    TuiSelectLike,
    TuiDataListWrapper,
    DataTableComponent,
    TuiMultiSelect,
  ],
  templateUrl: './vouchers.component.html',
})
export class VouchersComponent {
  private readonly voucherProvider = inject(CashVoucherProvider);
  private readonly reportProvider = inject(ReportProvider);
  private readonly authService = inject(AuthService);
  private readonly referenceDataService = inject(ReferenceDataService);
  private readonly storeScope = inject(StoreScopeService);
  private readonly injector = inject(Injector);

  readonly today = new Date();
  readonly todayStr = format(this.today, 'yyyy-MM-dd');

  vouchers = signal<VoucherItem[]>([]);
  loading = signal(false);
  totalCount = signal(0);
  page = 0;
  size = 10;
  keyword = signal('');
  filterType = signal<string | null>(null);
  readonly selectedStoreIds = signal<string[]>([]);

  readonly storeList = computed(() => this.referenceDataService.storeList());
  readonly isRegionalManager = computed(() => this.authService.hasRole(RoleCode.REGIONAL_MANAGER));
  readonly isStaff = computed(() => this.authService.hasRole(RoleCode.STAFF));
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

  readonly storeStringify: TuiStringHandler<string> = (id) =>
    this.storeList().find((s) => s.storeId === id)?.storeName ?? id;

  readonly matcherStore: TuiStringMatcher<string> = (id, query) => {
    const store = this.storeList().find((s) => s.storeId === id);
    if (!store) return false;
    return id === query || store.storeName.toLowerCase().includes(query.toLowerCase());
  };

  readonly tableColumns: ColumnDef[] = [
    { key: 'code', label: 'Mã phiếu' },
    { key: 'type', label: 'Loại', align: 'center' },
    { key: 'reason', label: 'Lý do' },
    { key: 'payer', label: 'Người nộp/nhận' },
    { key: 'amount', label: 'Số tiền', align: 'right' },
    { key: 'date', label: 'Ngày' },
    { key: 'contract', label: 'Hợp đồng' },
  ];

  canCreate = computed(() =>
    this.authService.hasAnyRole([
      RoleCode.ADMIN,
      RoleCode.REGIONAL_MANAGER,
      RoleCode.STORE_MANAGER,
      RoleCode.STAFF,
    ]),
  );

  asVoucher(item: unknown): VoucherItem {
    return item as VoucherItem;
  }
  getTypeLabel(v?: string | null): string {
    return VOUCHER_TYPE_LABELS[v ?? ''] ?? v ?? '-';
  }
  getReasonLabel(v?: string | null): string {
    return REASON_LABELS[v ?? ''] ?? v ?? '-';
  }

  getTypeClass(v?: string | null): string {
    return v === 'RECEIPT'
      ? 'bg-green-50 text-green-700 border border-green-200'
      : 'bg-red-50 text-red-700 border border-red-200';
  }

  readonly totalReceiptAmount = computed(() =>
    this.vouchers()
      .filter((v) => v.voucherType === 'RECEIPT')
      .reduce((s, v) => s + (v.amount ?? 0), 0),
  );

  readonly totalPaymentAmount = computed(() =>
    this.vouchers()
      .filter((v) => v.voucherType === 'PAYMENT')
      .reduce((s, v) => s + (v.amount ?? 0), 0),
  );

  readonly todayReceiptAmount = signal(0);
  readonly todayPaymentAmount = signal(0);

  constructor() {
    // Regional manager needs an explicit store selection to query data.
    // Regional manager needs an explicit store selection to query data.
    effect(() => {
      if (!this.canPickStoreFilter()) return;
      if (!this.isRegionalManager()) return;

      const ids = this.storeIdsForFilter();
      const cur = this.selectedStoreIds();
      if (cur.length === 0 && ids.length > 0) {
        untracked(() => this.selectedStoreIds.set([ids[0]]));
      }
    });

    // Initial load + reload on store change (Admin/Regional).
    effect(() => {
      if (!this.canPickStoreFilter()) {
        untracked(() => this.loadVouchers());
        return;
      }

      const storeIds = this.selectedStoreIds();
      if (this.isRegionalManager() && storeIds.length === 0) return;

      untracked(() => {
        this.page = 0;
        this.loadVouchers();
      });
    });
  }

  onKeywordChange(v: string): void {
    this.keyword.set(v);
    this.page = 0;
    this.loadVouchers();
  }
  onPaginationChange(e: { page: number; size: number }): void {
    this.page = e.page;
    this.size = e.size;
    this.loadVouchers();
  }
  setFilter(type: string | null): void {
    this.filterType.set(type);
    this.page = 0;
    this.loadVouchers();
  }

  loadVouchers(): void {
    this.loading.set(true);
    this.loadTodayTotals();
    const storeIds = this.canPickStoreFilter() ? this.selectedStoreIds() : [];
    const req: SearchCashVoucherRequest = {
      keyword: this.keyword() || null,
      pageIndex: this.page + 1,
      pageSize: this.size,
      sortBy: 'BusinessDate',
      sortDesc: true,
    };
    // Backend naming differs across endpoints; send both keys to be safe.
    const body = storeIds.length > 0 ? { ...req, storeIds, filterStoreIds: storeIds } : req;
    this.voucherProvider.apiCashVoucherSearchPost({ searchCashVoucherRequest: body }).subscribe({
      next: (r) => {
        if (r.status && r.data) {
          const data = r.data as { items?: VoucherItem[]; totalCount?: number };
          const items = data.items ?? (Array.isArray(r.data) ? (r.data as VoucherItem[]) : []);
          const type = this.filterType();
          this.vouchers.set(type ? items.filter((v) => v.voucherType === type) : items);
          this.totalCount.set(data.totalCount ?? this.vouchers().length);
        } else {
          this.vouchers.set([]);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadTodayTotals(): void {
    const storeIds = this.canPickStoreFilter()
      ? this.selectedStoreIds()
      : this.storeScope.resolveStoreIds(null);
    this.storeScope
      .fetchAcrossStores(
        storeIds,
        (storeId) =>
          this.reportProvider
            .apiReportDailyCollectionPost({
              reportDateRangeRequest: {
                fromDate: this.todayStr,
                toDate: this.todayStr,
                storeId,
              } as never,
            })
            .pipe(
              map((r) =>
                r.status && r.data
                  ? Array.isArray(r.data)
                    ? (r.data as DailyCollectionRow[])
                    : []
                  : ([] as DailyCollectionRow[]),
              ),
              catchError(() => of([] as DailyCollectionRow[])),
            ),
        (results) => results.flat() as DailyCollectionRow[],
      )
      .subscribe({
        next: (rows: DailyCollectionRow[]) => {
          this.todayReceiptAmount.set(
            rows.reduce((sum, row) => sum + (Number(row?.totalReceipt ?? 0) || 0), 0),
          );
          this.todayPaymentAmount.set(
            rows.reduce((sum, row) => sum + (Number(row?.totalPayment ?? 0) || 0), 0),
          );
        },
        error: () => {
          this.todayReceiptAmount.set(0);
          this.todayPaymentAmount.set(0);
        },
      });
  }

  formatCurrency(v?: number | null): string {
    return new Intl.NumberFormat('vi-VN').format(v ?? 0) + ' đ';
  }
  formatDate(iso?: string | null): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat('vi-VN').format(d);
  }

  openCreateDialog(): void {
    tuiDialog(VoucherCreateDialogComponent, {
      injector: this.injector,
      label: 'Tạo Phiếu Thu / Chi',
      size: 'l',
    })(undefined as any).subscribe(() => this.loadVouchers());
  }

  openViewDialog(v: VoucherItem): void {
    tuiDialog(VoucherViewDialogComponent, {
      injector: this.injector,
      label: 'Chi Tiết Phiếu',
      size: 'm',
    })(v as VoucherViewData).subscribe();
  }
}
