import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  TuiAlertService,
  TuiButton,
  TuiCalendar,
  TuiDataList,
  TuiIcon,
  TuiLabel,
  TuiNumberFormat,
  TuiNumberFormatSettings,
  TuiTextfield,
  TuiWithDropdownOpen,
  type TuiDialogContext,
  TuiSelectLike,
} from '@taiga-ui/core';
import { TuiChevron, TuiComboBox, TuiFilterByInputPipe, TuiInputDate, TuiInputNumber } from '@taiga-ui/kit';
import { TuiDay, TuiStringHandler, TuiStringMatcher } from '@taiga-ui/cdk';
import { injectContext } from '@taiga-ui/polymorpheus';
import { CommonModule } from '@angular/common';

import { CashVoucherProvider } from '../../api/api/cash-voucher.service';
import { CustomerProvider } from '../../api/api/customer.service';
import { LoanContractProvider } from '../../api/api/loan-contract.service';
import type { CUCashVoucherModel } from '../../api/model/cu-cash-voucher-model';
import { AuthService } from '../../services/auth.service';
import { ReferenceDataService } from '../../services/reference-data.service';
import { RoleCode } from '../../models/role.model';
import { TuiCurrencyPipe } from '@taiga-ui/addon-commerce';

interface CustomerOption {
  customerId: string;
  fullName: string;
  customerCode?: string | null;
  nationalId?: string | null;
}
interface LoanOption {
  loanContractId: string;
  contractNo?: string | null;
  customerName?: string | null;
}

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  RECEIPT: 'Phiếu Thu',
  PAYMENT: 'Phiếu Chi',
};

const REASON_LABELS: Record<string, string> = {
  LOAN_COLLECTION: 'Thu khoản cầm cố/thuê lại/cầm đồ',
  LOAN_DISBURSEMENT: 'Giải ngân',
  FILE_FEE: 'Phí hồ sơ',
  LATE_PENALTY: 'Phạt chậm nộp',
  EARLY_SETTLEMENT_PENALTY: 'Phạt tất toán sớm',
  OVERPAYMENT: 'Thu dư',
  OTHER_INCOME: 'Thu khác',
  OTHER_EXPENSE: 'Chi khác',
};

const REASONS_BY_TYPE: Record<string, string[]> = {
  RECEIPT: [
    'LOAN_COLLECTION',
    'FILE_FEE',
    'LATE_PENALTY',
    'EARLY_SETTLEMENT_PENALTY',
    'OVERPAYMENT',
    'OTHER_INCOME',
  ],
  PAYMENT: ['LOAN_DISBURSEMENT', 'OTHER_EXPENSE'],
};

@Component({
  selector: 'app-voucher-create-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiButton,
    TuiIcon,
    TuiLabel,
    TuiTextfield,
    TuiChevron,
    TuiComboBox,
    TuiDataList,
    TuiCalendar,
    TuiWithDropdownOpen,
    TuiInputDate,
    TuiNumberFormat,
    TuiInputNumber,
    TuiCurrencyPipe,
    TuiFilterByInputPipe,
    TuiSelectLike,
  ],
  templateUrl: './voucher-create-dialog.component.html',
})
export class VoucherCreateDialogComponent implements OnInit {
  readonly context = injectContext<TuiDialogContext<void, void>>();
  private readonly fb = inject(FormBuilder);
  private readonly voucherProvider = inject(CashVoucherProvider);
  private readonly customerProvider = inject(CustomerProvider);
  private readonly loanProvider = inject(LoanContractProvider);
  private readonly alerts = inject(TuiAlertService);
  private readonly authService = inject(AuthService);

  private readonly refData = inject(ReferenceDataService);

  readonly saving = signal(false);
  readonly customers = signal<CustomerOption[]>([]);
  readonly loanContracts = signal<LoanOption[]>([]);
  private readonly selectedType = signal<string>('RECEIPT');

  readonly canPickStore = computed(() =>
    this.authService.hasAnyRole([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER]),
  );
  readonly storeList = computed(() => {
    const all = this.refData.storeList();
    const user = this.authService.currentUser();
    if (this.authService.hasRole(RoleCode.ADMIN)) return all;
    if (this.authService.hasRole(RoleCode.REGIONAL_MANAGER)) {
      const allowed = new Set(user?.storeIds ?? []);
      return all.filter((s) => allowed.has(s.storeId));
    }
    const storeId = user?.storeId;
    return storeId ? all.filter((s) => s.storeId === storeId) : [];
  });

  protected numberFormat: Partial<TuiNumberFormatSettings> = {
    decimalSeparator: ',',
    thousandSeparator: '.',
  };

  readonly voucherTypes = ['RECEIPT', 'PAYMENT'];
  readonly filteredReasonCodes = computed(
    () => REASONS_BY_TYPE[this.selectedType()] ?? Object.keys(REASON_LABELS),
  );

  readonly typeStringify: TuiStringHandler<string> = (v) => VOUCHER_TYPE_LABELS[v] ?? v;
  readonly reasonStringify: TuiStringHandler<string> = (v) => REASON_LABELS[v] ?? v;
  
  readonly paymentMethods = ['CASH', 'COMPANY_ACCOUNT'];
  readonly paymentMethodStringify: TuiStringHandler<string> = (v) => v === 'COMPANY_ACCOUNT' ? 'Chuyển khoản / Tài khoản công ty' : 'Tiền mặt';
  readonly paymentMethodMatcher: TuiStringMatcher<string> = (v, q) => {
    if (!v || !q) return false;
    const qn = this.normalizeVi(q);
    return this.normalizeVi(this.paymentMethodStringify(v)) === qn || this.normalizeVi(v) === qn;
  };

  readonly typeMatcher: TuiStringMatcher<string> = (v, q) => {
    if (!v || !q) return false;
    const qn = this.normalizeVi(q);
    return this.normalizeVi(this.typeStringify(v)) === qn || this.normalizeVi(v) === qn;
  };
  readonly reasonMatcher: TuiStringMatcher<string> = (v, q) => {
    if (!v || !q) return false;
    const qn = this.normalizeVi(q);
    return this.normalizeVi(this.reasonStringify(v)) === qn || this.normalizeVi(v) === qn;
  };

  readonly customerStringify: TuiStringHandler<CustomerOption | string> = (item) => {
    if (!item) return '';
    if (typeof item === 'string') {
      return this.customers().find((c) => c.customerId === item)?.fullName ?? item;
    }
    return this.normalizeVi(`${item.fullName} ${item.customerCode ?? item.nationalId ?? ''}`.trim());
  };
  readonly customerMatcher: TuiStringMatcher<string> = (id, q) => {
    if (!id || !q) return false;
    const c = this.customers().find((x) => x.customerId === id);
    if (!c) return false;
    const qn = this.normalizeVi(q);
    return (
      this.normalizeVi(c.fullName) === qn ||
      this.normalizeVi(c.customerCode ?? '') === qn ||
      this.normalizeVi(c.nationalId ?? '') === qn
    );
  };

  readonly storeStringify: TuiStringHandler<{ storeId: string; storeName: string; storeCode?: string } | string> = (
    item,
  ) => {
    if (!item) return '';
    if (typeof item === 'string') {
      return this.storeList().find((s) => s.storeId === item)?.storeName ?? item;
    }
    return this.normalizeVi(`${item.storeName} ${item.storeCode ?? ''}`.trim());
  };
  readonly storeMatcher: TuiStringMatcher<string> = (id, q) => {
    if (!id || !q) return false;
    const store = this.storeList().find((s) => s.storeId === id);
    if (!store) return false;
    const qn = this.normalizeVi(q);
    return this.normalizeVi(store.storeName) === qn || this.normalizeVi(store.storeCode ?? '') === qn;
  };

  readonly loanStringify: TuiStringHandler<string> = (id) => {
    if (!id) return '';
    const l = this.loanContracts().find((x) => x.loanContractId === id);
    return l ? (l.contractNo ?? l.customerName ?? id) : id;
  };
  readonly loanMatcher: TuiStringMatcher<string> = (id, q) => {
    if (!id || !q) return false;
    const l = this.loanContracts().find((x) => x.loanContractId === id);
    if (!l) return false;
    const qn = this.normalizeVi(q);
    return this.normalizeVi(l.contractNo ?? '') === qn || this.normalizeVi(l.customerName ?? '') === qn;
  };

  form = this.fb.group({
    storeId: [null as string | null],
    voucherType: ['RECEIPT' as string | null, Validators.required],
    reasonCode: [null as string | null, Validators.required],
    businessDate: [null as TuiDay | null, Validators.required],
    payerReceiverName: ['', Validators.required],
    payerReceiverAddress: [null as string | null],
    amount: [null as number | null, [Validators.required, Validators.min(1)]],
    description: ['', Validators.required],
    customerId: [null as string | null],
    loanContractId: [null as string | null],
    documentNo: [null as string | null],
    paymentMethod: ['CASH' as string],
    bankName: [null as string | null],
    bankAccountNumber: [null as string | null],
  });

  onTypeChange(type: string): void {
    this.selectedType.set(type);
    const allowed = REASONS_BY_TYPE[type] ?? [];
    const currentReason = this.form.value.reasonCode;
    if (currentReason && !allowed.includes(currentReason)) {
      this.form.patchValue({ reasonCode: null });
    }
  }

  private normalizeVi(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .trim();
  }

  ngOnInit(): void {
    const today = new Date();
    this.form.patchValue({
      businessDate: new TuiDay(today.getFullYear(), today.getMonth(), today.getDate()),
    });

    this.form.controls.voucherType.valueChanges.subscribe((type) => {
      if (type) this.onTypeChange(type);
    });

    this.form.controls.paymentMethod.valueChanges.subscribe((method) => {
      const isCompany = method === 'COMPANY_ACCOUNT';
      if (isCompany) {
        this.form.controls.bankName.setValidators([Validators.required]);
        this.form.controls.bankAccountNumber.setValidators([Validators.required]);
      } else {
        this.form.controls.bankName.clearValidators();
        this.form.controls.bankAccountNumber.clearValidators();
        this.form.patchValue({ bankName: null, bankAccountNumber: null });
      }
      this.form.controls.bankName.updateValueAndValidity();
      this.form.controls.bankAccountNumber.updateValueAndValidity();
    });

    // Logic default store removed as per user request.

    this.customerProvider
      .apiCustomerSearchPost({ searchCustomerRequest: { pageSize: 5000 } })
      .subscribe({
        next: (r) => {
          if (r.status && r.data) {
            const data = r.data as { items?: CustomerOption[] };
            this.customers.set(data.items ?? []);
          }
        },
        error: () => {},
      });
    this.loanProvider
      .apiLoanContractSearchPost({
        searchLoanContractRequest: { pageSize: 5000, sortBy: 'ApplicationDate', sortDesc: true },
      })
      .subscribe({
        next: (r) => {
          if (r.status && r.data) {
            const data = r.data as { items?: LoanOption[] };
            this.loanContracts.set(data.items ?? []);
          }
        },
        error: () => {},
      });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const body: CUCashVoucherModel = {
      storeId: this.canPickStore()
        ? (v.storeId ?? undefined)
        : (this.authService.currentUser()?.storeId ?? undefined),
      voucherType: v.voucherType!,
      reasonCode: v.reasonCode!,
      businessDate: v.businessDate ? v.businessDate.toJSON() : undefined,
      payerReceiverName: v.payerReceiverName ?? null,
      payerReceiverAddress: v.payerReceiverAddress ?? null,
      amount: v.amount!,
      description: v.description!,
      customerId: v.customerId ?? null,
      loanContractId: v.loanContractId ?? null,
      documentNo: v.documentNo ?? null,
      paymentMethod: v.paymentMethod ?? 'CASH',
      bankName: v.bankName ?? null,
      bankAccountNumber: v.bankAccountNumber ?? null,
    };
    this.saving.set(true);
    this.voucherProvider.apiCashVoucherSavePost({ cUCashVoucherModel: body }).subscribe({
      next: (r) => {
        this.saving.set(false);
        if (r.status) {
          this.alerts.open('Tạo phiếu thành công', { appearance: 'positive' }).subscribe();
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
