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
import { TuiChevron, TuiSelect, TuiSkeleton } from '@taiga-ui/kit';
import { TuiStringHandler, TuiStringMatcher } from '@taiga-ui/cdk';
import { map } from 'rxjs';

import { ReportProvider } from '../../../api/api/report.service';
import { StoreProvider } from '../../../api/api/store.service';
import { AuthService } from '../../../services/auth.service';
import { StoreScopeService } from '../../../services/store-scope.service';
import { RoleCode } from '../../../models/role.model';

interface IncomeBreakdownItem {
  category?: string | null;
  categoryName?: string | null;
  amount?: number | null;
  count?: number | null;
}

interface MonthlyCashFlowRow {
  month?: number | null;
  disbursed?: number | null;
  totalCollected?: number | null;
  principal?: number | null;
  interest?: number | null;
  periodicFee?: number | null;
  fileFee?: number | null;
  insurance?: number | null;
  latePenalty?: number | null;
  earlyPenalty?: number | null;
  netIncome?: number | null;
  newLoanCount?: number | null;
}

interface MonthlyCashFlow {
  year?: number | null;
  totalDisbursed?: number | null;
  totalCollected?: number | null;
  totalNetIncome?: number | null;
  months?: MonthlyCashFlowRow[] | null;
}

interface PortfolioSummary {
  totalContracts?: number | null;
  disbursedCount?: number | null;
  badDebtCount?: number | null;
  settledCount?: number | null;
  overDueContractCount?: number | null;
  totalActivePortfolio?: number | null;
  totalRemainingPrincipal?: number | null;
  totalPrincipalCollected?: number | null;
  totalInterestCollected?: number | null;
  totalFeeCollected?: number | null;
  totalPenaltyCollected?: number | null;
  totalIncomeCollected?: number | null;
}

interface StoreItem {
  storeId: string;
  storeName: string;
}

const INCOME_LABELS: Record<string, string> = {
  LOAN_COLLECTION: 'Thu khoản Cầm cố/Thuê/Cầm đồ',
  FILE_FEE: 'Phí hồ sơ',
  INSURANCE: 'Bảo hiểm',
  LATE_PENALTY: 'Phạt chậm nộp',
  EARLY_SETTLEMENT_PENALTY: 'Phạt tất toán sớm',
  OVERPAYMENT: 'Thu dư',
  OTHER_INCOME: 'Thu khác',
};

const MONTH_NAMES = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

@Component({
  selector: 'app-reports-financial',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiButton,
    TuiDataList,
    TuiIcon,
    TuiSkeleton,
    TuiChevron,
    TuiSelect,
    TuiTextfield,
  ],
  templateUrl: './reports-financial.component.html',
})
export class ReportsFinancialComponent implements OnInit {
  private readonly reportProvider = inject(ReportProvider);
  private readonly storeProvider = inject(StoreProvider);
  private readonly authService = inject(AuthService);
  private readonly storeScope = inject(StoreScopeService);

  loading = signal(true);
  loadingCashFlow = signal(false);

  stores = signal<StoreItem[]>([]);
  selectedStoreId = signal<string | null>(null);
  selectedYear = signal(new Date().getFullYear());
  incomeBreakdown = signal<IncomeBreakdownItem[]>([]);
  monthlyCashFlow = signal<MonthlyCashFlow | null>(null);
  portfolio = signal<PortfolioSummary | null>(null);

  /** FormControl cho store selector (Admin only) */
  readonly storeControl = new FormControl<string | null>(null);
  /** FormControl cho year selector */
  readonly yearControl = new FormControl<string>(String(new Date().getFullYear()));

  readonly isAdmin = computed(() => this.authService.hasAnyRole([RoleCode.ADMIN]));
  readonly availableYearsStr = Array.from({ length: 5 }, (_, i) =>
    String(new Date().getFullYear() - i),
  );

  readonly storeStringify: TuiStringHandler<string | null> = (id) => {
    if (!id) return 'Tất cả chi nhánh';
    return this.stores().find((s) => s.storeId === id)?.storeName ?? id;
  };

  protected readonly matcherStore: TuiStringMatcher<string | null> = (id, query) => {
    if (!id) return query === '' || 'tất cả chi nhánh'.includes(query.toLowerCase());
    const item = this.stores().find((s) => s.storeId === id);
    if (!item) return false;
    return id === query || item.storeName.toLowerCase().includes(query.toLowerCase());
  };

  readonly yearStringify: TuiStringHandler<string> = (y) => y;

  protected readonly matcherYear: TuiStringMatcher<string> = (y, q) => y.includes(q);

  /** Tổng thu nhập từ income breakdown */
  readonly totalIncome = computed(() =>
    this.incomeBreakdown().reduce((s, x) => s + (x.amount ?? 0), 0),
  );

  /** % từng danh mục để vẽ progress bar */
  readonly incomeWithPercent = computed(() => {
    const total = this.totalIncome();
    return this.incomeBreakdown()
      .filter((x) => (x.amount ?? 0) > 0)
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
      .map((x) => ({
        ...x,
        label: INCOME_LABELS[x.category ?? ''] ?? x.category ?? '-',
        pct: total > 0 ? Math.round(((x.amount ?? 0) / total) * 100) : 0,
      }));
  });

  /** Giá trị max của cashflow row để vẽ bar */
  readonly maxCashFlowValue = computed(() => {
    const rows = this.monthlyCashFlow()?.months ?? [];
    return Math.max(...rows.map((r) => Math.max(r.disbursed ?? 0, r.totalCollected ?? 0)), 1);
  });

  /** Rows tháng với index */
  readonly cashFlowRows = computed(() => {
    const rows = this.monthlyCashFlow()?.months ?? [];
    return rows.map((r) => ({
      ...r,
      monthName: MONTH_NAMES[(r.month ?? 1) - 1] ?? `T${r.month}`,
      disbursedPct:
        this.maxCashFlowValue() > 0
          ? Math.round(((r.disbursed ?? 0) / this.maxCashFlowValue()) * 100)
          : 0,
      collectedPct:
        this.maxCashFlowValue() > 0
          ? Math.round(((r.totalCollected ?? 0) / this.maxCashFlowValue()) * 100)
          : 0,
    }));
  });

  ngOnInit(): void {
    if (this.isAdmin()) {
      this.storeProvider.apiStoreGetAllGet().subscribe({
        next: (r) => {
          if (r.status && Array.isArray(r.data)) {
            this.stores.set(r.data as StoreItem[]);
          }
        },
        error: () => { },
      });
      this.storeControl.valueChanges.subscribe((val) => { if (val === '') { this.storeControl.setValue(null, { emitEvent: false }); this.selectedStoreId.set(null); } else { this.selectedStoreId.set(val ?? null); } this.loadAll(); });
    }
    this.yearControl.valueChanges.subscribe((val) => {
      if (val) {
        this.selectedYear.set(Number(val));
        this.loadCashFlow();
      }
    });
    this.loadAll();
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

  private aggregatePortfolio(results: PortfolioSummary[]): PortfolioSummary {
    return results.reduce((acc, item) => {
      for (const [key, value] of Object.entries(item ?? {})) {
        if (typeof value === 'number') {
          acc[key as keyof PortfolioSummary] = (((acc[key as keyof PortfolioSummary] as number) ??
            0) + value) as never;
        } else if (acc[key as keyof PortfolioSummary] === undefined) {
          acc[key as keyof PortfolioSummary] = value as never;
        }
      }
      return acc;
    }, {} as PortfolioSummary);
  }

  private aggregateMonthlyCashFlow(results: MonthlyCashFlow[]): MonthlyCashFlow {
    const months = new Map<number, MonthlyCashFlowRow>();
    const summary: MonthlyCashFlow = {
      year: this.selectedYear(),
      totalDisbursed: 0,
      totalCollected: 0,
      totalNetIncome: 0,
      months: [],
    };

    for (const result of results) {
      if (!result) continue;
      summary.totalDisbursed = (summary.totalDisbursed ?? 0) + (result.totalDisbursed ?? 0);
      summary.totalCollected = (summary.totalCollected ?? 0) + (result.totalCollected ?? 0);
      summary.totalNetIncome = (summary.totalNetIncome ?? 0) + (result.totalNetIncome ?? 0);

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

    summary.months = Array.from(months.values()).sort((a, b) => (a.month ?? 0) - (b.month ?? 0));
    return summary;
  }

  loadAll(): void {
    this.loading.set(true);
    const now = new Date();
    const storeIds = this.storeScope.resolveStoreIds(this.selectedStoreId());

    const fromDate = `${now.getFullYear()}-01-01`;
    const toDate = new Date().toISOString().split('T')[0];

    Promise.all([
      new Promise<void>((resolve) => {
        this.storeScope
          .fetchAcrossStores(
            storeIds,
            (storeId) =>
              this.reportProvider
                .apiReportIncomeBreakdownPost({
                  reportDateRangeRequest: { storeId, fromDate, toDate } as never,
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
            next: (item) => {
              this.portfolio.set(item);
              resolve();
            },
            error: () => resolve(),
          });
      }),
    ]).finally(() => {
      this.loading.set(false);
      this.loadCashFlow();
    });
  }

  loadCashFlow(): void {
    this.loadingCashFlow.set(true);
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
        next: (r) => {
          if (r) this.monthlyCashFlow.set(r);
        },
        error: () => { },
        complete: () => this.loadingCashFlow.set(false),
      });
  }

  getLabelForCategory(code?: string | null): string {
    return INCOME_LABELS[code ?? ''] ?? code ?? '-';
  }

  formatCurrency(val?: number | null): string {
    if (val == null || val === 0) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  }

  readonly totalNewLoans = computed(() =>
    (this.monthlyCashFlow()?.months ?? []).reduce((s, r) => s + (r.newLoanCount ?? 0), 0),
  );
}
