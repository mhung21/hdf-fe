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
import { TuiChevron, TuiSelect, TuiInputDateRange, TuiInputDate, TuiDayRangePeriod } from '@taiga-ui/kit';
import { TuiDay, TuiDayRange, TuiStringHandler, TuiStringMatcher } from '@taiga-ui/cdk';
import { map } from 'rxjs';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

import { ReportProvider } from '../../api/api/report.service';
import { StoreProvider } from '../../api/api/store.service';
import { AuthService } from '../../services/auth.service';
import { StoreScopeService } from '../../services/store-scope.service';
import { RoleCode } from '../../models/role.model';

interface StoreItem {
  storeId: string;
  storeName: string;
}

interface DailyCollectionRow {
  businessDate?: string | null;
  storeName?: string | null;
  totalReceipt?: number | null;
  totalPayment?: number | null;
  netAmount?: number | null;
  receiptCount?: number | null;
}

interface OverdueSummaryItem {
  loanContractId?: string | null;
  contractCode?: string | null;
  customerName?: string | null;
  customerNationalId?: string | null;
  overdueDays?: number | null;
  overdueAmount?: number | null;
  latePenaltyAmount?: number | null;
  storeName?: string | null;
}

interface IncomeBreakdownItem {
  category?: string | null;
  categoryName?: string | null;
  amount?: number | null;
  count?: number | null;
}

interface PortfolioSummary {
  totalContracts?: number;
  disbursedCount?: number;
  badDebtCount?: number;
  settledCount?: number;
  overDueContractCount?: number;
  totalActivePortfolio?: number;
  totalRemainingPrincipal?: number;
  totalPrincipalCollected?: number;
  totalInterestCollected?: number;
  totalFeeCollected?: number;
  totalPenaltyCollected?: number;
  totalIncomeCollected?: number;
}

interface MonthlyCashFlowRow {
  month?: number;
  disbursed?: number;
  totalCollected?: number;
  principal?: number;
  interest?: number;
  periodicFee?: number;
  fileFee?: number;
  insurance?: number;
  latePenalty?: number;
  earlyPenalty?: number;
  netIncome?: number;
  newLoanCount?: number;
}

interface MonthlyCashFlow {
  year?: number;
  totalDisbursed?: number;
  totalCollected?: number;
  totalNetIncome?: number;
  months?: MonthlyCashFlowRow[];
}

@Component({
  selector: 'app-reports-store',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiButton,
    TuiDataList,
    TuiIcon,
    TuiChevron,
    TuiSelect,
    TuiTextfield,
    TuiInputDateRange,
    TuiInputDate,
  ],
  templateUrl: './reports-store.component.html',
})
export class ReportsStoreComponent implements OnInit {
  private readonly reportProvider = inject(ReportProvider);
  private readonly storeProvider = inject(StoreProvider);
  private readonly authService = inject(AuthService);
  private readonly storeScope = inject(StoreScopeService);

  loading = signal(false);
  exporting = signal(false);
  stores = signal<StoreItem[]>([]);
  selectedStoreId = signal<string | null>(null);
  dailyCollections = signal<DailyCollectionRow[]>([]);
  overdueItems = signal<OverdueSummaryItem[]>([]);
  incomeBreakdown = signal<IncomeBreakdownItem[]>([]);
  totalReceipt = signal(0);
  totalPayment = signal(0);
  portfolioSummary = signal<PortfolioSummary | null>(null);
  monthlyCashFlow = signal<MonthlyCashFlow | null>(null);
  selectedYear = signal(new Date().getFullYear());

  readonly availableYears = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  /** FormControl cho store selector (Admin only) */
  readonly storeControl = new FormControl<string | null>(null);

  readonly storeStringify: TuiStringHandler<string | null> = (id) => {
    if (!id) return 'Tất cả chi nhánh';
    return this.stores().find((s) => s.storeId === id)?.storeName ?? id;
  };

  protected readonly matcherStore: TuiStringMatcher<string | null> = (id, query) => {
    if (!id) return query === '' || 'tất cả chi nhánh'.includes(query.toLowerCase());
    const item = this.stores().find((s) => s.storeId === id);
    if (!item) return false;
    return id === query || item.storeName.toLowerCase().includes(query.toLowerCase());
  };

  readonly today = TuiDay.currentLocal();
  readonly firstOfMonth = new TuiDay(this.today.year, this.today.month, 1);

  readonly periods = [
    new TuiDayRangePeriod(new TuiDayRange(this.today, this.today), 'Hôm nay'),
    new TuiDayRangePeriod(new TuiDayRange(this.today.append({ day: -1 }), this.today.append({ day: -1 })), 'Hôm qua'),
    new TuiDayRangePeriod(new TuiDayRange(this.today.append({ day: -6 }), this.today), '7 ngày gần nhất'),
    new TuiDayRangePeriod(new TuiDayRange(this.today.append({ day: -29 }), this.today), '30 ngày gần nhất'),
  ];

  /** FormControl cho date range picker — dùng reactive để tránh xung đột với TuiTextfield */
  readonly dateRangeControl = new FormControl<TuiDayRange | null>(
    new TuiDayRange(this.firstOfMonth, this.today),
  );

  isAdmin = computed(() => this.authService.hasAnyRole([RoleCode.ADMIN]));
  currentUser = computed(() => this.authService.currentUser());

  incomeCategories: Record<string, string> = {
    LOAN_COLLECTION: 'Thu khoản cầm cố/thuê lại/cầm đồ',
    FILE_FEE: 'Phí hồ sơ',
    INSURANCE: 'Bảo hiểm',
    LATE_PENALTY: 'Phạt chậm nộp',
    EARLY_SETTLEMENT_PENALTY: 'Phạt tất toán sớm',
    OVERPAYMENT: 'Thu dư',
    OTHER_INCOME: 'Thu khác',
  };

  getCategoryName(code?: string | null): string {
    return this.incomeCategories[code ?? ''] ?? code ?? '-';
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

  ngOnInit(): void {
    if (this.isAdmin()) {
      this.storeProvider.apiStoreGetAllGet().subscribe({
        next: (r) => {
          if (r.status && Array.isArray(r.data)) this.stores.set(r.data as StoreItem[]);
        },
        error: () => {},
      });
      this.storeControl.valueChanges.subscribe((val) => {
        if (val === '') {
          this.storeControl.setValue(null, { emitEvent: false });
          this.selectedStoreId.set(null);
        } else {
          this.selectedStoreId.set(val ?? null);
        }
        this.loadAll();
      });
    }
    this.dateRangeControl.valueChanges.subscribe((range) => {
      if (range) this.loadAll();
    });
    this.loadAll();
  }

  private aggregatePortfolio(results: any[]): any {
    return results.reduce((acc, item) => {
      for (const [key, value] of Object.entries(item ?? {})) {
        if (typeof value === 'number') {
          acc[key] = (acc[key] ?? 0) + value;
        } else if (acc[key] === undefined) {
          acc[key] = value;
        }
      }
      return acc;
    }, {} as any);
  }

  private aggregateDailyCollections(results: DailyCollectionRow[][]): DailyCollectionRow[] {
    const rows = new Map<string, DailyCollectionRow>();
    for (const list of results) {
      for (const row of list ?? []) {
        const key = row.businessDate ?? row.storeName ?? JSON.stringify(row);
        const current = rows.get(key) ?? {
          businessDate: row.businessDate,
          storeName: row.storeName,
        };
        current.totalReceipt = (current.totalReceipt ?? 0) + (row.totalReceipt ?? 0);
        current.totalPayment = (current.totalPayment ?? 0) + (row.totalPayment ?? 0);
        current.netAmount = (current.netAmount ?? 0) + (row.netAmount ?? 0);
        current.receiptCount = (current.receiptCount ?? 0) + (row.receiptCount ?? 0);
        rows.set(key, current);
      }
    }
    return Array.from(rows.values()).sort((a, b) =>
      String(a.businessDate ?? '').localeCompare(String(b.businessDate ?? '')),
    );
  }

  private aggregateOverdue(results: any[][]): OverdueSummaryItem[] {
    return results.flatMap((items) => (Array.isArray(items) ? items : []));
  }

  private aggregateIncomeBreakdown(results: IncomeBreakdownItem[][]): IncomeBreakdownItem[] {
    const rows = new Map<string, IncomeBreakdownItem>();
    for (const list of results) {
      for (const row of list ?? []) {
        const key = row.category ?? row.categoryName ?? JSON.stringify(row);
        const current = rows.get(key) ?? { category: row.category, categoryName: row.categoryName };
        current.amount = (current.amount ?? 0) + (row.amount ?? 0);
        current.count = (current.count ?? 0) + (row.count ?? 0);
        rows.set(key, current);
      }
    }
    return Array.from(rows.values());
  }

  private aggregateMonthlyCashFlow(results: MonthlyCashFlow[]): MonthlyCashFlow {
    const months = new Map<number, MonthlyCashFlowRow>();
    const total: MonthlyCashFlow = {
      year: this.selectedYear(),
      totalDisbursed: 0,
      totalCollected: 0,
      totalNetIncome: 0,
      months: [],
    };

    for (const result of results) {
      if (!result) continue;
      total.totalDisbursed = (total.totalDisbursed ?? 0) + (result.totalDisbursed ?? 0);
      total.totalCollected = (total.totalCollected ?? 0) + (result.totalCollected ?? 0);
      total.totalNetIncome = (total.totalNetIncome ?? 0) + (result.totalNetIncome ?? 0);
      for (const row of result.months ?? []) {
        const month = row.month ?? 0;
        const current = months.get(month) ?? { month };
        current.disbursed = (current.disbursed ?? 0) + (row.disbursed ?? 0);
        current.totalCollected = (current.totalCollected ?? 0) + (row.totalCollected ?? 0);
        current.principal = (current.principal ?? 0) + (row.principal ?? 0);
        current.interest = (current.interest ?? 0) + (row.interest ?? 0);
        current.periodicFee = (current.periodicFee ?? 0) + (row.periodicFee ?? 0);
        current.fileFee = (current.fileFee ?? 0) + (row.fileFee ?? 0);
        current.insurance = (current.insurance ?? 0) + (row.insurance ?? 0);
        current.latePenalty = (current.latePenalty ?? 0) + (row.latePenalty ?? 0);
        current.earlyPenalty = (current.earlyPenalty ?? 0) + (row.earlyPenalty ?? 0);
        current.netIncome = (current.netIncome ?? 0) + (row.netIncome ?? 0);
        current.newLoanCount = (current.newLoanCount ?? 0) + (row.newLoanCount ?? 0);
        months.set(month, current);
      }
    }

    total.months = Array.from(months.values()).sort((a, b) => (a.month ?? 0) - (b.month ?? 0));
    return total;
  }

  onYearChange(year: number): void {
    this.selectedYear.set(year);
    this.loadMonthlyCashFlow();
  }

  loadAll(): void {
    this.loading.set(true);
    const r = this.dateRangeControl.value ?? new TuiDayRange(this.firstOfMonth, this.today);
    const fromDate = r.from.toJSON();
    const toDate = r.to.toJSON();
    const storeIds = this.storeScope.resolveStoreIds(this.selectedStoreId());

    Promise.all([
      new Promise<void>((resolve) => {
        this.storeScope
          .fetchAcrossStores(
            storeIds,
            (storeId) =>
              this.reportProvider
                .apiReportDailyCollectionPost({
                  reportDateRangeRequest: { fromDate, toDate, storeId } as never,
                })
                .pipe(
                  map((r) =>
                    r.status && r.data
                      ? Array.isArray(r.data)
                        ? (r.data as DailyCollectionRow[])
                        : []
                      : [],
                  ),
                ),
            (results) => this.aggregateDailyCollections(results),
          )
          .subscribe({
            next: (rows) => {
              this.dailyCollections.set(rows);
              this.totalReceipt.set(rows.reduce((s, x) => s + (x.totalReceipt ?? 0), 0));
              this.totalPayment.set(rows.reduce((s, x) => s + (x.totalPayment ?? 0), 0));
              resolve();
            },
            error: () => resolve(),
          });
      }),
      new Promise<void>((resolve) => {
        this.storeScope
          .fetchAcrossStores(
            storeIds,
            (storeId) =>
              this.reportProvider
                .apiReportOverdueSummaryPost({
                  reportStoreRequest: { storeId } as never,
                })
                .pipe(
                  map((r) => {
                    if (!r.status || !r.data) return [] as OverdueSummaryItem[];
                    const d = r.data as { riskDetail?: OverdueSummaryItem[] };
                    return Array.isArray(d.riskDetail) ? d.riskDetail : [];
                  }),
                ),
            (results) => this.aggregateOverdue(results),
          )
          .subscribe({
            next: (items) => {
              this.overdueItems.set(items);
              resolve();
            },
            error: () => resolve(),
          });
      }),
      new Promise<void>((resolve) => {
        this.storeScope
          .fetchAcrossStores(
            storeIds,
            (storeId) =>
              this.reportProvider
                .apiReportIncomeBreakdownPost({
                  reportDateRangeRequest: { fromDate, toDate, storeId } as never,
                })
                .pipe(
                  map((r) =>
                    r.status && r.data
                      ? Array.isArray(r.data)
                        ? (r.data as IncomeBreakdownItem[])
                        : []
                      : [],
                  ),
                ),
            (results) => this.aggregateIncomeBreakdown(results),
          )
          .subscribe({
            next: (items) => {
              this.incomeBreakdown.set(items);
              resolve();
            },
            error: () => resolve(),
          });
      }),
      new Promise<void>((resolve) => {
        this.storeScope
          .fetchAcrossStores(
            storeIds,
            (storeId) =>
              this.reportProvider
                .apiReportLoanPortfolioSummaryPost({
                  reportStoreRequest: { storeId } as never,
                })
                .pipe(map((r) => (r.status && r.data ? (r.data as PortfolioSummary) : null))),
            (results) =>
              this.aggregatePortfolio(results.filter((item): item is PortfolioSummary => !!item)),
          )
          .subscribe({
            next: (summary) => {
              this.portfolioSummary.set(summary);
              resolve();
            },
            error: () => resolve(),
          });
      }),
    ]).finally(() => {
      this.loading.set(false);
      this.loadMonthlyCashFlow();
    });
  }

  loadMonthlyCashFlow(): void {
    const storeIds = this.storeScope.resolveStoreIds(this.selectedStoreId());
    this.storeScope
      .fetchAcrossStores(
        storeIds,
        (storeId) =>
          this.reportProvider
            .apiReportMonthlyCashFlowPost({
              monthlyCashFlowRequest: { storeId, year: this.selectedYear() },
            })
            .pipe(map((r) => (r.status && r.data ? (r.data as MonthlyCashFlow) : null))),
        (results) =>
          this.aggregateMonthlyCashFlow(results.filter((item): item is MonthlyCashFlow => !!item)),
      )
      .subscribe({
        next: (r) => this.monthlyCashFlow.set(r),
        error: () => {},
      });
  }

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'HDF CrediFlow';
      workbook.created = new Date();

      // --- Color palette ---
      const COLORS = {
        primary: '1B5E20',
        primaryLight: 'E8F5E9',
        headerBg: '2E7D32',
        headerFont: 'FFFFFF',
        accent: 'FF6F00',
        accentLight: 'FFF8E1',
        danger: 'C62828',
        dangerLight: 'FFEBEE',
        info: '1565C0',
        infoLight: 'E3F2FD',
        titleBg: '1B5E20',
        titleFont: 'FFFFFF',
        border: 'BDBDBD',
        altRow: 'F5F5F5',
      };

      const r = this.dateRangeControl.value ?? new TuiDayRange(this.firstOfMonth, this.today);
      const fromStr = `${String(r.from.day).padStart(2, '0')}/${String(r.from.month + 1).padStart(2, '0')}/${r.from.year}`;
      const toStr = `${String(r.to.day).padStart(2, '0')}/${String(r.to.month + 1).padStart(2, '0')}/${r.to.year}`;
      const storeName = this.selectedStoreId()
        ? this.stores().find(s => s.storeId === this.selectedStoreId())?.storeName ?? 'Chi nhánh'
        : 'Tất cả chi nhánh';

      // Helper: style a header row
      const styleHeaderRow = (row: ExcelJS.Row, bgColor: string, fontColor: string) => {
        row.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: fontColor }, size: 11, name: 'Arial' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: COLORS.border } },
            bottom: { style: 'thin', color: { argb: COLORS.border } },
            left: { style: 'thin', color: { argb: COLORS.border } },
            right: { style: 'thin', color: { argb: COLORS.border } },
          };
        });
        row.height = 28;
      };

      const styleDataCell = (cell: ExcelJS.Cell, rowIndex: number) => {
        cell.font = { size: 11, name: 'Arial' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'E0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'E0E0E0' } },
          left: { style: 'thin', color: { argb: 'E0E0E0' } },
          right: { style: 'thin', color: { argb: 'E0E0E0' } },
        };
        cell.alignment = { vertical: 'middle' };
        if (rowIndex % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.altRow } };
        }
      };

      const addTitle = (ws: ExcelJS.Worksheet, title: string, colCount: number, startRow: number) => {
        ws.mergeCells(startRow, 1, startRow, colCount);
        const titleCell = ws.getCell(startRow, 1);
        titleCell.value = title;
        titleCell.font = { bold: true, size: 14, color: { argb: COLORS.titleFont }, name: 'Arial' };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(startRow).height = 36;

        // Subtitle with filter info
        ws.mergeCells(startRow + 1, 1, startRow + 1, colCount);
        const subCell = ws.getCell(startRow + 1, 1);
        subCell.value = `${storeName}  •  Từ ${fromStr} đến ${toStr}`;
        subCell.font = { italic: true, size: 10, color: { argb: '757575' }, name: 'Arial' };
        subCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(startRow + 1).height = 22;
      };

      const currFmt = '#,##0" ₫"';

      // ═══════════════════════════════════════════════
      // SHEET 1: Tổng quan KPI
      // ═══════════════════════════════════════════════
      const ws1 = workbook.addWorksheet('Tổng Quan', { properties: { tabColor: { argb: COLORS.primary } } });
      ws1.columns = [
        { width: 30 },
        { width: 25 },
        { width: 25 },
        { width: 25 },
      ];
      addTitle(ws1, 'BÁO CÁO CHI NHÁNH - TỔNG QUAN', 4, 1);

      const kpiData = [
        ['Tổng thu', this.totalReceipt()],
        ['Tổng chi', this.totalPayment()],
        ['Chênh lệch', this.totalReceipt() - this.totalPayment()],
        ['Số khoản quá hạn', this.overdueItems().length],
      ];

      // KPI header
      const kpiHeaderRow = ws1.getRow(4);
      kpiHeaderRow.values = ['Chỉ số', 'Giá trị'];
      styleHeaderRow(kpiHeaderRow, COLORS.headerBg, COLORS.headerFont);

      kpiData.forEach((item, i) => {
        const row = ws1.getRow(5 + i);
        row.values = [item[0], item[1]];
        row.getCell(1).font = { bold: true, size: 11, name: 'Arial' };
        row.getCell(2).numFmt = typeof item[1] === 'number' && i < 3 ? currFmt : '0';
        styleDataCell(row.getCell(1), i);
        styleDataCell(row.getCell(2), i);
        if (i === 2) {
          const val = item[1] as number;
          row.getCell(2).font = {
            bold: true,
            size: 11,
            name: 'Arial',
            color: { argb: val >= 0 ? COLORS.primary : COLORS.danger },
          };
        }
      });

      // Portfolio Summary in same sheet
      const ps = this.portfolioSummary();
      if (ps) {
        const psStart = 11;
        ws1.mergeCells(psStart, 1, psStart, 4);
        const psTitleCell = ws1.getCell(psStart, 1);
        psTitleCell.value = 'TỔNG QUAN DANH MỤC';
        psTitleCell.font = { bold: true, size: 12, color: { argb: COLORS.info }, name: 'Arial' };
        psTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.infoLight } };
        psTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws1.getRow(psStart).height = 30;

        const psHeaderRow = ws1.getRow(psStart + 1);
        psHeaderRow.values = ['Chỉ số', 'Giá trị', 'Chỉ số', 'Giá trị'];
        styleHeaderRow(psHeaderRow, COLORS.info, COLORS.headerFont);

        const psData: [string, number | undefined, string, number | undefined][] = [
          ['Đang thu', ps.disbursedCount, 'Nợ xấu', ps.badDebtCount],
          ['HĐ quá hạn', ps.overDueContractCount, 'Đã tất toán', ps.settledCount],
          ['Tổng dư nợ', ps.totalActivePortfolio, 'Còn phải thu gốc', ps.totalRemainingPrincipal],
          ['Gốc đã thu', ps.totalPrincipalCollected, 'Lãi đã thu', ps.totalInterestCollected],
          ['Phí đã thu', ps.totalFeeCollected, 'Phạt đã thu', ps.totalPenaltyCollected],
          ['Tổng thu nhập', ps.totalIncomeCollected, '', undefined],
        ];

        psData.forEach((item, i) => {
          const row = ws1.getRow(psStart + 2 + i);
          row.values = [item[0], item[1] ?? 0, item[2], item[3] ?? 0];
          [1, 2, 3, 4].forEach(c => {
            styleDataCell(row.getCell(c), i);
            if (c === 1 || c === 3) row.getCell(c).font = { bold: true, size: 11, name: 'Arial' };
            if (c === 2 || c === 4) {
              // Use currency for large values, integer for counts
              const val = row.getCell(c).value as number;
              row.getCell(c).numFmt = val > 999 ? currFmt : '0';
            }
          });
        });
      }

      // ═══════════════════════════════════════════════
      // SHEET 2: Thu Chi Theo Ngày
      // ═══════════════════════════════════════════════
      const ws2 = workbook.addWorksheet('Thu Chi Theo Ngày', { properties: { tabColor: { argb: COLORS.primary } } });
      ws2.columns = [
        { width: 18 },
        { width: 22 },
        { width: 22 },
        { width: 22 },
        { width: 14 },
      ];
      addTitle(ws2, 'THU CHI THEO NGÀY', 5, 1);

      const dailyHeaderRow = ws2.getRow(4);
      dailyHeaderRow.values = ['Ngày', 'Tổng thu', 'Tổng chi', 'Chênh lệch', 'Số phiếu'];
      styleHeaderRow(dailyHeaderRow, COLORS.headerBg, COLORS.headerFont);

      this.dailyCollections().forEach((row, i) => {
        const r = ws2.getRow(5 + i);
        r.values = [
          this.formatDate(row.businessDate),
          row.totalReceipt ?? 0,
          row.totalPayment ?? 0,
          row.netAmount ?? 0,
          row.receiptCount ?? 0,
        ];
        r.eachCell((cell, colNum) => {
          styleDataCell(cell, i);
          if (colNum >= 2 && colNum <= 4) cell.numFmt = currFmt;
          if (colNum === 2) cell.font = { ...cell.font, color: { argb: COLORS.primary } };
          if (colNum === 3) cell.font = { ...cell.font, color: { argb: COLORS.danger } };
          if (colNum === 4) {
            const val = (row.netAmount ?? 0);
            cell.font = { bold: true, size: 11, name: 'Arial', color: { argb: val >= 0 ? COLORS.primary : COLORS.danger } };
          }
        });
      });

      // Total row
      if (this.dailyCollections().length > 0) {
        const totalRowNum = 5 + this.dailyCollections().length;
        const totalRow = ws2.getRow(totalRowNum);
        totalRow.values = ['TỔNG CỘNG', this.totalReceipt(), this.totalPayment(), this.totalReceipt() - this.totalPayment(), ''];
        totalRow.eachCell((cell, colNum) => {
          cell.font = { bold: true, size: 11, name: 'Arial', color: { argb: COLORS.headerFont } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
          cell.border = {
            top: { style: 'medium', color: { argb: COLORS.primary } },
            bottom: { style: 'medium', color: { argb: COLORS.primary } },
            left: { style: 'thin', color: { argb: COLORS.border } },
            right: { style: 'thin', color: { argb: COLORS.border } },
          };
          if (colNum >= 2 && colNum <= 4) cell.numFmt = currFmt;
        });
        totalRow.height = 28;
      }

      // ═══════════════════════════════════════════════
      // SHEET 3: Phân Tích & Quá Hạn
      // ═══════════════════════════════════════════════
      const ws3 = workbook.addWorksheet('Phân Tích & Quá Hạn', { properties: { tabColor: { argb: COLORS.accent } } });
      ws3.columns = [
        { width: 30 },
        { width: 22 },
        { width: 14 },
        { width: 20 },
        { width: 20 },
        { width: 18 },
      ];

      // Income Breakdown
      addTitle(ws3, 'PHÂN TÍCH THU NHẬP', 6, 1);

      const incHeaderRow = ws3.getRow(4);
      incHeaderRow.values = ['Danh mục', 'Số tiền', 'Số giao dịch'];
      styleHeaderRow(incHeaderRow, COLORS.accent, COLORS.headerFont);

      this.incomeBreakdown().forEach((item, i) => {
        const row = ws3.getRow(5 + i);
        row.values = [this.getCategoryName(item.category), item.amount ?? 0, item.count ?? 0];
        row.eachCell((cell, colNum) => {
          styleDataCell(cell, i);
          if (colNum === 2) cell.numFmt = currFmt;
        });
      });

      // Overdue section
      const overdueStart = 5 + this.incomeBreakdown().length + 2;
      ws3.mergeCells(overdueStart, 1, overdueStart, 6);
      const overdueTitleCell = ws3.getCell(overdueStart, 1);
      overdueTitleCell.value = `KHOẢN QUÁ HẠN (${this.overdueItems().length} hồ sơ)`;
      overdueTitleCell.font = { bold: true, size: 12, color: { argb: COLORS.headerFont }, name: 'Arial' };
      overdueTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.danger } };
      overdueTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws3.getRow(overdueStart).height = 30;

      const overdueHeaderRow = ws3.getRow(overdueStart + 1);
      overdueHeaderRow.values = ['Khách hàng', 'CCCD/CMND', 'Hợp đồng', 'Số ngày quá hạn', 'Số tiền quá hạn', 'Phạt'];
      styleHeaderRow(overdueHeaderRow, COLORS.danger, COLORS.headerFont);

      this.overdueItems().forEach((item, i) => {
        const row = ws3.getRow(overdueStart + 2 + i);
        row.values = [
          item.customerName ?? '',
          item.customerNationalId ?? '',
          item.contractCode ?? '',
          item.overdueDays ?? 0,
          item.overdueAmount ?? 0,
          item.latePenaltyAmount ?? 0,
        ];
        row.eachCell((cell, colNum) => {
          styleDataCell(cell, i);
          if (colNum >= 5) cell.numFmt = currFmt;
          if (colNum === 4) {
            const days = item.overdueDays ?? 0;
            cell.font = {
              bold: true,
              size: 11,
              name: 'Arial',
              color: { argb: days >= 11 ? COLORS.danger : COLORS.accent },
            };
          }
        });
        // Highlight bad debt rows
        if ((item.overdueDays ?? 0) >= 11) {
          row.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.dangerLight } };
          });
        }
      });

      // ═══════════════════════════════════════════════
      // SHEET 4: Dòng Tiền Theo Tháng
      // ═══════════════════════════════════════════════
      const mcf = this.monthlyCashFlow();
      if (mcf) {
        const ws4 = workbook.addWorksheet('Dòng Tiền Tháng', { properties: { tabColor: { argb: COLORS.info } } });
        ws4.columns = [
          { width: 12 },
          { width: 20 },
          { width: 12 },
          { width: 20 },
          { width: 18 },
          { width: 18 },
          { width: 18 },
          { width: 20 },
        ];

        addTitle(ws4, `DÒNG TIỀN THEO THÁNG - NĂM ${this.selectedYear()}`, 8, 1);

        // Year totals
        const yrRow = ws4.getRow(4);
        yrRow.values = ['', 'Tổng giải ngân', '', 'Tổng đã thu về', '', 'Thu nhập (lãi+phí)', '', ''];
        styleHeaderRow(yrRow, COLORS.infoLight, COLORS.info);

        const yrValRow = ws4.getRow(5);
        yrValRow.values = ['', mcf.totalDisbursed ?? 0, '', mcf.totalCollected ?? 0, '', mcf.totalNetIncome ?? 0, '', ''];
        [2, 4, 6].forEach(c => {
          yrValRow.getCell(c).numFmt = currFmt;
          yrValRow.getCell(c).font = { bold: true, size: 12, name: 'Arial', color: { argb: COLORS.info } };
          yrValRow.getCell(c).alignment = { horizontal: 'center' };
        });
        yrValRow.height = 28;

        // Monthly table
        const mHeaderRow = ws4.getRow(7);
        mHeaderRow.values = ['Tháng', 'Giải ngân', 'HĐ mới', 'Đã thu về', 'Lãi thu', 'Phí thu', 'Phạt', 'Thu nhập'];
        styleHeaderRow(mHeaderRow, COLORS.headerBg, COLORS.headerFont);

        (mcf.months ?? []).forEach((m, i) => {
          const row = ws4.getRow(8 + i);
          const fees = (m.periodicFee ?? 0) + (m.fileFee ?? 0) + (m.insurance ?? 0);
          const penalties = (m.latePenalty ?? 0) + (m.earlyPenalty ?? 0);
          row.values = [
            `Tháng ${m.month}`,
            m.disbursed ?? 0,
            m.newLoanCount ?? 0,
            m.totalCollected ?? 0,
            m.interest ?? 0,
            fees,
            penalties,
            m.netIncome ?? 0,
          ];
          row.eachCell((cell, colNum) => {
            styleDataCell(cell, i);
            if (colNum >= 2 && colNum !== 3) cell.numFmt = currFmt;
            if (colNum === 8 && (m.netIncome ?? 0) > 0) {
              cell.font = { bold: true, size: 11, name: 'Arial', color: { argb: COLORS.primary } };
            }
          });
        });
      }

      // ═══════════════════════════════════════════════
      // Save file
      // ═══════════════════════════════════════════════
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const fileName = `BaoCaoChiNhanh_${storeName.replace(/\s+/g, '_')}_${fromStr.replace(/\//g, '')}_${toStr.replace(/\//g, '')}.xlsx`;
      saveAs(blob, fileName);
    } catch (err) {
      console.error('Export Excel error:', err);
    } finally {
      this.exporting.set(false);
    }
  }
}
