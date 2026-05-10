import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TuiButton, TuiDataList, TuiIcon, TuiTextfield, TuiOption } from '@taiga-ui/core';
import { TuiInputDateRange, TuiPagination, TuiSelect, TuiChevron, TuiDayRangePeriod } from '@taiga-ui/kit';
import { TuiDay, TuiDayRange, TuiStringHandler, TuiStringMatcher } from '@taiga-ui/cdk';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

import { ReportProvider } from '../../api/api/report.service';
import { StoreProvider } from '../../api/api/store.service';
import { AuthService } from '../../services/auth.service';
import { RoleCode } from '../../models/role.model';

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
    TuiDataList,
    TuiIcon,
    TuiTextfield,
    TuiSelect,
    TuiChevron,
    TuiOption,
    TuiInputDateRange,
    TuiPagination
  ],
  templateUrl: './reports-all.component.html',
})
export class ReportsAllComponent implements OnInit {
  private readonly reportProvider = inject(ReportProvider);
  private readonly storeProvider = inject(StoreProvider);
  private readonly authService = inject(AuthService);

  loading = signal(false);
  exporting = signal(false);

  stores = signal<StoreItem[]>([]);
  outstandingLoans = signal<OutstandingLoanItem[]>([]);
  badDebtSummary = signal<BadDebtSummaryItem[]>([]);

  pageIndex = signal(0);
  pageSize = signal(20);
  totalCount = signal(0);
  totalOutstandingPrincipal = signal(0);
  totalRemainingPrincipal = signal(0);

  Math = Math;

  readonly today = TuiDay.currentLocal();
  readonly firstOfMonth = new TuiDay(this.today.year, this.today.month, 1);
  readonly dateRangeControl = new FormControl<TuiDayRange | null>(
    new TuiDayRange(this.firstOfMonth, this.today)
  );

  readonly periods = [
    new TuiDayRangePeriod(new TuiDayRange(this.today, this.today), 'Hôm nay'),
    new TuiDayRangePeriod(new TuiDayRange(this.today.append({ day: -1 }), this.today.append({ day: -1 })), 'Hôm qua'),
    new TuiDayRangePeriod(new TuiDayRange(this.today.append({ day: -6 }), this.today), '7 ngày gần nhất'),
    new TuiDayRangePeriod(new TuiDayRange(this.today.append({ day: -29 }), this.today), '30 ngày gần nhất'),
  ];

  readonly storeControl = new FormControl<string | null>(null);
  readonly keywordControl = new FormControl<string>('');

  isAdmin = computed(() => this.authService.hasRole(RoleCode.ADMIN));
  canExportExcel = computed(() => this.authService.hasPermission('REPORT_ALL_EXPORT') || this.isAdmin());

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
        next: r => { if (r.status && r.data) this.stores.set(Array.isArray(r.data) ? r.data as StoreItem[] : []); },
        error: () => {},
      });
    }

    this.dateRangeControl.valueChanges.subscribe(range => {
      if (range) {
        this.pageIndex.set(0);
        this.loadBadDebtSummary();
        this.loadOutstandingLoans();
      }
    });

    this.storeControl.valueChanges.subscribe(() => {
      this.pageIndex.set(0);
      this.loadOutstandingLoans();
    });

    this.keywordControl.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(() => {
      this.pageIndex.set(0);
      this.loadOutstandingLoans();
    });

    this.loadBadDebtSummary();
    this.loadOutstandingLoans();
  }

  onPageChange(index: number): void {
    this.pageIndex.set(index);
    this.loadOutstandingLoans();
  }

  loadBadDebtSummary(): void {
    const r = this.dateRangeControl.value ?? new TuiDayRange(this.firstOfMonth, this.today);
    this.reportProvider.apiReportBadDebtSummaryPost({
      badDebtSummaryRequest: { year: r.from.year, month: r.from.month + 1 } as never,
    }).subscribe({
      next: r2 => {
        if (r2.status && r2.data) {
          this.badDebtSummary.set(Array.isArray(r2.data) ? r2.data as BadDebtSummaryItem[] : []);
        }
      }
    });
  }

  loadOutstandingLoans(): void {
    this.loading.set(true);
    const r = this.dateRangeControl.value;
    const fromDate = r ? r.from.toJSON() : null;
    const toDate = r ? r.to.toJSON() : null;

    this.reportProvider.apiReportOutstandingLoansPagedPost({
      outstandingLoansPagedRequest: {
        storeId: this.storeControl.value ?? null,
        keyword: this.keywordControl.value ?? null,
        fromDate: fromDate,
        toDate: toDate,
        pageIndex: this.pageIndex() + 1,
        pageSize: this.pageSize()
      } as never
    }).subscribe({
      next: r => {
        if (r.status && r.data) {
          const d = r.data as any;
          this.outstandingLoans.set(Array.isArray(d.items) ? d.items as OutstandingLoanItem[] : []);
          this.totalCount.set(d.totalCount ?? 0);
          this.totalOutstandingPrincipal.set(d.totalOutstandingPrincipal ?? 0);
          this.totalRemainingPrincipal.set(d.totalRemainingPrincipal ?? 0);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      const r = this.dateRangeControl.value;
      const fromDate = r ? r.from.toJSON() : null;
      const toDate = r ? r.to.toJSON() : null;

      // Gọi API lấy toàn bộ dữ liệu khớp với filter hiện tại
      const response = await this.reportProvider.apiReportOutstandingLoansPagedPost({
        outstandingLoansPagedRequest: {
          storeId: this.storeControl.value ?? null,
          keyword: this.keywordControl.value ?? null,
          fromDate: fromDate,
          toDate: toDate,
          pageIndex: 1,
          pageSize: 99999 // Lấy tất cả
        } as never
      }).toPromise();

      let items: OutstandingLoanItem[] = [];
      let totalOut = 0;
      let totalRem = 0;
      if (response?.status && response?.data) {
        const d = response.data as any;
        items = Array.isArray(d.items) ? d.items : [];
        totalOut = d.totalOutstandingPrincipal ?? 0;
        totalRem = d.totalRemainingPrincipal ?? 0;
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'HDF CrediFlow';
      workbook.created = new Date();

      const COLORS = {
        primary: '1B5E20',
        headerBg: '2E7D32',
        headerFont: 'FFFFFF',
        titleBg: '1B5E20',
        titleFont: 'FFFFFF',
        border: 'BDBDBD',
        altRow: 'F5F5F5',
      };

      const storeName = this.storeControl.value
        ? this.stores().find(s => s.storeId === this.storeControl.value)?.storeName ?? 'Chi nhánh'
        : 'Toàn hệ thống';

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

        ws.mergeCells(startRow + 1, 1, startRow + 1, colCount);
        const subCell = ws.getCell(startRow + 1, 1);
        subCell.value = storeName;
        subCell.font = { italic: true, size: 10, color: { argb: '757575' }, name: 'Arial' };
        subCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(startRow + 1).height = 22;
      };

      const ws = workbook.addWorksheet('Hợp Đồng Đang Thu', { properties: { tabColor: { argb: COLORS.primary } } });
      ws.columns = [
        { width: 6 },
        { width: 25 },
        { width: 30 },
        { width: 25 },
        { width: 20 },
        { width: 20 },
        { width: 15 },
        { width: 15 },
      ];

      addTitle(ws, 'DANH SÁCH HỢP ĐỒNG ĐANG THU', 8, 1);

      const headerRow = ws.getRow(4);
      headerRow.values = [
        'STT', 'Chi nhánh', 'Khách hàng', 'Mã HĐ', 'Gốc cho vay', 'Còn phải thu', 'Ngày GN', 'Ngày ĐH'
      ];
      styleHeaderRow(headerRow, COLORS.headerBg, COLORS.headerFont);

      items.forEach((item, index) => {
        const row = ws.getRow(5 + index);
        row.values = [
          index + 1,
          item.storeName,
          item.customerName,
          item.contractCode,
          item.principalAmount ?? 0,
          item.remainingPrincipal ?? 0,
          item.disbursedDate ? new Date(item.disbursedDate) : null,
          item.maturityDate ? new Date(item.maturityDate) : null,
        ];

        for (let c = 1; c <= 8; c++) {
          styleDataCell(row.getCell(c), index);
        }
        row.getCell(5).numFmt = '#,##0" ₫"';
        row.getCell(6).numFmt = '#,##0" ₫"';
        row.getCell(7).numFmt = 'dd/mm/yyyy';
        row.getCell(8).numFmt = 'dd/mm/yyyy';
        
        row.getCell(3).font = { bold: true, size: 11, name: 'Arial' };
        row.getCell(6).font = { bold: true, color: { argb: 'D32F2F' }, size: 11, name: 'Arial' };
      });

      // Dòng tổng
      const totalRowIdx = 5 + items.length;
      const totalRow = ws.getRow(totalRowIdx);
      ws.mergeCells(totalRowIdx, 1, totalRowIdx, 4);
      totalRow.getCell(1).value = 'TỔNG CỘNG';
      totalRow.getCell(5).value = totalOut;
      totalRow.getCell(6).value = totalRem;
      totalRow.height = 25;

      for (let c = 1; c <= 8; c++) {
        const cell = totalRow.getCell(c);
        cell.font = { bold: true, size: 11, name: 'Arial' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9C4' } };
        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.border } },
          bottom: { style: 'thin', color: { argb: COLORS.border } },
          left: { style: 'thin', color: { argb: COLORS.border } },
          right: { style: 'thin', color: { argb: COLORS.border } },
        };
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'right' : 'left' };
        if (c === 5 || c === 6) cell.numFmt = '#,##0" ₫"';
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `HD_DangThu_${this.today.year}${String(this.today.month + 1).padStart(2, '0')}${String(this.today.day).padStart(2, '0')}.xlsx`);

    } catch (err) {
      console.error('Export failed', err);
    } finally {
      this.exporting.set(false);
    }
  }
}
