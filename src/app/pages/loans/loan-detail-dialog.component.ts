import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  Injector,
  inject,
  OnDestroy,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import {
  TuiAlertService,
  TuiButton,
  TuiHint,
  TuiIcon,
  tuiDialog,
  type TuiDialogContext,
  TuiTextfield,
  TuiDataList,
  TuiNumberFormat,
  TuiNumberFormatSettings,
  TuiLabel,
  TuiSelectLike,
} from '@taiga-ui/core';
import {
  TuiChevron,
  TuiCheckbox,
  TuiComboBox,
  TuiDataListWrapper,
  TuiInputChip,
  TuiInputNumber,
  TuiMultiSelect,
  TuiTabs,
} from '@taiga-ui/kit';
import { TuiStringHandler, TuiStringMatcher } from '@taiga-ui/cdk';
import { injectContext } from '@taiga-ui/polymorpheus';

import { LoanContractProvider } from '../../api/api/loan-contract.service';
import { LoanContractAttachmentProvider } from '../../api/api/loan-contract-attachment.service';
import { CashVoucherProvider } from '../../api/api/cash-voucher.service';
import { AuthService } from '../../services/auth.service';
import {
  BadDebtCaseOpsService,
  BadDebtCaseSummary,
} from '../../services/bad-debt-case-ops.service';
import { RoleCode } from '../../models/role.model';
import {
  LOAN_CONTRACT_STATUS_CLASSES,
  LOAN_CONTRACT_STATUS_LABELS,
  LoanContractStatus,
} from '../../models/loan-contract-status.model';
import {
  LoanCollateralService,
  LoanCollateral,
  COLLATERAL_TYPE_LABELS,
  COLLATERAL_TYPES,
  COLLATERAL_SERIAL_LABEL,
  COLLATERAL_SERIAL_PLACEHOLDER,
} from '../../services/loan-collateral.service';
import {
  LoanContractDocumentService,
  LoanContractDocument,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
} from '../../services/loan-contract-document.service';
import { TuiCurrencyPipe } from '@taiga-ui/addon-commerce';
import {
  LoanStatusActionDialogComponent,
  LoanStatusActionDialogData,
  LoanStatusActionDialogResult,
} from './loan-status-action-dialog.component';

export interface LoanDetailDialogData {
  loanContractId: string;
  contractNo?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerCode?: string | null;
  customerPhone?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  principalAmount?: number | null;
  termMonths?: number | null;
  statusCode?: string | null;
  applicationDate?: string | null;
  disbursedDate?: string | null;
  maturityDate?: string | null;
  interestRateMonthlySnapshot?: number | null;
  qlkvRateMonthlySnapshot?: number | null;
  qltsRateMonthlySnapshot?: number | null;
  fixedMonthlyFeeAmountSnapshot?: number | null;
  fileFeeAmountSnapshot?: number | null;
  insuranceAmountSnapshot?: number | null;
  contractType?: string | null;
  ContractType?: string | null;
  pawnInterestAmountPerMillionPerDaySnapshot?: number | null;
  pawnFeeAmountPerMillionPerDaySnapshot?: number | null;
  pawnPeriodDaysSnapshot?: number | null;
  insuranceDiscountRateSnapshot?: number | null;
  earlySettlementPenaltyRateSnapshot?: number | null;
  latePaymentPenaltyRateSnapshot?: number | null;
  latePaymentStartDaySnapshot?: number | null;
  badDebtStartDaySnapshot?: number | null;
  netDisbursedAmount?: number | null;
  note?: string | null;
  customerSourceId?: string | null;
  customerSourceName?: string | null;
  badDebtCaseId?: string | null;
}

interface RepaymentScheduleRow {
  scheduleId?: string;
  periodNo?: number;
  periodFromDate?: string;
  periodToDate?: string;
  dueDate?: string;
  actualDayCount?: number;
  openingPrincipalAmount?: number;
  installmentAmount?: number;
  // các khoản phải trả (API trả về dạng dueXxxAmount)
  duePrincipalAmount?: number;
  dueInterestAmount?: number;
  dueQlkvAmount?: number;
  dueQltsAmount?: number;
  duePeriodicFeeAmount?: number;
  dueLatePenaltyAmount?: number;
  // đã trả
  paidPrincipalAmount?: number;
  paidInterestAmount?: number;
  paidQlkvAmount?: number;
  paidQltsAmount?: number;
  paidPeriodicFeeAmount?: number;
  paidLatePenaltyAmount?: number;
  closingPrincipalAmount?: number;
  statusCode?: string;
  fullyPaidAt?: string | null;
  note?: string | null;
}

interface LoanPaymentVoucher {
  voucherId?: string;
  voucherNo?: string;
  voucherType?: string;
  reasonCode?: string;
  businessDate?: string;
  voucherDatetime?: string;
  amount?: number;
  description?: string;
  isAdjustment?: boolean;
  payerReceiverName?: string | null;
  createdByName?: string | null;
  allocations?: { componentCode?: string; amount?: number; scheduleId?: string }[];
}

interface LoanFinancialSummary {
  principalAmount?: number;
  totalPeriods?: number;
  paidPeriods?: number;
  pendingPeriods?: number;
  overduePeriods?: number;
  paidPrincipal?: number;
  remainingPrincipal?: number;
  paidInterest?: number;
  paidPeriodicFee?: number;
  paidLatePenalty?: number;
  fileFee?: number;
  paidFileFee?: number;
  remainingFileFee?: number;
  insurance?: number;
  paidInsurance?: number;
  remainingInsurance?: number;
  earlySettlementPenalty?: number;
  totalCollected?: number;
  totalIncomeCollected?: number;
  totalDueRemaining?: number;
  voucherCount?: number;
}

interface ReceiptPurposeOption {
  code: string;
  label: string;
}

interface SettlementCalculationResult {
  loanContractId?: string;
  contractNo?: string;
  settlementDate?: string;
  contractTotalDays?: number;
  actualElapsedDays?: number;
  completionRatio?: number;
  isEarlySettlement?: boolean;
  remainingPrincipalAmount?: number;
  remainingFileFeeAmount?: number;
  remainingInsuranceAmount?: number;
  accruedInterestAmount?: number;
  accruedPeriodicFeeAmount?: number;
  unpaidLatePenaltyAmount?: number;
  earlySettlementPenaltyAmount?: number;
  totalSettlementAmount?: number;
  settlementType?: string;
}

interface InstallmentAllocationItem {
  code: string;
  label: string;
  due: number;
  allocated: number;
}

interface InstallmentAllocationPreview {
  enteredAmount: number;
  totalDue: number;
  allocatedTotal: number;
  remainingDueAfterPay: number;
  overpaidAmount: number;
  allocations: InstallmentAllocationItem[];
}

interface LoanStatusActionOption {
  label: string;
  toStatus: string;
  appearance: 'primary' | 'outline' | 'destructive';
  requiresReason?: boolean;
  hint?: string;
}

type TabKey = 'info' | 'schedule' | 'payments' | 'collateral' | 'docs';

@Component({
  selector: 'app-loan-detail-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TuiButton,
    TuiHint,
    TuiIcon,
    TuiLabel,
    TuiTextfield,
    TuiComboBox,
    TuiMultiSelect,
    TuiDataListWrapper,
    TuiInputChip,
    TuiSelectLike,
    TuiTabs,
    TuiChevron,
    TuiDataList,
    TuiNumberFormat,
    TuiInputNumber,
    TuiCurrencyPipe,
  ],
  templateUrl: './loan-detail-dialog.component.html',
})
export class LoanDetailDialogComponent implements OnInit, OnDestroy {
  readonly context = injectContext<TuiDialogContext<void, LoanDetailDialogData>>();
  private readonly loanProvider = inject(LoanContractProvider);
  private readonly attachmentProvider = inject(LoanContractAttachmentProvider);
  private readonly cashVoucherProvider = inject(CashVoucherProvider);
  private readonly badDebtCaseOps = inject(BadDebtCaseOpsService);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly collateralSvc = inject(LoanCollateralService);
  protected readonly documentSvc = inject(LoanContractDocumentService);
  private readonly alert = inject(TuiAlertService);
  private readonly injector = inject(Injector);

  readonly loan = computed(() => this.context.data);
  readonly loanContractId = computed(() => this.context.data.loanContractId);
  readonly normalizedContractType = computed(() =>
    String(
      this.loan().contractType ??
        this.loan().ContractType ??
        this.deriveContractTypeFromLoan(this.loan()) ??
        '',
    ).toUpperCase(),
  );
  readonly isPawnContract = computed(() => this.normalizedContractType() === 'PAWN');

  private deriveContractTypeFromLoan(loan: LoanDetailDialogData): string | null {
    const pawnSignals = [
      loan.pawnInterestAmountPerMillionPerDaySnapshot,
      loan.pawnFeeAmountPerMillionPerDaySnapshot,
      loan.pawnPeriodDaysSnapshot,
    ];
    if (pawnSignals.some((v) => typeof v === 'number' && v > 0)) {
      return 'PAWN';
    }

    const installmentSignals = [
      loan.interestRateMonthlySnapshot,
      loan.qlkvRateMonthlySnapshot,
      loan.qltsRateMonthlySnapshot,
      loan.fixedMonthlyFeeAmountSnapshot,
    ];
    if (installmentSignals.some((v) => typeof v === 'number' && v > 0)) {
      return 'INSTALLMENT';
    }

    return null;
  }

  readonly statusCode = signal<string | null>(this.context.data.statusCode ?? null);
  readonly badDebtCase = signal<BadDebtCaseSummary | null>(null);
  readonly statusChanging = signal(false);
  // Writable signals cho các field có thể thay đổi sau khi dialog mở
  readonly disbursedDate = signal<string | null>(this.context.data.disbursedDate ?? null);
  readonly maturityDate = signal<string | null>(this.context.data.maturityDate ?? null);
  protected numberFormat: Partial<TuiNumberFormatSettings> = {
    decimalSeparator: ',',
    thousandSeparator: '.',
  };
  // ── Tabs ──────────────────────────────────────────────────────────────────
  activeTab = signal<TabKey>('info');

  /** Index tab đang active — dùng để bind (activeItemIndex) cho tui-tabs. */
  readonly activeItemIndex = computed(() => this.tabs.findIndex((t) => t.key === this.activeTab()));

  /** Gọi khi tui-tabs thay đổi tab (bao gồm cả khi click bằng chuột). */
  setActiveItemIndex(index: number): void {
    const tab = this.tabs[index];
    if (tab) this.switchTab(tab.key);
  }

  readonly tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'info', label: 'Thông tin', icon: '@tui.file-text' },
    { key: 'schedule', label: 'Lịch trả nợ', icon: '@tui.calendar' },
    { key: 'payments', label: 'Lịch sử thu', icon: '@tui.receipt' },
    { key: 'collateral', label: 'Tài sản đảm bảo', icon: '@tui.landmark' },
    { key: 'docs', label: 'Hồ sơ giấy tờ', icon: '@tui.folder-open' },
  ];

  // ── Repayment schedule ─────────────────────────────────────────────────
  repaymentSchedule = signal<RepaymentScheduleRow[]>([]);
  scheduleLoading = signal(false);
  scheduleLoaded = signal(false);
  // ── Financial Summary ───────────────────────────────────────────────────
  financialSummary = signal<LoanFinancialSummary | null>(null);
  financialSummaryLoading = signal(false);
  financialSummaryLoaded = signal(false);

  // ── Computed: Sức khỏe khoản vay ────────────────────────────────────────────
  /** Danh sách kỳ quá hạn kèm số ngày tính từ hôm nay */
  readonly overdueDetails = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.repaymentSchedule()
      .filter((r) => {
        if (r.statusCode === 'PAID') return false;
        if (r.statusCode === 'OVERDUE') return true;
        // Không có statusCode OVERDUE từ backend? Tự suy từ ngày
        const dueDate = r.dueDate ? new Date(r.dueDate + 'T00:00:00') : null;
        return dueDate != null && dueDate < today;
      })
      .map((r) => {
        const dueDate = r.dueDate ? new Date(r.dueDate + 'T00:00:00') : null;
        const daysOverdue = dueDate
          ? Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000))
          : 0;
        return { ...r, daysOverdue };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  });

  /** Số ngày quá hạn lớn nhất trong tất cả các kỳ chậm nộp */
  readonly maxDaysOverdue = computed(() => this.overdueDetails()[0]?.daysOverdue ?? 0);

  /** % gốc đã trả (0–100) */
  readonly principalProgressPct = computed(() => {
    const fs = this.financialSummary();
    if (!fs?.principalAmount || fs.principalAmount === 0) return 0;
    return Math.min(100, Math.round(((fs.paidPrincipal ?? 0) / fs.principalAmount) * 100));
  });

  /** % kỳ đã hoàn thành (0–100) */
  readonly periodProgressPct = computed(() => {
    const fs = this.financialSummary();
    if (!fs?.totalPeriods || fs.totalPeriods === 0) return 0;
    return Math.min(100, Math.round(((fs.paidPeriods ?? 0) / fs.totalPeriods) * 100));
  });

  /** Màu progress bar dựa trên mức rủi ro */
  readonly healthProgressColor = computed(() => {
    const days = this.maxDaysOverdue();
    const overdue = this.financialSummary()?.overduePeriods ?? 0;
    if (days >= 11) return 'bg-red-500';
    if (days >= 4 || overdue > 0) return 'bg-amber-500';
    return 'bg-green-500';
  });

  readonly badDebtRecoveryRemainingAmount = computed(() => {
    const badDebt = this.badDebtCase();
    if (!badDebt) return null;

    const total = Math.max(0, Math.round(badDebt.totalOutstandingAmount ?? 0));
    const recovered = Math.max(0, Math.round(badDebt.recoveredAmountTotal ?? 0));
    return Math.max(0, total - recovered);
  });

  // ── Payment Vouchers ──────────────────────────────────────────────────
  paymentVouchers = signal<LoanPaymentVoucher[]>([]);
  paymentVouchersLoading = signal(false);
  paymentVouchersLoaded = signal(false);

  /** Sync guard to avoid spamming ChangeStatus when backend doesn't persist it. */
  private readonly autoSettleAttempted = signal(false);

  // ── Tạo phiếu thu thủ công theo hợp đồng ───────────────────────────────
  creatingReceipt = signal(false);
  receiptAmountInput = signal<number | null>(null);
  selectedReceiptPurposes = signal<string[]>([]);
  /** Kỳ được chọn để thu (null = kỳ đầu tiên chưa trả, số nguyên = periodNo cụ thể) */
  selectedPeriodNo = signal<number | null>(null);

  /** Toggle miễn phạt trễ nộp cho kỳ đang thanh toán. */
  waiveLatePenalty = signal(false);

  /** Có khoản phạt trễ nộp chưa trả trong kỳ đang TN? Dùng để hiện nút bỏ phạt. */
  readonly hasLatePenaltyDue = computed(
    () => (this.remainingAmounts()['LATE_PENALTY'] ?? 0) > 0 && this.hasSelectedRepaymentPurpose(),
  );

  toggleWaiveLatePenalty(): void {
    const nowWaived = !this.waiveLatePenalty();
    this.waiveLatePenalty.set(nowWaived);
    if (nowWaived) {
      // Bỏ LATE_PENALTY ngay lập tức khi user tick "Bỏ phạt"
      this.selectedReceiptPurposes.update((p) => p.filter((c) => c !== 'LATE_PENALTY'));
    }
    // Trigger auto-fill để tính lại amount (có/không có phạt)
    this.pendingAutoFill.set(true);
  }

  // (search filtering handled natively by tuiSelectLike)
  /** Cở hiệu báo rằng user vừa đổi mục thu, cần auto-fill lại khi data sẵn sàng */
  private pendingAutoFill = signal(true);
  // ── Settlement calculation (tính trực tiếp tại FE, không cần gọi API) ─────────────
  /**
   * Tính tất toán hoàn toàn tại FE dựa trên:
   * - repaymentSchedule đã tải: lãi, phí, phạt còn nợ
   * - financialSummary.remainingPrincipal: gốc còn lại (chính xác nhất)
   * - earlySettlementPenaltyRateSnapshot: tỷ lệ phạt lấy từ snapshot hợp đồng
   * Trả null khi dữ liệu chưa load xong hoặc không chọn EARLY_SETTLEMENT.
   */
  readonly settlementCalc = computed<SettlementCalculationResult | null>(() => {
    if (!this.hasSelectedEarlySettlement()) return null;
    if (!this.scheduleLoaded() || !this.financialSummaryLoaded()) return null;

    const loan = this.loan();
    const schedule = this.repaymentSchedule();
    const fs = this.financialSummary();
    const isPawn = this.isPawnContract();

    // Tính số ngày
    const disbursedStr = this.disbursedDate();
    const maturityStr = this.maturityDate();
    if (!disbursedStr) return null;

    const msPerDay = 86_400_000;
    const disbursed = new Date(disbursedStr + 'T00:00:00');
    const maturity = maturityStr
      ? new Date(maturityStr + 'T00:00:00')
      : new Date(
          disbursed.getFullYear(),
          disbursed.getMonth() + (loan.termMonths ?? 1),
          disbursed.getDate(),
        );
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const contractDays = Math.max(
      1,
      Math.round((maturity.getTime() - disbursed.getTime()) / msPerDay),
    );
    const elapsedDays = Math.max(0, Math.round((today.getTime() - disbursed.getTime()) / msPerDay));
    const completionRatio = Math.round((elapsedDays / contractDays) * 10000) / 100; // 2 decimal
    
    // Đối với Cầm đồ, mặc định không phạt tất toán sớm trừ khi có quy định riêng
    const isEarly = !isPawn && completionRatio < 80;

    // Gốc còn lại: lấy từ financialSummary (chính xác nhất)
    const remainPrincipal = Math.max(0, Math.round(fs?.remainingPrincipal ?? 0));

    // Tính lãi + phí + phạt tích luỹ đến ngày tất toán theo từng kỳ:
    //   - Kỳ đã QUÁ HẠN (dueDate < today): tính đủ phần còn nợ
    //   - Kỳ HIỆN TẠI (periodFromDate <= today <= dueDate): tính theo ngày thực tế
    //   - Kỳ TƯƠNG LAI (periodFromDate > today): bỏ qua (chưa phát sinh)
    let accruedInterest = 0;
    let accruedFee = 0;
    let unpaidLatePenalty = 0;

    for (const row of schedule) {
      const rowDueDate = row.dueDate ? new Date(row.dueDate + 'T00:00:00') : null;
      const rowFromDate = row.periodFromDate ? new Date(row.periodFromDate + 'T00:00:00') : null;

      if (rowDueDate && rowDueDate < today) {
        // Kỳ đã qua hạn hoàn toàn → tính đủ phần còn nợ (hoặc trừ đi nếu khách đóng dư)
        accruedInterest += (row.dueInterestAmount ?? 0) - (row.paidInterestAmount ?? 0);
        accruedFee += (row.duePeriodicFeeAmount ?? 0) - (row.paidPeriodicFeeAmount ?? 0);
        unpaidLatePenalty += (row.dueLatePenaltyAmount ?? 0) - (row.paidLatePenaltyAmount ?? 0);
      } else if (rowFromDate && rowFromDate <= today) {
        // Kỳ hiện tại đang chạy → tính theo ngày thực tế
        const daysElapsed = Math.max(
          1,
          Math.round((today.getTime() - rowFromDate.getTime()) / msPerDay),
        );

        let proratedInterest = 0;
        let proratedFee = 0;

        if (isPawn) {
          // Cầm đồ: Tính trực tiếp theo số tiền/1tr/ngày
          const dailyInterestRate = (loan.pawnInterestAmountPerMillionPerDaySnapshot ?? 0) / 1_000_000;
          const dailyFeeRate = (loan.pawnFeeAmountPerMillionPerDaySnapshot ?? 0) / 1_000_000;
          const openingPrincipal = row.openingPrincipalAmount ?? remainPrincipal;

          proratedInterest = Math.round(openingPrincipal * dailyInterestRate * daysElapsed);
          proratedFee = Math.round(openingPrincipal * dailyFeeRate * daysElapsed);
        } else {
          // Cầm cố/Thuê lại: Prorate theo tỷ lệ ngày trong kỳ
          const daysInPeriod = Math.max(1, row.actualDayCount ?? 30);
          const ratio = Math.min(1, daysElapsed / daysInPeriod);
          proratedInterest = Math.round((row.dueInterestAmount ?? 0) * ratio);
          proratedFee = Math.round((row.duePeriodicFeeAmount ?? 0) * ratio);
        }

        // Nếu đã trả nhiều hơn số prorated, kết quả sẽ là số âm (hoàn trả)
        accruedInterest += proratedInterest - (row.paidInterestAmount ?? 0);
        accruedFee += proratedFee - (row.paidPeriodicFeeAmount ?? 0);
        
        // Late penalty kỳ hiện tại (nếu có, đã quá ngưỡng trễ nộp)
        unpaidLatePenalty += (row.dueLatePenaltyAmount ?? 0) - (row.paidLatePenaltyAmount ?? 0);
      } else {
        // Kỳ tương lai: hoàn trả toàn bộ số tiền đã đóng trước (nếu có)
        accruedInterest -= (row.paidInterestAmount ?? 0);
        accruedFee -= (row.paidPeriodicFeeAmount ?? 0);
        unpaidLatePenalty -= (row.paidLatePenaltyAmount ?? 0);
      }
    }

    accruedInterest = Math.round(accruedInterest);
    accruedFee = Math.round(accruedFee);
    unpaidLatePenalty = Math.round(unpaidLatePenalty);

    // Phạt tất toán sớm dùng đúng tỷ lệ snapshot của hợp đồng (Cầm đồ mặc định là 0 nếu không có)
    const penaltyRate = isPawn 
      ? (loan.earlySettlementPenaltyRateSnapshot ?? 0) 
      : (loan.earlySettlementPenaltyRateSnapshot ?? 5);
    const earlyPenalty = isEarly ? Math.round((remainPrincipal * penaltyRate) / 100) : 0;

    // Phí hồ sơ còn lại
    const remainFileFee = Math.max(0, Math.round(fs?.remainingFileFee ?? 0));

    const total =
      remainPrincipal +
      accruedInterest +
      accruedFee +
      unpaidLatePenalty +
      earlyPenalty +
      remainFileFee;

    return {
      loanContractId: loan.loanContractId,
      contractNo: loan.contractNo ?? undefined,
      settlementDate: today.toISOString().split('T')[0],
      contractTotalDays: contractDays,
      actualElapsedDays: elapsedDays,
      completionRatio,
      isEarlySettlement: isEarly,
      remainingPrincipalAmount: remainPrincipal,
      remainingFileFeeAmount: remainFileFee,
      remainingInsuranceAmount: 0,
      accruedInterestAmount: accruedInterest,
      accruedPeriodicFeeAmount: accruedFee,
      unpaidLatePenaltyAmount: unpaidLatePenalty,
      earlySettlementPenaltyAmount: earlyPenalty,
      totalSettlementAmount: total,
      settlementType: isEarly ? 'EARLY' : 'ONTIME',
    };
  });

  constructor() {
    // Effect: re-fill số tiền gợi ý khi purpose thay đổi hoặc data vừa load xong
    // Đồng thời tự động inject LATE_PENALTY nếu kỳ đang chọn có phạt và chưa waive.
    effect(() => {
      if (!this.pendingAutoFill()) return;
      let selectedCodes = [...this.selectedReceiptPurposes()];
      const hasBadDebtRecovery = selectedCodes.includes('BAD_DEBT_RECOVERY');
      if (hasBadDebtRecovery) {
        const remaining = this.badDebtRecoveryRemainingAmount();
        if (remaining == null) return;

        const amount = Math.max(0, Math.round(remaining));
        untracked(() => {
          this.selectedReceiptPurposes.set(['BAD_DEBT_RECOVERY']);
          this.receiptAmountInput.set(amount > 0 ? amount : null);
          this.pendingAutoFill.set(false);
        });
        return;
      }

      const hasRepayment = selectedCodes.some((code) =>
        ['INTEREST', 'QLKV_FEE', 'QLTS_FEE', 'PRINCIPAL'].includes(code),
      );
      const needsFs = selectedCodes.some((code) => ['FILE_FEE'].includes(code));
      const needsSched = hasRepayment; // LATE_PENALTY được inject sau khi schedule load xong
      const needsSettlement = selectedCodes.includes('EARLY_SETTLEMENT');
      // Chờ đến khi data cần thiết đã tải xong
      if (needsFs && !this.financialSummaryLoaded()) return;
      if (needsSched && !this.scheduleLoaded()) return;
      // Tất toán sớm cần cả schedule lẫn financialSummary
      if (needsSettlement && (!this.scheduleLoaded() || !this.financialSummaryLoaded())) return;

      // Auto-inject LATE_PENALTY: bắt buộc nếu kỳ có phạt và user chưa bỏ phạt
      if (hasRepayment) {
        const latePenalty = this.remainingAmounts()['LATE_PENALTY'];
        if (!this.waiveLatePenalty() && latePenalty != null && latePenalty > 0) {
          if (!selectedCodes.includes('LATE_PENALTY'))
            selectedCodes = [...selectedCodes, 'LATE_PENALTY'];
        } else {
          selectedCodes = selectedCodes.filter((c) => c !== 'LATE_PENALTY');
        }
      } else {
        selectedCodes = selectedCodes.filter((c) => c !== 'LATE_PENALTY');
      }

      const amount = selectedCodes.reduce((sum, code) => {
        const v = this.remainingAmounts()[code];
        return sum + (v != null && v > 0 ? Math.round(v) : 0);
      }, 0);
      untracked(() => {
        this.selectedReceiptPurposes.set(selectedCodes);
        this.receiptAmountInput.set(amount > 0 ? amount : null);
        this.pendingAutoFill.set(false);
      });
    });

    // Effect: đảm bảo selected purpose luôn hợp lệ khi option bị ẩn theo trạng thái/đã nộp đủ
    // LATE_PENALTY được quản lý tự động (auto-inject) nên không strip theo visibleCodes.
    effect(() => {
      const selected = this.selectedReceiptPurposes();
      const status = this.statusCode();
      const visibleCodes = this.visibleReceiptPurposeOptions().map((x) => x.code);
      let normalized = selected.filter(
        (code) => code === 'LATE_PENALTY' || visibleCodes.includes(code),
      );
      if (status === LoanContractStatus.BAD_DEBT && normalized.includes('BAD_DEBT_RECOVERY')) {
        normalized = ['BAD_DEBT_RECOVERY'];
      }
      if (normalized.length !== selected.length) {
        untracked(() => {
          this.selectedReceiptPurposes.set(normalized);
          this.pendingAutoFill.set(true);
        });
      }
    });
  }

  readonly receiptPurposeOptions: ReceiptPurposeOption[] = [
    { code: 'FILE_FEE', label: 'Phí hợp đồng' },
    { code: 'INTEREST', label: 'Lãi' },
    { code: 'QLKV_FEE', label: 'Phí phần mềm' },
    { code: 'QLTS_FEE', label: 'Phí hao mòn' },
    { code: 'PRINCIPAL', label: 'Gốc' },
    { code: 'LATE_PENALTY', label: 'Phạt chậm nộp' },
    { code: 'EARLY_SETTLEMENT', label: 'Tất toán sớm' },
    { code: 'BAD_DEBT_RECOVERY', label: 'Thu hồi nợ xấu' },
    { code: 'OTHER_INCOME', label: 'Khác' },
  ];

  readonly receiptPurposeStringify: TuiStringHandler<string> = (code) =>
    this.receiptPurposeOptions.find((x) => x.code === code)?.label ?? code;

  readonly receiptPurposeMatcher: TuiStringMatcher<string> = (code, query) => {
    const label = this.receiptPurposeStringify(code);
    return (
      code.toLowerCase().includes(query.toLowerCase()) ||
      label.toLowerCase().includes(query.toLowerCase())
    );
  };

  getReceiptPurposeBadgeClass(code: string): string {
    if (['INTEREST', 'QLKV_FEE', 'QLTS_FEE', 'PRINCIPAL', 'LATE_PENALTY'].includes(code)) {
      return 'bg-blue-50 text-blue-700 border border-blue-200';
    }

    if (['FILE_FEE', 'INSURANCE'].includes(code)) {
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    }

    if (code === 'EARLY_SETTLEMENT') {
      return 'bg-orange-50 text-orange-700 border border-orange-200';
    }

    if (code === 'BAD_DEBT_RECOVERY') {
      return 'bg-red-50 text-red-700 border border-red-200';
    }

    return 'bg-gray-100 text-gray-600 border border-gray-200';
  }

  readonly bankTransferInfo = {
    bankName: 'MB Bank',
    bankBin: '970422',
    accountNo: '0912345678',
    accountName: 'CONG TY TNHH HD FINANCE',
  };

  /**
   * Kỳ chưa thanh toán đã đến hạn hoặc quá hạn (dueDate <= hôm nay).
   * Kỳ tương lai không hiển — user có thể nộp khi cần thông qua nút phần dưới.
   */
  readonly unpaidPeriods = computed(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const lateStart = this.loan().latePaymentStartDaySnapshot ?? 4;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.repaymentSchedule()
      .filter((r) => r.statusCode !== 'PAID' && r.dueDate != null && r.dueDate <= todayStr)
      .map((r) => {
        const dueDate = new Date(r.dueDate! + 'T00:00:00');
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000);
        const isLate = daysOverdue >= lateStart;
        return {
          periodNo: r.periodNo!,
          label: `Kỳ ${r.periodNo} — ${this.formatDate(r.dueDate)}`,
          statusCode: isLate
            ? 'OVERDUE'
            : daysOverdue > 0
              ? 'WARNING'
              : (r.statusCode ?? 'PENDING'),
          daysOverdue,
        };
      });
  });

  /** Số thứ tự kỳ sớm nhất chưa thanh toán (chỉ kỳ này mới cho phép click để thu). */
  readonly firstUnpaidPeriodNo = computed(() => {
    const unpaid = this.repaymentSchedule().filter((r) => r.statusCode !== 'PAID');
    if (!unpaid.length) return null;
    return unpaid.reduce((min, r) => Math.min(min, r.periodNo ?? Infinity), Infinity);
  });

  /** Ngày hôm nay dạng ISO string yyyy-MM-dd (so sánh với dueDate trong template). */
  todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /** Lần đầu tab payments: reset selectedPeriodNo về null (kỳ auto) */
  onSelectedPeriodChange(periodNo: number | null): void {
    this.selectedPeriodNo.set(periodNo);
    this.pendingAutoFill.set(true);
  }

  /**
   * Số tiền còn cần nộp theo từng khoản, tính từ lịch trả nợ + financial summary.
   * null = chưa có data; 0 = đã nộp đủ; > 0 = còn phải nộp.
   */
  readonly remainingAmounts = computed<Record<string, number | null>>(() => {
    const fs = this.financialSummary();
    const schedule = this.repaymentSchedule();
    const loan = this.loan();

    // Ưu tiên kỳ đã chọn; nếu null → tìm kỳ OVERDUE/PARTIAL/PENDING đầu tiên
    const chosenNo = this.selectedPeriodNo();

    // FILE_FEE: lấy từ financial summary (snapshot hợp đồng - đã thu)
    // INSURANCE không thu riêng nữa — đã gộp vào gốc vay
    const remainFileFee =
      fs != null ? (fs.remainingFileFee != null ? fs.remainingFileFee : (fs.fileFee ?? 0)) : null;

    // Lấy kỳ tiếp theo chưa trả từ schedule (ưu tiên OVERDUE → PARTIAL → PENDING)
    // Lấy kỳ tiếp theo chưa trả từ schedule (ưu tiên OVERDUE → PARTIAL → PENDING)
    const nextPeriod =
      chosenNo != null
        ? schedule.find((r) => r.periodNo === chosenNo)
        : (schedule.find((r) => r.statusCode === 'OVERDUE') ??
          schedule.find((r) => r.statusCode === 'PARTIAL') ??
          schedule.find((r) => r.statusCode === 'PENDING'));

    let dueInterest = 0;
    let duePeriodicFee = 0;
    let dueQlkv = 0;
    let dueQlts = 0;
    let duePrincipal = 0;
    let paidInterest = 0;
    let paidPeriodicFee = 0;
    let paidQlkv = 0;
    let paidQlts = 0;
    let paidPrincipal = 0;

    if (nextPeriod) {
      // Ưu tiên 1: lấy từ schedule row đã lưu trong DB (chính xác nhất)
      dueInterest = Number(nextPeriod.dueInterestAmount ?? 0);
      duePeriodicFee = Number(nextPeriod.duePeriodicFeeAmount ?? 0);
      dueQlkv = Number(nextPeriod.dueQlkvAmount ?? 0);
      dueQlts = Number(nextPeriod.dueQltsAmount ?? 0);
      duePrincipal = Number(nextPeriod.duePrincipalAmount ?? 0);
      paidInterest = Number(nextPeriod.paidInterestAmount ?? 0);
      paidPeriodicFee = Number(nextPeriod.paidPeriodicFeeAmount ?? 0);
      paidQlkv = Number(nextPeriod.paidQlkvAmount ?? 0);
      paidQlts = Number(nextPeriod.paidQltsAmount ?? 0);
      paidPrincipal = Number(nextPeriod.paidPrincipalAmount ?? 0);
    }

    // Fallback: Nếu schedule trống hoặc dueInterest = 0 (hợp đồng vừa giải ngân, chưa reload)
    // → tính từ thông số hợp đồng theo công thức PMT (giống backend Calculate)
    if (dueInterest === 0 && duePeriodicFee === 0 && duePrincipal === 0 && loan.principalAmount) {
      // Gốc hiệu dụng = gốc thực + bảo hiểm (đã gộp vào lịch trả nợ)
      const P = (loan.principalAmount ?? 0) + (loan.insuranceAmountSnapshot ?? 0);
      const n = loan.termMonths ?? 1;
      const ri = (loan.interestRateMonthlySnapshot ?? 0) / 100 / 30; // daily interest rate
      const qlkvRate = loan.qlkvRateMonthlySnapshot ?? 0;
      const qltsRate = loan.qltsRateMonthlySnapshot ?? 0;
      const fixedFee = Math.max(0, Math.round(loan.fixedMonthlyFeeAmountSnapshot ?? 0));
      const rf = (qlkvRate + qltsRate) / 100 / 30; // daily fee rate
      const rCombined = ri + rf;

      // Opening principal của kỳ tiếp theo = remainingPrincipal từ summary, hoặc P nếu chưa có
      const openingPrincipal = fs?.remainingPrincipal ?? P;
      const paidPeriods = fs?.paidPeriods ?? 0;
      const remainingPeriods = Math.max(1, n - paidPeriods);

      // Số ngày kỳ tiếp theo: từ schedule nếu có, không thì lấy từ periodFromDate/periodicToDate, fallback 30
      const days = nextPeriod?.actualDayCount ?? 30;

      dueInterest = Math.round(openingPrincipal * ri * days);
      duePeriodicFee = Math.round(openingPrincipal * rf * days + fixedFee);
      dueQlkv = Math.round(openingPrincipal * qlkvRate / 100 / 30 * days + fixedFee);
      dueQlts = Math.round(openingPrincipal * qltsRate / 100 / 30 * days);

      // Tính PMT để suy ra principal
      const power = Math.pow(1 + rCombined * 30, remainingPeriods); // monthly compounding
      const pmt =
        rCombined === 0
          ? Math.round(openingPrincipal / remainingPeriods)
          : Math.round((openingPrincipal * (rCombined * 30) * power) / (power - 1));

      duePrincipal =
        remainingPeriods === 1 ? openingPrincipal : Math.max(0, pmt - dueInterest - duePeriodicFee);
    }

    const hasRepaymentData = dueInterest > 0 || duePeriodicFee > 0 || duePrincipal > 0;

    const remainInterest = hasRepaymentData
      ? Math.max(0, dueInterest - paidInterest)
      : schedule.length > 0
        ? 0
        : null;
    const remainFee = hasRepaymentData
      ? Math.max(0, duePeriodicFee - paidPeriodicFee)
      : schedule.length > 0
        ? 0
        : null;
    const remainQlkv = hasRepaymentData
      ? Math.max(0, dueQlkv - paidQlkv)
      : schedule.length > 0
        ? 0
        : null;
    const remainQlts = hasRepaymentData
      ? Math.max(0, dueQlts - paidQlts)
      : schedule.length > 0
        ? 0
        : null;
    const remainPrincipal = hasRepaymentData
      ? Math.max(0, duePrincipal - paidPrincipal)
      : schedule.length > 0
        ? 0
        : null;
    const todayPenalty = new Date();
    todayPenalty.setHours(0, 0, 0, 0);
    // Ngưỡng ngày bắt đầu tính phạt chậm nộp: lấy từ snapshot hợp đồng, fallback = 4
    const lateStartDay = this.loan().latePaymentStartDaySnapshot ?? 4;
    // Chỉ tính LATE_PENALTY cho kỳ được chọn (ảnh hưởng selectedPeriodNo),
    // không gộp toàn bộ các kỳ quá hạn — tránh hiển phạt sai cho kỳ hiện tại chưa trễ
    const chosenNoForPenalty = this.selectedPeriodNo();
    const penaltyRow =
      chosenNoForPenalty != null
        ? schedule.find((r) => r.periodNo === chosenNoForPenalty)
        : (schedule.find((r) => r.statusCode === 'OVERDUE') ??
          schedule.find((r) => r.statusCode === 'PARTIAL') ??
          schedule.find(
            (r) =>
              r.statusCode === 'PENDING' &&
              r.dueDate != null &&
              r.dueDate <= todayPenalty.toISOString().slice(0, 10),
          ));
    const remainLatePenalty: number | null =
      schedule.length > 0
        ? (() => {
            if (!penaltyRow?.dueDate) return 0;
            const dueDatePen = new Date(penaltyRow.dueDate + 'T00:00:00');
            const daysOverdue = Math.floor(
              (todayPenalty.getTime() - dueDatePen.getTime()) / 86_400_000,
            );
            if (daysOverdue < lateStartDay) return 0; // chưa đến ngưỡng — không có phạt
            // Ưu tiên giá trị từ DB nếu đã tính
            const dbPenalty = Math.max(
              0,
              (penaltyRow.dueLatePenaltyAmount ?? 0) - (penaltyRow.paidLatePenaltyAmount ?? 0),
            );
            if (dbPenalty > 0) return dbPenalty;
            // Tính động: 8% trên số tiền còn nợ của kỳ đó
            const outstanding = Math.max(
              0,
              (penaltyRow.dueInterestAmount ?? 0) -
                (penaltyRow.paidInterestAmount ?? 0) +
                (penaltyRow.duePeriodicFeeAmount ?? 0) -
                (penaltyRow.paidPeriodicFeeAmount ?? 0) +
                (penaltyRow.duePrincipalAmount ?? 0) -
                (penaltyRow.paidPrincipalAmount ?? 0),
            );
            const penaltyRate = (this.loan().latePaymentPenaltyRateSnapshot ?? 8) / 100;
            return Math.round(outstanding * penaltyRate);
          })()
        : null;

    // Fallback cho hợp đồng cũ: Nếu có phí định kỳ nhưng chưa tách QLKV/QLTS
    let finalRemainQlkv = remainQlkv;
    if (remainFee != null && remainFee > 0 && remainQlkv === 0 && remainQlts === 0) {
      finalRemainQlkv = remainFee;
    }

    return {
      FILE_FEE: remainFileFee,
      INTEREST: remainInterest,
      QLKV_FEE: finalRemainQlkv,
      QLTS_FEE: remainQlts,
      PRINCIPAL: remainPrincipal,
      LATE_PENALTY: remainLatePenalty,
      OTHER: null,
      EARLY_SETTLEMENT: this.settlementCalc()?.totalSettlementAmount ?? null,
      BAD_DEBT_RECOVERY: this.badDebtRecoveryRemainingAmount(),
    };
  });

  /** Option hiển thị trong dropdown: ẩn mục đã nộp đủ + ràng buộc theo status. */
  readonly visibleReceiptPurposeOptions = computed<ReceiptPurposeOption[]>(() => {
    const status = this.statusCode();
    const amounts = this.remainingAmounts();
    if (status === LoanContractStatus.BAD_DEBT) {
      return this.receiptPurposeOptions.filter(
        (option) => option.code === 'BAD_DEBT_RECOVERY' || option.code === 'OTHER_INCOME',
      );
    }

    const isDisbursed =
      status === LoanContractStatus.DISBURSED || status === LoanContractStatus.BAD_DEBT;
    const isPendingDisbursement = status === LoanContractStatus.PENDING_DISBURSEMENT;
    const repaymentCodes = new Set(['INTEREST', 'QLKV_FEE', 'QLTS_FEE', 'PRINCIPAL', 'LATE_PENALTY']);
    const upfrontFeeCodes = new Set(['FILE_FEE']);

    // Nếu còn phí hồ sơ chưa nộp → ẩn các khoản trả nợ + tất toán
    const hasUnpaidUpfrontFees = isDisbursed && (amounts['FILE_FEE'] ?? 0) > 0;

    return this.receiptPurposeOptions.filter((option) => {
      // LATE_PENALTY không cho user tự chọn — auto-inject dựa trên trạng thái kỳ
      if (option.code === 'LATE_PENALTY') return false;

      // Tất toán sớm: chỉ hiện khi đã giải ngân và không còn phí một lần
      if (option.code === 'EARLY_SETTLEMENT' && (!isDisbursed || hasUnpaidUpfrontFees))
        return false;

      // Nhóm kỳ trả nợ: chỉ hiện khi đã giải ngân và đã nộp xống phí một lần
      if (repaymentCodes.has(option.code) && (!isDisbursed || hasUnpaidUpfrontFees)) return false;

      // Phí một lần (hồ sơ, BH): hiện khi chờ giải ngân HOẶC đã giải ngân
      if (upfrontFeeCodes.has(option.code) && !isDisbursed && !isPendingDisbursement) return false;

      // Ẩn mục đã nộp đủ (amount = 0 chính xác)
      // amount = null → chưa load xong → GIỮ hiển thị
      // EARLY_SETTLEMENT: không ẩn theo amount (calc chưa chạy = null luôn)
      if (option.code !== 'EARLY_SETTLEMENT') {
        const amount = amounts[option.code];
        if (amount !== null && amount <= 0) return false;
      }

      return true;
    });
  });

  /** Danh sách mã code hiển thị trong dropdown (dùng cho tuiMultiSelectGroup). */
  readonly visibleReceiptPurposeCodes = computed<string[]>(() =>
    this.visibleReceiptPurposeOptions().map((o) => o.code),
  );

  /** Khi user chọn loại khoản thu: set pendingAutoFill = true và kích hoạt load data nếu chưa có */
  onPurposesChange(codes: string[]): void {
    let unique = Array.from(new Set(codes ?? []));

    if (this.statusCode() === LoanContractStatus.BAD_DEBT) {
      unique = unique.filter((c) => c === 'BAD_DEBT_RECOVERY' || c === 'OTHER_INCOME');
      if (unique.includes('BAD_DEBT_RECOVERY')) {
        unique = ['BAD_DEBT_RECOVERY'];
      }

      this.selectedReceiptPurposes.set(unique);
      this.pendingAutoFill.set(true);
      if (!this.financialSummaryLoaded() && !this.financialSummaryLoading())
        this.loadFinancialSummary();
      if (!this.scheduleLoaded() && !this.scheduleLoading()) this.loadSchedule();
      if (!this.paymentVouchersLoaded() && !this.paymentVouchersLoading())
        this.loadPaymentVouchers();
      return;
    }

    // EARLY_SETTLEMENT phải dùng độc lập — không kết hợp với khoản khác
    const prevSelected = this.selectedReceiptPurposes();
    const wasEarlySelected = prevSelected.includes('EARLY_SETTLEMENT');
    const isEarlySelected = unique.includes('EARLY_SETTLEMENT');

    if (isEarlySelected && unique.length > 1) {
      // Mới bật EARLY_SETTLEMENT → xóa hết khoản khác
      if (!wasEarlySelected) {
        unique = ['EARLY_SETTLEMENT'];
      } else {
        // Đang bật EARLY_SETTLEMENT rồi, user thêm khoản mới → tắt EARLY_SETTLEMENT
        unique = unique.filter((c) => c !== 'EARLY_SETTLEMENT');
      }
    }

    this.selectedReceiptPurposes.set(unique);
    this.pendingAutoFill.set(true);
    // Kích hoạt load nếu chưa có data (effect sẽ tự fill khi data về)
    if (!this.financialSummaryLoaded() && !this.financialSummaryLoading())
      this.loadFinancialSummary();
    if (!this.scheduleLoaded() && !this.scheduleLoading()) this.loadSchedule();
    // Load phiếu thu để tính số tiền còn lại chính xác cho FILE_FEE / INSURANCE
    if (!this.paymentVouchersLoaded() && !this.paymentVouchersLoading()) this.loadPaymentVouchers();
  }

  readonly hasSelectedEarlySettlement = computed(() =>
    this.selectedReceiptPurposes().includes('EARLY_SETTLEMENT'),
  );

  readonly hasSelectedRepaymentPurpose = computed(() => {
    const selected = this.selectedReceiptPurposes();
    return selected.some((code) =>
      ['INTEREST', 'QLKV_FEE', 'QLTS_FEE', 'PRINCIPAL', 'LATE_PENALTY'].includes(code),
    );
  });

  /**
   * Preview phân bổ cho "Thu kỳ đến hạn" theo thứ tự ưu tiên:
   * 1) Lãi -> 2) Phí định kỳ -> 3) Phạt chậm -> 4) Gốc.
   */
  readonly installmentAllocationPreview = computed<InstallmentAllocationPreview | null>(() => {
    if (!this.hasSelectedRepaymentPurpose()) return null;

    const entered = Math.max(0, Math.round(this.receiptAmountInput() ?? 0));
    if (entered <= 0) return null;

    const amounts = this.remainingAmounts();
    const selectedSet = new Set(this.selectedReceiptPurposes());
    const interest = selectedSet.has('INTEREST')
      ? Math.max(0, Math.round(amounts['INTEREST'] ?? 0))
      : 0;
    const qlkvFee = selectedSet.has('QLKV_FEE')
      ? Math.max(0, Math.round(amounts['QLKV_FEE'] ?? 0))
      : 0;
    const qltsFee = selectedSet.has('QLTS_FEE')
      ? Math.max(0, Math.round(amounts['QLTS_FEE'] ?? 0))
      : 0;
    const latePenalty = selectedSet.has('LATE_PENALTY')
      ? Math.max(0, Math.round(amounts['LATE_PENALTY'] ?? 0))
      : 0;
    const principal = selectedSet.has('PRINCIPAL')
      ? Math.max(0, Math.round(amounts['PRINCIPAL'] ?? 0))
      : 0;

    const lines: InstallmentAllocationItem[] = [
      { code: 'INTEREST', label: this.getAllocLabel('INTEREST'), due: interest, allocated: 0 },
      { code: 'QLKV_FEE', label: this.getAllocLabel('QLKV_FEE'), due: qlkvFee, allocated: 0 },
      { code: 'QLTS_FEE', label: this.getAllocLabel('QLTS_FEE'), due: qltsFee, allocated: 0 },
      {
        code: 'LATE_PENALTY',
        label: this.getAllocLabel('LATE_PENALTY'),
        due: latePenalty,
        allocated: 0,
      },
      { code: 'PRINCIPAL', label: this.getAllocLabel('PRINCIPAL'), due: principal, allocated: 0 },
    ];

    let remaining = entered;
    for (const row of lines) {
      if (remaining <= 0 || row.due <= 0) continue;
      const paid = Math.min(remaining, row.due);
      row.allocated = paid;
      remaining -= paid;
    }

    const totalDue = lines.reduce((sum, row) => sum + row.due, 0);
    const allocatedTotal = lines.reduce((sum, row) => sum + row.allocated, 0);

    return {
      enteredAmount: entered,
      totalDue,
      allocatedTotal,
      remainingDueAfterPay: Math.max(0, totalDue - allocatedTotal),
      overpaidAmount: Math.max(0, entered - allocatedTotal),
      allocations: lines,
    };
  });

  /** Hợp đồng đã thu đủ (gốc + phí) theo summary, dùng để khóa tạo phiếu thu tiếp. */
  readonly isFullyPaid = computed(() => {
    const fs = this.financialSummary();
    if (!fs) return false;

    const remainingPrincipal = Math.round(fs.remainingPrincipal ?? 0);
    const remainingFileFee = Math.round(fs.remainingFileFee ?? 0);
    const remainingInsurance = Math.round(fs.remainingInsurance ?? 0);
    const totalDueRemaining = Math.round(fs.totalDueRemaining ?? 0);

    return (
      remainingPrincipal <= 0 &&
      remainingFileFee <= 0 &&
      remainingInsurance <= 0 &&
      totalDueRemaining <= 0
    );
  });

  /** Có phiếu thu tất toán (tất toán sớm) trong lịch sử thu. */
  readonly hasSettlementReceipt = computed(() =>
    this.paymentVouchers().some(
      (v) =>
        (v.voucherType ?? '').toUpperCase() === 'RECEIPT' && v.reasonCode === 'EARLY_SETTLEMENT',
    ),
  );

  readonly canCreateReceipt = computed(() => {
    const s = this.statusCode();
    const canByStatus =
      s === LoanContractStatus.PENDING_DISBURSEMENT ||
      s === LoanContractStatus.DISBURSED ||
      s === LoanContractStatus.BAD_DEBT;
    return canByStatus && !this.isFullyPaid() && !this.hasSettlementReceipt();
  });

  readonly isAdmin = computed(() => this.authService.hasRole(RoleCode.ADMIN));

  /** Tiền chiết khấu bảo hiểm = phí bảo hiểm × % chiết khấu / 100. Chỉ Admin xem. */
  readonly insuranceDiscountAmount = computed(() => {
    const loan = this.loan();
    const rate = loan.insuranceDiscountRateSnapshot ?? 0;
    const amount = loan.insuranceAmountSnapshot ?? 0;
    if (rate <= 0 || amount <= 0) return null;
    return Math.round((amount * rate) / 100);
  });

  readonly canManageContractStatus = computed(() =>
    this.authService.hasAnyRole([
      RoleCode.ADMIN,
      RoleCode.REGIONAL_MANAGER,
      RoleCode.STORE_MANAGER,
    ]),
  );

  readonly availableStatusActions = computed<LoanStatusActionOption[]>(() => {
    const canManage = this.canManageContractStatus();
    const canApprove = canManage || this.authService.hasPermission('LOAN_APPROVE');
    const canDisburse = canManage || this.authService.hasPermission('LOAN_DISBURSE');
    const canCancel = canManage || this.authService.hasPermission('LOAN_CANCEL');
    const canTransferBadDebt = canManage || this.authService.hasPermission('BAD_DEBT_TRANSFER');

    const status = this.statusCode();
    if (!status) return [];

    const actions: LoanStatusActionOption[] = [];

    if (status === LoanContractStatus.PENDING_APPROVAL) {
      if (canApprove) {
        actions.push({
          label: 'Duyệt hợp đồng',
          toStatus: LoanContractStatus.PENDING_DISBURSEMENT,
          appearance: 'primary',
        });
        actions.push({
          label: 'Không duyệt',
          toStatus: LoanContractStatus.DRAFT,
          appearance: 'outline',
          requiresReason: true,
          hint: 'Nên nhập lý do để nhân viên chỉnh sửa đúng nội dung.',
        });
      }
    } else if (status === LoanContractStatus.PENDING_DISBURSEMENT) {
      if (canDisburse) {
        actions.push({
          label: 'Xác nhận giải ngân',
          toStatus: LoanContractStatus.DISBURSED,
          appearance: 'primary',
        });
      }
    } else if (status === LoanContractStatus.DISBURSED) {
      if (canTransferBadDebt) {
        actions.push({
          label: 'Chuyển nợ xấu',
          toStatus: LoanContractStatus.BAD_DEBT,
          appearance: 'outline',
          requiresReason: true,
          hint: 'Nên ghi rõ lý do và tình trạng thu hồi để đối soát sau này.',
        });
      }
    } else if (status === LoanContractStatus.BAD_DEBT) {
      if (canManage) {
        actions.push({
          label: 'Đóng hồ sơ',
          toStatus: LoanContractStatus.BAD_DEBT_CLOSED,
          appearance: 'primary',
          requiresReason: true,
          hint: 'Ghi nhận lý do đóng: đã thu hồi xong, xóa nợ, hoặc xử lý xong.',
        });
      }
    }

    // "Hủy hợp đồng" available any time for active-like statuses
    const finalStatuses = new Set([
      LoanContractStatus.CANCELLED,
      LoanContractStatus.SETTLED,
      LoanContractStatus.CLOSED,
      LoanContractStatus.BAD_DEBT_CLOSED,
    ]);

    if (canCancel && !finalStatuses.has(status as LoanContractStatus)) {
      actions.push({
        label: 'Hủy hợp đồng',
        toStatus: LoanContractStatus.CANCELLED,
        appearance: 'destructive',
        requiresReason: true,
      });
    }

    return actions;
  });

  isNegativeAction(action: LoanStatusActionOption): boolean {
    return (
      action.toStatus === LoanContractStatus.DRAFT ||
      action.toStatus === LoanContractStatus.CANCELLED
    );
  }

  getActionTriggerAppearance(
    action: LoanStatusActionOption,
  ): 'primary' | 'outline' | 'destructive' | 'ghost' {
    if (this.isNegativeAction(action)) {
      return 'destructive';
    }

    if (action.appearance === 'primary') {
      return 'primary';
    }

    return 'outline';
  }

  /** Style + copy cho banner "cần thao tác" tương ứng với trạng thái hiện tại. */
  readonly actionBanner = computed<{
    wrapperClass: string;
    iconClass: string;
    icon: string;
    title: string;
    desc: string;
  } | null>(() => {
    const status = this.statusCode();
    switch (status) {
      case LoanContractStatus.PENDING_APPROVAL:
        return {
          wrapperClass: 'border-l-4 border-purple-500 bg-purple-50',
          iconClass: 'text-purple-600',
          icon: '@tui.clock',
          title: 'Chờ duyệt hợp đồng',
          desc: 'Nhân viên đã gửi hồ sơ — kiểm tra và duyệt để tiến hành giải ngân.',
        };
      case LoanContractStatus.PENDING_DISBURSEMENT:
        return {
          wrapperClass: 'border-l-4 border-emerald-500 bg-emerald-50',
          iconClass: 'text-emerald-600',
          icon: '@tui.banknote',
          title: 'Sẵn sàng giải ngân',
          desc: 'Hợp đồng đã được duyệt — xác nhận giải ngân để kích hoạt lịch thu.',
        };
      case LoanContractStatus.DISBURSED:
        return {
          wrapperClass: 'border-l-4 border-red-400 bg-red-50',
          iconClass: 'text-red-500',
          icon: '@tui.triangle-alert',
          title: 'Xử lý nợ xấu',
          desc: 'Có thể cần chuyển sang nợ xấu nếu không còn khả năng thu hồi.',
        };
      case LoanContractStatus.BAD_DEBT:
        return {
          wrapperClass: 'border-l-4 border-orange-500 bg-orange-50',
          iconClass: 'text-orange-600',
          icon: '@tui.folder-open',
          title: 'Hồ sơ nợ xấu đang mở',
          desc: 'Đóng hồ sơ khi đã thu hồi xong hoặc xử lý xong.',
        };
      default:
        return null;
    }
  });

  readonly transferContent = computed(() => {
    const contractNo = this.loan().contractNo ?? this.loanContractId();
    const selected = this.selectedReceiptPurposes();
    const purpose =
      selected.length > 0
        ? selected.map((code) => this.receiptPurposeStringify(code)).join(', ')
        : 'khoản thu';
    return `Thu ${purpose} - ${contractNo}`;
  });

  readonly qrImageUrl = computed(() => {
    const amount = this.receiptAmountInput() ?? 0;
    if (amount <= 0) return null;
    const addInfo = encodeURIComponent(this.transferContent());
    const accountName = encodeURIComponent(this.bankTransferInfo.accountName);
    return `https://img.vietqr.io/image/${this.bankTransferInfo.bankBin}-${this.bankTransferInfo.accountNo}-compact2.png?amount=${Math.round(amount)}&addInfo=${addInfo}&accountName=${accountName}`;
  });
  // ── Collateral ─────────────────────────────────────────────────────────
  collaterals = signal<LoanCollateral[]>([]);
  collateralLoaded = signal(false);
  collateralLoading = signal(false);
  showCollateralForm = signal(false);
  savingCollateral = signal(false);

  readonly collateralForm = new FormGroup({
    collateralType: new FormControl<string>('OTHER', {
      nonNullable: true,
      validators: Validators.required,
    }),
    description: new FormControl<string>('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    serialNumber: new FormControl<string | null>(null),
    estimatedValue: new FormControl<number | null>(null),
    detail: new FormControl<string>('', { nonNullable: true }),
    note: new FormControl<string>('', { nonNullable: true }),
  });

  readonly collateralTypes = COLLATERAL_TYPES;
  readonly collateralTypeStringify: TuiStringHandler<string> = (t) => {
    if (!t) return '';
    return COLLATERAL_TYPE_LABELS[t] ?? t;
  };
  readonly collateralTypeMatcher: TuiStringMatcher<string> = (t, q) => {
    if (!t || !q) return false;
    return this.collateralTypeStringify(t).toLowerCase() === q.toLowerCase();
  };
  readonly getSerialNumberLabel = (type: string): string =>
    COLLATERAL_SERIAL_LABEL[type] ?? 'Mã định danh (nếu có)';
  readonly getSerialNumberPlaceholder = (type: string): string =>
    COLLATERAL_SERIAL_PLACEHOLDER[type] ?? '';

  // ── PDF Attachment ──────────────────────────────────────────────────────
  pdfAttachment = signal<any>(undefined); // undefined=not loaded, null=none, obj=exists
  attachmentLoaded = signal(false);
  attachmentLoading = signal(false);
  uploadingPdf = signal(false);

  // ── Document images ─────────────────────────────────────────────────────
  documents = signal<LoanContractDocument[]>([]);
  documentLoaded = signal(false);
  documentLoading = signal(false);
  uploadingDoc = signal(false);
  selectedDocType = signal<string>('OTHER');
  previewDocUrl = signal<string | null>(null); // blob: URL — nhớ revoke khi đóng
  previewIsImage = signal(false);

  /** Cache blob URLs cho thumbnail nhỏ trong danh sách. */
  private readonly docBlobCache = new Map<string, string>();

  readonly otherDocs = computed(() => this.documents());

  readonly documentTypes = DOCUMENT_TYPES;
  readonly documentTypeStringify: TuiStringHandler<string> = (t) => {
    if (!t) return '';
    return DOCUMENT_TYPE_LABELS[t] ?? t;
  };
  readonly documentTypeMatcher: TuiStringMatcher<string> = (t, q) => {
    if (!t || !q) return false;
    return this.documentTypeStringify(t).toLowerCase() === q.toLowerCase();
  };

  // chỉ DRAFT mới được thêm/sửa/xóa
  readonly isDraft = computed(() => this.statusCode() === LoanContractStatus.DRAFT);
  readonly LoanContractStatus = LoanContractStatus;

  openStatusActionDialog(action: LoanStatusActionOption): void {
    const data: LoanStatusActionDialogData = {
      actionLabel: action.label,
      contractNo: this.loan().contractNo,
      requiresReason: !!action.requiresReason,
      hint: action.hint,
      isNegative: this.isNegativeAction(action),
    };

    tuiDialog(LoanStatusActionDialogComponent, {
      injector: this.injector,
      label: 'Xác nhận thay đổi trạng thái',
      size: 's',
    })(data).subscribe((result?: LoanStatusActionDialogResult) => {
      if (!result) return;
      this.performStatusAction(action, result.reason);
    });
  }

  performStatusAction(action: LoanStatusActionOption, reasonFromDialog?: string | null): void {
    if (this.statusChanging()) return;

    const reason = (reasonFromDialog ?? '').trim();
    if (action.requiresReason && !reason) {
      this.alert
        .open('Vui lòng nhập lý do trước khi chuyển trạng thái.', { appearance: 'warning' })
        .subscribe();
      return;
    }

    this.statusChanging.set(true);
    this.loanProvider
      .apiLoanContractChangeStatusPost({
        changeStatusRequest: {
          loanContractId: this.loanContractId(),
          toStatus: action.toStatus,
          reason: reason || null,
        },
      })
      .subscribe({
        next: (r) => {
          this.statusChanging.set(false);
          if (r.status) {
            this.statusCode.set(action.toStatus);
            // Cập nhật ngày giải ngân và đáo hạn khi chuyển sang DISBURSED
            if (action.toStatus === LoanContractStatus.DISBURSED && !this.disbursedDate()) {
              const today = new Date().toISOString().split('T')[0];
              this.disbursedDate.set(today);
              const months = this.loan().termMonths ?? 0;
              if (months > 0) {
                const mat = new Date();
                mat.setMonth(mat.getMonth() + months);
                this.maturityDate.set(mat.toISOString().split('T')[0]);
              }
            }
            const label =
              LOAN_CONTRACT_STATUS_LABELS[action.toStatus as LoanContractStatus] ?? action.toStatus;
            this.alert
              .open(`Đã chuyển hợp đồng sang trạng thái "${label}" thành công.`, {
                appearance: 'positive',
              })
              .subscribe();
            this.scheduleLoaded.set(false);
            this.financialSummaryLoaded.set(false);
            this.paymentVouchersLoaded.set(false);
            this.loadSchedule();
            this.loadFinancialSummary();
            this.loadPaymentVouchers();
          } else {
            this.alert
              .open(r.message ?? 'Không thể cập nhật trạng thái hợp đồng.', {
                appearance: 'negative',
              })
              .subscribe();
          }
        },
        error: (err) => {
          this.statusChanging.set(false);
          const message = err?.error?.message ?? 'Lỗi kết nối khi cập nhật trạng thái.';
          this.alert.open(message, { appearance: 'negative' }).subscribe();
        },
      });
  }

  ngOnInit(): void {
    this.loadSchedule();
    this.loadFinancialSummary();
    this.loadPaymentVouchers();
    this.loadBadDebtCaseInfo(this.statusCode());
  }

  ngOnDestroy(): void {
    // Giải phóng tất cả blob URLs khi component destroy
    const preview = this.previewDocUrl();
    if (preview) URL.revokeObjectURL(preview);
    this.docBlobCache.forEach((url) => URL.revokeObjectURL(url));
    this.docBlobCache.clear();
  }

  /**
   * Trả về blob URL cho thumbnail. Lần đầu sẽ fetch và cache lại.
   * Dùng trong template: [src]="getDocBlobUrl(doc)"
   */
  getDocBlobUrl(doc: LoanContractDocument): string {
    if (this.docBlobCache.has(doc.documentId)) {
      return this.docBlobCache.get(doc.documentId)!;
    }
    // placeholder trong lúc fetch
    this.docBlobCache.set(doc.documentId, '');
    this.documentSvc.fetchBlobUrl(doc.documentId).subscribe({
      next: (blobUrl) => this.docBlobCache.set(doc.documentId, blobUrl),
    });
    return '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  switchTab(tab: TabKey): void {
    this.activeTab.set(tab);
    if (tab === 'schedule' && !this.scheduleLoading() && !this.scheduleLoaded())
      this.loadSchedule();
    if (tab === 'payments') {
      if (!this.paymentVouchersLoaded()) this.loadPaymentVouchers();
      // Đảm bảo dữ liệu auto-fill đã sẵn sàng
      if (!this.scheduleLoaded() && !this.scheduleLoading()) this.loadSchedule();
      if (!this.financialSummaryLoaded() && !this.financialSummaryLoading())
        this.loadFinancialSummary();
    }
    if (tab === 'collateral' && !this.collateralLoaded()) this.loadCollaterals();
    if (tab === 'docs') {
      if (!this.attachmentLoaded()) this.loadAttachment();
      if (!this.documentLoaded()) this.loadDocuments();
    }
  }

  /**
   * Được gọi khi user click vào kỳ chưa thanh toán trong tab Lịch trả nợ.
   * Chuyển sang tab Lịch sử thu và tự động tick Lãi + Phí định kỳ + Gốc (+ Phạt nếu OVERDUE).
   */
  payPeriodFromSchedule(row: RepaymentScheduleRow): void {
    // LATE_PENALTY sẽ được auto-inject bởi effect nếu kỳ có phạt
    this.waiveLatePenalty.set(false); // reset waive khi chọn kỳ mới từ lịch
    this.selectedReceiptPurposes.set(['INTEREST', 'QLKV_FEE', 'QLTS_FEE', 'PRINCIPAL']);
    this.selectedPeriodNo.set(row.periodNo ?? null);
    this.pendingAutoFill.set(true);
    this.switchTab('payments');
  }

  /** .NET [FromBody] Guid yêu cầu payload JSON string (ví dụ: "guid"). */
  private guidBody(id: string): string {
    return JSON.stringify(id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Repayment schedule
  // ─────────────────────────────────────────────────────────────────────────

  private loadSchedule(): void {
    const id = this.loanContractId();
    if (!id) {
      console.warn('[LoanDetail] loadSchedule: loanContractId is empty, skipping');
      return;
    }
    this.scheduleLoading.set(true);
    this.loanProvider
      .apiLoanContractGetRepaymentSchedulePost({ body: this.guidBody(id) })
      .subscribe({
        next: (r) => {
          this.scheduleLoading.set(false);
          this.scheduleLoaded.set(true);
          if (r.status && r.data)
            this.repaymentSchedule.set(
              Array.isArray(r.data) ? (r.data as RepaymentScheduleRow[]) : [],
            );
        },
        error: (err) => {
          this.scheduleLoading.set(false);
          console.error('[LoanDetail] GetRepaymentSchedule 400:', err?.error ?? err);
        },
      });
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // Financial Summary
  // ───────────────────────────────────────────────────────────────────────────────
  private loadFinancialSummary(): void {
    const status = this.statusCode();
    const id = this.loanContractId();
    // Chỉ skip cho DRAFT / PENDING_APPROVAL / CANCELLED – PENDING_DISBURSEMENT
    // vẫn cần để lấy phí hồ sơ + bảo hiểm cho auto-fill
    if (!id || !status || status === 'DRAFT' || status === 'CANCELLED') return;
    this.financialSummaryLoading.set(true);
    this.loanProvider
      .apiLoanContractGetFinancialSummaryPost({ body: this.guidBody(id) })
      .subscribe({
        next: (r) => {
          this.financialSummaryLoading.set(false);
          this.financialSummaryLoaded.set(true);
          if (r.status && r.data) this.financialSummary.set(r.data as LoanFinancialSummary);
        },
        error: (err) => {
          this.financialSummaryLoading.set(false);
          console.error('[LoanDetail] GetFinancialSummary error:', err?.error ?? err);
        },
      });
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // Payment Vouchers
  // ───────────────────────────────────────────────────────────────────────────────
  loadPaymentVouchers(): void {
    const id = this.loanContractId();
    if (!id) {
      console.warn('[LoanDetail] loadPaymentVouchers: loanContractId is empty, skipping');
      return;
    }
    this.paymentVouchersLoading.set(true);
    this.cashVoucherProvider
      .apiCashVoucherGetByLoanContractPost({ body: this.guidBody(id) })
      .subscribe({
        next: (r) => {
          this.paymentVouchersLoading.set(false);
          this.paymentVouchersLoaded.set(true);
          if (r.status && r.data) {
            const list = Array.isArray(r.data) ? (r.data as LoanPaymentVoucher[]) : [];
            this.paymentVouchers.set(list);

            // If there's a settlement receipt but status isn't updated by backend,
            // lock the UI to prevent further collections and try to sync status once (Admin/Manager only).
            const hasSettle = list.some(
              (v) =>
                (v.voucherType ?? '').toUpperCase() === 'RECEIPT' &&
                v.reasonCode === 'EARLY_SETTLEMENT',
            );
            if (hasSettle && this.statusCode() !== LoanContractStatus.SETTLED) {
              this.statusCode.set(LoanContractStatus.SETTLED);
              this.selectedReceiptPurposes.set([]);
              this.selectedPeriodNo.set(null);
              this.receiptAmountInput.set(null);

              if (this.canManageContractStatus() && !this.autoSettleAttempted()) {
                this.autoSettleAttempted.set(true);
                this.loanProvider
                  .apiLoanContractChangeStatusPost({
                    changeStatusRequest: {
                      loanContractId: this.loanContractId(),
                      toStatus: LoanContractStatus.SETTLED,
                      reason: 'Auto settle via settlement receipt',
                    },
                  })
                  .subscribe({
                    next: () => this.refreshLoanInfo(),
                    error: () => {},
                  });
              }
            }
          }
        },
        error: (err) => {
          this.paymentVouchersLoading.set(false);
          this.paymentVouchersLoaded.set(true);
          console.error('[LoanDetail] GetByLoanContract 400:', err?.error ?? err);
        },
      });
  }

  private refreshLoanInfo(): void {
    const id = this.loanContractId();
    if (!id) return;

    this.loanProvider.apiLoanContractGetByIdPost({ body: this.guidBody(id) }).subscribe({
      next: (r) => {
        if (!r?.status || !r.data) return;
        const d: any = r.data;
        this.statusCode.set(d.statusCode ?? this.statusCode());
        this.disbursedDate.set(d.disbursedDate ?? this.disbursedDate());
        this.maturityDate.set(d.maturityDate ?? this.maturityDate());
        this.loadBadDebtCaseInfo(d.statusCode ?? this.statusCode());
      },
      error: (err) => console.error('[LoanDetail] GetById error:', err?.error ?? err),
    });
  }

  private loadBadDebtCaseInfo(status?: string | null): void {
    if (status !== LoanContractStatus.BAD_DEBT) {
      this.badDebtCase.set(null);
      return;
    }

    this.badDebtCaseOps.getByLoanContractId(this.loanContractId()).subscribe({
      next: (item) => this.badDebtCase.set(item),
      error: () => this.badDebtCase.set(null),
    });
  }

  createReceiptForContract(): void {
    if (!this.canCreateReceipt()) {
      this.alert
        .open('Chỉ tạo phiếu thu sau khi hợp đồng đã được duyệt.', { appearance: 'warning' })
        .subscribe();
      return;
    }

    const amount = Math.round(this.receiptAmountInput() ?? 0);
    if (amount <= 0) {
      this.alert.open('Vui lòng nhập số tiền hợp lệ (> 0).', { appearance: 'warning' }).subscribe();
      return;
    }

    const purposes = this.selectedReceiptPurposes();
    if (purposes.length === 0) {
      this.alert.open('Vui lòng chọn ít nhất 1 khoản thu.', { appearance: 'warning' }).subscribe();
      return;
    }

    const body = {
      loanContractId: this.loanContractId(),
      purposes,
      reasonCode: this.mapPurposesToReasonCode(purposes),
      amount,
      payerReceiverName: this.loan().customerName ?? null,
      description: this.buildReceiptDescription(purposes, amount),
    };

    if (purposes.includes('BAD_DEBT_RECOVERY')) {
      const note = this.buildReceiptDescription(purposes, amount);
      const badDebtCaseId = this.badDebtCase()?.badDebtCaseId;

      const submitRecovery = (resolvedBadDebtCaseId: string): void => {
        this.badDebtCaseOps
          .recordRecovery({
            badDebtCaseId: resolvedBadDebtCaseId,
            amount,
            businessDate: this.todayIso(),
            note,
          })
          .subscribe({
            next: (r: any) => {
              this.creatingReceipt.set(false);
              if (r.status) {
                this.alert
                  .open('Tạo phiếu thu thành công.', { appearance: 'positive' })
                  .subscribe();
                this.receiptAmountInput.set(null);
                this.selectedReceiptPurposes.set([]);
                this.selectedPeriodNo.set(null);
                this.scheduleLoaded.set(false);
                this.financialSummaryLoaded.set(false);
                this.paymentVouchersLoaded.set(false);
                this.loadSchedule();
                this.loadFinancialSummary();
                this.loadPaymentVouchers();
                this.refreshLoanInfo();
              } else {
                this.alert
                  .open(r.message ?? 'Không thể ghi nhận thu hồi nợ xấu.', {
                    appearance: 'negative',
                  })
                  .subscribe();
              }
            },
            error: (err: any) => {
              this.creatingReceipt.set(false);
              const msg = err?.error?.message ?? 'Lỗi kết nối khi ghi nhận thu hồi nợ xấu.';
              this.alert.open(msg, { appearance: 'negative' }).subscribe();
            },
          });
      };

      this.creatingReceipt.set(true);
      if (badDebtCaseId) {
        submitRecovery(badDebtCaseId);
      } else {
        this.badDebtCaseOps.getByLoanContractId(this.loanContractId()).subscribe({
          next: (item) => {
            const resolvedBadDebtCaseId = item?.badDebtCaseId;
            if (!resolvedBadDebtCaseId) {
              this.creatingReceipt.set(false);
              this.alert
                .open('Không tìm thấy hồ sơ nợ xấu của hợp đồng này.', { appearance: 'negative' })
                .subscribe();
              return;
            }

            this.badDebtCase.set(item);
            submitRecovery(resolvedBadDebtCaseId);
          },
          error: () => {
            this.creatingReceipt.set(false);
            this.alert.open('Lỗi khi tải hồ sơ nợ xấu.', { appearance: 'negative' }).subscribe();
          },
        });
      }
      return;
    }

    this.creatingReceipt.set(true);
    this.cashVoucherProvider
      .apiCashVoucherCollectLoanPaymentPost({ collectLoanPaymentModel: body })
      .subscribe({
        next: (r: any) => {
          this.creatingReceipt.set(false);
          if (r.status) {
            this.alert.open('Tạo phiếu thu thành công.', { appearance: 'positive' }).subscribe();
            this.receiptAmountInput.set(null);
            this.selectedReceiptPurposes.set([]);
            this.selectedPeriodNo.set(null);
            // Reload để cập nhật lại lịch trả nợ + financial summary + danh sách phiếu
            this.scheduleLoaded.set(false);
            this.financialSummaryLoaded.set(false);
            this.paymentVouchersLoaded.set(false);
            this.loadSchedule();
            this.loadFinancialSummary();
            this.loadPaymentVouchers();
            this.refreshLoanInfo();
          } else {
            this.alert
              .open(r.message ?? 'Không thể tạo phiếu thu.', { appearance: 'negative' })
              .subscribe();
          }
        },
        error: (err) => {
          this.creatingReceipt.set(false);
          const msg = err?.error?.message ?? 'Lỗi kết nối khi tạo phiếu thu.';
          this.alert.open(msg, { appearance: 'negative' }).subscribe();
        },
      });
  }

  private mapPurposesToReasonCode(purposes: string[]): string {
    if (purposes.length === 1) {
      switch (purposes[0]) {
        case 'FILE_FEE':
          return 'FILE_FEE';
        case 'LATE_PENALTY':
          return 'LATE_PENALTY';
        case 'EARLY_SETTLEMENT':
          return 'EARLY_SETTLEMENT';
        case 'BAD_DEBT_RECOVERY':
          return 'BAD_DEBT_RECOVERY';
        case 'OTHER_INCOME':
          return 'OTHER_INCOME';
        default:
          return 'LOAN_COLLECTION';
      }
    }

    if (purposes.every((x) => x === 'OTHER_INCOME')) return 'OTHER_INCOME';
    return 'LOAN_COLLECTION';
  }

  private buildReceiptDescription(purposes: string[], amount: number): string {
    if (purposes.length === 1 && purposes[0] === 'BAD_DEBT_RECOVERY') {
      const contractNo = this.loan().contractNo ?? this.loanContractId();
      return `Thu hồi nợ xấu cho hợp đồng ${contractNo} - ${this.formatCurrency(amount)}`;
    }

    const labels = purposes.map((p) => this.receiptPurposeStringify(p));
    const label = labels.join(', ');
    const contractNo = this.loan().contractNo ?? this.loanContractId();
    return `Thu ${label} cho hợp đồng ${contractNo} - ${this.formatCurrency(amount)}`;
  }

  /** Tổng cộng tất cả các cột số trong bảng lịch trả nợ */
  readonly scheduleDetailTotals = computed(() => {
    const rows = this.repaymentSchedule();
    return {
      installmentAmount: rows.reduce((s, r) => s + (r.installmentAmount ?? 0), 0),
      duePrincipalAmount: rows.reduce((s, r) => s + (r.duePrincipalAmount ?? 0), 0),
      dueInterestAmount: rows.reduce((s, r) => s + (r.dueInterestAmount ?? 0), 0),
      dueQlkvAmount: rows.reduce((s, r) => s + (r.dueQlkvAmount ?? 0), 0),
      dueQltsAmount: rows.reduce((s, r) => s + (r.dueQltsAmount ?? 0), 0),
      duePawnTotal: rows.reduce(
        (s, r) => s + (r.duePrincipalAmount ?? 0) + (r.dueInterestAmount ?? 0),
        0,
      ),
      dueRentTotal: rows.reduce(
        (s, r) => s + (r.dueQlkvAmount ?? 0) + (r.dueQltsAmount ?? 0),
        0,
      ),
      totalPaid: rows.reduce((s, r) => s + this.totalPaid(r), 0),
    };
  });

  // Helper: Tổng đã trả cho một kỳ
  totalPaid(row: RepaymentScheduleRow): number {
    return (
      (row.paidPrincipalAmount ?? 0) +
      (row.paidInterestAmount ?? 0) +
      (row.paidPeriodicFeeAmount ?? 0) +
      (row.paidLatePenaltyAmount ?? 0)
    );
  }

  getScheduleStatusBadge(status?: string): { label: string; css: string } {
    switch (status) {
      case 'PAID':
        return {
          label: 'Đã thanh toán',
          css: 'bg-green-100 text-green-700 border border-green-200',
        };
      case 'PARTIAL':
        return { label: 'Trả một phần', css: 'bg-blue-100 text-blue-700 border border-blue-200' };
      case 'OVERDUE':
        return { label: 'Quá hạn', css: 'bg-red-100 text-red-700 border border-red-200' };
      default:
        return {
          label: 'Chưa thanh toán',
          css: 'bg-amber-50 text-amber-700 border border-amber-300',
        };
    }
  }

  /** Trả về class CSS cho badge một kỳ: thêm ring nhẹ khi isPayable, KHÔNG đổi màu chữ. */
  getScheduleRowBadgeClass(badgeCss: string, isPayable: boolean): string {
    if (!isPayable) return badgeCss;
    return (
      badgeCss +
      ' cursor-pointer group-hover:ring-1 group-hover:ring-primary/70 group-hover:shadow-sm'
    );
  }

  getVoucherTypeLabel(type?: string): string {
    const map: Record<string, string> = { RECEIPT: 'Phiếu thu', PAYMENT: 'Phiếu chi' };
    return map[type ?? ''] ?? type ?? '-';
  }

  getVoucherReasonLabel(code?: string): string {
    const map: Record<string, string> = {
      LOAN_COLLECTION: 'Thu cố định',
      LOAN_DISBURSEMENT: 'Giải ngân',
      FILE_FEE: 'Phí hồ sơ',
      INSURANCE: 'Bảo hiểm',
      EARLY_SETTLEMENT: 'Tất toán sớm',
      BAD_DEBT_RECOVERY: 'Thu hồi nợ xấu',
      OVERPAYMENT: 'Số tiền chuyển kỳ sau',
      OTHER_INCOME: 'Thu khác',
      OTHER_PAYMENT: 'Chi khác',
    };
    return map[code ?? ''] ?? code ?? '-';
  }

  getAllocLabel(code?: string): string {
    const map: Record<string, string> = {
      PRINCIPAL: 'Gốc',
      INTEREST: 'Lãi',
      QLKV_FEE: 'Phí phần mềm',
      QLTS_FEE: 'Phí hao mòn',
      FILE_FEE: 'Phí hồ sơ',
      INSURANCE: 'Bảo hiểm',
      LATE_PENALTY: 'Phạt chậm nộp',
      EARLY_SETTLEMENT_PENALTY: 'Phạt tất toán sớm',
      OTHER_INCOME: 'Thu khác',
    };
    return map[code ?? ''] ?? code ?? '-';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Collateral
  // ─────────────────────────────────────────────────────────────────────────

  loadCollaterals(): void {
    this.collateralLoading.set(true);
    this.collateralSvc.getByLoanContract(this.loanContractId()).subscribe({
      next: (r) => {
        this.collateralLoading.set(false);
        this.collateralLoaded.set(true);
        if (r.status && r.data) this.collaterals.set(r.data as LoanCollateral[]);
      },
      error: () => {
        this.collateralLoading.set(false);
        this.collateralLoaded.set(true);
      },
    });
  }

  toggleCollateralForm(): void {
    this.showCollateralForm.update((v) => !v);
    if (!this.showCollateralForm())
      this.collateralForm.reset({ collateralType: 'OTHER', description: '', detail: '', note: '' });
  }

  saveCollateral(): void {
    if (this.collateralForm.invalid) {
      this.collateralForm.markAllAsTouched();
      return;
    }
    this.savingCollateral.set(true);
    const v = this.collateralForm.value;
    this.collateralSvc
      .save({
        loanContractId: this.loanContractId(),
        collateralType: v.collateralType ?? 'OTHER',
        description: v.description ?? '',
        serialNumber: v.serialNumber || null,
        estimatedValue: v.estimatedValue ?? null,
        detail: v.detail || null,
        note: v.note || null,
      })
      .subscribe({
        next: (r) => {
          this.savingCollateral.set(false);
          if (r.status) {
            this.alert.open('Đã thêm tài sản đảm bảo.', { appearance: 'positive' }).subscribe();
            this.showCollateralForm.set(false);
            this.collateralForm.reset({
              collateralType: 'OTHER',
              description: '',
              detail: '',
              note: '',
            });
            this.collateralLoaded.set(false);
            this.loadCollaterals();
          } else {
            this.alert.open(r.message ?? 'Lỗi khi lưu.', { appearance: 'negative' }).subscribe();
          }
        },
        error: () => {
          this.savingCollateral.set(false);
          this.alert.open('Lỗi kết nối.', { appearance: 'negative' }).subscribe();
        },
      });
  }

  deleteCollateral(c: LoanCollateral): void {
    if (!confirm(`Xóa tài sản: ${c.description}?`)) return;
    this.collateralSvc.delete(c.collateralId).subscribe({
      next: (r) => {
        if (r.status) {
          this.alert.open('Đã xóa tài sản đảm bảo.', { appearance: 'positive' }).subscribe();
          this.collaterals.update((list) => list.filter((x) => x.collateralId !== c.collateralId));
        } else {
          this.alert.open(r.message ?? 'Không thể xóa.', { appearance: 'negative' }).subscribe();
        }
      },
      error: () => this.alert.open('Lỗi kết nối.', { appearance: 'negative' }).subscribe(),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PDF Attachment
  // ─────────────────────────────────────────────────────────────────────────

  loadAttachment(): void {
    const id = this.loanContractId();
    if (!id) {
      console.warn('[LoanDetail] loadAttachment: loanContractId is empty, skipping');
      return;
    }
    this.attachmentLoading.set(true);
    this.attachmentProvider
      .apiLoanContractAttachmentGetByLoanContractPost({ body: this.guidBody(id) })
      .subscribe({
        next: (r) => {
          this.attachmentLoading.set(false);
          this.attachmentLoaded.set(true);
          this.pdfAttachment.set(r.data ?? null);
        },
        error: () => {
          this.attachmentLoading.set(false);
          this.attachmentLoaded.set(true);
          this.pdfAttachment.set(null);
        },
      });
  }

  onPdfFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      this.alert.open('Chỉ chấp nhận file PDF.', { appearance: 'negative' }).subscribe();
      input.value = '';
      return;
    }
    this.uploadPdf(file);
    input.value = '';
  }

  private uploadPdf(file: File): void {
    this.uploadingPdf.set(true);
    this.attachmentProvider
      .apiLoanContractAttachmentUploadPost({ loanContractId: this.loanContractId(), file })
      .subscribe({
        next: (r) => {
          this.uploadingPdf.set(false);
          if (r.status) {
            this.alert
              .open('Upload hợp đồng PDF thành công.', { appearance: 'positive' })
              .subscribe();
            this.attachmentLoaded.set(false);
            this.loadAttachment();
          } else {
            this.alert
              .open(r.message ?? 'Upload thất bại.', { appearance: 'negative' })
              .subscribe();
          }
        },
        error: () => {
          this.uploadingPdf.set(false);
          this.alert.open('Lỗi kết nối.', { appearance: 'negative' }).subscribe();
        },
      });
  }

  /** @deprecated D\u00f9ng downloadPdfAttachment() thay th\u1ebf */
  getPdfViewUrl(attachmentId: string): string {
    const base: string = (this.attachmentProvider as any)?.configuration?.basePath ?? '';
    return `${base}/api/LoanContractAttachment/ViewPdf/${attachmentId}`;
  }

  /** M\u1edf PDF h\u1ee3p \u0111\u1ed3ng qua blob URL trong tab m\u1edbi (c\u00f3 k\u00e8m auth token). */
  openPdfAttachment(attachmentId: string): void {
    const base: string = (this.attachmentProvider as any)?.configuration?.basePath ?? '';
    this.http
      .get(`${base}/api/LoanContractAttachment/ViewPdf/${attachmentId}`, { responseType: 'blob' })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          // revoke sau 60s \u2014 \u0111\u1ee7 th\u1eddi gian browser t\u1ea3i xong
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        },
        error: () =>
          this.alert
            .open('Kh\u00f4ng th\u1ec3 m\u1edf file PDF.', { appearance: 'negative' })
            .subscribe(),
      });
  }

  /** T\u1ea3i PDF h\u1ee3p \u0111\u1ed3ng v\u1ec1 m\u00e1y (c\u00f3 k\u00e8m auth token). */
  downloadPdfAttachment(att: any): void {
    const base: string = (this.attachmentProvider as any)?.configuration?.basePath ?? '';
    this.http
      .get(`${base}/api/LoanContractAttachment/Download/${att.attachmentId}`, {
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = att.fileName ?? 'hopDong.pdf';
          a.click();
          URL.revokeObjectURL(url);
        },
        error: () =>
          this.alert
            .open('T\u1ea3i file th\u1ea5t b\u1ea1i.', { appearance: 'negative' })
            .subscribe(),
      });
  }

  /** @deprecated D\u00f9ng downloadPdfAttachment() thay th\u1ebf */
  getPdfDownloadUrl(attachmentId: string): string {
    const base: string = (this.attachmentProvider as any)?.configuration?.basePath ?? '';
    return `${base}/api/LoanContractAttachment/Download/${attachmentId}`;
  }

  downloadDocument(doc: LoanContractDocument): void {
    this.documentSvc.downloadFile(doc.documentId, doc.fileName).subscribe({
      error: () => this.alert.open('Tải file thất bại.', { appearance: 'negative' }).subscribe(),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Document images / files
  // ─────────────────────────────────────────────────────────────────────────

  loadDocuments(): void {
    this.documentLoading.set(true);
    this.documentSvc.getByLoanContract(this.loanContractId()).subscribe({
      next: (r) => {
        this.documentLoading.set(false);
        this.documentLoaded.set(true);
        if (r.status && r.data) this.documents.set(r.data as LoanContractDocument[]);
      },
      error: () => {
        this.documentLoading.set(false);
        this.documentLoaded.set(true);
      },
    });
  }

  onDocFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadDocument(file);
    input.value = '';
  }

  private uploadDocument(file: File): void {
    this.uploadingDoc.set(true);
    this.documentSvc.upload(this.loanContractId(), file, this.selectedDocType()).subscribe({
      next: (r) => {
        this.uploadingDoc.set(false);
        if (r.status) {
          this.alert.open('Upload giấy tờ thành công.', { appearance: 'positive' }).subscribe();
          this.documentLoaded.set(false);
          this.loadDocuments();
        } else {
          this.alert.open(r.message ?? 'Upload thất bại.', { appearance: 'negative' }).subscribe();
        }
      },
      error: () => {
        this.uploadingDoc.set(false);
        this.alert.open('Lỗi kết nối.', { appearance: 'negative' }).subscribe();
      },
    });
  }

  deleteDocument(doc: LoanContractDocument): void {
    if (!confirm(`Xóa file: ${doc.fileName}?`)) return;
    this.documentSvc.delete(doc.documentId).subscribe({
      next: (r) => {
        if (r.status) {
          this.alert.open('Đã xóa giấy tờ.', { appearance: 'positive' }).subscribe();
          this.documents.update((list) => list.filter((x) => x.documentId !== doc.documentId));
        } else {
          this.alert.open(r.message ?? 'Không thể xóa.', { appearance: 'negative' }).subscribe();
        }
      },
      error: () => this.alert.open('Lỗi kết nối.', { appearance: 'negative' }).subscribe(),
    });
  }

  openDocPreview(doc: LoanContractDocument): void {
    this.previewIsImage.set(this.isImageContent(doc.contentType));
    this.documentSvc.fetchBlobUrl(doc.documentId).subscribe({
      next: (blobUrl) => {
        // Revoke URL cũ nếu có trước khi set mới
        const old = this.previewDocUrl();
        if (old) URL.revokeObjectURL(old);
        this.previewDocUrl.set(blobUrl);
      },
      error: () =>
        this.alert.open('Không thể tải file xem trước.', { appearance: 'negative' }).subscribe(),
    });
  }

  closePreview(): void {
    const url = this.previewDocUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewDocUrl.set(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  getStatusLabel(code?: string | null): string {
    if (!code) return '-';
    return LOAN_CONTRACT_STATUS_LABELS[code as LoanContractStatus] ?? code;
  }

  getStatusClass(code?: string | null): string {
    if (!code) return 'bg-gray-100 text-gray-500 border border-gray-200';
    return (
      LOAN_CONTRACT_STATUS_CLASSES[code as LoanContractStatus] ??
      'bg-gray-100 text-gray-500 border border-gray-200'
    );
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

  /** Format gọn số tiền (không kèm ký hiệu VNĐ) dùng trong dropdown option. */
  formatAmountShort(amount: number): string {
    return new Intl.NumberFormat('vi-VN').format(Math.round(amount));
  }

  getCollateralTypeLabel = (t: string): string => COLLATERAL_TYPE_LABELS[t] ?? t;
  getDocumentTypeLabel = (t: string): string => DOCUMENT_TYPE_LABELS[t] ?? t;
  isImageContent = (contentType: string): boolean => contentType.startsWith('image/');
  formatFileSize = (bytes: number): string => this.documentSvc.formatFileSize(bytes);
}
