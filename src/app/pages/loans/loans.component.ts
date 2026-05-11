import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  inject,
  signal,
  computed,
  effect,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  timeout,
} from 'rxjs';
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
import { TuiTablePagination } from '@taiga-ui/addon-table';
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

import { LoanContractProvider } from '../../api/api/loan-contract.service';
import { SearchLoanContractRequest } from '../../api/model/search-loan-contract-request';
import { AuthService } from '../../services/auth.service';
import { ReferenceDataService } from '../../services/reference-data.service';
import { RoleCode } from '../../models/role.model';
import {
  LoanContractStatus,
  LOAN_CONTRACT_STATUS_CLASSES,
  LOAN_CONTRACT_STATUS_LABELS,
  ACTIVE_LOAN_STATUSES,
} from '../../models/loan-contract-status.model';
import { LoanCreateDialogComponent, LoanCreateDialogData } from './loan-create-dialog.component';
import { LoanDetailDialogComponent, LoanDetailDialogData } from './loan-detail-dialog.component';
import { LoanCancelDialogComponent, LoanCancelDialogData } from './loan-cancel-dialog.component';
import {
  LoanReassignDialogComponent,
  LoanReassignDialogData,
} from './loan-reassign-dialog.component';
import {
  LoanStatusActionDialogComponent,
  LoanStatusActionDialogData,
  LoanStatusActionDialogResult,
} from './loan-status-action-dialog.component';

interface QuickStatusAction {
  label: string;
  toStatus: string;
  appearance: 'primary' | 'outline' | 'destructive';
  icon: string;
  requiresReason?: boolean;
  hint?: string;
}

interface LoanContractItem {
  loanContractId: string;
  contractNo?: string | null;
  contractType?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerCode?: string | null;
  customerNationalId?: string | null;
  customerPhone?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  principalAmount?: number | null;
  termMonths?: number | null;
  statusCode?: string | null;
  applicationDate?: string | null;
  updatedAt?: string | null;
  disbursedDate?: string | null;
  maturityDate?: string | null;
  interestRateMonthlySnapshot?: number | null;
  qlkvRateMonthlySnapshot?: number | null;
  qltsRateMonthlySnapshot?: number | null;
  fixedMonthlyFeeAmountSnapshot?: number | null;
  fileFeeAmountSnapshot?: number | null;
  insuranceAmountSnapshot?: number | null;
  pawnInterestAmountPerMillionPerDaySnapshot?: number | null;
  pawnFeeAmountPerMillionPerDaySnapshot?: number | null;
  pawnPeriodDaysSnapshot?: number | null;
  earlySettlementPenaltyRateSnapshot?: number | null;
  latePaymentPenaltyRateSnapshot?: number | null;
  latePaymentStartDaySnapshot?: number | null;
  badDebtStartDaySnapshot?: number | null;
  loanProductId?: string | null;
  netDisbursedAmount?: number | null;
  note?: string | null;
  customerSourceId?: string | null;
  customerSourceName?: string | null;
}

@Component({
  selector: 'app-loans',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TuiButton,
    TuiChevron,
    TuiComboBox,
    TuiDataList,
    TuiDataListWrapper,
    TuiGroup,
    TuiHint,
    TuiIcon,
    TuiInputChip,
    TuiInputDateRange,
    TuiMultiSelect,
    TuiSelectLike,
    TuiSkeleton,
    TuiTablePagination,
    TuiTextfield,
  ],
  templateUrl: './loans.component.html',
  styleUrls: ['./loans.component.less'],
})
export class LoansComponent {
  private readonly loanProvider = inject(LoanContractProvider);
  private readonly alertService = inject(TuiAlertService);
  private readonly authService = inject(AuthService);
  private readonly referenceDataService = inject(ReferenceDataService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  searchInput = '';
  private readonly _kw$ = new Subject<string>();
  private regionalAutoLoaded = false;

  loans = signal<LoanContractItem[]>([]);
  loading = signal(false);
  totalCount = signal(0);
  page = signal(0);
  size = signal(20);
  keyword = signal('');
  contractGroup = signal<'ACTIVE' | 'SETTLED' | 'CANCELLED'>('ACTIVE');
  statusFilter = signal<string | null>(null);
  dateFilterType = signal<'ApplicationDate' | 'DisbursedDate'>('ApplicationDate');
  readonly pageSizeItems = [20, 50, 100] as const;

  filterForm = this.fb.group({
    dateRange: [null as TuiDayRange | null],
    statusCodes: [[] as string[]],
    filterStoreIds: [[] as string[]],
    dateFilterType: ['ApplicationDate' as 'ApplicationDate' | 'DisbursedDate'],
  });

  // Signals for tuiInputChip+tuiSelectLike (ngModel bridge — formControlName doesn't work with array)
  readonly selectedStatusCodes = signal<string[]>([]);
  readonly selectedFilterStoreIds = signal<string[]>([]);

  readonly storeList = computed(() => this.referenceDataService.storeList());
  readonly isAdmin = computed(() => this.authService.hasRole(RoleCode.ADMIN));
  readonly isRegionalManager = computed(() => this.authService.hasRole(RoleCode.REGIONAL_MANAGER));
  readonly showTotals = computed(() => !this.authService.hasRole(RoleCode.STAFF));
  readonly canPickStoreFilter = computed(() =>
    this.authService.hasAnyRole([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER]),
  );
  readonly canCreate = computed(() => this.authService.hasPermission('LOAN_CREATE'));
  readonly canCancelLoan = computed(
    () =>
      this.authService.hasAnyRole([
        RoleCode.ADMIN,
        RoleCode.REGIONAL_MANAGER,
        RoleCode.STORE_MANAGER,
      ]) || this.authService.hasPermission('LOAN_CANCEL'),
  );
  readonly canReassignLoan = computed(
    () =>
      this.authService.hasAnyRole([
        RoleCode.ADMIN,
        RoleCode.REGIONAL_MANAGER,
        RoleCode.STORE_MANAGER,
      ]) || this.authService.hasPermission('LOAN_ASSIGN'),
  );

  overdueMap = signal<
    Map<
      string,
      { overdueCount: number; maxDaysOverdue: number; riskLevel: string; totalUnpaid: number }
    >
  >(new Map());

  readonly totalPrincipal = computed(() =>
    this.filteredLoans().reduce((s, l) => s + (Number(l.principalAmount) || 0), 0),
  );

  readonly totalInsurance = computed(() =>
    this.filteredLoans().reduce((s, l) => s + (Number(l.insuranceAmountSnapshot) || 0), 0),
  );

  readonly totalFileFee = computed(() =>
    this.filteredLoans().reduce((s, l) => s + (Number(l.fileFeeAmountSnapshot) || 0), 0),
  );

  readonly totalNetDisbursed = computed(() =>
    this.filteredLoans().reduce((s, l) => s + (Number(l.netDisbursedAmount) || 0), 0),
  );

  private readonly statusSortOrder: Record<string, number> = {
    [LoanContractStatus.PENDING_APPROVAL]: 10,
    [LoanContractStatus.PENDING_DISBURSEMENT]: 20,
    [LoanContractStatus.DISBURSED]: 30,
    [LoanContractStatus.BAD_DEBT]: 40,
    [LoanContractStatus.SETTLED]: 50,
    [LoanContractStatus.CLOSED]: 60,
    [LoanContractStatus.BAD_DEBT_CLOSED]: 70,
    [LoanContractStatus.CANCELLED]: 80,
    [LoanContractStatus.DRAFT]: 90,
  };

  private statusRank(code?: string | null): number {
    return this.statusSortOrder[code ?? ''] ?? 999;
  }

  readonly filteredLoans = computed(() => {
    const list = this.loans();
    const group = this.contractGroup();
    const statusCodes = this.selectedStatusCodes();
    const storeIds = this.selectedFilterStoreIds();

    // UI multi-select is OR-within-field (statusCodes / storeIds), AND across fields.
    const filtered = list.filter((loan) => {
      const status = loan.statusCode as LoanContractStatus;
      const isActive = status ? ACTIVE_LOAN_STATUSES.includes(status) : false;
      const storeId = loan.storeId ?? '';

      // 1. Group Filter
      if (group === 'ACTIVE' && !isActive) return false;
      if (group === 'SETTLED') {
        const isSettledGroup =
          status === LoanContractStatus.SETTLED ||
          status === LoanContractStatus.CLOSED ||
          status === LoanContractStatus.BAD_DEBT_CLOSED;
        if (!isSettledGroup) return false;
      }
      if (group === 'CANCELLED' && status !== LoanContractStatus.CANCELLED) return false;

      // 2. Multi-select Status Filter (AND with group, OR within selected list)
      if (statusCodes.length > 0 && (!status || !statusCodes.includes(status))) return false;

      // 3. Store Filter
      if (this.canPickStoreFilter() && storeIds.length > 0 && !storeIds.includes(storeId))
        return false;

      return true;
    });

    // Business order: Chờ duyệt -> Chờ GN -> Đang thu -> Nợ xấu -> ...; within same status newest first.
    return filtered.slice().sort((a, b) => {
      const d = this.statusRank(a.statusCode) - this.statusRank(b.statusCode);
      if (d !== 0) return d;
      const at = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.applicationDate ? new Date(a.applicationDate).getTime() : 0);
      const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.applicationDate ? new Date(b.applicationDate).getTime() : 0);
      return bt - at;
    });
  });

  readonly filteredTotal = computed(() => this.filteredLoans().length);

  readonly pagedLoans = computed(() => {
    const list = this.filteredLoans();
    const page = this.page();
    const size = this.size();
    const start = page * size;
    return list.slice(start, start + size);
  });

  readonly allStatusOptions = [
    { label: 'Nháp', value: LoanContractStatus.DRAFT },
    { label: 'Chờ duyệt', value: LoanContractStatus.PENDING_APPROVAL },
    { label: 'Chờ GN', value: LoanContractStatus.PENDING_DISBURSEMENT },
    { label: 'Đang thu', value: LoanContractStatus.DISBURSED },
    { label: 'Nợ xấu', value: LoanContractStatus.BAD_DEBT },
    { label: 'Tất toán', value: LoanContractStatus.SETTLED },
    { label: 'Đã đóng', value: LoanContractStatus.CLOSED },
    { label: 'Đã đóng (nợ xấu)', value: LoanContractStatus.BAD_DEBT_CLOSED },
    { label: 'Đã hủy', value: LoanContractStatus.CANCELLED },
  ];

  readonly statusOptions = computed(() => {
    const group = this.contractGroup();
    return this.allStatusOptions.filter((opt) => {
      const status = opt.value;
      if (group === 'ACTIVE') return ACTIVE_LOAN_STATUSES.includes(status);
      if (group === 'SETTLED')
        return (
          status === LoanContractStatus.SETTLED ||
          status === LoanContractStatus.CLOSED ||
          status === LoanContractStatus.BAD_DEBT_CLOSED
        );
      if (group === 'CANCELLED') return status === LoanContractStatus.CANCELLED;
      return false;
    });
  });

  // Flat arrays for TuiDataListWrapper [items]
  readonly statusValues = computed(() => this.statusOptions().map((o) => o.value));
  readonly storeIds = computed(() =>
    this.storeList()
      .map((s) => s.storeId)
      .filter((id): id is string => !!id),
  );

  /** Store ids for filter UI (Admin: all stores; Regional: only managed stores). */
  readonly storeIdsForFilter = computed(() => {
    const ids = this.storeIds();
    if (!this.isRegionalManager()) return ids;

    const allowed = new Set(this.authService.currentUser()?.storeIds ?? []);
    // Fallback: if backend doesn't provide managed store ids yet, show all stores so user can still select.
    if (allowed.size === 0) return ids;
    return ids.filter((id) => allowed.has(id));
  });

  readonly statusStringify: TuiStringHandler<string> = (value) =>
    this.statusOptions().find((item) => item.value === value)?.label ?? value;

  readonly matcherStatus: TuiStringMatcher<string> = (value, query) => {
    const label = this.statusOptions().find((item) => item.value === value)?.label ?? value;
    return String(value) === query || label.toLowerCase().includes(query.toLowerCase());
  };

  readonly LoanContractStatus = LoanContractStatus;

  readonly storeStringify: TuiStringHandler<string> = (id) =>
    this.storeList().find((s) => s.storeId === id)?.storeName ?? id;

  readonly matcherStore: TuiStringMatcher<string> = (id, query) => {
    const store = this.storeList().find((s) => s.storeId === id);
    if (!store) return false;
    return id === query || store.storeName.toLowerCase().includes(query.toLowerCase());
  };

  readonly dateTypeOptions = [
    { label: 'Ngày tạo', value: 'ApplicationDate' },
    { label: 'Ngày giải ngân', value: 'DisbursedDate' },
  ];

  readonly dateTypeStringify: TuiStringHandler<string> = (val) =>
    this.dateTypeOptions.find((o) => o.value === val)?.label ?? val;

  readonly matcherDateType: TuiStringMatcher<string> = (val, query) => {
    const label = this.dateTypeOptions.find((o) => o.value === val)?.label ?? val;
    return String(val) === query || label.toLowerCase().includes(query.toLowerCase());
  };

  readonly maskNationalId = (id?: string | null) => {
    if (!id) return '';
    const last4 = id.slice(-4);
    return `${'*'.repeat(Math.max(0, id.length - 4))}${last4}`;
  };

  private normalizeContractType(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toUpperCase();
    return normalized || null;
  }

  private deriveContractType(item: any): string | null {
    const pawnSignals = [
      item?.pawnInterestAmountPerMillionPerDaySnapshot,
      item?.pawnFeeAmountPerMillionPerDaySnapshot,
      item?.pawnPeriodDaysSnapshot,
    ];
    if (pawnSignals.some((v) => typeof v === 'number' && v > 0)) {
      return 'PAWN';
    }

    const installmentSignals = [
      item?.interestRateMonthlySnapshot,
      item?.qlkvRateMonthlySnapshot,
      item?.qltsRateMonthlySnapshot,
      item?.fixedMonthlyFeeAmountSnapshot,
    ];
    if (installmentSignals.some((v) => typeof v === 'number' && v > 0)) {
      return 'INSTALLMENT';
    }

    return null;
  }

  private normalizeLoanContractItem(item: any): LoanContractItem {
    if (!item || typeof item !== 'object') {
      return item as LoanContractItem;
    }

    const contractType =
      this.normalizeContractType(item.contractType ?? item.ContractType) ??
      this.deriveContractType(item);

    return {
      ...item,
      contractType,
    } as LoanContractItem;
  }

  constructor() {
    this._kw$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => this.onKeywordChange(v));

    // Sync multi-select signals → form + reload
    effect(() => {
      const statusCodes = this.selectedStatusCodes();
      const filterStoreIds = this.selectedFilterStoreIds();
      untracked(() => {
        this.filterForm.patchValue({ statusCodes, filterStoreIds }, { emitEvent: false });
        this.page.set(0);
      });
    });

    this.filterForm.valueChanges
      .pipe(debounceTime(100), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(0);
        this.loadLoans();
      });

    // Store list loads async; regional manager needs it to build the storeId query list.
    effect(() => {
      if (!this.isRegionalManager()) return;
      const ids = this.storeIdsForFilter();
      if (ids.length === 0) return;
      if (this.regionalAutoLoaded) return;
      untracked(() => {
        this.regionalAutoLoaded = true;
        this.loadLoans();
      });
    });

    this.loadLoans();
    this.loadOverdueInfo();
  }

  onDateFilterTypeChange(type: 'ApplicationDate' | 'DisbursedDate'): void {
    if (this.filterForm.get('dateFilterType')?.value === type) return;
    this.filterForm.patchValue({ dateFilterType: type });
    this.page.set(0);
    this.loadLoans();
  }

  setContractGroup(group: 'ACTIVE' | 'SETTLED' | 'CANCELLED'): void {
    if (this.contractGroup() === group) return;
    this.contractGroup.set(group);
    this.selectedStatusCodes.set([]); // Clear sub-filters when group changes
    this.page.set(0);
  }

  clearFilters(): void {
    this.selectedStatusCodes.set([]);
    this.selectedFilterStoreIds.set([]);
    this.filterForm.patchValue(
      { dateRange: null, statusCodes: [], filterStoreIds: [] },
      { emitEvent: false },
    );
    this.page.set(0);
    this.loadLoans();
  }

  get hasActiveFilters(): boolean {
    const v = this.filterForm.value;
    return !!(
      v.dateRange ||
      this.selectedStatusCodes().length > 0 ||
      this.selectedFilterStoreIds().length > 0
    );
  }

  onSearchInputChange(value: string): void {
    this.searchInput = value;
    this._kw$.next(value);
  }

  onKeywordChange(value: string): void {
    this.keyword.set(value);
    this.page.set(0);
    this.loadLoans();
  }

  onPaginationChange(event: { page: number; size: number }): void {
    const prevSize = this.size();
    if (event.size !== prevSize) {
      this.size.set(event.size);
      this.page.set(0);
      return;
    }
    this.page.set(event.page);
  }

  loadLoans(): void {
    this.loading.set(true);
    const fv = this.filterForm.value;
    const range = fv.dateRange as TuiDayRange | null;

    const pageSize = 200;
    const requestTimeoutMs = 20000;

    const baseReq: SearchLoanContractRequest = {
      keyword: this.keyword() || null,
      pageIndex: 1,
      pageSize,
      sortBy: 'UpdatedAt',
      sortDesc: true,
      // Status/store are filtered client-side (supports multi-select).
      statusCode: null,
      fromDate: range?.from?.toJSON() ?? null,
      toDate: range?.to?.toJSON() ?? null,
      dateFilterType: fv.dateFilterType || 'ApplicationDate',
      filterStoreIds: null,
    };

    const fetchPage = (pageIndex: number, filterStoreIds: string[] | null) =>
      this.loanProvider
        .apiLoanContractSearchPost({
          searchLoanContractRequest: { ...baseReq, pageIndex, filterStoreIds },
        })
        .pipe(
          timeout({ first: requestTimeoutMs }),
          catchError(() => of({ status: false, data: null } as any)),
        );

    fetchPage(1, null).subscribe({
      next: (result) => {
        if (result.status && result.data) {
          const data = result.data as { items?: LoanContractItem[]; totalCount?: number };
          const rawFirstItems =
            data.items ?? (Array.isArray(result.data) ? (result.data as LoanContractItem[]) : []);
          const firstItems = rawFirstItems.map((item) => this.normalizeLoanContractItem(item));
          const total = typeof data.totalCount === 'number' ? data.totalCount : null;
          const actualPageSize =
            typeof (data as any).pageSize === 'number' ? (data as any).pageSize : pageSize;

          if (!total || total <= firstItems.length) {
            // Backend returns full list (no totalCount) or already returned everything.
            this.loans.set(firstItems);
            this.totalCount.set(firstItems.length);
            this.page.set(0);
            this.loading.set(false);
            return;
          }

          const pageCount = Math.ceil(total / actualPageSize);
          const calls = Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) =>
            fetchPage(i + 2, null),
          );

          if (calls.length === 0) {
            this.loans.set(firstItems);
            this.totalCount.set(total);
            this.page.set(0);
            this.loading.set(false);
            return;
          }

          forkJoin(calls).subscribe({
            next: (rest) => {
              const merged: LoanContractItem[] = [...firstItems];
              for (const r of rest as any[]) {
                if (!r?.status || !r.data) continue;
                const rd = r.data as { items?: LoanContractItem[] };
                const items =
                  rd.items ?? (Array.isArray(r.data) ? (r.data as LoanContractItem[]) : []);
                merged.push(...items.map((item) => this.normalizeLoanContractItem(item)));
              }
              this.loans.set(merged);
              this.totalCount.set(merged.length);
              this.page.set(0);
              this.loading.set(false);
            },
            error: () => {
              // Fallback: at least show the first chunk.
              this.loans.set(firstItems);
              this.totalCount.set(firstItems.length);
              this.page.set(0);
              this.loading.set(false);
              this.alertService
                .open(
                  'Kh\\u00f4ng th\\u1ec3 t\\u1ea3i \\u0111\\u1ee7 t\\u1ea5t c\\u1ea3 k\\u1ebft qu\\u1ea3 \\u0111\\u1ec3 t\\u1ed5ng h\\u1ee3p.',
                  {
                    appearance: 'negative',
                  },
                )
                .subscribe();
            },
          });
        } else {
          this.loans.set([]);
          this.totalCount.set(0);
          this.page.set(0);
          this.loading.set(false);
        }
      },
      error: () => {
        this.loading.set(false);
        this.alertService
          .open('L\\u1ed7i k\\u1ebft n\\u1ed1i.', { appearance: 'negative' })
          .subscribe();
      },
    });
  }

  private loadOverdueInfo(): void {
    this.loanProvider
      .apiLoanContractGetOverdueListPost({ getOverdueListRequest: { minDaysOverdue: 1 } })
      .subscribe({
        next: (r) => {
          if (!r.status || !Array.isArray(r.data)) return;
          const map = new Map<
            string,
            { overdueCount: number; maxDaysOverdue: number; riskLevel: string; totalUnpaid: number }
          >();
          for (const row of r.data as any[]) {
            const id = row.loanContractId as string;
            if (!id) continue;
            const days: number = row.daysOverdue ?? 0;
            const normalizeRisk = (rv: string): string => {
              if (rv === 'POTENTIAL_BAD_DEBT') return 'HIGH';
              if (rv === 'LATE') return 'MEDIUM';
              return 'LOW';
            };
            const risk: string = normalizeRisk(row.riskLevel ?? 'WARNING');
            const unpaid: number = row.totalUnpaid ?? 0;
            const existing = map.get(id);
            if (!existing) {
              map.set(id, {
                overdueCount: 1,
                maxDaysOverdue: days,
                riskLevel: risk,
                totalUnpaid: unpaid,
              });
            } else {
              const riskRank: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
              const highestRisk =
                (riskRank[risk] ?? 0) > (riskRank[existing.riskLevel] ?? 0)
                  ? risk
                  : existing.riskLevel;
              map.set(id, {
                overdueCount: existing.overdueCount + 1,
                maxDaysOverdue: Math.max(existing.maxDaysOverdue, days),
                riskLevel: highestRisk,
                totalUnpaid: existing.totalUnpaid + unpaid,
              });
            }
          }
          this.overdueMap.set(map);
        },
        error: () => { },
      });
  }

  getOverdueInfo(loanContractId: string) {
    return this.overdueMap().get(loanContractId) ?? null;
  }

  getQuickStatusActions(loan: LoanContractItem): QuickStatusAction[] {
    const status = loan.statusCode;
    const canManage = this.authService.hasAnyRole([
      RoleCode.ADMIN,
      RoleCode.REGIONAL_MANAGER,
      RoleCode.STORE_MANAGER,
    ]);
    const canApprove = canManage || this.authService.hasPermission('LOAN_APPROVE');
    const canDisburse = canManage || this.authService.hasPermission('LOAN_DISBURSE');

    if (status === LoanContractStatus.DRAFT) {
      return [
        {
          label: 'Nộp duyệt',
          toStatus: LoanContractStatus.PENDING_APPROVAL,
          appearance: 'primary',
          icon: '@tui.send',
        },
      ];
    }
    if (status === LoanContractStatus.PENDING_APPROVAL && canApprove) {
      return [
        {
          label: 'Duyệt',
          toStatus: LoanContractStatus.PENDING_DISBURSEMENT,
          appearance: 'primary',
          icon: '@tui.check',
        },
        {
          label: 'Trả lại',
          toStatus: LoanContractStatus.DRAFT,
          appearance: 'outline',
          icon: '@tui.undo-2',
          requiresReason: true,
          hint: 'Nhập lý do để nhân viên chỉnh sửa.',
        },
      ];
    }
    if (status === LoanContractStatus.PENDING_DISBURSEMENT && canDisburse) {
      return [
        {
          label: 'Giải ngân',
          toStatus: LoanContractStatus.DISBURSED,
          appearance: 'primary',
          icon: '@tui.banknote',
        },
      ];
    }
    if (status === LoanContractStatus.DISBURSED && canManage) {
      return [
        {
          label: 'Chuyển nợ xấu',
          toStatus: LoanContractStatus.BAD_DEBT,
          appearance: 'outline',
          icon: '@tui.triangle-alert',
          requiresReason: true,
          hint: 'Ghi rõ lý do chuyển nợ xấu.',
        },
      ];
    }
    return [];
  }

  openStatusActionFromTable(loan: LoanContractItem, action: QuickStatusAction, event: Event): void {
    event.stopPropagation();
    const data: LoanStatusActionDialogData = {
      actionLabel: action.label,
      contractNo: loan.contractNo,
      requiresReason: !!action.requiresReason,
      hint: action.hint,
      isNegative:
        action.toStatus === LoanContractStatus.DRAFT ||
        action.toStatus === LoanContractStatus.CANCELLED,
    };

    tuiDialog(LoanStatusActionDialogComponent, {
      injector: this.injector,
      label: 'Xác nhận thay đổi trạng thái',
      size: 's',
    })(data).subscribe((result?: LoanStatusActionDialogResult) => {
      if (!result) return;
      const reason = (result.reason ?? '').trim();
      if (action.requiresReason && !reason) return;

      this.loanProvider
        .apiLoanContractChangeStatusPost({
          changeStatusRequest: {
            loanContractId: loan.loanContractId,
            toStatus: action.toStatus,
            reason: reason || null,
          },
        })
        .subscribe({
          next: (r: any) => {
            if (r.status) {
              const label =
                LOAN_CONTRACT_STATUS_LABELS[action.toStatus as LoanContractStatus] ??
                action.toStatus;
              this.alertService
                .open(`Đã chuyển sang "${label}".`, { appearance: 'positive' })
                .subscribe();
              this.loadLoans();
            } else {
              this.alertService
                .open(r.message ?? 'Không thể cập nhật trạng thái.', { appearance: 'negative' })
                .subscribe();
            }
          },
          error: (err: any) => {
            this.alertService
              .open(err?.error?.message ?? 'Lỗi kết nối.', { appearance: 'negative' })
              .subscribe();
          },
        });
    });
  }

  openCreateDialog(): void {
    tuiDialog(LoanCreateDialogComponent, {
      injector: this.injector,
      label: 'Tạo hợp đồng',
      size: 'l',
      appearance: 'dialog-wide',
    })(undefined).subscribe(() => this.loadLoans());
  }

  openDetailDialog(loan: LoanContractItem): void {
    const detail = this.normalizeLoanContractItem(loan) as LoanDetailDialogData &
      LoanCreateDialogData;

    if (loan.statusCode === LoanContractStatus.DRAFT) {
      tuiDialog(LoanCreateDialogComponent, {
        injector: this.injector,
        label: 'Chỉnh Sửa Hợp Đồng Nháp',
        size: 'l',
        appearance: 'dialog-wide',
      })(detail).subscribe(() => this.loadLoans());
      return;
    }

    tuiDialog(LoanDetailDialogComponent, {
      injector: this.injector,
      label: 'Chi Tiết Hợp Đồng',
      size: 'l',
      appearance: 'dialog-wide',
    })(detail).subscribe(() => this.loadLoans());
  }

  private refreshLoanRow(loanContractId: string): void {
    this.loanProvider.apiLoanContractGetByIdPost({ body: loanContractId }).subscribe({
      next: (r) => {
        if (!r.status || !r.data) return;
        const updated = this.normalizeLoanContractItem(r.data);
        this.loans.update((list) =>
          list.map((item) =>
            item.loanContractId === loanContractId ? { ...item, ...updated } : item,
          ),
        );
        const terminalStatuses: string[] = [
          LoanContractStatus.SETTLED,
          LoanContractStatus.CLOSED,
          LoanContractStatus.BAD_DEBT_CLOSED,
          LoanContractStatus.CANCELLED,
        ];
        if (terminalStatuses.includes(updated.statusCode ?? '')) {
          this.overdueMap.update((map) => {
            const next = new Map(map);
            next.delete(loanContractId);
            return next;
          });
        }
      },
      error: () => { },
    });
  }

  openCancelDialog(loan: LoanContractItem, event: Event): void {
    event.stopPropagation();
    tuiDialog(LoanCancelDialogComponent, {
      injector: this.injector,
      label: 'Hủy Hợp Đồng',
      size: 's',
    })({
      loanContractId: loan.loanContractId,
      contractNo: loan.contractNo,
    } as LoanCancelDialogData).subscribe(() => this.loadLoans());
  }

  openReassignDialog(loan: LoanContractItem, event: Event): void {
    event.stopPropagation();
    tuiDialog(LoanReassignDialogComponent, {
      injector: this.injector,
      label: 'Chuyển Phụ Trách Hợp Đồng',
      size: 'm',
    })({
      loanContractId: loan.loanContractId,
      contractNo: loan.contractNo,
      customerName: loan.customerName,
    } as LoanReassignDialogData).subscribe(() => this.loadLoans());
  }

  openStatusActionFromCard(loan: LoanContractItem, action: QuickStatusAction): void {
    this.openStatusActionFromTable(loan, action, new MouseEvent('click'));
  }

  getStatusBorderColor(code?: string | null): string {
    switch (code) {
      case LoanContractStatus.DRAFT:
        return '#9ca3af';
      case LoanContractStatus.PENDING_APPROVAL:
        return '#f59e0b';
      case LoanContractStatus.PENDING_DISBURSEMENT:
        return '#3b82f6';
      case LoanContractStatus.DISBURSED:
        return '#16a34a';
      case LoanContractStatus.SETTLED:
        return '#6b7280';
      case LoanContractStatus.BAD_DEBT:
        return '#ef4444';
      case LoanContractStatus.BAD_DEBT_CLOSED:
        return '#9b1c1c';
      case LoanContractStatus.CANCELLED:
        return '#d1d5db';
      default:
        return '#e5e7eb';
    }
  }

  getStatusLabel(code?: string | null): string {
    if (!code) return '-';
    return LOAN_CONTRACT_STATUS_LABELS[code as LoanContractStatus] ?? code;
  }

  getContractTypeLabel(value?: string | null): string {
    const type = this.normalizeContractType(value);
    if (!type) return '-';
    if (type === 'PAWN') return 'Cầm đồ';
    if (type === 'INSTALLMENT') return 'Cầm cố/Thuê';
    return type;
  }

  getContractTypeClass(value?: string | null): string {
    const type = this.normalizeContractType(value);
    if (type === 'PAWN') return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
    if (type === 'INSTALLMENT') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    return 'bg-gray-100 text-gray-600 border border-gray-200';
  }

  getStatusClass(code?: string | null): string {
    if (!code) return 'bg-gray-100 text-gray-500 border border-gray-200';
    return (
      LOAN_CONTRACT_STATUS_CLASSES[code as LoanContractStatus] ??
      'bg-gray-100 text-gray-500 border border-gray-200'
    );
  }

  formatCurrency(val?: number | null): string {
    if (val == null) return '-';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat('vi-VN').format(d);
  }
}
