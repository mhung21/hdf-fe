import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { ReportProvider } from '../api/api/report.service';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly reportApi = inject(ReportProvider);

  getPortfolioSummary(storeId?: string | null): Observable<any> {
    return this.reportApi.apiReportLoanPortfolioSummaryPost({
      reportStoreRequest: { storeId: storeId ?? null }
    }).pipe(map(r => r.data), catchError(() => of(null)));
  }

  getMonthlyCashFlow(year: number, storeId?: string | null): Observable<any> {
    return this.reportApi.apiReportMonthlyCashFlowPost({
      monthlyCashFlowRequest: { year, storeId: storeId ?? null }
    }).pipe(map(r => r.data), catchError(() => of(null)));
  }

  getOverdueSummary(storeId?: string | null): Observable<any> {
    return this.reportApi.apiReportOverdueSummaryPost({
      reportStoreRequest: { storeId: storeId ?? null }
    }).pipe(map(r => r.data), catchError(() => of(null)));
  }

  getBadDebtSummary(year: number, month: number, storeId?: string | null): Observable<any[]> {
    return this.reportApi.apiReportBadDebtSummaryPost({
      badDebtSummaryRequest: { year, month, storeId: storeId ?? null }
    }).pipe(map(r => (r.data as any[]) ?? []), catchError(() => of([])));
  }

  getOutstandingLoans(storeId?: string | null): Observable<any[]> {
    return this.reportApi.apiReportOutstandingLoansPost({
      reportStoreRequest: { storeId: storeId ?? null }
    }).pipe(map(r => (r.data as any[]) ?? []), catchError(() => of([])));
  }

  getTodayCollection(date: string, storeId?: string | null): Observable<any[]> {
    return this.reportApi.apiReportDailyCollectionPost({
      reportDateRangeRequest: { fromDate: date, toDate: date, storeId: storeId ?? null }
    }).pipe(map(r => (r.data as any[]) ?? []), catchError(() => of([])));
  }

  getIncomeBreakdown(fromDate: string, toDate: string, storeId?: string | null): Observable<any> {
    return this.reportApi.apiReportIncomeBreakdownPost({
      reportDateRangeRequest: { fromDate, toDate, storeId: storeId ?? null }
    }).pipe(map(r => r.data), catchError(() => of(null)));
  }

  formatCurrency(amount: number): string {
    if (!amount && amount !== 0) return '—';
    if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)} tỷ`;
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(0)} tr`;
    return `${amount.toLocaleString('vi-VN')} đ`;
  }

  getRiskLabel(level: string): string {
    switch (level) {
      case 'WARNING': return 'Cảnh Báo';
      case 'LATE': return 'Trễ Hạn';
      case 'POTENTIAL_BAD_DEBT': return 'Nợ Xấu';
      default: return level ?? '';
    }
  }
}
