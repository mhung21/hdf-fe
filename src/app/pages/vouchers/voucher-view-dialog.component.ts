import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { TuiButton, TuiIcon, type TuiDialogContext } from '@taiga-ui/core';
import { injectContext } from '@taiga-ui/polymorpheus';
import { CommonModule } from '@angular/common';

export interface VoucherViewData {
  voucherId: string;
  voucherNo?: string | null;
  voucherType?: string | null;
  reasonCode?: string | null;
  businessDate?: string | null;
  payerReceiverName?: string | null;
  amount?: number | null;
  description?: string | null;
  contractCode?: string | null;
  customerName?: string | null;
  storeName?: string | null;
  isAdjustment?: boolean | null;
  paymentMethod?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
}

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  RECEIPT: 'Phiếu Thu',
  PAYMENT: 'Phiếu Chi',
};

const REASON_LABELS: Record<string, string> = {
  LOAN_COLLECTION: 'Thu khoản cầm cố/thuê lại/cầm đồ',
  LOAN_DISBURSEMENT: 'Giải ngân',
  FILE_FEE: 'Phí hồ sơ',
  INSURANCE: 'Bảo hiểm',
  LATE_PENALTY: 'Phạt chậm nộp',
  EARLY_SETTLEMENT_PENALTY: 'Phạt tất toán sớm',
  OVERPAYMENT: 'Thu dư',
  OTHER_INCOME: 'Thu khác',
  OTHER_EXPENSE: 'Chi khác',
};

@Component({
  selector: 'app-voucher-view-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TuiButton, TuiIcon],
  templateUrl: './voucher-view-dialog.component.html',
})
export class VoucherViewDialogComponent {
  readonly context = injectContext<TuiDialogContext<void, VoucherViewData>>();
  readonly item = computed(() => this.context.data);

  getTypeLabel(v?: string | null): string {
    return VOUCHER_TYPE_LABELS[v ?? ''] ?? v ?? '-';
  }
  getReasonLabel(v?: string | null): string {
    return REASON_LABELS[v ?? ''] ?? v ?? '-';
  }
  getTypeClass(v?: string | null): string {
    return v === 'RECEIPT'
      ? 'bg-green-50 text-green-700 border border-green-200'
      : 'bg-red-50 text-red-700 border border-red-200';
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
}
