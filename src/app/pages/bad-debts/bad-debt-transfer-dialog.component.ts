import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  TuiAlertService,
  TuiButton,
  TuiDataList,
  TuiIcon,
  TuiLabel,
  TuiTextfield,
  type TuiDialogContext,
} from '@taiga-ui/core';
import { TuiChevron, TuiComboBox } from '@taiga-ui/kit';
import { TuiStringHandler, TuiStringMatcher } from '@taiga-ui/cdk';
import { injectContext } from '@taiga-ui/polymorpheus';
import { CommonModule } from '@angular/common';

import { BadDebtCaseProvider } from '../../api/api/bad-debt-case.service';
import { LoanContractProvider } from '../../api/api/loan-contract.service';
import type { TransferBadDebtRequest } from '../../api/model/transfer-bad-debt-request';

interface LoanOption {
  loanContractId: string;
  contractCode?: string | null;
  customerName?: string | null;
  statusCode?: string;
}

@Component({
  selector: 'app-bad-debt-transfer-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiButton,
    TuiIcon,
    TuiLabel,
    TuiTextfield,
    TuiChevron,
    TuiComboBox,
    TuiDataList,
  ],
  templateUrl: './bad-debt-transfer-dialog.component.html',
})
export class BadDebtTransferDialogComponent implements OnInit {
  readonly context = injectContext<TuiDialogContext<void, void>>();
  private readonly fb = inject(FormBuilder);
  private readonly badDebtProvider = inject(BadDebtCaseProvider);
  private readonly loanProvider = inject(LoanContractProvider);
  private readonly alerts = inject(TuiAlertService);

  readonly saving = signal(false);
  readonly loanContracts = signal<LoanOption[]>([]);

  form = this.fb.group({
    loanContractId: ['', Validators.required],
    note: [''],
  });

  readonly loanStringify: TuiStringHandler<string> = (id) => {
    const l = this.loanContracts().find((x) => x.loanContractId === id);
    return l ? `${l.contractCode ?? id} - ${l.customerName ?? ''}` : id;
  };
  readonly loanMatcher: TuiStringMatcher<string> = (id, q) => {
    const l = this.loanContracts().find((x) => x.loanContractId === id);
    if (!l) return false;
    return (
      (l.contractCode ?? '').toLowerCase().includes(q.toLowerCase()) ||
      (l.customerName ?? '').toLowerCase().includes(q.toLowerCase())
    );
  };

  ngOnInit(): void {
    this.loanProvider
      .apiLoanContractSearchPost({
        searchLoanContractRequest: {
          pageSize: 500,
          sortBy: 'ApplicationDate',
          sortDesc: true,
        },
      })
      .subscribe({
        next: (r) => {
          if (r.status && r.data) {
            const data = r.data as { items?: LoanOption[] };
            this.loanContracts.set(
              (data.items ?? []).filter((l) => l.statusCode === 'BAD_DEBT'),
            );
          }
        },
        error: () => {},
      });
  }

  confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const req: TransferBadDebtRequest = {
      loanContractId: v.loanContractId!,
      note: v.note ?? null,
    };
    this.saving.set(true);
    this.badDebtProvider
      .apiBadDebtCaseTransferFromLoanPost({ transferBadDebtRequest: req })
      .subscribe({
        next: (r) => {
          this.saving.set(false);
          if (r.status) {
            this.alerts.open('Đã chuyển sang nợ xấu', { appearance: 'positive' }).subscribe();
            this.context.completeWith();
          } else {
            this.alerts.open('Có lỗi xảy ra', { appearance: 'negative' }).subscribe();
          }
        },
        error: () => {
          this.saving.set(false);
          this.alerts.open('Có lỗi xảy ra', { appearance: 'negative' }).subscribe();
        },
      });
  }
}
