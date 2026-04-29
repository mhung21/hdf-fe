import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, forkJoin, map, Observable, switchMap, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { addMonths, differenceInDays, format } from 'date-fns';
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
  type TuiDialogContext,
} from '@taiga-ui/core';
import {
  TuiChevron,
  TuiCheckbox,
  TuiComboBox,
  TuiInputDate,
  TuiInputNumber,
  TuiTabs,
} from '@taiga-ui/kit';
import { TuiDay, TuiStringHandler, TuiStringMatcher } from '@taiga-ui/cdk';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiCurrencyPipe } from '@taiga-ui/addon-commerce';

import { LoanContractProvider } from '../../api/api/loan-contract.service';
import { LoanContractAttachmentProvider } from '../../api/api/loan-contract-attachment.service';
import { CustomerProvider } from '../../api/api/customer.service';
import { LoanProductProvider } from '../../api/api/loan-product.service';
import { CULoanContractModel } from '../../api/model/cu-loan-contract-model';
import { LoanContractStatus } from '../../models/loan-contract-status.model';
import { AuthService } from '../../services/auth.service';
import { ReferenceDataService } from '../../services/reference-data.service';
import { RoleCode } from '../../models/role.model';
import { LoanPrintService } from './loan-print.service';
import {
  LoanCollateralService,
  COLLATERAL_TYPE_LABELS,
  COLLATERAL_TYPES,
  COLLATERAL_SERIAL_LABEL,
  COLLATERAL_SERIAL_PLACEHOLDER,
} from '../../services/loan-collateral.service';
import {
  LoanContractDocumentService,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
} from '../../services/loan-contract-document.service';

export interface LoanProductOption {
  loanProductId: string;
  productName: string;
  productCode: string;
  interestRateMonthly?: number;
  qlkvRateMonthly?: number;
  qltsRateMonthly?: number;
  fixedMonthlyFeeAmount?: number;
  defaultFileFeeAmount?: number;
  defaultInsuranceRate?: number;
  minPrincipalAmount?: number;
  maxPrincipalAmount?: number;
  minTermMonths?: number;
  maxTermMonths?: number;
}

export interface CustomerOption {
  customerId: string;
  customerCode?: string | null;
  firstStoreId?: string | null;
  storeId?: string | null;
  fullName: string;
  nationalId?: string | null;
  phone?: string | null;
  hasBadHistory?: boolean;
}

interface RepaymentScheduleRow {
  periodNo?: number;
  dayCount?: number;
  dueDate?: string;
  installmentAmount?: number;
  principalAmount?: number;
  interestAmount?: number;
  qlkvAmount?: number;
  fixedMonthlyFeeAmount?: number;
  qltsAmount?: number;
  periodicFeeAmount?: number;
  totalPayment?: number;
  remainingPrincipal?: number;
}

interface CalculateResult {
  monthlyPayment?: number;
  totalInterest?: number;
  totalPeriodicFee?: number;
  totalPayment?: number;
  schedule?: RepaymentScheduleRow[];
}

/** Tài liệu đang chờ upload (chưa có loanContractId) */
interface PendingDoc {
  id: number;
  file: File;
  previewUrl: string;
  type: string;
}

type TabKey = 'info' | 'collateral' | 'docs';
type ContractType = 'INSTALLMENT' | 'PAWN';

/** Dữ liệu hợp đồng nháp khi mở dialog để chỉnh sửa; undefined khi tạo mới */
export interface LoanCreateDialogData {
  loanContractId: string;
  storeId?: string | null;
  customerId?: string | null;
  contractType?: ContractType | null;
  loanProductId?: string | null;
  principalAmount?: number | null;
  termMonths?: number | null;
  applicationDate?: string | null;
  interestRateMonthlySnapshot?: number | null;
  qlkvRateMonthlySnapshot?: number | null;
  qltsRateMonthlySnapshot?: number | null;
  fixedMonthlyFeeAmountSnapshot?: number | null;
  fileFeeAmountSnapshot?: number | null;
  insuranceAmountSnapshot?: number | null;
  pawnInterestAmountPerMillionPerDaySnapshot?: number | null;
  pawnFeeAmountPerMillionPerDaySnapshot?: number | null;
  pawnPeriodDaysSnapshot?: number | null;
  note?: string | null;
  customerSourceId?: string | null;
}

@Component({
  selector: 'app-loan-create-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TuiButton,
    TuiCheckbox,
    TuiIcon,
    TuiLabel,
    TuiTextfield,
    TuiChevron,
    TuiComboBox,
    TuiDataList,
    TuiCalendar,
    TuiInputDate,
    TuiNumberFormat,
    TuiInputNumber,
    TuiCurrencyPipe,
    TuiTabs,
  ],
  templateUrl: './loan-create-dialog.component.html',
})
export class LoanCreateDialogComponent {
  readonly context = injectContext<TuiDialogContext<void, LoanCreateDialogData | undefined>>();
  private readonly loanProvider = inject(LoanContractProvider);
  private readonly attachmentProvider = inject(LoanContractAttachmentProvider);
  private readonly customerProvider = inject(CustomerProvider);
  private readonly loanProductProvider = inject(LoanProductProvider);
  private readonly alertService = inject(TuiAlertService);
  private readonly authService = inject(AuthService);
  private readonly refData = inject(ReferenceDataService);
  private readonly printService = inject(LoanPrintService);
  private readonly fb = inject(FormBuilder);
  private readonly collateralSvc = inject(LoanCollateralService);
  protected readonly documentSvc = inject(LoanContractDocumentService);

  /** ID hợp đồng đang chỉnh sửa (nếu là bản nháp), null nếu tạo mới */
  readonly editingId = signal<string | null>(null);
  readonly loadingExisting = signal(false);

  readonly LoanContractStatus = LoanContractStatus;

  // ── Tabs ─────────────────────────────────────────────────────────────────
  activeTab = signal<TabKey>('info');

  readonly tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'info', label: 'Thông tin', icon: '@tui.file-text' },
    { key: 'collateral', label: 'Tài sản đảm bảo', icon: '@tui.landmark' },
    { key: 'docs', label: 'Hồ sơ giấy tờ', icon: '@tui.folder-open' },
  ];

  protected numberFormat: Partial<TuiNumberFormatSettings> = {
    decimalSeparator: ',',
    thousandSeparator: '.',
  };

  saving = signal(false);
  /** Checkbox: hợp đồng đã giải ngân rồi nhưng mới nhập hệ thống (nhập hậu kỳ). */
  alreadyDisbursed = signal(false);
  /** Ngày giải ngân thực tế được chọn khi nhập hậu kỳ. */
  backdatedDisbursedDate = signal<TuiDay | null>(null);
  /** Chỉ Manager/Admin mới được nhập hậu kỳ (tạo hợp đồng đã giải ngân). */
  readonly canBackdateDisbursement = computed(() =>
    this.authService.hasAnyRole([
      RoleCode.ADMIN,
      RoleCode.REGIONAL_MANAGER,
      RoleCode.STORE_MANAGER,
    ]),
  );
  customers = signal<CustomerOption[]>([]);
  loanProducts = signal<LoanProductOption[]>([]);

  readonly collateralTypes = COLLATERAL_TYPES;
  readonly collateralTypeStringify: TuiStringHandler<string> = (t) => {
    if (!t) return '';
    return COLLATERAL_TYPE_LABELS[t] ?? t;
  };
  readonly collateralTypeMatcher: TuiStringMatcher<string> = (t, q) => {
    if (!t || !q) return false;
    return this.normalizeVi(this.collateralTypeStringify(t)).includes(this.normalizeVi(q));
  };

  readonly collateralForm = this.fb.group({
    collateralType: ['OTHER' as string, Validators.required],
    description: ['', Validators.required],
    serialNumber: [null as string | null],
    estimatedValue: [null as number | null],
    detail: [null as string | null],
    note: [null as string | null],
  });

  // ── Hồ sơ giấy tờ (queue trước khi save) ─────────────────────────────────
  private pendingDocCounter = 0;

  /** PDF hợp đồng đang chờ */
  pendingPdf = signal<File | null>(null);
  /** Các giấy tờ khác đang chờ */
  pendingOtherDocs = signal<PendingDoc[]>([]);
  /** Loại tài liệu được chọn cho "Giấy tờ khác" */
  pendingOtherDocType = signal<string>('OTHER');

  readonly documentTypes = DOCUMENT_TYPES.filter((t) => t !== 'ID_FRONT' && t !== 'ID_BACK');
  readonly documentTypeStringify: TuiStringHandler<string> = (t) => {
    if (!t) return '';
    return DOCUMENT_TYPE_LABELS[t] ?? t;
  };
  readonly documentTypeMatcher: TuiStringMatcher<string> = (t, q) => {
    if (!t || !q) return false;
    return this.normalizeVi(this.documentTypeStringify(t)).includes(this.normalizeVi(q));
  };

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
  readonly customerSources = computed(() => this.refData.customerSources());
  readonly getSerialNumberLabel = (type: string): string =>
    COLLATERAL_SERIAL_LABEL[type] ?? 'Mã định danh (nếu có)';
  readonly getSerialNumberPlaceholder = (type: string): string =>
    COLLATERAL_SERIAL_PLACEHOLDER[type] ?? '';

  /** Chuẩn hóa tiếng Việt: bỏ dấu + lowercase để so sánh không phân biệt dấu */
  private normalizeVi(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'))
      .toLowerCase();
  }

  readonly filteredCustomers = computed(() => {
    const storeId = this._storeIdSig() ?? null;
    const list = this.customers();
    if (!storeId) return list;
    return list.filter((c) => (c.firstStoreId ?? c.storeId ?? null) === storeId);
  });

  readonly customerStringify: TuiStringHandler<string> = (id) => {
    if (!id) return '';
    return (
      this.filteredCustomers().find((c) => c.customerId === id)?.fullName ??
      this.customers().find((c) => c.customerId === id)?.fullName ??
      id
    );
  };
  readonly customerMatcher: TuiStringMatcher<string> = (id, query) => {
    if (!id || !query) return false;
    const qn = this.normalizeVi(query);
    const customer = this.filteredCustomers().find((c) => c.customerId === id);
    if (!customer) return false;
    return (
      this.normalizeVi(customer.fullName).includes(qn) ||
      this.normalizeVi(customer.customerCode ?? '').includes(qn)
    );
  };

  readonly productStringify: TuiStringHandler<string> = (id) => {
    if (!id) return '';
    return this.loanProducts().find((p) => p.loanProductId === id)?.productName ?? id;
  };
  readonly productMatcher: TuiStringMatcher<string> = (id, query) => {
    if (!id || !query) return false;
    return this.normalizeVi(this.productStringify(id)).includes(this.normalizeVi(query));
  };

  readonly storeStringify: TuiStringHandler<string> = (id) => {
    if (!id) return '';
    return this.storeList().find((s) => s.storeId === id)?.storeName ?? id;
  };
  readonly storeMatcher: TuiStringMatcher<string> = (id, query) => {
    if (!id || !query) return false;
    return this.normalizeVi(this.storeStringify(id)).includes(this.normalizeVi(query));
  };

  readonly customerSourceStringify: TuiStringHandler<string> = (id) => {
    if (!id) return '';
    return this.customerSources().find((s) => s.sourceId === id)?.sourceName ?? id;
  };
  readonly customerSourceMatcher: TuiStringMatcher<string> = (id, query) => {
    if (!id || !query) return false;
    return this.normalizeVi(this.customerSourceStringify(id)).includes(this.normalizeVi(query));
  };

  form = this.fb.group({
    storeId: [null as string | null],
    customerId: ['', Validators.required],
    contractType: ['INSTALLMENT' as ContractType, Validators.required],
    loanProductId: [null as string | null],
    principalAmount: [null as number | null, [Validators.required, Validators.min(1)]],
    termMonths: [null as number | null, [Validators.required, Validators.min(1)]],
    applicationDate: [null as TuiDay | null, Validators.required],
    interestRateMonthlySnapshot: [null as number | null, Validators.required],
    qlkvRateMonthlySnapshot: [null as number | null],
    qltsRateMonthlySnapshot: [null as number | null],
    fixedMonthlyFeeAmountSnapshot: [null as number | null],
    fileFeeAmountSnapshot: [null as number | null],
    insuranceAmountSnapshot: [null as number | null],
    pawnInterestAmountPerMillionPerDaySnapshot: [null as number | null],
    pawnFeeAmountPerMillionPerDaySnapshot: [null as number | null],
    pawnPeriodDaysSnapshot: [10 as number | null],
    note: [null as string | null],
    customerSourceId: [null as string | null],
  });

  // ── Signals: theo dõi principal + productId để tính phí tự động ──────────
  private readonly _principalSig = toSignal(this.form.controls.principalAmount.valueChanges, {
    initialValue: null as number | null,
  });
  private readonly _loanProductIdSig = toSignal(this.form.controls.loanProductId.valueChanges, {
    initialValue: null as string | null,
  });
  private readonly _contractTypeSig = toSignal(this.form.controls.contractType.valueChanges, {
    initialValue: this.form.controls.contractType.value as ContractType,
  });
  private readonly _storeIdSig = toSignal(this.form.controls.storeId.valueChanges, {
    initialValue: this.form.controls.storeId.value,
  });

  /** Sản phẩm vay đang chọn — dùng để hiển thị hint và validate. */
  readonly selectedProduct = computed(() =>
    this._contractTypeSig() === 'INSTALLMENT'
      ? (this.loanProducts().find((p) => p.loanProductId === this._loanProductIdSig()) ?? null)
      : null,
  );

  readonly selectedContractType = computed<ContractType>(
    () => this._contractTypeSig() ?? 'INSTALLMENT',
  );

  readonly isPawnContract = computed(() => this.selectedContractType() === 'PAWN');

  /** Tính tự động phí hồ sơ + bảo hiểm khi principal hoặc sản phẩm thay đổi */
  private readonly derivedUpfrontFees = computed(() => {
    if (this.selectedContractType() !== 'INSTALLMENT') return null;
    const principal = this._principalSig() ?? 0;
    const productId = this._loanProductIdSig();
    if (!productId) return null;
    const p = this.loanProducts().find((x) => x.loanProductId === productId);
    if (!p) return null;
    return {
      fileFee: Math.round((principal * (p.defaultFileFeeAmount ?? 0)) / 100),
      insuranceFee: Math.round((principal * (p.defaultInsuranceRate ?? 0)) / 100),
    };
  });

  private readonly _customerIdSig = toSignal(this.form.controls.customerId.valueChanges, {
    initialValue: this.form.controls.customerId.value,
  });

  /** Khách hàng đang chọn — tự cập nhật khi customerId thay đổi */
  readonly selectedCustomer = computed(
    () => this.customers().find((c) => c.customerId === this._customerIdSig()) ?? null,
  );

  /** Form value snapshot sau 300ms debounce để tính lịch trả nợ */
  private readonly _formValueSig = toSignal(this.form.valueChanges.pipe(debounceTime(300)), {
    initialValue: this.form.value,
  });

  /** Kết quả tính toán lịch trả nợ — computed tự động, không cần set() thủ công */
  readonly calculateResult = computed<CalculateResult | null>(() => {
    const v = this._formValueSig();
    if (!v.principalAmount || !v.termMonths) return null;

    // Nếu đang nhập hậu kỳ: tính lịch từ ngày giải ngân thực tế đã chọn
    const backdated = this.backdatedDisbursedDate();
    const baseDate =
      this.alreadyDisbursed() && backdated
        ? new Date(backdated.year, backdated.month, backdated.day)
        : v.applicationDate
          ? new Date(v.applicationDate.year, v.applicationDate.month, v.applicationDate.day)
          : null;

    if (this.selectedContractType() === 'PAWN') {
      const principal =
        (v.principalAmount ?? 0) + Math.max(0, Math.round(v.insuranceAmountSnapshot ?? 0));
      const periodCount = Math.max(1, v.termMonths);
      const periodDays = Math.max(1, Math.round(v.pawnPeriodDaysSnapshot ?? 10));
      const interestRatePerMillionPerDay = v.pawnInterestAmountPerMillionPerDaySnapshot ?? 0;
      const feeRatePerMillionPerDay = v.pawnFeeAmountPerMillionPerDaySnapshot ?? 0;

      const schedule: RepaymentScheduleRow[] = [];
      let totalInterest = 0;
      let totalPeriodicFee = 0;
      let totalPayment = 0;

      for (let i = 1; i <= periodCount; i++) {
        const dueDate = baseDate
          ? new Date(
              baseDate.getFullYear(),
              baseDate.getMonth(),
              baseDate.getDate() + i * periodDays,
            )
          : null;
        const interest = Math.round(
          (principal * interestRatePerMillionPerDay * periodDays) / 1_000_000,
        );
        const qlts = Math.round((principal * feeRatePerMillionPerDay * periodDays) / 1_000_000);
        const total = interest + qlts;

        schedule.push({
          periodNo: i,
          dayCount: periodDays,
          dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
          installmentAmount: total,
          principalAmount: 0,
          interestAmount: interest,
          qlkvAmount: 0,
          fixedMonthlyFeeAmount: 0,
          qltsAmount: qlts,
          periodicFeeAmount: qlts,
          totalPayment: total,
          remainingPrincipal: principal,
        });

        totalInterest += interest;
        totalPeriodicFee += qlts;
        totalPayment += total;
      }

      return {
        monthlyPayment: schedule[0]?.installmentAmount ?? 0,
        totalInterest,
        totalPeriodicFee,
        totalPayment,
        schedule,
      };
    }

    if (!v.interestRateMonthlySnapshot) return null;

    // Bảo hiểm được cộng vào gốc vay — tính lãi trên tổng (gốc + bảo hiểm)
    const effectivePrincipal =
      (v.principalAmount ?? 0) + Math.max(0, Math.round(v.insuranceAmountSnapshot ?? 0));

    return this.computeLoan(
      effectivePrincipal,
      v.termMonths,
      v.interestRateMonthlySnapshot,
      v.qlkvRateMonthlySnapshot ?? 0,
      v.qltsRateMonthlySnapshot ?? 0,
      v.fixedMonthlyFeeAmountSnapshot ?? 0,
      baseDate,
    );
  });

  /** Tổng các cột số tiền trong lịch trả nợ — hiển thị dòng cuối bảng */
  readonly scheduleTotals = computed(() => {
    const rows = this.calculateResult()?.schedule ?? [];
    return {
      installmentAmount: rows.reduce((s, r) => s + (r.installmentAmount ?? 0), 0),
      principalAmount: rows.reduce((s, r) => s + (r.principalAmount ?? 0), 0),
      interestAmount: rows.reduce((s, r) => s + (r.interestAmount ?? 0), 0),
      qlkvAmount: rows.reduce((s, r) => s + (r.qlkvAmount ?? 0), 0),
      qltsAmount: rows.reduce((s, r) => s + (r.qltsAmount ?? 0), 0),
    };
  });

  constructor() {
    // Effect: cập nhật validators min/max cho principalAmount và termMonths khi đổi sản phẩm
    effect(() => {
      const p = this.selectedProduct();
      untracked(() => {
        const principalCtrl = this.form.controls.principalAmount;
        const termCtrl = this.form.controls.termMonths;
        const principalValidators = [Validators.required, Validators.min(1)];
        const termValidators = [Validators.required, Validators.min(1)];
        if (p) {
          if (p.minPrincipalAmount != null)
            principalValidators.push(Validators.min(p.minPrincipalAmount));
          if (p.maxPrincipalAmount != null)
            principalValidators.push(Validators.max(p.maxPrincipalAmount));
          if (p.minTermMonths != null) termValidators.push(Validators.min(p.minTermMonths));
          if (p.maxTermMonths != null) termValidators.push(Validators.max(p.maxTermMonths));
        }
        principalCtrl.setValidators(principalValidators);
        termCtrl.setValidators(termValidators);
        principalCtrl.updateValueAndValidity({ emitEvent: false });
        termCtrl.updateValueAndValidity({ emitEvent: false });
      });
    });

    // Effect: đổi validators theo loại hợp đồng để pawn không bị chặn bởi field installment và ngược lại
    effect(() => {
      const type = this.selectedContractType();
      untracked(() => {
        const installmentCtrls = [
          this.form.controls.interestRateMonthlySnapshot,
          this.form.controls.qlkvRateMonthlySnapshot,
          this.form.controls.qltsRateMonthlySnapshot,
          this.form.controls.fixedMonthlyFeeAmountSnapshot,
          this.form.controls.fileFeeAmountSnapshot,
          this.form.controls.insuranceAmountSnapshot,
        ];
        const pawnCtrls = [
          this.form.controls.pawnInterestAmountPerMillionPerDaySnapshot,
          this.form.controls.pawnFeeAmountPerMillionPerDaySnapshot,
          this.form.controls.pawnPeriodDaysSnapshot,
        ];

        if (type === 'PAWN') {
          this.form.controls.interestRateMonthlySnapshot.clearValidators();
          this.form.controls.qlkvRateMonthlySnapshot.clearValidators();
          this.form.controls.qltsRateMonthlySnapshot.clearValidators();
          this.form.controls.fixedMonthlyFeeAmountSnapshot.clearValidators();
          this.form.controls.fileFeeAmountSnapshot.clearValidators();
          this.form.controls.insuranceAmountSnapshot.clearValidators();
          this.form.controls.pawnInterestAmountPerMillionPerDaySnapshot.setValidators([
            Validators.required,
            Validators.min(0),
          ]);
          this.form.controls.pawnFeeAmountPerMillionPerDaySnapshot.setValidators([
            Validators.required,
            Validators.min(0),
          ]);
          this.form.controls.pawnPeriodDaysSnapshot.setValidators([
            Validators.required,
            Validators.min(1),
          ]);
        } else {
          this.form.controls.interestRateMonthlySnapshot.setValidators([
            Validators.required,
            Validators.min(0),
          ]);
          this.form.controls.qlkvRateMonthlySnapshot.clearValidators();
          this.form.controls.qltsRateMonthlySnapshot.clearValidators();
          this.form.controls.fixedMonthlyFeeAmountSnapshot.clearValidators();
          this.form.controls.fileFeeAmountSnapshot.clearValidators();
          this.form.controls.insuranceAmountSnapshot.clearValidators();
          this.form.controls.pawnInterestAmountPerMillionPerDaySnapshot.clearValidators();
          this.form.controls.pawnFeeAmountPerMillionPerDaySnapshot.clearValidators();
          this.form.controls.pawnPeriodDaysSnapshot.clearValidators();
        }

        [...installmentCtrls, ...pawnCtrls].forEach((ctrl) =>
          ctrl.updateValueAndValidity({ emitEvent: false }),
        );
      });
    });

    // Effect: patch lãi suất + phí vào form khi chọn sản phẩm vay
    effect(() => {
      const productId = this._loanProductIdSig();
      if (!productId) return;
      const p = this.loanProducts().find((x) => x.loanProductId === productId);
      if (!p) return;
      untracked(() =>
        this.form.patchValue(
          {
            interestRateMonthlySnapshot: p.interestRateMonthly ?? null,
            qlkvRateMonthlySnapshot: p.qlkvRateMonthly ?? null,
            qltsRateMonthlySnapshot: p.qltsRateMonthly ?? null,
            fixedMonthlyFeeAmountSnapshot: p.fixedMonthlyFeeAmount ?? null,
          },
          { emitEvent: false },
        ),
      );
    });

    // Effect: sync phí hồ sơ + bảo hiểm xuống form
    effect(() => {
      const fees = this.derivedUpfrontFees();
      if (fees === null) return;
      untracked(() =>
        this.form.patchValue(
          { fileFeeAmountSnapshot: fees.fileFee, insuranceAmountSnapshot: fees.insuranceFee },
          { emitEvent: false },
        ),
      );
    });

    effect(() => {
      const type = this.selectedContractType();
      untracked(() => {
        if (type === 'PAWN') {
          this.form.patchValue(
            {
              loanProductId: null,
              fileFeeAmountSnapshot: 0,
              insuranceAmountSnapshot: 0,
              qlkvRateMonthlySnapshot: 0,
              qltsRateMonthlySnapshot: 0,
              fixedMonthlyFeeAmountSnapshot: 0,
              pawnPeriodDaysSnapshot: this.form.controls.pawnPeriodDaysSnapshot.value ?? 10,
            },
            { emitEvent: false },
          );
        } else {
          this.form.patchValue(
            {
              pawnInterestAmountPerMillionPerDaySnapshot: null,
              pawnFeeAmountPerMillionPerDaySnapshot: null,
              pawnPeriodDaysSnapshot: 10,
            },
            { emitEvent: false },
          );
        }
      });
    });

    effect(() => {
      const storeId = this._storeIdSig();
      const selectedCustomer = this.selectedCustomer();
      if (!storeId || !selectedCustomer) return;
      if ((selectedCustomer.firstStoreId ?? selectedCustomer.storeId ?? null) === storeId) return;
      untracked(() => this.form.patchValue({ customerId: null }, { emitEvent: false }));
    });

    // Cleanup: revoke blob URLs khi component bị destroy
    inject(DestroyRef).onDestroy(() => {
      this.pendingOtherDocs().forEach((d) => URL.revokeObjectURL(d.previewUrl));
    });
  }

  private fetchAllCustomers$(): Observable<CustomerOption[]> {
    const fetchPage = (pageIndex: number) =>
      this.customerProvider.apiCustomerSearchPost({
        searchCustomerRequest: { pageIndex, pageSize: 1000 },
      });

    return fetchPage(1).pipe(
      switchMap((result) => {
        if (!result.status || !result.data) return of([]);
        const data = result.data as any;
        const firstItems = data.items ?? (Array.isArray(data) ? data : []);
        const total = typeof data.totalCount === 'number' ? data.totalCount : null;
        const actualPageSize = typeof data.pageSize === 'number' ? data.pageSize : 1000;

        if (!total || total <= firstItems.length) {
          return of(firstItems);
        }

        const pageCount = Math.ceil(total / actualPageSize);
        const calls = Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) =>
          fetchPage(i + 2)
        );

        if (calls.length === 0) return of(firstItems);

        return forkJoin(calls).pipe(
          map((rest) => {
            const merged = [...firstItems];
            for (const r of rest as any[]) {
              if (r?.status && r.data) {
                const rd = r.data as any;
                const items = rd.items ?? (Array.isArray(rd) ? rd : []);
                merged.push(...items);
              }
            }
            return merged;
          })
        );
      })
    );
  }

  ngOnInit(): void {
    if (this.canPickStore()) {
      this.form.get('storeId')!.setValidators(Validators.required);
      const first = this.storeList()[0]?.storeId ?? null;
      if (first && !this.form.controls.storeId.value) {
        this.form.controls.storeId.setValue(first);
      }
    } else {
      this.form.patchValue({ storeId: this.authService.currentUser()?.storeId ?? null });
      this.form.get('storeId')!.clearValidators();
    }
    this.form.get('storeId')!.updateValueAndValidity();

    const existingData = this.context.data;

    if (existingData) {
      // Chỉnh sửa bản nháp: dữ liệu đã có sẵn từ danh sách,
      // chỉ cần load customers + products để ComboBox stringify được, sau đó patch form
      this.editingId.set(existingData.loanContractId);
      this.loadingExisting.set(true);
      forkJoin([
        this.fetchAllCustomers$(),
        this.loanProductProvider.apiLoanProductGetAllGet(),
      ]).subscribe({
        next: ([customersData, productsResult]) => {
          this.loadingExisting.set(false);

          this.customers.set(customersData);

          if (productsResult.status && productsResult.data) {
            this.loanProducts.set(
              Array.isArray(productsResult.data)
                ? (productsResult.data as LoanProductOption[])
                : [],
            );
          }

          const d = existingData;
          this.form.patchValue({
            storeId: d.storeId ?? null,
            customerId: d.customerId ?? null,
            contractType: (d.contractType as ContractType | null) ?? 'INSTALLMENT',
            loanProductId: d.loanProductId ?? null,
            principalAmount: d.principalAmount ?? null,
            termMonths: d.termMonths ?? null,
            applicationDate: d.applicationDate
              ? TuiDay.jsonParse(d.applicationDate.substring(0, 10))
              : null,
            interestRateMonthlySnapshot: d.interestRateMonthlySnapshot ?? null,
            qlkvRateMonthlySnapshot: d.qlkvRateMonthlySnapshot ?? null,
            qltsRateMonthlySnapshot: d.qltsRateMonthlySnapshot ?? null,
            fixedMonthlyFeeAmountSnapshot: d.fixedMonthlyFeeAmountSnapshot ?? null,
            fileFeeAmountSnapshot: d.fileFeeAmountSnapshot ?? null,
            insuranceAmountSnapshot: d.insuranceAmountSnapshot ?? null,
            pawnInterestAmountPerMillionPerDaySnapshot:
              d.pawnInterestAmountPerMillionPerDaySnapshot ?? null,
            pawnFeeAmountPerMillionPerDaySnapshot: d.pawnFeeAmountPerMillionPerDaySnapshot ?? null,
            pawnPeriodDaysSnapshot: d.pawnPeriodDaysSnapshot ?? 10,
            note: d.note ?? null,
            customerSourceId: d.customerSourceId ?? null,
          });
        },
        error: () => this.loadingExisting.set(false),
      });
    } else {
      // Tạo mới: load reference data độc lập
      this.fetchAllCustomers$().subscribe({
        next: (items) => this.customers.set(items),
        error: () => {},
      });

      this.loanProductProvider.apiLoanProductGetAllGet().subscribe({
        next: (r) => {
          if (r.status && r.data)
            this.loanProducts.set(Array.isArray(r.data) ? (r.data as LoanProductOption[]) : []);
        },
        error: () => {},
      });
    }
  }

  private computeLoan(
    totalPrincipal: number,
    N: number,
    rateMonthly: number,
    qlkvRateMonthly: number,
    qltsRateMonthly: number,
    fixedMonthlyFeeAmount: number,
    baseDate: Date | null,
  ): CalculateResult {
    const interestRateMonth = rateMonthly / 100;
    const qlkvRateMonth = qlkvRateMonthly / 100;
    const qltsRateMonth = qltsRateMonthly / 100;
    const combinedRateMonth = interestRateMonth + qlkvRateMonth + qltsRateMonth;
    const base = baseDate ?? new Date();

    // PMT theo workbook mới trên tổng gốc tính toán
    const pow = Math.pow(1 + combinedRateMonth, N);
    const pmtRaw =
      combinedRateMonth === 0
        ? totalPrincipal / N
        : (totalPrincipal * combinedRateMonth * pow) / (pow - 1);
    const pmt = Math.round(pmtRaw);

    // Kỳ n = ngày giải ngân + n tháng (không cộng dồn từ kỳ trước để tránh trôi ngày)
    const dueDates = Array.from({ length: N }, (_, i) => addMonths(base, i + 1));
    const periods = dueDates.map((toDate, index) => {
      const fromDate = index === 0 ? base : dueDates[index - 1];
      const dayCount = Math.max(0, differenceInDays(toDate, fromDate));
      return { fromDate, toDate, dayCount };
    });

    // Hệ số quy đổi: N kỳ / tổng số ngày thực tế toàn bộ hợp đồng
    const totalActualDays = periods.reduce((sum, p) => sum + p.dayCount, 0);
    const dailyFactor = totalActualDays > 0 ? N / totalActualDays : 1 / 30;

    let remaining = totalPrincipal;
    let totalInterest = 0;
    let totalPeriodicFee = 0;
    let totalPayment = 0;
    const schedule: RepaymentScheduleRow[] = [];

    for (let n = 1; n <= N; n++) {
      const period = periods[n - 1];
      const dayCount = period?.dayCount || 30;
      const dueDate = period?.toDate ?? addMonths(base, n);

      const interest = Math.round(remaining * interestRateMonth * dailyFactor * dayCount);
      const qlkv = Math.round(remaining * qlkvRateMonth * dailyFactor * dayCount);
      const qlts =
        Math.round(remaining * qltsRateMonth * dailyFactor * dayCount) + fixedMonthlyFeeAmount;
      const fee = qlkv + qlts;

      let principal: number;
      if (n === N) {
        principal = remaining;
      } else {
        // Công thức: Tiền gốc = Tiền TT hàng kỳ - Tiền lãi - Phí QLKV - Phí QLTS
        principal = Math.max(0, Math.round(pmt - interest - fee));
        if (principal > remaining) principal = remaining;
      }
      const total = principal + interest + fee;
      remaining = Math.max(0, remaining - principal);
      totalInterest += interest;
      totalPeriodicFee += fee;
      totalPayment += total;
      schedule.push({
        periodNo: n,
        dayCount,
        dueDate: format(dueDate, 'yyyy-MM-dd'),
        installmentAmount: total,
        principalAmount: principal,
        interestAmount: interest,
        qlkvAmount: qlkv,
        fixedMonthlyFeeAmount: 0,
        qltsAmount: qlts,
        periodicFeeAmount: fee,
        totalPayment: total,
        remainingPrincipal: remaining,
      });
    }
    return { monthlyPayment: pmt, totalInterest, totalPeriodicFee, totalPayment, schedule };
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

  printSchedule(): void {
    const calc = this.calculateResult();
    const v = this.form.value;
    if (!calc?.schedule?.length) return;
    this.printService.print({
      customer: this.selectedCustomer(),
      contractType: this.selectedContractType(),
      principalAmount:
        (v.principalAmount ?? 0) + Math.max(0, Math.round(v.insuranceAmountSnapshot ?? 0)),
      termMonths: v.termMonths,
      interestRateMonthly: v.interestRateMonthlySnapshot,
      qlkvRateMonthly: v.qlkvRateMonthlySnapshot ?? 0,
      qltsRateMonthly: v.qltsRateMonthlySnapshot ?? 0,
      fixedMonthlyFeeAmount: v.fixedMonthlyFeeAmountSnapshot ?? 0,
      pawnInterestAmountPerMillionPerDay: v.pawnInterestAmountPerMillionPerDaySnapshot ?? 0,
      pawnFeeAmountPerMillionPerDay: v.pawnFeeAmountPerMillionPerDaySnapshot ?? 0,
      pawnPeriodDays: v.pawnPeriodDaysSnapshot ?? 10,
      fileFeeAmount: v.fileFeeAmountSnapshot,
      insuranceAmount: v.insuranceAmountSnapshot,
      monthlyPayment: calc.monthlyPayment,
      totalInterest: calc.totalInterest,
      totalPeriodicFee: calc.totalPeriodicFee,
      totalPayment: calc.totalPayment,
      schedule: calc.schedule,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  readonly activeItemIndex = computed(() => this.tabs.findIndex((t) => t.key === this.activeTab()));

  setActiveItemIndex(index: number): void {
    const tab = this.tabs[index];
    if (tab) this.activeTab.set(tab.key);
  }

  switchTab(tab: TabKey): void {
    this.activeTab.set(tab);
  }

  setContractType(type: ContractType): void {
    this.form.patchValue({ contractType: type }, { emitEvent: true });
  }

  readonly selectionGridClass = computed(() =>
    this.canPickStore()
      ? 'grid grid-cols-1 gap-4 md:grid-cols-4'
      : 'grid grid-cols-1 gap-4 md:grid-cols-3',
  );

  maskNationalId(id?: string | null): string {
    if (!id) return '-';
    if (id.length < 8) return id;
    return id.slice(0, 5) + '***' + id.slice(-3);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Xử lý chọn file
  // ─────────────────────────────────────────────────────────────────────────

  onPdfSelected(event: Event): void {
    const file = this.pickFile(event);
    if (!file) return;
    if (file.type !== 'application/pdf') {
      this.alertService.open('Chỉ chấp nhận file PDF.', { appearance: 'negative' }).subscribe();
      return;
    }
    this.pendingPdf.set(file);
  }

  removePendingPdf(): void {
    this.pendingPdf.set(null);
  }

  onOtherDocSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    this.pendingOtherDocs.update((list) => [
      ...list,
      ...files.map((file) => ({
        id: ++this.pendingDocCounter,
        file,
        previewUrl: URL.createObjectURL(file),
        type: 'OTHER',
      })),
    ]);
  }

  removePendingOtherDoc(id: number): void {
    const doc = this.pendingOtherDocs().find((d) => d.id === id);
    if (doc) URL.revokeObjectURL(doc.previewUrl);
    this.pendingOtherDocs.update((list) => list.filter((d) => d.id !== id));
  }

  private pickFile(event: Event): File | null {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    return file;
  }

  isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }
  formatFileSize = (bytes: number): string => this.documentSvc.formatFileSize(bytes);
  getDocTypeLabel = (t: string): string => DOCUMENT_TYPE_LABELS[t] ?? t;

  // ─────────────────────────────────────────────────────────────────────────
  // Save
  // ─────────────────────────────────────────────────────────────────────────

  save(initialStatus: LoanContractStatus = LoanContractStatus.DRAFT): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.activeTab.set('info'); // hiện tab thông tin để user thấy lỗi
      return;
    }
    const v = this.form.value;
    // xác định trạng thái mục tiêu
    const targetStatus = this.alreadyDisbursed() ? LoanContractStatus.DISBURSED : initialStatus;
    const body: any = {
      storeId: this.canPickStore()
        ? (v.storeId ?? '')
        : (this.authService.currentUser()?.storeId ?? ''),
      customerId: v.customerId!,
      contractType: this.selectedContractType(),
      loanProductId: v.loanProductId ?? null,
      principalAmount: v.principalAmount!,
      termMonths: v.termMonths!,
      applicationDate: v.applicationDate ? v.applicationDate.toJSON() : undefined,
      interestRateMonthlySnapshot: v.interestRateMonthlySnapshot ?? undefined,
      qlkvRateMonthlySnapshot: v.qlkvRateMonthlySnapshot ?? undefined,
      qltsRateMonthlySnapshot: v.qltsRateMonthlySnapshot ?? undefined,
      fileFeeAmountSnapshot: v.fileFeeAmountSnapshot ?? undefined,
      insuranceAmountSnapshot: v.insuranceAmountSnapshot ?? undefined,
      pawnInterestAmountPerMillionPerDaySnapshot:
        v.pawnInterestAmountPerMillionPerDaySnapshot ?? undefined,
      pawnFeeAmountPerMillionPerDaySnapshot: v.pawnFeeAmountPerMillionPerDaySnapshot ?? undefined,
      pawnPeriodDaysSnapshot: v.pawnPeriodDaysSnapshot ?? undefined,
      note: v.note ?? null,
      customerSourceId: v.customerSourceId ?? null,
      initialStatus: targetStatus,
      backdatedDisbursedDate:
        this.alreadyDisbursed() && this.backdatedDisbursedDate()
          ? this.backdatedDisbursedDate()!.toJSON()
          : undefined,
    };
    body.fixedMonthlyFeeAmountSnapshot = v.fixedMonthlyFeeAmountSnapshot ?? undefined;
    // Thêm ID để cập nhật nếu đang chỉnh sửa bản nháp
    if (this.editingId()) {
      body.loanContractId = this.editingId()!;
    }
    this.saving.set(true);
    this.loanProvider.apiLoanContractSavePost({ cULoanContractModel: body }).subscribe({
      next: (r) => {
        this.saving.set(false);
        if (r.status) {
          const loanId = (r.data as any)?.loanContractId as string | undefined;

          // --- Lưu tài sản đảm bảo (nếu đã nhập) ---
          const cv = this.collateralForm.value;
          if (cv.description && loanId) {
            this.collateralSvc
              .save({
                loanContractId: loanId,
                collateralType: cv.collateralType ?? 'OTHER',
                description: cv.description,
                serialNumber: cv.serialNumber ?? null,
                estimatedValue: cv.estimatedValue ?? null,
                detail: cv.detail ?? null,
                note: cv.note ?? null,
              })
              .subscribe(); // fire-and-forget
          }

          // --- Upload hồ sơ giấy tờ (nếu đã chọn file) ---
          if (loanId) this.uploadPendingDocuments(loanId);

          const label =
            initialStatus === LoanContractStatus.PENDING_APPROVAL
              ? 'Đã gửi duyệt thành công'
              : 'Đã lưu nháp thành công';
          this.alertService.open(label, { appearance: 'positive' }).subscribe();
          this.context.completeWith();
        } else {
          this.alertService
            .open(r.message ?? 'Có lỗi xảy ra', { appearance: 'negative' })
            .subscribe();
        }
      },
      error: () => {
        this.saving.set(false);
        this.alertService.open('Có lỗi xảy ra', { appearance: 'negative' }).subscribe();
      },
    });
  }

  /** Upload tất cả tài liệu đang queue sau khi tạo hợp đồng thành công */
  private uploadPendingDocuments(loanId: string): void {
    const uploads: ReturnType<typeof this.documentSvc.upload>[] = [];
    const pdf = this.pendingPdf();

    for (const doc of this.pendingOtherDocs())
      uploads.push(this.documentSvc.upload(loanId, doc.file, doc.type));
    if (pdf)
      uploads.push(
        this.attachmentProvider.apiLoanContractAttachmentUploadPost({
          loanContractId: loanId,
          file: pdf,
        }) as any,
      );

    if (!uploads.length) return;
    forkJoin(uploads).subscribe({
      error: () =>
        this.alertService
          .open(
            'Một số tài liệu không upload được. Bạn có thể upload lại trong chi tiết hợp đồng.',
            { appearance: 'warning' },
          )
          .subscribe(),
    });
  }
}
