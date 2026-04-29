import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  TuiAlertService,
  TuiButton,
  TuiCalendar,
  TuiIcon,
  TuiLabel,
  TuiTextfield,
  TuiWithDropdownOpen,
  type TuiDialogContext,
} from '@taiga-ui/core';
import { TuiInputDate } from '@taiga-ui/kit';
import { TuiDay } from '@taiga-ui/cdk';
import { injectContext } from '@taiga-ui/polymorpheus';
import { CommonModule } from '@angular/common';

import { PolicySettingProvider } from '../../api/api/policy-setting.service';
import { ReferenceDataService, StoreOption } from '../../services/reference-data.service';
import type { CUPolicySettingModel } from '../../api/model/cu-policy-setting-model';

export interface PolicyFormItem {
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
  selector: 'app-policy-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiButton,
    TuiIcon,
    TuiLabel,
    TuiTextfield,
    TuiCalendar,
    TuiWithDropdownOpen,
    TuiInputDate,
  ],
  templateUrl: './policy-form-dialog.component.html',
})
export class PolicyFormDialogComponent implements OnInit {
  readonly context = injectContext<TuiDialogContext<void, PolicyFormItem | null>>();
  private readonly fb = inject(FormBuilder);
  private readonly policyProvider = inject(PolicySettingProvider);
  private readonly refData = inject(ReferenceDataService);
  private readonly alerts = inject(TuiAlertService);

  readonly saving = signal(false);
  readonly editingPolicy = computed(() => this.context.data);
  readonly storeList = computed(() => this.refData.storeList());

  /** Set các storeId đang được chọn */
  readonly selectedStoreIds = signal<Set<string>>(new Set());

  /** true = chính sách toàn hệ thống */
  readonly isGlobal = signal(true);

  form = this.fb.group({
    effectiveFrom: [null as TuiDay | null, Validators.required],
    effectiveTo: [null as TuiDay | null],
    earlySettlementPenaltyRate: [5, Validators.required],
    latePaymentPenaltyRate: [8, Validators.required],
    latePaymentStartDay: [4, Validators.required],
    badDebtStartDay: [11, Validators.required],
    warningDaysStr: [''],
    insuranceDiscountRate: [0 as number, [Validators.required, Validators.min(0), Validators.max(100)]],
  });

  ngOnInit(): void {
    const item = this.editingPolicy();
    if (item) {
      const global = item.isGlobal ?? !(item.storeIds?.length);
      this.isGlobal.set(global);
      if (!global && item.storeIds?.length) {
        this.selectedStoreIds.set(new Set(item.storeIds));
      }
      this.form.patchValue({
        effectiveFrom: item.effectiveFrom ? TuiDay.jsonParse(item.effectiveFrom) : null,
        effectiveTo: item.effectiveTo ? TuiDay.jsonParse(item.effectiveTo) : null,
        earlySettlementPenaltyRate: item.earlySettlementPenaltyRate ?? 5,
        latePaymentPenaltyRate: item.latePaymentPenaltyRate ?? 8,
        latePaymentStartDay: item.latePaymentStartDay ?? 4,
        badDebtStartDay: item.badDebtStartDay ?? 11,
        warningDaysStr: item.warningDays?.length ? item.warningDays.join(',') : '',
        insuranceDiscountRate: item.insuranceDiscountRate ?? 0,
      });
    }
  }

  toggleGlobal(global: boolean): void {
    this.isGlobal.set(global);
    if (global) this.selectedStoreIds.set(new Set());
  }

  toggleStore(storeId: string): void {
    const set = new Set(this.selectedStoreIds());
    if (set.has(storeId)) set.delete(storeId);
    else set.add(storeId);
    this.selectedStoreIds.set(set);
  }

  isStoreSelected(storeId: string): boolean {
    return this.selectedStoreIds().has(storeId);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.isGlobal() && this.selectedStoreIds().size === 0) {
      this.alerts.open('Vui lòng chọn ít nhất một chi nhánh hoặc chọn "Toàn hệ thống".', { appearance: 'warning' }).subscribe();
      return;
    }

    const v = this.form.value;
    const warningDays = (v.warningDaysStr ?? '')
      .split(',')
      .map((s: string) => parseInt(s.trim(), 10))
      .filter((n: number) => !isNaN(n));

    const body: CUPolicySettingModel = {
      policyId: this.editingPolicy()?.policyId ?? null,
      storeIds: this.isGlobal() ? [] : Array.from(this.selectedStoreIds()),
      effectiveFrom: v.effectiveFrom?.toJSON() ?? '',
      effectiveTo: v.effectiveTo?.toJSON() ?? null,
      earlySettlementPenaltyRate: v.earlySettlementPenaltyRate ?? undefined,
      latePaymentPenaltyRate: v.latePaymentPenaltyRate ?? undefined,
      latePaymentStartDay: v.latePaymentStartDay ?? undefined,
      badDebtStartDay: v.badDebtStartDay ?? undefined,
      warningDays: warningDays.length ? warningDays : null,
      insuranceDiscountRate: v.insuranceDiscountRate ?? 0,
    };
    this.saving.set(true);
    this.policyProvider.apiPolicySettingSavePost({ cUPolicySettingModel: body }).subscribe({
      next: (r) => {
        this.saving.set(false);
        if (r.status) {
          this.alerts.open('Lưu chính sách thành công', { appearance: 'positive' }).subscribe();
          this.context.completeWith();
        } else {
          this.alerts.open(r.message ?? 'Có lỗi xảy ra', { appearance: 'negative' }).subscribe();
        }
      },
      error: () => {
        this.saving.set(false);
        this.alerts.open('Có lỗi xảy ra', { appearance: 'negative' }).subscribe();
      },
    });
  }
}
