import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { TuiButton, TuiHint, TuiIcon, TuiTextfield, tuiDialog } from '@taiga-ui/core';

import { BadDebtCaseProvider } from '../../api/api/bad-debt-case.service';
import { PolicySettingProvider } from '../../api/api/policy-setting.service';
import { SearchBadDebtCaseRequest } from '../../api/model/search-bad-debt-case-request';
import { AuthService } from '../../services/auth.service';
import { RoleCode } from '../../models/role.model';
import {
  DataTableComponent,
  ColumnDef,
} from '../../shared/components/data-table/data-table.component';
import { BadDebtTransferDialogComponent } from './bad-debt-transfer-dialog.component';
import { BadDebtViewDialogComponent, BadDebtViewData } from './bad-debt-view-dialog.component';
import {
  BadDebtRecoveryDialogComponent,
  BadDebtRecoveryDialogData,
} from './bad-debt-recovery-dialog.component';

interface BadDebtItem {
  badDebtCaseId: string;
  loanContractId?: string | null;
  contractCode?: string | null;
  contractNo?: string | null;
  customerName?: string | null;
  customerNationalId?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  outstandingPrincipalAmount?: number | null;
  totalOutstandingAmount?: number | null;
  recoveredAmountTotal?: number | null;
  statusCode?: string | null;
  transferDate?: string | null;
  transferredByName?: string | null;
  note?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Đang theo dõi',
  RECOVERING: 'Đang thu hồi',
  CLOSED: 'Đã đóng hồ sơ',
};

interface PolicyItem {
  storeId?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  badDebtStartDay?: number | null;
}

@Component({
  selector: 'app-bad-debts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TuiButton,
    TuiHint,
    TuiIcon,
    TuiTextfield,
    DataTableComponent,
  ],
  templateUrl: './bad-debts.component.html',
})
export class BadDebtsComponent implements OnInit {
  private readonly badDebtProvider = inject(BadDebtCaseProvider);
  private readonly policyProvider = inject(PolicySettingProvider);
  private readonly authService = inject(AuthService);
  private readonly injector = inject(Injector);

  cases = signal<BadDebtItem[]>([]);
  loading = signal(false);
  totalCount = signal(0);
  page = 0;
  size = 10;
  keyword = signal('');
  badDebtStartDay = signal(11);
  totalOutstandingAmount = signal(0);
  totalBadDebtCount = signal(0);
  private readonly summaryPageSize = 1000;

  readonly tableColumns: ColumnDef[] = [
    { key: 'customer', label: 'Khách hàng', class: 'min-w-48' },
    { key: 'contract', label: 'Hợp đồng', class: 'min-w-32' },
    { key: 'outstanding', label: 'Dư nợ', align: 'right', class: 'min-w-36' },
    { key: 'recovered', label: 'Đã thu hồi', align: 'right', class: 'min-w-32' },
    { key: 'status', label: 'Trạng thái', align: 'center', class: 'min-w-32' },
    { key: 'transferDate', label: 'Ngày chuyển', class: 'min-w-32' },
    { key: 'store', label: 'Chi nhánh', class: 'min-w-32' },
    { key: 'transferredBy', label: 'Người thực hiện', class: 'min-w-36' },
  ];

  canManage = computed(
    () =>
      this.authService.hasAnyRole([
        RoleCode.ADMIN,
        RoleCode.REGIONAL_MANAGER,
        RoleCode.STORE_MANAGER,
      ]) || this.authService.hasPermission('BAD_DEBT_TRANSFER'),
  );

  asCase(item: unknown): BadDebtItem {
    return item as BadDebtItem;
  }
  getStatusLabel(code?: string | null): string {
    return STATUS_LABELS[code ?? ''] ?? code ?? '-';
  }
  getStatusClass(code?: string | null): string {
    switch (code) {
      case 'OPEN':
        return 'bg-red-50 text-red-700 border border-red-200';
      case 'RECOVERING':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'CLOSED':
        return 'bg-green-50 text-green-700 border border-green-200';
      default:
        return 'bg-gray-100 text-gray-600 border border-gray-200';
    }
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

  remainingOutstandingAmount(item: BadDebtItem): number {
    const total = Math.max(0, Math.round(Number(item.totalOutstandingAmount ?? 0) || 0));
    const recovered = Math.max(0, Math.round(Number(item.recoveredAmountTotal ?? 0) || 0));
    return Math.max(0, total - recovered);
  }

  displayContractCode(item: BadDebtItem): string {
    return item.contractCode ?? item.contractNo ?? '-';
  }

  ngOnInit(): void {
    this.loadCases();
    this.loadSummary();
    this.loadPolicy();
  }

  loadPolicy(): void {
    this.policyProvider.apiPolicySettingGetAllGet().subscribe({
      next: (r) => {
        if (!r.status || !r.data) return;
        const today = new Date();
        const items: PolicyItem[] = Array.isArray(r.data) ? (r.data as PolicyItem[]) : [];
        const currentStoreId = this.authService.currentUser()?.storeId;
        const isActive = (p: PolicyItem) => {
          const from = p.effectiveFrom ? new Date(p.effectiveFrom) : null;
          const to = p.effectiveTo ? new Date(p.effectiveTo) : null;
          return (!from || from <= today) && (!to || to >= today);
        };
        const active = items.filter(isActive);
        const storePolicy = active.find((p) => p.storeId && p.storeId === currentStoreId);
        const systemPolicy = active.find((p) => !p.storeId);
        const policy = storePolicy ?? systemPolicy;
        if (policy?.badDebtStartDay) this.badDebtStartDay.set(policy.badDebtStartDay);
      },
    });
  }

  onKeywordChange(v: string): void {
    this.keyword.set(v);
    this.page = 0;
    this.loadCases();
    this.loadSummary();
  }
  onPaginationChange(e: { page: number; size: number }): void {
    this.page = e.page;
    this.size = e.size;
    this.loadCases();
  }

  private searchPage(pageIndex: number, pageSize: number) {
    const req: SearchBadDebtCaseRequest = {
      keyword: this.keyword() || null,
      pageIndex,
      pageSize,
      sortDesc: true,
    };
    return this.badDebtProvider.apiBadDebtCaseSearchPost({ searchBadDebtCaseRequest: req }).pipe(
      map((r) => {
        if (!r.status || !r.data) {
          return { items: [] as BadDebtItem[], totalCount: 0 };
        }
        const data = r.data as { items?: BadDebtItem[]; totalCount?: number };
        const items = data.items ?? (Array.isArray(r.data) ? (r.data as BadDebtItem[]) : []);
        return { items, totalCount: data.totalCount ?? items.length };
      }),
      catchError(() => of({ items: [] as BadDebtItem[], totalCount: 0 })),
    );
  }

  loadCases(): void {
    this.loading.set(true);
    const req: SearchBadDebtCaseRequest = {
      keyword: this.keyword() || null,
      pageIndex: this.page + 1,
      pageSize: this.size,
      sortDesc: true,
    };
    this.badDebtProvider.apiBadDebtCaseSearchPost({ searchBadDebtCaseRequest: req }).subscribe({
      next: (r) => {
        if (r.status && r.data) {
          const data = r.data as { items?: BadDebtItem[]; totalCount?: number };
          this.cases.set(data.items ?? (Array.isArray(r.data) ? (r.data as BadDebtItem[]) : []));
          this.totalCount.set(data.totalCount ?? this.cases().length);
        } else {
          this.cases.set([]);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadSummary(): void {
    this.searchPage(1, this.summaryPageSize)
      .pipe(
        switchMap((first) => {
          if (first.totalCount <= first.items.length) {
            return of(first.items);
          }

          const pageCount = Math.ceil(first.totalCount / this.summaryPageSize);
          const calls = Array.from({ length: pageCount - 1 }, (_, i) =>
            this.searchPage(i + 2, this.summaryPageSize),
          );
          return forkJoin(calls).pipe(
            map((rest) => [first.items, ...rest.map((r) => r.items)].flat()),
            catchError(() => of(first.items)),
          );
        }),
      )
      .subscribe({
        next: (items) => {
          this.totalBadDebtCount.set(items.length);
          this.totalOutstandingAmount.set(
            items.reduce((sum, item) => sum + this.remainingOutstandingAmount(item), 0),
          );
        },
        error: () => {
          this.totalBadDebtCount.set(0);
          this.totalOutstandingAmount.set(0);
        },
      });
  }

  refreshAll(): void {
    this.loadCases();
    this.loadSummary();
  }

  openTransferDialog(): void {
    tuiDialog(BadDebtTransferDialogComponent, {
      injector: this.injector,
      label: 'Chuyển Sang Nợ Xấu',
      size: 'm',
    })(undefined as any).subscribe(() => this.refreshAll());
  }

  openViewDialog(item: BadDebtItem): void {
    tuiDialog(BadDebtViewDialogComponent, {
      injector: this.injector,
      label: 'Chi Tiết Hồ Sơ Nợ Xấu',
      size: 'm',
    })(item as BadDebtViewData).subscribe((changed) => {
      if (changed) this.refreshAll();
    });
  }

  openRecoveryDialog(item: BadDebtItem): void {
    const data: BadDebtRecoveryDialogData = {
      badDebtCaseId: item.badDebtCaseId,
      contractCode: item.contractCode ?? item.contractNo,
      customerName: item.customerName,
      totalOutstandingAmount: item.totalOutstandingAmount,
      recoveredAmountTotal: item.recoveredAmountTotal,
    };
    tuiDialog(BadDebtRecoveryDialogComponent, {
      injector: this.injector,
      label: 'Ghi Nhận Thu Hồi Nợ Xấu',
      dismissible: false,
      size: 's',
    })(data).subscribe((saved) => {
      if (saved) this.refreshAll();
    });
  }
}
