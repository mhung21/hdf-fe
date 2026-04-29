import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { TuiIcon } from '@taiga-ui/core';
import { TuiTable } from '@taiga-ui/addon-table';
import { TuiSkeleton } from '@taiga-ui/kit';
import { format } from 'date-fns';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../services/auth.service';
import { StoreScopeService } from '../../services/store-scope.service';

const MONTH_LABELS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, BaseChartDirective, TuiIcon, TuiTable, TuiSkeleton],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.less'],
})
export class DashboardComponent implements OnInit {
  readonly today = new Date();
  readonly todayStr = format(this.today, 'yyyy-MM-dd');
  readonly currentYear = this.today.getFullYear();

  private readonly auth = inject(AuthService);
  private readonly svc = inject(DashboardService);
  private readonly storeScope = inject(StoreScopeService);

  currentUser = this.auth.currentUser;
  userRole = computed(() => (this.auth.currentUser()?.role as string) ?? 'STAFF');
  isAdmin = computed(() => this.userRole() === 'ADMIN');
  isManager = computed(() => this.userRole() === 'STORE_MANAGER' || this.userRole() === 'REGIONAL_MANAGER');

  loading = signal(true);
  error = signal<string | null>(null);

  portfolio = signal<any>(null);
  cashFlow = signal<any>(null);
  overdueSummary = signal<any>(null);
  badDebtSummary = signal<any[]>([]);
  storeList = signal<any[]>([]);
  todayColList = signal<any[]>([]);

  disbursedCount    = computed(() => this.portfolio()?.disbursedCount ?? 0);
  pendingApprovalCount = computed(() => this.portfolio()?.pendingApprovalCount ?? 0);
  pendingDisbCount  = computed(() => this.portfolio()?.pendingDisbCount ?? 0);
  overdueContractCount = computed(() => this.portfolio()?.overdueContractCount ?? 0);
  badDebtCount      = computed(() => this.portfolio()?.badDebtCount ?? 0);
  remainingPrincipal = computed(() => this.portfolio()?.totalRemainingPrincipal ?? 0);
  totalActivePortfolio = computed(() => this.portfolio()?.totalActivePortfolio ?? 0);
  totalIncomeCollected = computed(() => this.portfolio()?.totalIncomeCollected ?? 0);
  totalContracts    = computed(() => this.portfolio()?.totalContracts ?? 0);
  badDebtOutstanding = computed(() =>
    this.badDebtSummary().reduce((sum: number, row: any) => sum + (Number(row?.totalOutstanding ?? 0) || 0), 0)
  );
  todayReceiptTotal = computed(() => {
    const list = this.todayColList();
    return Array.isArray(list)
      ? list.reduce((sum: number, row: any) => sum + (Number(row?.totalReceipt ?? row?.totalReceipts ?? 0) || 0), 0)
      : 0;
  });
  todayPaymentTotal = computed(() => {
    const list = this.todayColList();
    return Array.isArray(list)
      ? list.reduce((sum: number, row: any) => sum + (Number(row?.totalPayment ?? row?.totalPayments ?? 0) || 0), 0)
      : 0;
  });
  todayNetCash = computed(() => this.todayReceiptTotal() - this.todayPaymentTotal());
  draftCount = computed(() => this.portfolio()?.draftCount ?? 0);
  staffPriorityOverdues = computed<any[]>(() =>
    ((this.overdueSummary()?.riskDetail as any[]) ?? [])
      .filter((x) => (x?.daysOverdue ?? 0) > 0)
      .sort((a, b) => {
        const days = (b?.daysOverdue ?? 0) - (a?.daysOverdue ?? 0);
        if (days !== 0) return days;
        return (b?.totalUnpaid ?? 0) - (a?.totalUnpaid ?? 0);
      })
      .slice(0, 5)
  );

  overdueList = computed<any[]>(() =>
    ((this.overdueSummary()?.riskDetail as any[]) ?? []).slice(0, 8)
  );
  overdueBuckets = computed<any[]>(() => (this.overdueSummary()?.buckets as any[]) ?? []);
  overdueTotal   = computed(() => this.overdueSummary()?.totalUnpaid ?? 0);

  doughnutLegend = computed(() => {
    const p = this.portfolio();
    return [
      { label: 'Đang Giải Ngân', color: '#16a34a', value: p?.disbursedCount ?? 0 },
      { label: 'Chờ Duyệt/GN', color: '#f59e0b', value: (p?.pendingApprovalCount ?? 0) + (p?.pendingDisbCount ?? 0) },
      { label: 'Nháp',              color: '#9ca3af', value: p?.draftCount ?? 0 },
      { label: 'Nợ Xấu',       color: '#ef4444', value: p?.badDebtCount ?? 0 },
      { label: 'Đã Tất Toán', color: '#10b981', value: (p?.settledCount ?? 0) + (p?.closedCount ?? 0) },
    ];
  });
  doughnutTotal = computed(() => this.doughnutLegend().reduce((s, i) => s + i.value, 0));

  readonly barChartOptions: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: '#6b7280' } },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.9)', titleColor: '#e2e8f0', bodyColor: '#cbd5e1',
        padding: 10, cornerRadius: 8,
        callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + ctx.parsed.y + ' tỷ' }
      }
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11 }, color: '#9ca3af' } },
      y: { grid: { color: '#f3f4f6' }, border: { display: false }, ticks: { font: { size: 11 }, color: '#9ca3af', callback: v => v + 'B' } }
    }
  };

  barChartData = computed((): ChartData<'bar'> => {
    const months: any[] = this.cashFlow()?.months ?? [];
    const labels = months.length ? months.map((m: any) => MONTH_LABELS[(m.month ?? 1) - 1]) : MONTH_LABELS;
    const toB = (v: number) => Math.round((v ?? 0) / 1e7) / 100;
    return {
      labels,
      datasets: [
        { data: months.map((m: any) => toB(m.disbursed)),      label: 'Giải Ngân', backgroundColor: '#3b82f6aa', hoverBackgroundColor: '#3b82f6', borderRadius: 5, borderSkipped: false },
        { data: months.map((m: any) => toB(m.totalCollected)), label: 'Thu Về',       backgroundColor: '#16a34aaa', hoverBackgroundColor: '#16a34a', borderRadius: 5, borderSkipped: false },
        { data: months.map((m: any) => toB(m.netIncome)),      label: 'Lợi Nhuận',    backgroundColor: '#f59e0baa', hoverBackgroundColor: '#f59e0b', borderRadius: 5, borderSkipped: false },
      ]
    };
  });

  readonly doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true, maintainAspectRatio: false, cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', callbacks: { label: ctx => ' ' + ctx.label + ': ' + ctx.parsed + ' HĐ' } }
    },
    animation: { animateRotate: true, duration: 800 }
  };

  doughnutData = computed((): ChartData<'doughnut'> => {
    const items = this.doughnutLegend();
    return {
      labels: items.map(i => i.label),
      datasets: [{ data: items.map(i => i.value), backgroundColor: items.map(i => i.color), hoverOffset: 6, borderWidth: 2, borderColor: '#ffffff' }]
    };
  });

  readonly overdueTableCols = ['contractNo', 'customerName', 'daysOverdue', 'totalUnpaid', 'riskLevel'] as const;

  ngOnInit(): void { this.loadAll(); }

  private aggregatePortfolio(results: any[]): any {
    const numericKeys = new Set([
      'totalContracts',
      'disbursedCount',
      'pendingApprovalCount',
      'pendingDisbCount',
      'overdueContractCount',
      'badDebtCount',
      'draftCount',
      'settledCount',
      'closedCount',
      'badDebtClosedCount',
      'totalActivePortfolio',
      'totalRemainingPrincipal',
      'totalIncomeCollected',
      'totalPrincipalCollected',
      'totalInterestCollected',
      'totalFeeCollected',
      'totalPenaltyCollected',
    ]);

    return results.reduce((acc, item) => {
      for (const [key, value] of Object.entries(item ?? {})) {
        if (key === 'storeId' || key === 'storeName') continue;
        if (Array.isArray(value)) {
          acc[key] = [...(acc[key] ?? []), ...value];
          continue;
        }
        if (numericKeys.has(key) || typeof value === 'number') {
          acc[key] = (acc[key] ?? 0) + (Number(value) || 0);
          continue;
        }
        if (acc[key] === undefined) {
          acc[key] = value;
        }
      }
      return acc;
    }, {} as any);
  }

  private aggregateMonthlyCashFlow(results: any[]): any {
    const months = Array.from({ length: 12 }, (_, index) => ({ month: index + 1 }));
    const summary = {
      totalDisbursed: 0,
      totalCollected: 0,
      totalNetIncome: 0,
    };

    for (const result of results) {
      if (!result) continue;
      summary.totalDisbursed += Number(result.totalDisbursed ?? 0);
      summary.totalCollected += Number(result.totalCollected ?? 0);
      summary.totalNetIncome += Number(result.totalNetIncome ?? 0);

      for (const row of (result.months ?? [])) {
        const monthIndex = Number(row?.month ?? 0) - 1;
        if (monthIndex < 0 || monthIndex >= months.length) continue;
        const target = months[monthIndex] as Record<string, any>;
        for (const [key, value] of Object.entries(row ?? {})) {
          if (key === 'month') continue;
          if (typeof value === 'number') {
            target[key] = (target[key] ?? 0) + value;
          } else if (target[key] === undefined) {
            target[key] = value;
          }
        }
      }
    }

    return { ...summary, months };
  }

  private aggregateOverdue(results: any[]): any {
    const riskDetail: any[] = [];
    const buckets = new Map<string, any>();
    let totalUnpaid = 0;

    for (const result of results) {
      if (!result) continue;
      totalUnpaid += Number(result.totalUnpaid ?? 0);
      if (Array.isArray(result.riskDetail)) {
        riskDetail.push(...result.riskDetail);
      }

      for (const bucket of (result.buckets ?? [])) {
        const key = bucket?.label ?? bucket?.bracket ?? JSON.stringify(bucket ?? {});
        const current = buckets.get(key) ?? { ...bucket };
        current.count = (current.count ?? 0) + (Number(bucket?.count ?? 0) || 0);
        current.amount = (current.amount ?? 0) + (Number(bucket?.amount ?? 0) || 0);
        current.totalUnpaid = (current.totalUnpaid ?? 0) + (Number(bucket?.totalUnpaid ?? 0) || 0);
        buckets.set(key, current);
      }
    }

    return { totalUnpaid, riskDetail, buckets: Array.from(buckets.values()) };
  }

  private combineLists(results: any[][]): any[] {
    return results.flatMap((items) => Array.isArray(items) ? items : []);
  }

  private loadAll(): void {
    this.loading.set(true);
    this.error.set(null);
    const storeIds = this.storeScope.resolveStoreIds();
    forkJoin({
      portfolio: this.storeScope.fetchAcrossStores(
        storeIds,
        (storeId) => this.svc.getPortfolioSummary(storeId),
        (results) => this.aggregatePortfolio(results),
      ),
      cashFlow: this.storeScope.fetchAcrossStores(
        storeIds,
        (storeId) => this.svc.getMonthlyCashFlow(this.currentYear, storeId),
        (results) => this.aggregateMonthlyCashFlow(results),
      ),
      overdue: this.storeScope.fetchAcrossStores(
        storeIds,
        (storeId) => this.svc.getOverdueSummary(storeId),
        (results) => this.aggregateOverdue(results),
      ),
      badDebt: this.storeScope.fetchAcrossStores(
        storeIds,
        (storeId) => this.svc.getBadDebtSummary(this.currentYear, this.today.getMonth() + 1, storeId),
        (results) => this.combineLists(results),
      ),
      stores: this.storeScope.fetchAcrossStores(
        storeIds,
        (storeId) => this.svc.getOutstandingLoans(storeId),
        (results) => this.combineLists(results),
      ),
      todayCol: this.storeScope.fetchAcrossStores(
        storeIds,
        (storeId) => this.svc.getTodayCollection(this.todayStr, storeId),
        (results) => this.combineLists(results),
      ),
    }).subscribe({
      next: (data) => {
        this.portfolio.set(data.portfolio);
        this.cashFlow.set(data.cashFlow);
        this.overdueSummary.set(data.overdue);
        this.badDebtSummary.set(Array.isArray(data.badDebt) ? data.badDebt : []);
        this.storeList.set(Array.isArray(data.stores) ? data.stores : []);
        this.todayColList.set(Array.isArray(data.todayCol) ? data.todayCol : []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Không thể tải dữ liệu. Vui lòng thử lại sau.');
        this.loading.set(false);
      }
    });
  }

  refresh(): void { this.loadAll(); }

  formatCurrency = (n: number) => this.svc.formatCurrency(n);
  getRiskLabel    = (l: string) => this.svc.getRiskLabel(l);
}
