import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import {
  TuiButton,
  TuiCalendar,
  TuiDataList,
  TuiIcon,
  TuiLabel,
  TuiTextfield,
} from '@taiga-ui/core';
import { TuiChevron, TuiInputDateRange, TuiSelect } from '@taiga-ui/kit';
import { TuiDay, TuiDayRange, TuiStringHandler } from '@taiga-ui/cdk';

import {
  CollaboratorService,
  type CommissionReportRow,
} from '../../api/api/collaborator.extras';
import { ReferenceDataService } from '../../services/reference-data.service';
import { AuthService } from '../../services/auth.service';
import { RoleCode } from '../../models/role.model';

@Component({
  selector: 'app-collaborator-commission-report',
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
    TuiDataList,
    TuiInputDateRange,
    TuiSelect,
  ],
  templateUrl: './collaborator-commission-report.component.html',
})
export class CollaboratorCommissionReportComponent implements OnInit {
  private readonly collaboratorService = inject(CollaboratorService);
  private readonly refData = inject(ReferenceDataService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly isAdmin = computed(() => this.authService.hasRole(RoleCode.ADMIN));
  readonly storeList = computed(() => this.refData.storeList());

  rows = signal<CommissionReportRow[]>([]);
  loading = signal(false);
  totalCount = signal(0);
  totalCommission = signal(0);

  form = this.fb.group({
    dateRange: [null as TuiDayRange | null],
    storeId: [null as string | null],
  });

  readonly stringifyStore: TuiStringHandler<string> = (id) =>
    this.storeList().find((s) => s.storeId === id)?.storeName ?? id ?? '';

  readonly selectedDateRange = toSignal(
    this.form.get('dateRange')!.valueChanges,
    { initialValue: null },
  );

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  }

  ngOnInit(): void {
    // Mặc định lọc tháng hiện tại
    const now = TuiDay.currentLocal();
    const firstOfMonth = new TuiDay(now.year, now.month, 1);
    this.form.patchValue({ dateRange: new TuiDayRange(firstOfMonth, now) });
    this.load();
  }

  load(): void {
    const v = this.form.value;
    const range = v.dateRange;
    this.loading.set(true);
    this.collaboratorService
      .commissionReport({
        fromDate: range?.from?.toJSON() ?? null,
        toDate: range?.to?.toJSON() ?? null,
        storeId: v.storeId ?? null,
        pageIndex: 1,
        pageSize: 200,
      })
      .subscribe({
        next: (r) => {
          this.loading.set(false);
          if (r.status && r.data) {
            const data = r.data as { items?: CommissionReportRow[]; totalCount?: number };
            const items = data.items ?? [];
            this.rows.set(items);
            this.totalCount.set(data.totalCount ?? items.length);
            this.totalCommission.set(
              items.reduce((sum, row) => sum + (row.commissionAmount ?? 0), 0),
            );
          }
        },
        error: () => this.loading.set(false),
      });
  }
}
