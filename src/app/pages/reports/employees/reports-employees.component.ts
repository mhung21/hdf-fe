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
import { TuiChevron, TuiComboBox, TuiInputDateRange, TuiSkeleton } from '@taiga-ui/kit';
import { TuiDay, TuiDayRange, TuiStringHandler, TuiStringMatcher } from '@taiga-ui/cdk';
import { map } from 'rxjs';

import { ReportProvider } from '../../../api/api/report.service';
import { StoreProvider } from '../../../api/api/store.service';
import { AuthService } from '../../../services/auth.service';
import { StoreScopeService } from '../../../services/store-scope.service';
import { RoleCode } from '../../../models/role.model';

interface EmployeeKpiItem {
  userId?: string | null;
  fullName?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  contractsCreated?: number | null;
  contractsDisbursed?: number | null;
  totalPrincipalDisbursed?: number | null;
  contractsSettled?: number | null;
  contractsBadDebt?: number | null;
  badDebtRate?: number | null;
  collectionsCount?: number | null;
  totalCollected?: number | null;
  customersCreated?: number | null;
}

interface KpiSummary {
  totalEmployees?: number | null;
  totalContractsCreated?: number | null;
  totalDisbursed?: number | null;
  totalCollected?: number | null;
  totalBadDebt?: number | null;
  totalCustomersCreated?: number | null;
}

interface KpiResult {
  fromDate?: string | null;
  toDate?: string | null;
  employees?: EmployeeKpiItem[] | null;
  summary?: KpiSummary | null;
}

interface StoreItem { storeId: string; storeName: string; }

@Component({
  selector: 'app-reports-employees',
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
    TuiSkeleton,
  ],
  templateUrl: './reports-employees.component.html',
})
export class ReportsEmployeesComponent implements OnInit {
  private readonly reportProvider = inject(ReportProvider);
  private readonly storeProvider  = inject(StoreProvider);
  private readonly authService    = inject(AuthService);
  private readonly storeScope     = inject(StoreScopeService);

  loading = signal(true);
  stores  = signal<StoreItem[]>([]);
  result  = signal<KpiResult | null>(null);

  readonly isAdmin  = computed(() => this.authService.hasAnyRole([RoleCode.ADMIN]));
  readonly today    = TuiDay.currentLocal();
  readonly firstOfMonth = new TuiDay(this.today.year, this.today.month, 1);

  readonly dateRangeControl = new FormControl<TuiDayRange | null>(
    new TuiDayRange(this.firstOfMonth, this.today)
  );
  readonly storeControl = new FormControl<string | null>(null);

  readonly storeStringify: TuiStringHandler<string | null> = (id) => {
    if (!id) return 'Tất cả chi nhánh';
    return this.stores().find(s => s.storeId === id)?.storeName ?? id;
  };

  protected readonly matcherStore: TuiStringMatcher<string | null> = (id, query) => {
    if (!id) return query === '' || 'tất cả chi nhánh'.includes(query.toLowerCase());
    const item = this.stores().find(s => s.storeId === id);
    if (!item) return false;
    return id === query || item.storeName.toLowerCase().includes(query.toLowerCase());
  };

  ngOnInit(): void {
    this.storeProvider.apiStoreGetAllGet().subscribe({
      next: r => {
        if (r.status && Array.isArray(r.data))
          this.stores.set(r.data as StoreItem[]);
      },
    });
    this.load();
  }

  private aggregateKpi(results: KpiResult[]): KpiResult {
    const employees = new Map<string, EmployeeKpiItem>();
    const summary: KpiSummary = {
      totalEmployees: 0,
      totalContractsCreated: 0,
      totalDisbursed: 0,
      totalCollected: 0,
      totalBadDebt: 0,
      totalCustomersCreated: 0,
    };

    for (const result of results) {
      if (!result) continue;
      const currentSummary = result.summary ?? {};
      summary.totalEmployees = (summary.totalEmployees ?? 0) + (currentSummary.totalEmployees ?? 0);
      summary.totalContractsCreated = (summary.totalContractsCreated ?? 0) + (currentSummary.totalContractsCreated ?? 0);
      summary.totalDisbursed = (summary.totalDisbursed ?? 0) + (currentSummary.totalDisbursed ?? 0);
      summary.totalCollected = (summary.totalCollected ?? 0) + (currentSummary.totalCollected ?? 0);
      summary.totalBadDebt = (summary.totalBadDebt ?? 0) + (currentSummary.totalBadDebt ?? 0);
      summary.totalCustomersCreated = (summary.totalCustomersCreated ?? 0) + (currentSummary.totalCustomersCreated ?? 0);

      for (const item of result.employees ?? []) {
        const key = item.userId ?? item.fullName ?? JSON.stringify(item);
        const current = employees.get(key) ?? { userId: item.userId, fullName: item.fullName, storeId: item.storeId, storeName: item.storeName };
        current.contractsCreated = (current.contractsCreated ?? 0) + (item.contractsCreated ?? 0);
        current.contractsDisbursed = (current.contractsDisbursed ?? 0) + (item.contractsDisbursed ?? 0);
        current.totalPrincipalDisbursed = (current.totalPrincipalDisbursed ?? 0) + (item.totalPrincipalDisbursed ?? 0);
        current.contractsSettled = (current.contractsSettled ?? 0) + (item.contractsSettled ?? 0);
        current.contractsBadDebt = (current.contractsBadDebt ?? 0) + (item.contractsBadDebt ?? 0);
        current.collectionsCount = (current.collectionsCount ?? 0) + (item.collectionsCount ?? 0);
        current.totalCollected = (current.totalCollected ?? 0) + (item.totalCollected ?? 0);
        current.customersCreated = (current.customersCreated ?? 0) + (item.customersCreated ?? 0);
        employees.set(key, current);
      }
    }

    return { summary, employees: Array.from(employees.values()) };
  }

  load(): void {
    const range = this.dateRangeControl.value;
    if (!range) return;
    this.loading.set(true);

    const from = `${range.from.year}-${String(range.from.month + 1).padStart(2, '0')}-${String(range.from.day).padStart(2, '0')}`;
    const to   = `${range.to.year}-${String(range.to.month + 1).padStart(2, '0')}-${String(range.to.day).padStart(2, '0')}`;
    const storeIds = this.storeScope.resolveStoreIds(this.storeControl.value);

    this.storeScope.fetchAcrossStores(
      storeIds,
      (storeId) => (this.reportProvider as any).apiReportEmployeeKpiPost({
        reportDateRangeRequest: {
          storeId,
          fromDate: from,
          toDate: to,
        },
      } as any).pipe(map((r: any) => (r.status ? r.data as KpiResult : null))),
      (results) => this.aggregateKpi(results.filter((item): item is KpiResult => !!item)),
    ).subscribe({
      next: r => {
        if (r) this.result.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  fmt(v?: number | null): string {
    if (v == null) return '-';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);
  }

  fmtNum(v?: number | null): string {
    if (v == null) return '-';
    return new Intl.NumberFormat('vi-VN').format(v);
  }

  fmtPct(v?: number | null): string {
    if (v == null) return '-';
    return v.toFixed(1) + '%';
  }

  employees    = computed(() => this.result()?.employees ?? []);
  summary      = computed(() => this.result()?.summary ?? null);
  storeOptions = computed<Array<string | null>>(() => [null, ...this.stores().map(s => s.storeId)]);
}
