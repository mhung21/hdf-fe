import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
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

import { CustomerProvider } from '../../api/api/customer.service';
import { AppUserProvider } from '../../api/api/app-user.service';

export interface CustomerReassignDialogData {
  customerId: string;
  customerName: string;
}

interface UserItem {
  userId: string;
  fullName: string;
  username: string;
}

@Component({
  selector: 'app-customer-reassign-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TuiButton,
    TuiIcon,
    TuiLabel,
    TuiTextfield,
    TuiDataList,
    TuiChevron,
    TuiComboBox,
  ],
  templateUrl: './customer-reassign-dialog.component.html',
})
export class CustomerReassignDialogComponent implements OnInit {
  readonly context = injectContext<TuiDialogContext<void, CustomerReassignDialogData>>();
  private readonly customerProvider = inject(CustomerProvider);
  private readonly appUserProvider = inject(AppUserProvider);
  private readonly alertService = inject(TuiAlertService);
  private readonly fb = inject(FormBuilder);

  saving = signal(false);
  users = signal<UserItem[]>([]);

  form = this.fb.group({
    targetUserId: [null as string | null, Validators.required],
  });

  readonly userStringify: TuiStringHandler<string> = (id) =>
    this.users().find((u) => u.userId === id)?.fullName ?? '';

  protected readonly userMatcher: TuiStringMatcher<string> = (id, query) => {
    const user = this.users().find((u) => u.userId === id);
    if (!user) return false;
    return (
      user.fullName.toLowerCase().includes(query.toLowerCase()) ||
      user.username.toLowerCase().includes(query.toLowerCase())
    );
  };

  ngOnInit(): void {
    this.appUserProvider.apiAppUserGetAllGet().subscribe({
      next: (r) => {
        if (r.status && Array.isArray(r.data)) {
          this.users.set(r.data as UserItem[]);
        }
      },
    });
  }

  confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const targetUserId = this.form.value.targetUserId!;
    this.saving.set(true);
    this.customerProvider
      .apiCustomerAssignPost({
        assignCustomerRequest: {
          customerId: this.context.data.customerId,
          targetUserId,
        },
      })
      .subscribe({
        next: (r) => {
          this.saving.set(false);
          if (r.status) {
            this.alertService
              .open('Chuyển giao khách hàng thành công', { appearance: 'positive', autoClose: 3000 })
              .subscribe();
            this.context.completeWith();
          } else {
            this.alertService
              .open((r as any).message ?? 'Có lỗi xảy ra', { appearance: 'negative', autoClose: 4000 })
              .subscribe();
          }
        },
        error: () => {
          this.saving.set(false);
          this.alertService
            .open('Có lỗi xảy ra khi chuyển giao', { appearance: 'negative', autoClose: 4000 })
            .subscribe();
        },
      });
  }
}
