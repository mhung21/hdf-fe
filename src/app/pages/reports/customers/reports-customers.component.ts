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
import { TuiChevron, TuiSelect, TuiInputDateRange, TuiInputMonth } from '@taiga-ui/kit';
import { TuiDay, TuiDayRange, TuiMonth, TuiStringHandler, TuiStringMatcher } from '@taiga-ui/cdk';
import { map } from 'rxjs';

import { ReportProvider } from '../../../api/api/report.service';
import { StoreProvider } from '../../../api/api/store.service';
import { AuthService } from '../../../services/auth.service';
import { StoreScopeService } from '../../../services/store-scope.service';
import { RoleCode } from '../../../models/role.model';

interface AdvancedStoreRow {
  storeId?: string | null;
  storeName?: string | null;
  totalContracts?: number | null;
  activeContracts?: number | null;
  settledContracts?: number | null;
  badDebtContracts?: number | null;
  badDebtRate?: number | null;
  totalCustomers?: number | null;
  returningCustomers?: number | null;
  returnRate?: number | null;
}

interface AdvancedSourceRow {
  sourceName?: string | null;
  contractCount?: number | null;
  customerCount?: number | null;
  badDebtCount?: number | null;
}

interface AdvancedStats {
  totalContracts?: number | null;
  activeContracts?: number | null;
  settledContracts?: number | null;
  badDebtContracts?: number | null;
  totalCustomers?: number | null;
  returningCustomers?: number | null;
  returnRate?: number | null;
  topReturnStoreName?: string | null;
  topReturnStoreRate?: number | null;
  topBadDebtStoreName?: string | null;
  topBadDebtStoreRate?: number | null;
  byStore?: AdvancedStoreRow[] | null;
  bySource?: AdvancedSourceRow[] | null;
}

interface CustomerStatRow {
  period?: string | null;
  newCustomers?: number | null;
  returningCustomers?: number | null;
  ctvCustomers?: number | null;
  walkInCustomers?: number | null;
  total?: number | null;
}

interface CustomerSummary {
  totalNew?: number | null;
  totalReturning?: number | null;
  totalCtv?: number | null;
  totalWalkIn?: number | null;
  rows?: CustomerStatRow[] | null;
}

interface StoreItem { storeId: string; storeName: string; }

const GROUP_BY_OPTIONS = [
  { value: 'day', label: 'Theo ngày' },
  // { value: 'week', label: 'Theo tuần' },
  { value: 'month', label: 'Theo tháng' },
];

@Component({
  selector: 'app-reports-customers',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiButton,
    TuiDataList,
    TuiIcon,
    TuiChevron,
    TuiSelect,
    TuiTextfield,
    TuiInputDateRange,
    TuiInputMonth,
  ],
  templateUrl: './reports-customers.component.html',
})
export class ReportsCustomersComponent implements OnInit {
  private readonly reportProvider = inject(ReportProvider);
  private readonly storeProvider = inject(StoreProvider);
  private readonly authService = inject(AuthService);
  private readonly storeScope = inject(StoreScopeService);

  loading = signal(true);
  loadingAdvanced = signal(false);
  stores = signal<StoreItem[]>([]);
  selectedStoreId = signal<string | null>(null);
  groupBy = signal<string>('month');
  customerData = signal<CustomerSummary | null>(null);
  advancedStats = signal<AdvancedStats | null>(null);

  readonly isAdmin = computed(() => this.authService.hasAnyRole([RoleCode.ADMIN]));
  readonly isStaff = computed(() => this.authService.hasRole(RoleCode.STAFF));
  readonly groupByOptions = GROUP_BY_OPTIONS;

  readonly storeControl = new FormControl<string | null>(null);

  readonly storeStringify: TuiStringHandler<string | null> = (id) => {
    if (!id) return 'Tất cả chi nhánh';
    return this.stores().find((s) => s.storeId === id)?.storeName ?? id;
  };

  protected readonly matcherStore: TuiStringMatcher<string | null> = (id, query) => {
    if (!id) return query === '' || 'tất cả chi nhánh'.includes(query.toLowerCase());
    const item = this.stores().find(s => s.storeId === id);
    if (!item) return false;
    return id === query || item.storeName.toLowerCase().includes(query.toLowerCase());
  };

  readonly today = TuiDay.currentLocal();
  readonly firstOfYear = new TuiDay(this.today.year, 0, 1);

  readonly dateRangeControl = new FormControl<TuiDayRange | null>(
    new TuiDayRange(this.firstOfYear, this.today)
  );

  readonly monthControl = new FormControl<TuiMonth | null>(
    new TuiMonth(this.today.year, this.today.month)
  );

  readonly advancedByStore  = computed(() => this.advancedStats()?.byStore ?? []);
  readonly advancedBySource = computed(() => this.advancedStats()?.bySource ?? []);

  readonly rows = computed(() => this.customerData()?.rows ?? []);
  readonly totalNew = computed(() => this.customerData()?.totalNew ?? 0);
  readonly totalReturning = computed(() => this.customerData()?.totalReturning ?? 0);
  readonly totalCtv = computed(() => this.customerData()?.totalCtv ?? 0);
  readonly totalWalkIn = computed(() => this.customerData()?.totalWalkIn ?? 0);
  readonly grandTotal = computed(() => this.totalNew() + this.totalReturning());

  readonly newRate = computed(() =>
    this.grandTotal() > 0 ? Math.round((this.totalNew() / this.grandTotal()) * 100) : 0
  );

  readonly maxRowTotal = computed(() =>
    Math.max(...this.rows().map(r => r.total ?? 0), 1)
  );
  readonly focusedRows = computed(() =>
    [...this.rows()]
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
      .slice(0, 10)
  );

  ngOnInit(): void {
    if (this.isAdmin()) {
      this.storeProvider.apiStoreGetAllGet().subscribe({
        next: r => { if (r.status && Array.isArray(r.data)) this.stores.set(r.data as StoreItem[]); },
        error: () => {},
      });
      this.storeControl.valueChanges.subscribe(val => {
        this.selectedStoreId.set(val ?? null);
        this.loadData();
      });
    }
    this.dateRangeControl.valueChanges.subscribe(range => {
      if (range) this.loadData();
    });
    this.monthControl.valueChanges.subscribe(m => {
      if (m) this.loadData();
    });
    this.loadData();
    this.loadAdvancedStats();
  }

  private aggregateCustomerSummary(results: CustomerSummary[]): CustomerSummary {
    const rows = new Map<string, CustomerStatRow>();
    const summary: CustomerSummary = { totalNew: 0, totalReturning: 0, totalCtv: 0, totalWalkIn: 0, rows: [] };

    for (const result of results) {
      if (!result) continue;
      summary.totalNew = (summary.totalNew ?? 0) + (result.totalNew ?? 0);
      summary.totalReturning = (summary.totalReturning ?? 0) + (result.totalReturning ?? 0);
      summary.totalCtv = (summary.totalCtv ?? 0) + (result.totalCtv ?? 0);
      summary.totalWalkIn = (summary.totalWalkIn ?? 0) + (result.totalWalkIn ?? 0);
      for (const row of result.rows ?? []) {
        const key = row.period ?? JSON.stringify(row);
        const current = rows.get(key) ?? { period: row.period };
        current.newCustomers = (current.newCustomers ?? 0) + (row.newCustomers ?? 0);
        current.returningCustomers = (current.returningCustomers ?? 0) + (row.returningCustomers ?? 0);
        current.ctvCustomers = (current.ctvCustomers ?? 0) + (row.ctvCustomers ?? 0);
        current.walkInCustomers = (current.walkInCustomers ?? 0) + (row.walkInCustomers ?? 0);
        current.total = (current.total ?? 0) + (row.total ?? 0);
        rows.set(key, current);
      }
    }

    summary.rows = Array.from(rows.values());
    return summary;
  }

  private aggregateAdvancedStats(results: AdvancedStats[]): AdvancedStats {
    const byStore = new Map<string, AdvancedStoreRow>();
    const bySource = new Map<string, AdvancedSourceRow>();
    const summary: AdvancedStats = {
      totalContracts: 0,
      activeContracts: 0,
      settledContracts: 0,
      badDebtContracts: 0,
      totalCustomers: 0,
      returningCustomers: 0,
      returnRate: 0,
      byStore: [],
      bySource: [],
    };

    for (const result of results) {
      if (!result) continue;
      summary.totalContracts = (summary.totalContracts ?? 0) + (result.totalContracts ?? 0);
      summary.activeContracts = (summary.activeContracts ?? 0) + (result.activeContracts ?? 0);
      summary.settledContracts = (summary.settledContracts ?? 0) + (result.settledContracts ?? 0);
      summary.badDebtContracts = (summary.badDebtContracts ?? 0) + (result.badDebtContracts ?? 0);
      summary.totalCustomers = (summary.totalCustomers ?? 0) + (result.totalCustomers ?? 0);
      summary.returningCustomers = (summary.returningCustomers ?? 0) + (result.returningCustomers ?? 0);

      for (const row of result.byStore ?? []) {
        const key = row.storeId ?? row.storeName ?? JSON.stringify(row);
        const current = byStore.get(key) ?? { storeId: row.storeId, storeName: row.storeName };
        current.totalContracts = (current.totalContracts ?? 0) + (row.totalContracts ?? 0);
        current.activeContracts = (current.activeContracts ?? 0) + (row.activeContracts ?? 0);
        current.settledContracts = (current.settledContracts ?? 0) + (row.settledContracts ?? 0);
        current.badDebtContracts = (current.badDebtContracts ?? 0) + (row.badDebtContracts ?? 0);
        current.totalCustomers = (current.totalCustomers ?? 0) + (row.totalCustomers ?? 0);
        current.returningCustomers = (current.returningCustomers ?? 0) + (row.returningCustomers ?? 0);
        current.badDebtRate = current.totalContracts && current.totalContracts > 0
          ? Math.round(((current.badDebtContracts ?? 0) / current.totalContracts) * 1000) / 10
          : (row.badDebtRate ?? null);
        current.returnRate = current.totalCustomers && current.totalCustomers > 0
          ? Math.round(((current.returningCustomers ?? 0) / current.totalCustomers) * 1000) / 10
          : (row.returnRate ?? null);
        byStore.set(key, current);
      }

      for (const row of result.bySource ?? []) {
        const key = row.sourceName ?? JSON.stringify(row);
        const current = bySource.get(key) ?? { sourceName: row.sourceName };
        current.contractCount = (current.contractCount ?? 0) + (row.contractCount ?? 0);
        current.customerCount = (current.customerCount ?? 0) + (row.customerCount ?? 0);
        current.badDebtCount = (current.badDebtCount ?? 0) + (row.badDebtCount ?? 0);
        bySource.set(key, current);
      }
    }

    summary.byStore = Array.from(byStore.values());
    summary.bySource = Array.from(bySource.values());
    summary.returnRate = summary.totalCustomers && summary.totalCustomers > 0
      ? Math.round(((summary.returningCustomers ?? 0) / summary.totalCustomers) * 1000) / 10
      : 0;
    return summary;
  }

  onGroupByChange(val: string): void {
    this.groupBy.set(val);
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const storeIds = this.storeScope.resolveStoreIds(this.selectedStoreId());
    const gb = this.groupBy();

    let fromDate: string;
    let toDate: string;

    if (gb === 'month') {
      const m = this.monthControl.value ?? new TuiMonth(this.today.year, this.today.month);
      const lastDay = new Date(m.year, m.month + 1, 0).getDate();
      fromDate = new TuiDay(m.year, m.month, 1).toJSON();
      toDate = new TuiDay(m.year, m.month, lastDay).toJSON();
    } else {
      const r = this.dateRangeControl.value ?? new TuiDayRange(this.firstOfYear, this.today);
      fromDate = r.from.toJSON();
      toDate = r.to.toJSON();
    }

    this.storeScope.fetchAcrossStores(
      storeIds,
      (storeId) => this.reportProvider.apiReportCustomerStatsPost({
        customerStatsRequest: {
          storeId,
          fromDate,
          toDate,
          groupBy: gb,
        },
      }).pipe(map((res) => (res.status && res.data ? res.data as CustomerSummary : null))),
      (results) => this.aggregateCustomerSummary(results.filter((item): item is CustomerSummary => !!item)),
    ).subscribe({
      next: res => {
        if (res) this.customerData.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadAdvancedStats(): void {
    this.loadingAdvanced.set(true);
    const storeIds = this.storeScope.resolveStoreIds(this.selectedStoreId());
    const r = this.dateRangeControl.value ?? new TuiDayRange(this.firstOfYear, this.today);

    this.storeScope.fetchAcrossStores(
      storeIds,
      (storeId) => (this.reportProvider as any).apiReportCustomerAdvancedStatsPost({
        reportDateRangeRequest: { storeId, fromDate: r.from.toJSON(), toDate: r.to.toJSON() } as any,
      } as any).pipe(map((res: any) => (res.status && res.data ? res.data as AdvancedStats : null))),
      (results) => this.aggregateAdvancedStats(results.filter((item): item is AdvancedStats => !!item)),
    ).subscribe({
      next: res => {
        if (res) this.advancedStats.set(res);
        this.loadingAdvanced.set(false);
      },
      error: () => this.loadingAdvanced.set(false),
    });
  }

  fmtPct(v?: number | null): string {
    if (v == null) return '-';
    return v.toFixed(1) + '%';
  }

  barWidth(val?: number | null): number {
    return this.maxRowTotal() > 0 ? Math.round(((val ?? 0) / this.maxRowTotal()) * 100) : 0;
  }
}
