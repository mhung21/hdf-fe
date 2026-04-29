import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TuiAlertService, TuiButton, TuiIcon, type TuiDialogContext } from '@taiga-ui/core';
import { injectContext } from '@taiga-ui/polymorpheus';
import { CommonModule } from '@angular/common';
import { BadDebtCaseProvider } from '../../api/api/bad-debt-case.service';
import { AuthService } from '../../services/auth.service';
import { RoleCode } from '../../models/role.model';

export interface BadDebtViewData {
  badDebtCaseId: string;
  caseCode?: string | null;
  loanContractId?: string | null;
  storeId?: string | null;
  contractCode?: string | null;
  contractNo?: string | null;
  customerName?: string | null;
  customerNationalId?: string | null;
  storeName?: string | null;
  outstandingPrincipalAmount?: number | null;
  totalOutstandingAmount?: number | null;
  recoveredAmountTotal?: number | null;
  statusCode?: string | null;
  transferDate?: string | null;
  note?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Đang theo dõi',
  RECOVERING: 'Đang thu hồi',
  ACTIVE: 'Đang theo dõi',
  RECOVERED: 'Đã thu hồi',
  WRITTEN_OFF: 'Đã xóa nợ',
  CLOSED: 'Đã đóng',
};

@Component({
  selector: 'app-bad-debt-view-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TuiButton, TuiIcon],
  templateUrl: './bad-debt-view-dialog.component.html',
})
export class BadDebtViewDialogComponent {
  readonly context = injectContext<TuiDialogContext<boolean, BadDebtViewData>>();
  private readonly badDebtProvider = inject(BadDebtCaseProvider);
  private readonly alert = inject(TuiAlertService);
  private readonly authService = inject(AuthService);
  readonly item = computed(() => this.context.data);
  readonly saving = signal(false);

  readonly canManage = computed(() =>
    this.authService.hasAnyRole([
      RoleCode.ADMIN,
      RoleCode.REGIONAL_MANAGER,
      RoleCode.STORE_MANAGER,
    ]),
  );

  readonly canClose = computed(() => {
    const s = this.item().statusCode;
    return this.canManage() && (s === 'OPEN' || s === 'RECOVERING' || s === 'ACTIVE');
  });

  getStatusLabel(code?: string | null): string {
    return STATUS_LABELS[code ?? ''] ?? code ?? '-';
  }
  getStatusClass(code?: string | null): string {
    switch (code) {
      case 'OPEN':
      case 'ACTIVE':
        return 'bg-red-50 text-red-700 border border-red-200';
      case 'RECOVERING':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'RECOVERED':
        return 'bg-green-50 text-green-700 border border-green-200';
      case 'WRITTEN_OFF':
      case 'CLOSED':
        return 'bg-gray-100 text-gray-500 border border-gray-200';
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

  displayContractCode(c: BadDebtViewData): string {
    return c.contractCode ?? c.contractNo ?? '-';
  }

  closeBadDebtCase(): void {
    const c = this.item();
    if (!c.loanContractId || !c.storeId) {
      this.alert
        .open('Thiếu thông tin hợp đồng để đóng hồ sơ.', { appearance: 'negative' })
        .subscribe();
      return;
    }
    this.saving.set(true);
    this.badDebtProvider
      .apiBadDebtCaseSavePost({
        cUBadDebtCaseModel: {
          badDebtCaseId: c.badDebtCaseId,
          loanContractId: c.loanContractId,
          storeId: c.storeId,
          outstandingPrincipalAmount: c.outstandingPrincipalAmount ?? undefined,
          totalOutstandingAmount: c.totalOutstandingAmount ?? undefined,
          recoveredAmountTotal: c.recoveredAmountTotal ?? undefined,
          statusCode: 'CLOSED',
          note: c.note,
        },
      })
      .subscribe({
        next: (r) => {
          this.saving.set(false);
          if (r.status) {
            this.alert
              .open('Đóng hồ sơ nợ xấu thành công. Khách hàng có thể mở hồ sơ trở lại.', {
                appearance: 'positive',
              })
              .subscribe();
            this.context.$implicit.next(true);
            this.context.$implicit.complete();
          } else {
            this.alert.open(r.message ?? 'Có lỗi xảy ra.', { appearance: 'negative' }).subscribe();
          }
        },
        error: () => {
          this.saving.set(false);
          this.alert.open('Lỗi kết nối.', { appearance: 'negative' }).subscribe();
        },
      });
  }
}
