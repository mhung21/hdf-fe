import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { BASE_PATH } from '../api/variables';
import { ResultAPI } from '../api/model/result-api';

export interface ActivityLogItem {
  activityLogId: string;
  moduleCode: string;
  actionCode: string;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  oldData?: string | null;
  newData?: string | null;
  metadata?: string | null;
  customerId?: string | null;
  loanContractId?: string | null;
  storeId?: string | null;
  changedBy?: string | null;
  changedByName?: string | null;
  changedAtUtc: string;
  requestPath?: string | null;
}

export interface ActivityLogSearchRequest {
  keyword?: string | null;
  pageIndex: number;
  pageSize: number;
  sortBy?: string | null;
  sortDesc?: boolean;
  moduleCodes?: string[] | null;
  actionCodes?: string[] | null;
  changedBy?: string | null;
  customerId?: string | null;
  loanContractId?: string | null;
  fromUtc?: string | null;
  toUtc?: string | null;
}

export interface ActivityLogSearchResult {
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  items: ActivityLogItem[];
}

@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH, { optional: true }) ?? 'http://localhost';

  search(request: ActivityLogSearchRequest): Observable<ActivityLogSearchResult> {
    return this.http
      .post<ResultAPI>(`${this.basePath}/api/ActivityLog/Search`, request)
      .pipe(
        map((res) => {
          const data = (res?.data ?? {}) as Partial<ActivityLogSearchResult>;
          return {
            totalCount: data.totalCount ?? 0,
            pageIndex: data.pageIndex ?? request.pageIndex,
            pageSize: data.pageSize ?? request.pageSize,
            items: Array.isArray(data.items) ? data.items : [],
          };
        }),
      );
  }
}
