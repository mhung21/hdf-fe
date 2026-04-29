import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BASE_PATH } from '../api/variables';

export interface LoanCollateral {
  collateralId: string;
  loanContractId: string;
  collateralType: string;
  description: string;
  /** Số IMEI (điện thoại), biển số (xe cộ), số sổ tiết kiệm... */
  serialNumber?: string | null;
  estimatedValue?: number | null;
  detail?: string | null;
  note?: string | null;
  createdAt?: string | null;
}

export const COLLATERAL_TYPE_LABELS: Record<string, string> = {
  PHONE:    'Điện thoại / Tablet',
  PROPERTY: 'Bất động sản',
  VEHICLE:  'Xe cộ',
  SAVINGS:  'Sổ tiết kiệm',
  OTHER:    'Khác',
};

export const COLLATERAL_TYPES = Object.keys(COLLATERAL_TYPE_LABELS);

/** Nhãn trường mã định danh tuỳ theo loại tài sản */
export const COLLATERAL_SERIAL_LABEL: Record<string, string> = {
  PHONE:    'Số IMEI / Serial',
  VEHICLE:  'Biển số / Số khung xe',
  PROPERTY: 'Số thửa / Mã sổ đỏ',
  SAVINGS:  'Số sổ tiết kiệm',
  OTHER:    'Mã định danh (nếu có)',
};

/** Placeholder gợi ý cho trường mã định danh */
export const COLLATERAL_SERIAL_PLACEHOLDER: Record<string, string> = {
  PHONE:    'VD: 352999110123456',
  VEHICLE:  'VD: 51G-123.45 / VNAA123456789',
  PROPERTY: 'VD: Thửa 123, Tờ bản đồ 05',
  SAVINGS:  'VD: 12345678901',
  OTHER:    'VD: ABC-12345',
};

@Injectable({ providedIn: 'root' })
export class LoanCollateralService {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH, { optional: true }) ?? 'http://localhost';

  getByLoanContract(loanContractId: string): Observable<any> {
    return this.http.post<any>(`${this.basePath}/api/LoanCollateral/GetByLoanContract`, JSON.stringify(loanContractId), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  save(model: {
    collateralId?: string | null;
    loanContractId: string;
    collateralType: string;
    description: string;
    serialNumber?: string | null;
    estimatedValue?: number | null;
    detail?: string | null;
    note?: string | null;
  }): Observable<any> {
    return this.http.post<any>(`${this.basePath}/api/LoanCollateral/Save`, model);
  }

  delete(collateralId: string): Observable<any> {
    return this.http.post<any>(`${this.basePath}/api/LoanCollateral/Delete`, JSON.stringify(collateralId), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
