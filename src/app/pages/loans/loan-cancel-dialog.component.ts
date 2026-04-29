import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  TuiAlertService,
  TuiButton,
  TuiIcon,
  TuiLabel,
  TuiTextfield,
  type TuiDialogContext,
} from '@taiga-ui/core';
import { injectContext } from '@taiga-ui/polymorpheus';

import { LoanContractProvider } from '../../api/api/loan-contract.service';
import { CancelLoanContractRequest } from '../../api/model/cancel-loan-contract-request';

export interface LoanCancelDialogData {
  loanContractId: string;
  contractNo?: string | null;
}

@Component({
  selector: 'app-loan-cancel-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TuiButton, TuiIcon, TuiLabel, TuiTextfield],
  templateUrl: './loan-cancel-dialog.component.html',
})
export class LoanCancelDialogComponent {
  readonly context = injectContext<TuiDialogContext<void, LoanCancelDialogData>>();
  private readonly loanProvider = inject(LoanContractProvider);
  private readonly alertService = inject(TuiAlertService);
  private readonly fb = inject(FormBuilder);

  saving = signal(false);

  form = this.fb.group({
    note: ['', Validators.required],
  });

  confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const req: CancelLoanContractRequest = {
      loanContractId: this.context.data.loanContractId,
      cancellationReason: this.form.value.note ?? '',
    };
    this.saving.set(true);
    this.loanProvider.apiLoanContractCancelPost({ cancelLoanContractRequest: req }).subscribe({
      next: (r) => {
        this.saving.set(false);
        if (r.status) {
          this.alertService.open('Đã hủy hợp đồng', { appearance: 'positive' }).subscribe();
          this.context.completeWith();
        } else {
          this.alertService.open('Có lỗi xảy ra', { appearance: 'negative' }).subscribe();
        }
      },
      error: () => {
        this.saving.set(false);
        this.alertService.open('Có lỗi xảy ra', { appearance: 'negative' }).subscribe();
      },
    });
  }
}
