import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  TuiAlertService,
  TuiButton,
  TuiIcon,
  TuiLabel,
  TuiNumberFormat,
  TuiNumberFormatSettings,
  TuiTextfield,
  type TuiDialogContext,
} from '@taiga-ui/core';
import { TuiCheckbox, TuiInputNumber } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';
import { CommonModule } from '@angular/common';

import { LoanProductProvider } from '../../api/api/loan-product.service';
import type { CULoanProductModel } from '../../api/model/cu-loan-product-model';
import { AuthService } from '../../services/auth.service';
import { TuiCurrencyPipe } from '@taiga-ui/addon-commerce';

export interface LoanProductFormItem {
  loanProductId: string;
  productCode?: string | null;
  productName?: string | null;
  description?: string | null;
  minPrincipalAmount?: number | null;
  maxPrincipalAmount?: number | null;
  minTermMonths?: number | null;
  maxTermMonths?: number | null;
  interestRateMonthly?: number | null;
  qlkvRateMonthly?: number | null;
  qltsRateMonthly?: number | null;
  fixedMonthlyFeeAmount?: number | null;
  defaultFileFeeAmount?: number | null;
  defaultInsuranceRate?: number | null;
  isActive?: boolean | null;
}

@Component({
  selector: 'app-loan-product-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiButton,
    TuiIcon,
    TuiLabel,
    TuiTextfield,
    TuiCheckbox,
    TuiNumberFormat,
    TuiInputNumber,
    TuiCurrencyPipe,
  ],
  templateUrl: './loan-product-form-dialog.component.html',
})
export class LoanProductFormDialogComponent implements OnInit {
  readonly context = injectContext<TuiDialogContext<void, LoanProductFormItem | null>>();
  private readonly fb = inject(FormBuilder);
  private readonly productProvider = inject(LoanProductProvider);
  private readonly alerts = inject(TuiAlertService);
  private readonly authService = inject(AuthService);

  readonly saving = signal(false);
  readonly editingProduct = computed(() => this.context.data);

  form = this.fb.group({
    productCode: ['', Validators.required],
    productName: ['', Validators.required],
    description: [null as string | null],
    minPrincipalAmount: [null as number | null],
    maxPrincipalAmount: [null as number | null],
    minTermMonths: [null as number | null],
    maxTermMonths: [null as number | null],
    interestRateMonthly: [null as number | null, Validators.required],
    qlkvRateMonthly: [null as number | null],
    qltsRateMonthly: [null as number | null],
    fixedMonthlyFeeAmount: [null as number | null],
    defaultFileFeeAmount: [null as number | null],
    defaultInsuranceRate: [null as number | null],
    isActive: [true],
  });
  protected numberFormat: Partial<TuiNumberFormatSettings> = {
    decimalSeparator: ',',
    thousandSeparator: '.',
  };

  ngOnInit(): void {
    const item = this.editingProduct();
    if (item) {
      this.form.patchValue({
        productCode: item.productCode ?? '',
        productName: item.productName ?? '',
        description: item.description ?? null,
        minPrincipalAmount: item.minPrincipalAmount ?? null,
        maxPrincipalAmount: item.maxPrincipalAmount ?? null,
        minTermMonths: item.minTermMonths ?? null,
        maxTermMonths: item.maxTermMonths ?? null,
        interestRateMonthly: item.interestRateMonthly ?? null,
        qlkvRateMonthly: item.qlkvRateMonthly ?? null,
        qltsRateMonthly: item.qltsRateMonthly ?? null,
        fixedMonthlyFeeAmount: item.fixedMonthlyFeeAmount ?? null,
        defaultFileFeeAmount: item.defaultFileFeeAmount ?? null,
        defaultInsuranceRate: item.defaultInsuranceRate ?? null,
        isActive: item.isActive ?? true,
      });
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const currentUser = this.authService.currentUser();
    const body: CULoanProductModel = {
      loanProductId: this.editingProduct()?.loanProductId ?? null,
      storeId: (currentUser as { storeId?: string })?.storeId ?? null,
      productCode: v.productCode!,
      productName: v.productName!,
      description: v.description ?? null,
      minPrincipalAmount: v.minPrincipalAmount ?? undefined,
      maxPrincipalAmount: v.maxPrincipalAmount ?? undefined,
      minTermMonths: v.minTermMonths ?? undefined,
      maxTermMonths: v.maxTermMonths ?? undefined,
      interestRateMonthly: v.interestRateMonthly ?? undefined,
      qlkvRateMonthly: v.qlkvRateMonthly ?? undefined,
      qltsRateMonthly: v.qltsRateMonthly ?? undefined,
      defaultFileFeeAmount: v.defaultFileFeeAmount ?? undefined,
      defaultInsuranceRate: v.defaultInsuranceRate ?? undefined,
      isActive: v.isActive ?? true,
    };
    (body as CULoanProductModel & { fixedMonthlyFeeAmount?: number }).fixedMonthlyFeeAmount =
      v.fixedMonthlyFeeAmount ?? undefined;
    this.saving.set(true);
    this.productProvider.apiLoanProductSavePost({ cULoanProductModel: body }).subscribe({
      next: (r) => {
        this.saving.set(false);
        if (r.status) {
          this.alerts
            .open(this.editingProduct() ? 'Cập nhật thành công' : 'Thêm sản phẩm thành công', {
              appearance: 'positive',
            })
            .subscribe();
          this.context.completeWith();
        } else {
          this.alerts.open('Có lỗi xảy ra', { appearance: 'negative' }).subscribe();
        }
      },
      error: () => {
        this.saving.set(false);
        this.alerts.open('Có lỗi xảy ra', { appearance: 'negative' }).subscribe();
      },
    });
  }
}
