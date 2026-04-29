import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TuiButton, TuiDataList, TuiIcon, TuiTextfield } from '@taiga-ui/core';
import { TuiChevron, TuiComboBox, TuiInputDateRange, TuiInputDate } from '@taiga-ui/kit';
import { TuiDay, TuiDayRange, TuiStringHandler, TuiStringMatcher } from '@taiga-ui/cdk';
import { map } from 'rxjs';

import { ReportProvider } from '../../api/api/report.service';
import { StoreProvider } from '../../api/api/store.service';
import { AuthService } from '../../services/auth.service';
import { StoreScopeService } from '../../services/store-scope.service';
import { RoleCode } from '../../models/role.model';

interface StoreItem {
  storeId: string;
  storeName: string;
}

interface DailyCollectionRow {
  businessDate?: string | null;
  storeName?: string | null;
  totalReceipt?: number | null;
  totalPayment?: number | null;
  netAmount?: number | null;
  receiptCount?: number | null;
}

interface OverdueSummaryItem {
  loanContractId?: string | null;
  contractCode?: string | null;
  customerName?: string | null;
  customerNationalId?: string | null;
  overdueDays?: number | null;
  overdueAmount?: number | null;
  latePenaltyAmount?: number | null;
  storeName?: string | null;
}

interface IncomeBreakdownItem {
  category?: string | null;
  categoryName?: string | null;
  amount?: number | null;
  count?: number | null;
}

interface PortfolioSummary {
  totalContracts?: number;
  disbursedCount?: number;
  badDebtCount?: number;
  settledCount?: number;
  overDueContractCount?: number;
  totalActivePortfolio?: number;
  totalRemainingPrincipal?: number;
  totalPrincipalCollected?: number;
  totalInterestCollected?: number;
  totalFeeCollected?: number;
  totalPenaltyCollected?: number;
  totalIncomeCollected?: number;
}

interface MonthlyCashFlowRow {
  month?: number;
  disbursed?: number;
  totalCollected?: number;
  principal?: number;
  interest?: number;
  periodicFee?: number;
  fileFee?: number;
  insurance?: number;
  latePenalty?: number;
  earlyPenalty?: number;
  netIncome?: number;
  newLoanCount?: number;
}

interface MonthlyCashFlow {
  year?: number;
  totalDisbursed?: number;
  totalCollected?: number;
  totalNetIncome?: number;
  months?: MonthlyCashFlowRow[];
}

@Component({
  selector: 'app-reports-store',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiButton,
    TuiDataList,
    TuiIcon,
    TuiChevron,
    TuiComboBox,
    TuiTextfield,
    TuiInputDateRange,
    TuiInputDate,
  ],
  templateUrl: './reports-store.component.html',
})
export class ReportsStoreComponent implements OnInit {
  private readonly reportProvider = inject(ReportProvider);
  private readonly storeProvider = inject(StoreProvider);
  private readonly authService = inject(AuthService);
  private readonly storeScope = inject(StoreScopeService);

  loading = signal(false);
  stores = signal<StoreItem[]>([]);
  selectedStoreId = signal<string | null>(null);
  dailyCollections = signal<DailyCollectionRow[]>([]);
  overdueItems = signal<OverdueSummaryItem[]>([]);
  incomeBreakdown = signal<IncomeBreakdownItem[]>([]);
  totalReceipt = signal(0);
  totalPayment = signal(0);
  portfolioSummary = signal<PortfolioSummary | null>(null);
  monthlyCashFlow = signal<MonthlyCashFlow | null>(null);
  selectedYear = signal(new Date().getFullYear());

  readonly availableYears = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  /** FormControl cho store selector (Admin only) */
  readonly storeControl = new FormControl<string | null>(null);

  readonly storeStringify: TuiStringHandler<string | null> = (id) => {
    if (!id) return '';
    return this.stores().find((s) => s.storeId === id)?.storeName ?? id;
  };

  protected readonly matcherStore: TuiStringMatcher<string | null> = (id, query) => {
    if (!id) return query === '' || 'tất cả chi nhánh'.includes(query.toLowerCase());
    const item = this.stores().find((s) => s.storeId === id);
    if (!item) return false;
    return id === query || item.storeName.toLowerCase().includes(query.toLowerCase());
  };

  readonly today = TuiDay.currentLocal();
  readonly firstOfMonth = new TuiDay(this.today.year, this.today.month, 1);

  /** FormControl cho date range picker — dùng reactive để tránh xung đột với TuiTextfield */
  readonly dateRangeControl = new FormControl<TuiDayRange | null>(
    new TuiDayRange(this.firstOfMonth, this.today),
  );

  isAdmin = computed(() => this.authService.hasAnyRole([RoleCode.ADMIN]));
  currentUser = computed(() => this.authService.currentUser());

  incomeCategories: Record<string, string> = {
    LOAN_COLLECTION: 'Thu khoản cầm cố/thuê lại/cầm đồ',
    FILE_FEE: 'Phí hồ sơ',
    INSURANCE: 'Bảo hiểm',
    LATE_PENALTY: 'Phạt chậm nộp',
    EARLY_SETTLEMENT_PENALTY: 'Phạt tất toán sớm',
    OVERPAYMENT: 'Thu dư',
    OTHER_INCOME: 'Thu khác',
  };

  getCategoryName(code?: string | null): string {
    return this.incomeCategories[code ?? ''] ?? code ?? '-';
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

  ngOnInit(): void {
    if (this.isAdmin()) {
      this.storeProvider.apiStoreGetAllGet().subscribe({
        next: (r) => {
          if (r.status && Array.isArray(r.data)) this.stores.set(r.data as StoreItem[]);
        },
        error: () => {},
      });
      this.storeControl.valueChanges.subscribe((val) => {
        this.selectedStoreId.set(val ?? null);
        this.loadAll();
      });
    }
    this.dateRangeControl.valueChanges.subscribe((range) => {
      if (range) this.loadAll();
    });
    this.loadAll();
  }

  private aggregatePortfolio(results: any[]): any {
    return results.reduce((acc, item) => {
      for (const [key, value] of Object.entries(item ?? {})) {
        if (typeof value === 'number') {
          acc[key] = (acc[key] ?? 0) + value;
        } else if (acc[key] === undefined) {
          acc[key] = value;
        }
      }
      return acc;
    }, {} as any);
  }

  private aggregateDailyCollections(results: DailyCollectionRow[][]): DailyCollectionRow[] {
    const rows = new Map<string, DailyCollectionRow>();
    for (const list of results) {
      for (const row of list ?? []) {
        const key = row.businessDate ?? row.storeName ?? JSON.stringify(row);
        const current = rows.get(key) ?? {
          businessDate: row.businessDate,
          storeName: row.storeName,
        };
        current.totalReceipt = (current.totalReceipt ?? 0) + (row.totalReceipt ?? 0);
        current.totalPayment = (current.totalPayment ?? 0) + (row.totalPayment ?? 0);
        current.netAmount = (current.netAmount ?? 0) + (row.netAmount ?? 0);
        current.receiptCount = (current.receiptCount ?? 0) + (row.receiptCount ?? 0);
        rows.set(key, current);
      }
    }
    return Array.from(rows.values()).sort((a, b) =>
      String(a.businessDate ?? '').localeCompare(String(b.businessDate ?? '')),
    );
  }

  private aggregateOverdue(results: any[][]): OverdueSummaryItem[] {
    return results.flatMap((items) => (Array.isArray(items) ? items : []));
  }

  private aggregateIncomeBreakdown(results: IncomeBreakdownItem[][]): IncomeBreakdownItem[] {
    const rows = new Map<string, IncomeBreakdownItem>();
    for (const list of results) {
      for (const row of list ?? []) {
        const key = row.category ?? row.categoryName ?? JSON.stringify(row);
        const current = rows.get(key) ?? { category: row.category, categoryName: row.categoryName };
        current.amount = (current.amount ?? 0) + (row.amount ?? 0);
        current.count = (current.count ?? 0) + (row.count ?? 0);
        rows.set(key, current);
      }
    }
    return Array.from(rows.values());
  }

  private aggregateMonthlyCashFlow(results: MonthlyCashFlow[]): MonthlyCashFlow {
    const months = new Map<number, MonthlyCashFlowRow>();
    const total: MonthlyCashFlow = {
      year: this.selectedYear(),
      totalDisbursed: 0,
      totalCollected: 0,
      totalNetIncome: 0,
      months: [],
    };

    for (const result of results) {
      if (!result) continue;
      total.totalDisbursed = (total.totalDisbursed ?? 0) + (result.totalDisbursed ?? 0);
      total.totalCollected = (total.totalCollected ?? 0) + (result.totalCollected ?? 0);
      total.totalNetIncome = (total.totalNetIncome ?? 0) + (result.totalNetIncome ?? 0);
      for (const row of result.months ?? []) {
        const month = row.month ?? 0;
        const current = months.get(month) ?? { month };
        current.disbursed = (current.disbursed ?? 0) + (row.disbursed ?? 0);
        current.totalCollected = (current.totalCollected ?? 0) + (row.totalCollected ?? 0);
        current.principal = (current.principal ?? 0) + (row.principal ?? 0);
        current.interest = (current.interest ?? 0) + (row.interest ?? 0);
        current.periodicFee = (current.periodicFee ?? 0) + (row.periodicFee ?? 0);
        current.fileFee = (current.fileFee ?? 0) + (row.fileFee ?? 0);
        current.insurance = (current.insurance ?? 0) + (row.insurance ?? 0);
        current.latePenalty = (current.latePenalty ?? 0) + (row.latePenalty ?? 0);
        current.earlyPenalty = (current.earlyPenalty ?? 0) + (row.earlyPenalty ?? 0);
        current.netIncome = (current.netIncome ?? 0) + (row.netIncome ?? 0);
        current.newLoanCount = (current.newLoanCount ?? 0) + (row.newLoanCount ?? 0);
        months.set(month, current);
      }
    }

    total.months = Array.from(months.values()).sort((a, b) => (a.month ?? 0) - (b.month ?? 0));
    return total;
  }

  onYearChange(year: number): void {
    this.selectedYear.set(year);
    this.loadMonthlyCashFlow();
  }

  loadAll(): void {
    this.loading.set(true);
    const r = this.dateRangeControl.value ?? new TuiDayRange(this.firstOfMonth, this.today);
    const fromDate = r.from.toJSON();
    const toDate = r.to.toJSON();
    const storeIds = this.storeScope.resolveStoreIds(this.selectedStoreId());

    Promise.all([
      new Promise<void>((resolve) => {
        this.storeScope
          .fetchAcrossStores(
            storeIds,
            (storeId) =>
              this.reportProvider
                .apiReportDailyCollectionPost({
                  reportDateRangeRequest: { fromDate, toDate, storeId } as never,
                })
                .pipe(
                  map((r) =>
                    r.status && r.data
                      ? Array.isArray(r.data)
                        ? (r.data as DailyCollectionRow[])
                        : []
                      : [],
                  ),
                ),
            (results) => this.aggregateDailyCollections(results),
          )
          .subscribe({
            next: (rows) => {
              this.dailyCollections.set(rows);
              this.totalReceipt.set(rows.reduce((s, x) => s + (x.totalReceipt ?? 0), 0));
              this.totalPayment.set(rows.reduce((s, x) => s + (x.totalPayment ?? 0), 0));
              resolve();
            },
            error: () => resolve(),
          });
      }),
      new Promise<void>((resolve) => {
        this.storeScope
          .fetchAcrossStores(
            storeIds,
            (storeId) =>
              this.reportProvider
                .apiReportOverdueSummaryPost({
                  reportStoreRequest: { storeId } as never,
                })
                .pipe(
                  map((r) => {
                    if (!r.status || !r.data) return [] as OverdueSummaryItem[];
                    const d = r.data as { riskDetail?: OverdueSummaryItem[] };
                    return Array.isArray(d.riskDetail) ? d.riskDetail : [];
                  }),
                ),
            (results) => this.aggregateOverdue(results),
          )
          .subscribe({
            next: (items) => {
              this.overdueItems.set(items);
              resolve();
            },
            error: () => resolve(),
          });
      }),
      new Promise<void>((resolve) => {
        this.storeScope
          .fetchAcrossStores(
            storeIds,
            (storeId) =>
              this.reportProvider
                .apiReportIncomeBreakdownPost({
                  reportDateRangeRequest: { fromDate, toDate, storeId } as never,
                })
                .pipe(
                  map((r) =>
                    r.status && r.data
                      ? Array.isArray(r.data)
                        ? (r.data as IncomeBreakdownItem[])
                        : []
                      : [],
                  ),
                ),
            (results) => this.aggregateIncomeBreakdown(results),
          )
          .subscribe({
            next: (items) => {
              this.incomeBreakdown.set(items);
              resolve();
            },
            error: () => resolve(),
          });
      }),
      new Promise<void>((resolve) => {
        this.storeScope
          .fetchAcrossStores(
            storeIds,
            (storeId) =>
              this.reportProvider
                .apiReportLoanPortfolioSummaryPost({
                  reportStoreRequest: { storeId } as never,
                })
                .pipe(map((r) => (r.status && r.data ? (r.data as PortfolioSummary) : null))),
            (results) =>
              this.aggregatePortfolio(results.filter((item): item is PortfolioSummary => !!item)),
          )
          .subscribe({
            next: (summary) => {
              this.portfolioSummary.set(summary);
              resolve();
            },
            error: () => resolve(),
          });
      }),
    ]).finally(() => {
      this.loading.set(false);
      this.loadMonthlyCashFlow();
    });
  }

  loadMonthlyCashFlow(): void {
    const storeIds = this.storeScope.resolveStoreIds(this.selectedStoreId());
    this.storeScope
      .fetchAcrossStores(
        storeIds,
        (storeId) =>
          this.reportProvider
            .apiReportMonthlyCashFlowPost({
              monthlyCashFlowRequest: { storeId, year: this.selectedYear() },
            })
            .pipe(map((r) => (r.status && r.data ? (r.data as MonthlyCashFlow) : null))),
        (results) =>
          this.aggregateMonthlyCashFlow(results.filter((item): item is MonthlyCashFlow => !!item)),
      )
      .subscribe({
        next: (r) => this.monthlyCashFlow.set(r),
        error: () => {},
      });
  }
}
