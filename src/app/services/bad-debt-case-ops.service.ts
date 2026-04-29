import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { BASE_PATH } from '../api/variables';
import { BadDebtCaseProvider } from '../api/api/bad-debt-case.service';
import { RecordBadDebtRecoveryModel } from '../api/model/record-bad-debt-recovery-model';
import { ResultAPI } from '../api/model/result-api';

export interface BadDebtCaseSummary {
  badDebtCaseId: string;
  loanContractId?: string | null;
  contractCode?: string | null;
  contractNo?: string | null;
  customerName?: string | null;
  totalOutstandingAmount?: number | null;
  recoveredAmountTotal?: number | null;
  statusCode?: string | null;
  note?: string | null;
}

@Injectable({ providedIn: 'root' })
export class BadDebtCaseOpsService {
  private readonly http = inject(HttpClient);
  private readonly badDebtCaseProvider = inject(BadDebtCaseProvider);
  private readonly basePath = inject(BASE_PATH, { optional: true }) ?? 'http://localhost';

  recordRecovery(model: RecordBadDebtRecoveryModel): Observable<ResultAPI> {
    return this.http.post<ResultAPI>(`${this.basePath}/api/BadDebtCase/RecordRecovery`, model);
  }

  getByLoanContractId(loanContractId: string): Observable<BadDebtCaseSummary | null> {
    return this.badDebtCaseProvider.apiBadDebtCaseGetAllGet().pipe(
      map((r) => {
        if (!r.status || !r.data) return null;

        const items = Array.isArray(r.data) ? (r.data as BadDebtCaseSummary[]) : [];
        return items.find((item) => item.loanContractId === loanContractId) ?? null;
      }),
    );
  }
}
