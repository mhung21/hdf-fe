import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TuiButton,
  TuiHint,
  TuiIcon,
  TuiTextfield,
  tuiDialog,
} from '@taiga-ui/core';

import { PolicySettingProvider } from '../../api/api/policy-setting.service';
import { SearchPolicySettingRequest } from '../../api/model/search-policy-setting-request';
import { AuthService } from '../../services/auth.service';
import { RoleCode } from '../../models/role.model';
import { DataTableComponent, ColumnDef } from '../../shared/components/data-table/data-table.component';
import { PolicyFormDialogComponent, PolicyFormItem } from './policy-form-dialog.component';

interface PolicyItem {
  policyId: string;
  isGlobal?: boolean;
  storeIds?: string[] | null;
  storeNames?: string[] | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  earlySettlementPenaltyRate?: number | null;
  latePaymentPenaltyRate?: number | null;
  latePaymentStartDay?: number | null;
  badDebtStartDay?: number | null;
  warningDays?: number[] | null;
  insuranceDiscountRate?: number | null;
}

@Component({
  selector: 'app-policies',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TuiButton,
    TuiHint,
    TuiIcon,
    TuiTextfield,
    DataTableComponent,
  ],
  templateUrl: './policies.component.html',
})
export class PoliciesComponent implements OnInit {
  private readonly policyProvider = inject(PolicySettingProvider);
  private readonly authService = inject(AuthService);
  private readonly injector = inject(Injector);

  policies = signal<PolicyItem[]>([]);
  loading = signal(false);
  totalCount = signal(0);
  page = 0;
  size = 10;
  keyword = signal('');

  readonly tableColumns: ColumnDef[] = [
    { key: 'store', label: 'Chi nhánh' },
    { key: 'effective', label: 'Hiệu lực' },
    { key: 'latePayment', label: 'Phạt chậm nộp', align: 'center' },
    { key: 'earlySettlement', label: 'Phạt TT sớm', align: 'center' },
    { key: 'badDebt', label: 'Ngày nợ xấu', align: 'center' },
    { key: 'warning', label: 'Cảnh báo (ngày)' },
  ];

  canManage = computed(() => this.authService.hasAnyRole([RoleCode.ADMIN]));

  asPolicy(item: unknown): PolicyItem { return item as PolicyItem; }
  formatDate(iso?: string | null): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat('vi-VN').format(d);
  }

  ngOnInit(): void { this.loadPolicies(); }
  onKeywordChange(v: string): void { this.keyword.set(v); this.page = 0; this.loadPolicies(); }
  onPaginationChange(e: { page: number; size: number }): void { this.page = e.page; this.size = e.size; this.loadPolicies(); }

  loadPolicies(): void {
    this.loading.set(true);
    const req: SearchPolicySettingRequest = { keyword: this.keyword() || null, pageIndex: this.page + 1, pageSize: this.size };
    this.policyProvider.apiPolicySettingSearchPost({ searchPolicySettingRequest: req }).subscribe({
      next: r => {
        if (r.status && r.data) {
          const data = r.data as { items?: PolicyItem[]; totalCount?: number };
          this.policies.set(data.items ?? (Array.isArray(r.data) ? r.data as PolicyItem[] : []));
          this.totalCount.set(data.totalCount ?? this.policies().length);
        } else { this.policies.set([]); }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreateDialog(): void {
    tuiDialog(PolicyFormDialogComponent, {
      injector: this.injector,
      label: 'Thêm Chính Sách',
      size: 'l',
    })(null).subscribe(() => this.loadPolicies());
  }

  openEditDialog(item: PolicyItem): void {
    tuiDialog(PolicyFormDialogComponent, {
      injector: this.injector,
      label: 'Sửa Chính Sách',
      size: 'l',
    })(item as PolicyFormItem).subscribe(() => this.loadPolicies());
  }
}
