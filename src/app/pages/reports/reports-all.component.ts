import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TuiButton, TuiIcon, TuiTextfield } from '@taiga-ui/core';
import { TuiInputDateRange } from '@taiga-ui/kit';
import { TuiDay, TuiDayRange } from '@taiga-ui/cdk';

import { ReportProvider } from '../../api/api/report.service';
import { StoreProvider } from '../../api/api/store.service';
import { AuthService } from '../../services/auth.service';

interface OutstandingLoanItem {
  loanContractId?: string | null;
  contractCode?: string | null;
  customerName?: string | null;
  storeName?: string | null;
  storeId?: string | null;
  principalAmount?: number | null;
  remainingPrincipal?: number | null;
  disbursedDate?: string | null;
  maturityDate?: string | null;
  statusCode?: string | null;
}

interface BadDebtSummaryItem {
  month?: string | null;
  storeName?: string | null;
  newCases?: number | null;
  newAmount?: number | null;
  recoveredThisMonth?: number | null;
  recoveredPrevMonths?: number | null;
  totalOutstanding?: number | null;
}

interface StoreItem { storeId: string; storeName: string; storeCode?: string | null; }

@Component({
  selector: 'app-reports-all',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiButton,
    TuiIcon,
    TuiTextfield,
    TuiInputDateRange,
  ],
  templateUrl: './reports-all.component.html',
})
export class ReportsAllComponent implements OnInit {
  private readonly reportProvider = inject(ReportProvider);
  private readonly storeProvider = inject(StoreProvider);
  private readonly authService = inject(AuthService);

  loading = signal(false);
  stores = signal<StoreItem[]>([]);
  outstandingLoans = signal<OutstandingLoanItem[]>([]);
  badDebtSummary = signal<BadDebtSummaryItem[]>([]);
  totalOutstandingPrincipal = signal(0);
  totalRemainingPrincipal = signal(0);

  readonly today = TuiDay.currentLocal();
  readonly firstOfMonth = new TuiDay(this.today.year, this.today.month, 1);
  readonly dateRangeControl = new FormControl<TuiDayRange | null>(
    new TuiDayRange(this.firstOfMonth, this.today)
  );

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
    this.storeProvider.apiStoreGetAllGet().subscribe({
      next: r => { if (r.status && r.data) this.stores.set(Array.isArray(r.data) ? r.data as StoreItem[] : []); },
      error: () => {},
    });
    this.dateRangeControl.valueChanges.subscribe(range => {
      if (range) this.loadAll();
    });
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    const r = this.dateRangeControl.value ?? new TuiDayRange(this.firstOfMonth, this.today);

    Promise.all([
      new Promise<void>(resolve => {
        this.reportProvider.apiReportOutstandingLoansPost({ reportStoreRequest: {} as never }).subscribe({
          next: r2 => {
            if (r2.status && r2.data) {
              const items = Array.isArray(r2.data) ? r2.data as OutstandingLoanItem[] : [];
              this.outstandingLoans.set(items);
              this.totalOutstandingPrincipal.set(items.reduce((s, x) => s + (x.principalAmount ?? 0), 0));
              this.totalRemainingPrincipal.set(items.reduce((s, x) => s + (x.remainingPrincipal ?? 0), 0));
            }
            resolve();
          },
          error: () => resolve(),
        });
      }),
      new Promise<void>(resolve => {
        this.reportProvider.apiReportBadDebtSummaryPost({
          badDebtSummaryRequest: { year: r.from.year, month: r.from.month + 1 } as never,
        }).subscribe({
          next: r2 => {
            if (r2.status && r2.data) {
              this.badDebtSummary.set(Array.isArray(r2.data) ? r2.data as BadDebtSummaryItem[] : []);
            }
            resolve();
          },
          error: () => resolve(),
        });
      }),
    ]).finally(() => this.loading.set(false));
  }
}
