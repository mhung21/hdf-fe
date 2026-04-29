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

import { ReportProvider } from '../../../api/api/report.service';
import { StoreProvider } from '../../../api/api/store.service';
import { AuthService } from '../../../services/auth.service';
import { RoleCode } from '../../../models/role.model';

interface CollateralTypeItem {
  collateralType?: string | null;
  totalCount?: number | null;
  totalValue?: number | null;
  avgValue?: number | null;
  badDebtCount?: number | null;
  badDebtRate?: number | null;
}

interface RecoveryByMonthItem {
  yearMonth?: string | null;
  recoveredAmount?: number | null;
}

interface RecoveryByYearItem {
  year?: number | null;
  recoveredAmount?: number | null;
  monthCount?: number | null;
  avgPerMonth?: number | null;
}

interface CollateralResult {
  fromDate?: string | null;
  toDate?: string | null;
  totalCollaterals?: number | null;
  totalEstimatedValue?: number | null;
  totalBadDebt?: number | null;
  overallBadDebtRate?: number | null;
  totalRecovered?: number | null;
  byCollateralType?: CollateralTypeItem[] | null;
  recoveryByMonth?: RecoveryByMonthItem[] | null;
  recoveryByYear?: RecoveryByYearItem[] | null;
}

interface StoreItem { storeId: string; storeName: string; }

@Component({
  selector: 'app-reports-collaterals',
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
  templateUrl: './reports-collaterals.component.html',
})
export class ReportsCollateralsComponent implements OnInit {
  private readonly reportProvider = inject(ReportProvider);
  private readonly storeProvider  = inject(StoreProvider);
  private readonly authService    = inject(AuthService);

  loading = signal(true);
  stores  = signal<StoreItem[]>([]);
  result  = signal<CollateralResult | null>(null);

  readonly isAdmin  = computed(() => this.authService.hasAnyRole([RoleCode.ADMIN]));
  readonly today    = TuiDay.currentLocal();
  readonly firstOfYear = new TuiDay(this.today.year, 0, 1);

  readonly dateRangeControl = new FormControl<TuiDayRange | null>(
    new TuiDayRange(this.firstOfYear, this.today)
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

  readonly storeOptions = computed(() => this.stores().map(s => s.storeId));

  readonly byType       = computed(() => this.result()?.byCollateralType ?? []);
  readonly byMonth      = computed(() => this.result()?.recoveryByMonth ?? []);
  readonly byYear       = computed(() => this.result()?.recoveryByYear ?? []);

  ngOnInit(): void {
    this.storeProvider.apiStoreGetAllGet().subscribe({
      next: r => {
        if (r.status && Array.isArray(r.data))
          this.stores.set(r.data as StoreItem[]);
      },
    });
    this.load();
  }

  load(): void {
    const range = this.dateRangeControl.value;
    if (!range) return;
    this.loading.set(true);

    const from = `${range.from.year}-${String(range.from.month + 1).padStart(2, '0')}-${String(range.from.day).padStart(2, '0')}`;
    const to   = `${range.to.year}-${String(range.to.month + 1).padStart(2, '0')}-${String(range.to.day).padStart(2, '0')}`;

    (this.reportProvider as any).apiReportCollateralReportPost({
      reportDateRangeRequest: {
        storeId:  this.storeControl.value ?? undefined,
        fromDate: from,
        toDate:   to,
      },
    } as any).subscribe({
      next: r => {
        if (r.status) this.result.set(r.data as CollateralResult);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  fmt(v?: number | null): string {
    if (v == null) return '-';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);
  }

  fmtPct(v?: number | null): string {
    if (v == null) return '-';
    return v.toFixed(1) + '%';
  }

  fmtMonth(ym?: string | null): string {
    if (!ym) return '-';
    const [year, month] = ym.split('-');
    return `Th${month}/${year}`;
  }
}
