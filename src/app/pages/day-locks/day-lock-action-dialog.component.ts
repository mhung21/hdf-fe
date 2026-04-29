import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  TuiAlertService,
  TuiButton,
  TuiCalendar,
  TuiDataList,
  TuiIcon,
  TuiLabel,
  TuiTextfield,
  TuiWithDropdownOpen,
  type TuiDialogContext,
} from '@taiga-ui/core';
import { TuiChevron, TuiComboBox, TuiInputDate } from '@taiga-ui/kit';
import { TuiDay, TuiStringHandler, TuiStringMatcher } from '@taiga-ui/cdk';
import { injectContext } from '@taiga-ui/polymorpheus';
import { CommonModule } from '@angular/common';

import { StoreProvider } from '../../api/api/store.service';
import type { StoreDayLockRequest } from '../../api/model/store-day-lock-request';

interface StoreOption {
  storeId: string;
  storeName: string;
  storeCode?: string | null;
}

@Component({
  selector: 'app-day-lock-action-dialog',
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
    TuiCalendar,
    TuiWithDropdownOpen,
    TuiInputDate,
  ],
  templateUrl: './day-lock-action-dialog.component.html',
})
export class DayLockActionDialogComponent implements OnInit {
  readonly context = injectContext<TuiDialogContext<void, 'lock' | 'unlock'>>();
  private readonly fb = inject(FormBuilder);
  private readonly storeProvider = inject(StoreProvider);
  private readonly alerts = inject(TuiAlertService);

  readonly saving = signal(false);
  readonly stores = signal<StoreOption[]>([]);
  readonly action = computed(() => this.context.data);

  form = this.fb.group({
    storeId: ['', Validators.required],
    businessDate: [null as TuiDay | null, Validators.required],
  });

  readonly storeStringify: TuiStringHandler<string> = (id) =>
    this.stores().find((s) => s.storeId === id)?.storeName ?? id;
  readonly storeMatcher: TuiStringMatcher<string> = (id, q) => {
    const s = this.stores().find((x) => x.storeId === id);
    if (!s) return false;
    return (
      s.storeName.toLowerCase().includes(q.toLowerCase()) ||
      (s.storeCode ?? '').toLowerCase().includes(q.toLowerCase())
    );
  };

  ngOnInit(): void {
    this.storeProvider.apiStoreGetAllGet().subscribe({
      next: (r) => {
        if (r.status && r.data) {
          this.stores.set(Array.isArray(r.data) ? (r.data as StoreOption[]) : []);
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
    const req: StoreDayLockRequest = {
      storeId: v.storeId ?? undefined,
      businessDate: v.businessDate?.toJSON() ?? undefined,
    };
    this.saving.set(true);
    const call =
      this.action() === 'lock'
        ? this.storeProvider.apiStoreLockDayPost({ storeDayLockRequest: req })
        : this.storeProvider.apiStoreUnlockDayPost({ storeDayLockRequest: req });

    call.subscribe({
      next: (r) => {
        this.saving.set(false);
        if (r.status) {
          this.alerts
            .open(
              this.action() === 'lock' ? 'Đã khóa ngày thành công' : 'Đã mở khóa ngày thành công',
              { appearance: 'positive' },
            )
            .subscribe();
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
