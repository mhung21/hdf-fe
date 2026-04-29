import { Injectable } from '@angular/core';

export interface LoanPrintCustomer {
  fullName: string;
  nationalId?: string | null;
  phone?: string | null;
}

export interface LoanPrintScheduleRow {
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

export interface LoanPrintParams {
  customer: LoanPrintCustomer | null;
  contractType: 'INSTALLMENT' | 'PAWN';
  principalAmount: number | null | undefined;
  termMonths: number | null | undefined;
  interestRateMonthly: number | null | undefined;
  qlkvRateMonthly: number | null | undefined;
  qltsRateMonthly: number | null | undefined;
  fixedMonthlyFeeAmount: number | null | undefined;
  pawnInterestAmountPerMillionPerDay?: number | null | undefined;
  pawnFeeAmountPerMillionPerDay?: number | null | undefined;
  pawnPeriodDays?: number | null | undefined;
  fileFeeAmount: number | null | undefined;
  insuranceAmount: number | null | undefined;
  monthlyPayment?: number;
  totalInterest?: number;
  totalPeriodicFee?: number;
  totalPayment?: number;
  schedule: LoanPrintScheduleRow[];
}

@Injectable({ providedIn: 'root' })
export class LoanPrintService {
  private formatCurrency(val?: number | null): string {
    if (val == null) return '-';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  }

  private formatDate(iso?: string | null): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat('vi-VN').format(d);
  }

  print(p: LoanPrintParams): void {
    if (!p.schedule.length) return;

    // Bảo hiểm đã cộng vào gốc vay — chỉ còn phí hồ sơ thu trước giải ngân
    const upfront = p.fileFeeAmount ?? 0;
    const lastRow = p.schedule[p.schedule.length - 1];

    if (p.contractType === 'PAWN') {
      const pawnRows = p.schedule
        .map(
          (r) => `<tr>
            <td>${r.periodNo}</td>
            <td>${r.dayCount ?? '-'}</td>
            <td>${this.formatDate(r.dueDate)}</td>
            <td>${this.formatCurrency(r.interestAmount)}</td>
            <td>${this.formatCurrency(r.qltsAmount)}</td>
            <td><strong>${this.formatCurrency(r.installmentAmount ?? r.totalPayment)}</strong></td>
          </tr>`,
        )
        .join('');

      const pawnHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Bảng minh họa cầm đồ</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; padding: 28px 32px; color: #111; }
    h2 { margin: 0 0 6px; font-size: 18px; }
    .sub { color: #666; font-size: 12px; margin-bottom: 6px; }
    .meta { color: #444; margin-bottom: 18px; font-size: 12px; line-height: 1.8; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 14px 0; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 22px; }
    .box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; }
    .box .label { font-size: 11px; color: #888; margin-bottom: 4px; }
    .box .value { font-size: 15px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead th { background: #f3f4f6; padding: 7px 10px; text-align: right; border-bottom: 2px solid #d1d5db; font-weight: 600; }
    thead th:first-child { text-align: center; }
    tbody td { padding: 5px 10px; text-align: right; border-bottom: 1px solid #f3f4f6; }
    tbody td:first-child { text-align: center; font-weight: 600; }
    tbody tr:nth-child(even) { background: #fafafa; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  <h2>Bảng minh họa cầm đồ</h2>
  <div class="sub">Công ty TNHH HD Finance — Tài liệu tham khảo, không có giá trị pháp lý</div>
  <hr />
  <div class="meta">
    ${
      p.customer
        ? `Khách hàng: <strong>${p.customer.fullName}</strong>
         &nbsp;|&nbsp; CCCD: ${p.customer.nationalId ?? '-'}
         &nbsp;|&nbsp; SĐT: ${p.customer.phone ?? '-'}`
        : ''
    }
    <br/>
    Tổng gốc: <strong>${this.formatCurrency(p.principalAmount)}</strong>
    &nbsp;|&nbsp; ${p.termMonths} kỳ
    &nbsp;|&nbsp; Lãi ${this.formatCurrency(p.pawnInterestAmountPerMillionPerDay ?? 0)}/1tr/ngày
    &nbsp;|&nbsp; Phí QLTS ${this.formatCurrency(p.pawnFeeAmountPerMillionPerDay ?? 0)}/1tr/ngày
    &nbsp;|&nbsp; ${p.pawnPeriodDays ?? 10} ngày/kỳ
  </div>

  <div class="summary">
    <div class="box">
      <div class="label">Ngày đáo hạn</div>
      <div class="value">${this.formatDate(lastRow?.dueDate)}</div>
    </div>
    <div class="box">
      <div class="label">Trả mỗi kỳ</div>
      <div class="value">${this.formatCurrency(p.monthlyPayment)}</div>
    </div>
    <div class="box">
      <div class="label">Tổng lãi</div>
      <div class="value">${this.formatCurrency(p.totalInterest)}</div>
    </div>
    <div class="box">
      <div class="label">Tổng phí QLTS</div>
      <div class="value">${this.formatCurrency(p.totalPeriodicFee)}</div>
    </div>
    <div class="box">
      <div class="label">Tổng thanh toán</div>
      <div class="value">${this.formatCurrency(p.totalPayment)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align:center">TT</th>
        <th>Số ngày</th>
        <th>Ngày đóng tiền</th>
        <th>Lãi</th>
        <th>Phí QLTS</th>
        <th>Tổng TT hàng kỳ</th>
      </tr>
    </thead>
    <tbody>${pawnRows}</tbody>
  </table>

  <script>window.onload = () => window.print();<\/script>
</body>
</html>`;

      const w = window.open('', '_blank');
      w?.document.write(pawnHtml);
      w?.document.close();
      return;
    }

    const rows = p.schedule
      .map(
        (r) => `<tr>
          <td>${r.periodNo}</td>
          <td>${r.dayCount ?? '-'}</td>
          <td>${this.formatDate(r.dueDate)}</td>
          <td><strong>${this.formatCurrency(r.installmentAmount ?? r.totalPayment)}</strong></td>
          <td>${this.formatCurrency(r.principalAmount)}</td>
          <td>${this.formatCurrency(r.interestAmount)}</td>
          <td>${this.formatCurrency((r.principalAmount ?? 0) + (r.interestAmount ?? 0))}</td>
          <td>${this.formatCurrency(r.qlkvAmount)}</td>
          <td>${this.formatCurrency(r.fixedMonthlyFeeAmount)}</td>
          <td>${this.formatCurrency(r.qltsAmount)}</td>
          <td>${this.formatCurrency((r.qlkvAmount ?? 0) + (r.qltsAmount ?? 0))}</td>
          <td>${this.formatCurrency(r.remainingPrincipal)}</td>
        </tr>`,
      )
      .join('');

    const custMeta = p.customer
      ? `Khách hàng: <strong>${p.customer.fullName}</strong>
         &nbsp;|&nbsp; CCCD: ${p.customer.nationalId ?? '-'}
         &nbsp;|&nbsp; SĐT: ${p.customer.phone ?? '-'}`
      : '';

    const totalPeriodicRate = (p.qlkvRateMonthly ?? 0) + (p.qltsRateMonthly ?? 0);
    const feeMeta =
      totalPeriodicRate > 0
        ? `&nbsp;|&nbsp; QLKV ${p.qlkvRateMonthly ?? 0}% + QLTS ${p.qltsRateMonthly ?? 0}%/tháng`
        : '';

    const fixedFeeMeta = `&nbsp;|&nbsp; Phí cố định/tháng ${this.formatCurrency(p.fixedMonthlyFeeAmount ?? 0)}`;

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Bảng minh họa lãi suất</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; padding: 28px 32px; color: #111; }
    h2 { margin: 0 0 6px; font-size: 18px; }
    .sub { color: #666; font-size: 12px; margin-bottom: 6px; }
    .meta { color: #444; margin-bottom: 18px; font-size: 12px; line-height: 1.8; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 14px 0; }

    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 22px; }
    .box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; }
    .box .label { font-size: 11px; color: #888; margin-bottom: 4px; }
    .box .value { font-size: 15px; font-weight: 700; }
    .box.upfront { background: #fef3c7; border-color: #fbbf24; }
    .box.upfront .label { color: #92400e; }
    .box.upfront .sub-detail { font-size: 11px; color: #92400e; margin-top: 5px; }

    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead th { background: #f3f4f6; padding: 7px 10px; text-align: right; border-bottom: 2px solid #d1d5db; font-weight: 600; }
    thead th:first-child { text-align: center; }
    tbody td { padding: 5px 10px; text-align: right; border-bottom: 1px solid #f3f4f6; }
    tbody td:first-child { text-align: center; font-weight: 600; }
    tbody tr:nth-child(even) { background: #fafafa; }

    @media print {
      body { padding: 10px; }
    }
  </style>
</head>
<body>
  <h2>Bảng minh họa lãi suất</h2>
  <div class="sub">Công ty TNHH HD Finance — Tài liệu tham khảo, không có giá trị pháp lý</div>
  <hr />
  <div class="meta">
    ${custMeta}
    <br/>
    Tổng gốc (gốc + BH): <strong>${this.formatCurrency(p.principalAmount)}</strong>
    &nbsp;|&nbsp; ${p.termMonths} tháng
    &nbsp;|&nbsp; Lãi ${p.interestRateMonthly}%/tháng
    ${feeMeta}
    ${fixedFeeMeta}
  </div>

  <div class="summary">
    <div class="box upfront">
      <div class="label">⚡ Thanh toán ngay (phí hồ sơ)</div>
      <div class="value">${this.formatCurrency(upfront)}</div>
      <div class="sub-detail">Phí hồ sơ: ${this.formatCurrency(p.fileFeeAmount ?? 0)}</div>
    </div>
    <div class="box">
      <div class="label">Trả hàng tháng (gốc + lãi + phí ĐK)</div>
      <div class="value">${this.formatCurrency(p.monthlyPayment)}</div>
    </div>
    <div class="box">
      <div class="label">Ngày đáo hạn</div>
      <div class="value">${this.formatDate(lastRow?.dueDate)}</div>
    </div>
    <div class="box">
      <div class="label">Tổng lãi định kỳ</div>
      <div class="value">${this.formatCurrency(p.totalInterest)}</div>
    </div>
    <div class="box">
      <div class="label">Tổng phí định kỳ (ĐK)</div>
      <div class="value">${this.formatCurrency(p.totalPeriodicFee)}</div>
    </div>
    <div class="box">
      <div class="label">Tổng thanh toán định kỳ</div>
      <div class="value">${this.formatCurrency(p.totalPayment)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align:center">TT</th>
        <th>Số ngày</th>
        <th>Ngày đóng tiền</th>
        <th>Tiền TT hàng kỳ</th>
        <th>Tiền gốc</th>
        <th>Tiền lãi</th>
        <th>Tổng cầm đồ</th>
        <th>Phí QLKV</th>
        <th>Phí cố định/tháng</th>
        <th>Phí QLTS</th>
        <th>Tổng cho thuê</th>
        <th>Nợ gốc còn lại</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <script>window.onload = () => window.print();<\/script>
</body>
</html>`;

    const w = window.open('', '_blank');
    w?.document.write(html);
    w?.document.close();
  }
}
