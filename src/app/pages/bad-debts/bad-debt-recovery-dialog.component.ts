import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiAlertService, TuiButton, TuiNumberFormatSettings, TuiTextfield, type TuiDialogContext, TuiNumberFormat } from '@taiga-ui/core';
import { TuiInputDate, TuiInputNumber } from '@taiga-ui/kit';
import { TuiDay } from '@taiga-ui/cdk';
import { injectContext } from '@taiga-ui/polymorpheus';
import { BadDebtCaseOpsService } from '../../services/bad-debt-case-ops.service';
import {  TuiCurrencyPipe } from '@taiga-ui/addon-commerce';

export interface BadDebtRecoveryDialogData {
  badDebtCaseId: string;
  contractCode?: string | null;
  customerName?: string | null;
  totalOutstandingAmount?: number | null;
  recoveredAmountTotal?: number | null;
}

@Component({
  selector: 'app-bad-debt-recovery-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, TuiButton, TuiTextfield, TuiInputDate, TuiNumberFormat, TuiCurrencyPipe, TuiInputNumber],
  template: `
    <div class="p-4 min-w-[360px]">
      <h3 class="text-lg font-semibold text-gray-800 mb-4">Ghi nhận thu hồi nợ xấu</h3>

      @if (data.contractCode || data.customerName) {
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm">
          @if (data.customerName) {
            <div class="font-medium text-amber-800">{{ data.customerName }}</div>
          }
          @if (data.contractCode) {
            <div class="text-amber-600">Hợp đồng: {{ data.contractCode }}</div>
          }
          <div class="mt-1 text-amber-700">
            Dư nợ cần thu: <span class="font-bold">{{ fmt(remaining()) }}</span>
          </div>
        </div>
      }

      <form [formGroup]="form" class="flex flex-col gap-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Số tiền thu hồi <span class="text-red-500">*</span></label>
          <tui-textfield>
            <input
              tuiTextfield
              type="number"
              formControlName="amount"
              placeholder="Nhập số tiền"
              min="1"
            />
                    <input tuiInputNumber [tuiNumberFormat]="numberFormat" [postfix]="' VNĐ' | tuiCurrency" formControlName="amount" placeholder="VD: 100.000.000 VNĐ" />
          </tui-textfield>
          @if (form.controls.amount.invalid && form.controls.amount.touched) {
            <p class="text-xs text-red-500 mt-1">Số tiền phải lớn hơn 0</p>
          }
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Ngày thu <span class="text-red-500">*</span></label>
          <tui-textfield>
            <input tuiInputDate formControlName="businessDate" placeholder="dd/mm/yyyy" />
            <tui-calendar *tuiTextfieldDropdown />
          </tui-textfield>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
          <tui-textfield>
            <input tuiTextfield formControlName="note" placeholder="Lý do / ghi chú" />
          </tui-textfield>
        </div>
      </form>

      <div class="flex gap-2 justify-end mt-5">
        <button tuiButton appearance="outline" size="m" type="button" (click)="cancel()">
          Huỷ
        </button>
        <button
          tuiButton
          appearance="primary"
          size="m"
          type="button"
          [disabled]="saving() || form.invalid"
          (click)="save()"
        >
          {{ saving() ? 'Đang lưu...' : 'Ghi nhận' }}
        </button>
      </div>
    </div>
  `,
})
export class BadDebtRecoveryDialogComponent {
  readonly context = injectContext<TuiDialogContext<boolean, BadDebtRecoveryDialogData>>();
  private readonly badDebtOps = inject(BadDebtCaseOpsService);
  private readonly alerts = inject(TuiAlertService);
  private readonly fb = inject(FormBuilder);

  protected numberFormat: Partial<TuiNumberFormatSettings> = {
    decimalSeparator: ',',
    thousandSeparator: '.',
  };
  readonly data = this.context.data;
  readonly saving = signal(false);

  // Tiền còn lại cần thu
  remaining(): number {
    const total     = this.data.totalOutstandingAmount ?? 0;
    const recovered = this.data.recoveredAmountTotal    ?? 0;
    return Math.max(0, total - recovered);
  }

  fmt(val: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  }

  readonly today = TuiDay.currentLocal();

  form = this.fb.group({
    amount:       [this.remaining() > 0 ? this.remaining() : null, [Validators.required, Validators.min(1)]],
    businessDate: [this.today as TuiDay | null, Validators.required],
    note:         [''],
  });

  cancel(): void { this.context.completeWith(false); }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const v = this.form.getRawValue();
    const businessDateIso = v.businessDate
      ? `${v.businessDate.year}-${String(v.businessDate.month + 1).padStart(2, '0')}-${String(v.businessDate.day).padStart(2, '0')}`
      : new Date().toISOString().slice(0, 10);

    this.badDebtOps.recordRecovery({
      badDebtCaseId: this.data.badDebtCaseId,
      amount: Math.round(v.amount ?? 0),
      businessDate: businessDateIso,
      note: v.note?.trim() || undefined,
    }).subscribe({
      next: r => {
        this.saving.set(false);
        if (r.status) {
          this.alerts.open('Đã ghi nhận khoản thu hồi thành công.', { appearance: 'success' }).subscribe();
          this.context.completeWith(true);
        } else {
          this.alerts.open(r.message ?? 'Có lỗi xảy ra.', { appearance: 'error' }).subscribe();
        }
      },
      error: () => {
        this.saving.set(false);
        this.alerts.open('Lỗi kết nối, vui lòng thử lại.', { appearance: 'error' }).subscribe();
      },
    });
  }
}
