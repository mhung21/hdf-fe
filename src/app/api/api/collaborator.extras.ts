/**
 * Companion file cho CollaboratorProvider (generated bởi pnpm ga).
 * Thêm shorthand methods + CollaboratorDto để component không dùng tên API dài.
 * File này KHÔNG bị overwrite khi chạy `pnpm ga`.
 */

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpContext } from '@angular/common/http';

import { CollaboratorProvider } from './collaborator.service';
import { CUCollaboratorModel } from '../model/cu-collaborator-model';
import { SearchCollaboratorRequest } from '../model/search-collaborator-request';
import { ResultAPI } from '../model/result-api';
import { environment } from '../../../environments/environment';

export type { CUCollaboratorModel };

export interface CollaboratorDto {
  collaboratorId: string;
  fullName: string;
  phone?: string | null;
  idNumber?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  note?: string | null;
  commissionRate?: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface CommissionReportRequest {
  fromDate?: string | null;   // ISO date yyyy-MM-dd
  toDate?: string | null;
  storeId?: string | null;
  pageIndex?: number;
  pageSize?: number;
}

export interface CommissionReportRow {
  collaboratorId: string;
  fullName: string;
  phone?: string | null;
  idNumber?: string | null;
  storeName?: string | null;
  commissionRate?: number | null;
  loanCount: number;
  totalPrincipal: number;
  commissionAmount: number;
}

@Injectable({ providedIn: 'root' })
export class CollaboratorService {
  private readonly provider = inject(CollaboratorProvider);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getAll(options?: { context?: HttpContext }): Observable<ResultAPI> {
    return this.provider.apiCollaboratorGetAllGet(undefined, undefined, options);
  }

  search(request: SearchCollaboratorRequest, options?: { context?: HttpContext }): Observable<ResultAPI> {
    return this.provider.apiCollaboratorSearchPost({ searchCollaboratorRequest: request }, undefined, undefined, options);
  }

  save(model: CUCollaboratorModel, options?: { context?: HttpContext }): Observable<ResultAPI> {
    return this.provider.apiCollaboratorSavePost({ cUCollaboratorModel: model }, undefined, undefined, options);
  }

  getById(id: string, options?: { context?: HttpContext }): Observable<ResultAPI> {
    return this.provider.apiCollaboratorGetByIdPost({ body: JSON.stringify(id) }, undefined, undefined, options);
  }

  commissionReport(request: CommissionReportRequest): Observable<ResultAPI> {
    return this.http.post<ResultAPI>(`${this.baseUrl}/api/Collaborator/CommissionReport`, request);
  }
}
