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

import { StoreProvider } from '../../api/api/store.service';
import type { CUStoreModel } from '../../api/model/cu-store-model';
import { AuthService } from '../../services/auth.service';
import { RoleCode } from '../../models/role.model';

export interface StoreFormItem {
  storeId: string;
  storeCode: string;
  storeName: string;
  address?: string | null;
  phone?: string | null;
  openedOn?: string | null;
  isActive: boolean;
}

@Component({
  selector: 'app-store-form-dialog',
  standalone: true,
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
  templateUrl: './store-form-dialog.component.html',
})
export class StoreFormDialogComponent implements OnInit {
  readonly context = injectContext<TuiDialogContext<void, StoreFormItem | null>>();
  private readonly fb = inject(FormBuilder);
  private readonly storeProvider = inject(StoreProvider);
  private readonly alerts = inject(TuiAlertService);
  private readonly authService = inject(AuthService);

  /** STORE_MANAGER đang sửa chi nhánh của mình — chỉ được sửa Tên, Địa chỉ, SDT */
  readonly isLimitedEdit = computed(
    () => !!this.context.data && this.authService.hasRole(RoleCode.STORE_MANAGER)
  );

  private static readonly STORE_CODE_PREFIX = 'STR';

  readonly saving = signal(false);
  private readonly createCodeSeed = signal(this.generateTimestampToken());

  readonly editingStore = computed(() => this.context.data);

  form = this.fb.group({
    storeId: [null as string | null],
    storeCode: ['', [Validators.required, Validators.maxLength(20)]],
    storeName: ['', [Validators.required, Validators.maxLength(255)]],
    address: [''],
    phone: ['', Validators.maxLength(20)],
    openedOn: [null as TuiDay | null],
    isActive: [true],
  });

  ngOnInit(): void {
    const store = this.editingStore();
    if (store) {
      this.form.reset({
        storeId: store.storeId,
        storeCode: store.storeCode,
        storeName: store.storeName,
        address: store.address ?? '',
        phone: store.phone ?? '',
        openedOn: store.openedOn ? TuiDay.jsonParse(store.openedOn.slice(0, 10)) : null,
        isActive: store.isActive,
      });
    } else {
      this.createCodeSeed.set(this.generateTimestampToken());
      this.syncGeneratedStoreCode();
    }
    this.form.controls.storeCode.disable();
    // STORE_MANAGER không được sửa ngày mở và trạng thái
    if (this.isLimitedEdit()) {
      this.form.controls.openedOn.disable();
    }
  }

  syncGeneratedStoreCode(): void {
    if (this.editingStore()) return;
    const storeName = this.form.controls.storeName.value ?? '';
    this.form.controls.storeCode.setValue(this.buildGeneratedStoreCode(storeName), {
      emitEvent: false,
    });
  }

  save(): void {
    this.syncGeneratedStoreCode();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const value = this.form.getRawValue();
    const model: CUStoreModel = {
      storeId: value.storeId ?? undefined,
      storeCode: value.storeCode!.trim(),
      storeName: value.storeName!.trim(),
      address: value.address?.trim() || undefined,
      phone: value.phone?.trim() || undefined,
      openedOn: value.openedOn ? value.openedOn.toJSON() : undefined,
      isActive: value.isActive ?? true,
    };
    this.storeProvider.apiStoreSavePost({ cUStoreModel: model }).subscribe({
      next: (result) => {
        this.saving.set(false);
        if (result.status) {
          this.alerts
            .open(this.editingStore() ? 'Cập nhật chi nhánh thành công' : 'Thêm chi nhánh thành công', {
              appearance: 'positive',
            })
            .subscribe();
          this.context.completeWith();
        } else {
          this.alerts.open(result.message ?? 'Không thể lưu chi nhánh', { appearance: 'negative' }).subscribe();
        }
      },
      error: () => {
        this.saving.set(false);
        this.alerts.open('Có lỗi xảy ra khi lưu chi nhánh', { appearance: 'negative' }).subscribe();
      },
    });
  }

  private buildGeneratedStoreCode(storeName: string): string {
    const alias = this.buildStoreAlias(storeName);
    if (!alias) return '';
    return `${StoreFormDialogComponent.STORE_CODE_PREFIX}-${alias}-${this.createCodeSeed()}`;
  }

  private buildStoreAlias(storeName: string): string {
    const normalized = storeName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, ' ')
      .trim();
    if (!normalized) return '';
    const ignoredTokens = new Set(['CUA', 'HANG', 'CHI', 'NHANH', 'STORE']);
    const tokens = normalized
      .split(/\s+/)
      .filter((token) => token && !ignoredTokens.has(token));
    if (tokens.length === 0) return 'STR';
    return (
      tokens
        .slice(0, 4)
        .map((token) => (/^\d+$/.test(token) ? token : token[0]))
        .join('')
        .slice(0, 4) || 'STR'
    );
  }

  private generateTimestampToken(): string {
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}`;
  }
}
