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
import { TuiChevron, TuiComboBox, TuiSkeleton } from '@taiga-ui/kit';
import { TuiStringHandler, TuiStringMatcher } from '@taiga-ui/cdk';
import { map } from 'rxjs';

import { ReportProvider } from '../../../api/api/report.service';
import { AuthService } from '../../../services/auth.service';
import { StoreProvider } from '../../../api/api/store.service';
import { StoreScopeService } from '../../../services/store-scope.service';
import { RoleCode } from '../../../models/role.model';

interface OverdueItem {
  loanContractId?: string | null;
  contractCode?: string | null;
  customerName?: string | null;
  customerNationalId?: string | null;
  overdueDays?: number | null;
  overdueAmount?: number | null;
  latePenaltyAmount?: number | null;
  storeName?: string | null;
  statusCode?: string | null;
}

interface BadDebtItem {
  month?: string | null;
  storeName?: string | null;
  newCases?: number | null;
  newAmount?: number | null;
  recoveredThisMonth?: number | null;
  recoveredPrevMonths?: number | null;
  totalOutstanding?: number | null;
}

interface OverdueGroup {
  label: string;
  bracket: string;
  colorClass: string;
  badgeColor: string;
  items: OverdueItem[];
  totalAmount: number;
  totalPenalty: number;
}

interface StoreItem {
  storeId: string;
  storeName: string;
}

@Component({
  selector: 'app-reports-risk',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiButton,
    TuiIcon,
    TuiChevron,
    TuiComboBox,
    TuiDataList,
    TuiTextfield,
    TuiSkeleton,
  ],
  templateUrl: './reports-risk.component.html',
})
export class ReportsRiskComponent implements OnInit {
  private readonly reportProvider = inject(ReportProvider);
  private readonly storeProvider = inject(StoreProvider);
  private readonly authService = inject(AuthService);
  private readonly storeScope = inject(StoreScopeService);

  loading = signal(true);
  stores = signal<StoreItem[]>([]);
  selectedStoreId = signal<string | null>(null);
  overdueItems = signal<OverdueItem[]>([]);
  badDebtSummary = signal<BadDebtItem[]>([]);

  readonly storeControl = new FormControl<string | null>(null);

  readonly isAdmin = computed(() => this.authService.hasAnyRole([RoleCode.ADMIN]));
  readonly isManager = computed(() =>
    this.authService.hasAnyRole([
      RoleCode.ADMIN,
      RoleCode.REGIONAL_MANAGER,
      RoleCode.STORE_MANAGER,
    ]),
  );
  readonly isStaff = computed(() => this.authService.hasRole(RoleCode.STAFF));

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

  /** Phân nhóm hợp đồng quá hạn theo số ngày */
  readonly overdueGroups = computed<OverdueGroup[]>(() => {
    const all = this.overdueItems();
    const brackets: {
      label: string;
      bracket: string;
      colorClass: string;
      badgeColor: string;
      min: number;
      max: number;
    }[] = [
      {
        label: '1 – 3 ngày',
        bracket: '1-3',
        colorClass: 'border-yellow-200 bg-yellow-50',
        badgeColor: 'warning',
        min: 1,
        max: 3,
      },
      {
        label: '4 – 10 ngày',
        bracket: '4-10',
        colorClass: 'border-orange-200 bg-orange-50',
        badgeColor: 'warning',
        min: 4,
        max: 10,
      },
      {
        label: '11 – 30 ngày',
        bracket: '11-30',
        colorClass: 'border-red-200 bg-red-50',
        badgeColor: 'error',
        min: 11,
        max: 30,
      },
      {
        label: 'Trên 30 ngày',
        bracket: '30+',
        colorClass: 'border-red-300 bg-red-100',
        badgeColor: 'error',
        min: 31,
        max: Infinity,
      },
    ];
    return brackets.map((b) => {
      const items = all.filter(
        (i) => (i.overdueDays ?? 0) >= b.min && (i.overdueDays ?? 0) <= b.max,
      );
      return {
        label: b.label,
        bracket: b.bracket,
        colorClass: b.colorClass,
        badgeColor: b.badgeColor,
        items,
        totalAmount: items.reduce((s, x) => s + (x.overdueAmount ?? 0), 0),
        totalPenalty: items.reduce((s, x) => s + (x.latePenaltyAmount ?? 0), 0),
      };
    });
  });

  readonly totalOverdueCount = computed(() => this.overdueItems().length);
  readonly totalOverdueAmount = computed(() =>
    this.overdueItems().reduce((s, x) => s + (x.overdueAmount ?? 0), 0),
  );
  readonly totalPenaltyAmount = computed(() =>
    this.overdueItems().reduce((s, x) => s + (x.latePenaltyAmount ?? 0), 0),
  );
  readonly totalBadDebtOutstanding = computed(() =>
    this.badDebtSummary().reduce((s, x) => s + (x.totalOutstanding ?? 0), 0),
  );
  readonly urgentOverdues = computed(() =>
    [...this.overdueItems()]
      .sort((a, b) => {
        const days = (b.overdueDays ?? 0) - (a.overdueDays ?? 0);
        if (days !== 0) return days;
        return (b.overdueAmount ?? 0) - (a.overdueAmount ?? 0);
      })
      .slice(0, 12),
  );

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
    this.loadAll();
  }

  private aggregateOverdue(results: OverdueItem[][]): OverdueItem[] {
    return results.flatMap((items) => (Array.isArray(items) ? items : []));
  }

  private aggregateBadDebt(results: BadDebtItem[][]): BadDebtItem[] {
    return results.flatMap((items) => (Array.isArray(items) ? items : []));
  }

  selectStore(storeId: string | null): void {
    this.selectedStoreId.set(storeId);
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    const storeIds = this.storeScope.resolveStoreIds(this.selectedStoreId());

    const now = new Date();

    Promise.all([
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
                    if (!r.status || !r.data) return [] as OverdueItem[];
                    const d = r.data as { riskDetail?: OverdueItem[] };
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
                .apiReportBadDebtSummaryPost({
                  badDebtSummaryRequest: {
                    storeId,
                    year: now.getFullYear(),
                    month: now.getMonth() + 1,
                  } as never,
                })
                .pipe(
                  map((r) =>
                    r.status && r.data
                      ? Array.isArray(r.data)
                        ? (r.data as BadDebtItem[])
                        : []
                      : [],
                  ),
                ),
            (results) => this.aggregateBadDebt(results),
          )
          .subscribe({
            next: (items) => {
              this.badDebtSummary.set(items);
              resolve();
            },
            error: () => resolve(),
          });
      }),
    ]).finally(() => this.loading.set(false));
  }

  formatCurrency(val?: number | null): string {
    if (val == null || val === 0) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat('vi-VN').format(d);
  }
}
