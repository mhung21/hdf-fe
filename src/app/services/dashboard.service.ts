import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError, timeout } from 'rxjs';
import { ReportProvider } from '../api/api/report.service';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly reportApi = inject(ReportProvider);
  private readonly requestTimeoutMs = 15000;

  private toDashboardError(scope: string, error: unknown): Error {
    const status =
      error && typeof error === 'object' && 'status' in error
        ? Number((error as { status?: number }).status)
        : undefined;
    const isTimeout =
      error &&
      typeof error === 'object' &&
      'name' in error &&
      (error as { name?: string }).name === 'TimeoutError';

    if (isTimeout || status === 408 || status === 504) {
      return new Error(`Yeu cau ${scope} bi timeout`);
    }

    if (status === 401 || status === 403) {
      return new Error(`Phien dang nhap het han khi tai ${scope}`);
    }

    if (status === 0) {
      return new Error(`Khong the ket noi may chu khi tai ${scope}`);
    }

    return new Error(`Khong the tai ${scope}`);
  }

  toDisplayError(error: unknown): string {
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: string }).message ?? '')
        : '';

    if (!message) {
      return 'Không thể tải dữ liệu dashboard. Vui lòng thử lại sau.';
    }

    if (message.includes('Phiên đăng nhập hết hạn')) {
      return 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
    }

    if (message.includes('timeout')) {
      return 'Yêu cầu tải dữ liệu bị timeout. Vui lòng thử lại.';
    }

    if (message.includes('Khong the ket noi may chu')) {
      return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng.';
    }

    return 'Không thể tải dữ liệu dashboard. Vui lòng thử lại sau.';
  }

  getPortfolioSummary(storeId?: string | null): Observable<any> {
    return this.reportApi.apiReportLoanPortfolioSummaryPost({
      reportStoreRequest: { storeId: storeId ?? null }
    }).pipe(
      timeout({ first: this.requestTimeoutMs }),
      map(r => r.data),
      catchError((error) => throwError(() => this.toDashboardError('tong quan du no', error)))
    );
  }

  getMonthlyCashFlow(year: number, storeId?: string | null): Observable<any> {
    return this.reportApi.apiReportMonthlyCashFlowPost({
      monthlyCashFlowRequest: { year, storeId: storeId ?? null }
    }).pipe(
      timeout({ first: this.requestTimeoutMs }),
      map(r => r.data),
      catchError((error) => throwError(() => this.toDashboardError('dong tien theo thang', error)))
    );
  }

  getOverdueSummary(storeId?: string | null): Observable<any> {
    return this.reportApi.apiReportOverdueSummaryPost({
      reportStoreRequest: { storeId: storeId ?? null }
    }).pipe(
      timeout({ first: this.requestTimeoutMs }),
      map(r => r.data),
      catchError((error) => throwError(() => this.toDashboardError('du lieu qua han', error)))
    );
  }

  getBadDebtSummary(year: number, month: number, storeId?: string | null): Observable<any[]> {
    return this.reportApi.apiReportBadDebtSummaryPost({
      badDebtSummaryRequest: { year, month, storeId: storeId ?? null }
    }).pipe(
      timeout({ first: this.requestTimeoutMs }),
      map(r => (r.data as any[]) ?? []),
      catchError((error) => throwError(() => this.toDashboardError('tong hop no xau', error)))
    );
  }

  getOutstandingLoans(storeId?: string | null): Observable<any[]> {
    return this.reportApi.apiReportOutstandingLoansPost({
      reportStoreRequest: { storeId: storeId ?? null }
    }).pipe(
      timeout({ first: this.requestTimeoutMs }),
      map(r => (r.data as any[]) ?? []),
      catchError((error) => throwError(() => this.toDashboardError('danh sach du no', error)))
    );
  }

  getTodayCollection(date: string, storeId?: string | null): Observable<any[]> {
    return this.reportApi.apiReportDailyCollectionPost({
      reportDateRangeRequest: { fromDate: date, toDate: date, storeId: storeId ?? null }
    }).pipe(
      timeout({ first: this.requestTimeoutMs }),
      map(r => (r.data as any[]) ?? []),
      catchError((error) => throwError(() => this.toDashboardError('thu chi hom nay', error)))
    );
  }

  getIncomeBreakdown(fromDate: string, toDate: string, storeId?: string | null): Observable<any> {
    return this.reportApi.apiReportIncomeBreakdownPost({
      reportDateRangeRequest: { fromDate, toDate, storeId: storeId ?? null }
    }).pipe(
      timeout({ first: this.requestTimeoutMs }),
      map(r => r.data),
      catchError((error) => throwError(() => this.toDashboardError('chi tiet thu nhap', error)))
    );
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
