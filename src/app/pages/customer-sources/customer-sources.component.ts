import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiAlertService, TuiButton, TuiHint, TuiIcon, TuiTextfield } from '@taiga-ui/core';
import { TuiCheckbox } from '@taiga-ui/kit';

import { CustomerSourceProvider } from '../../api/api/customer-source.service';
import { CustomerSource } from '../../api/model/customer-source';
import { AuthService } from '../../services/auth.service';
import { ReferenceDataService } from '../../services/reference-data.service';
import { RoleCode } from '../../models/role.model';

@Component({
  selector: 'app-customer-sources',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, TuiButton, TuiHint, TuiIcon, TuiTextfield, TuiCheckbox],
  templateUrl: './customer-sources.component.html',
})
export class CustomerSourcesComponent {
  private readonly provider = inject(CustomerSourceProvider);
  private readonly refData = inject(ReferenceDataService);
  private readonly authService = inject(AuthService);
  private readonly alert = inject(TuiAlertService);
  private readonly fb = inject(FormBuilder);

  readonly sources = this.refData.customerSources;
  readonly saving = signal(false);
  readonly deletingId = signal<string | null>(null);

  // null = đang tạo mới; string = đang sửa item có sourceId đó
  readonly editingId = signal<string | null | 'NEW'>(null);

  readonly canManage = computed(() =>
    this.authService.hasAnyRole([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER])
  );

  readonly form = this.fb.group({
    sourceName: ['', [Validators.required, Validators.maxLength(100)]],
    isActive:   [true],
    sortOrder:  [0],
  });

  startCreate(): void {
    this.form.reset({ sourceName: '', isActive: true, sortOrder: 0 });
    this.editingId.set('NEW');
  }

  startEdit(src: CustomerSource): void {
    this.form.reset({ sourceName: src.sourceName, isActive: src.isActive, sortOrder: src.sortOrder });
    this.editingId.set(src.sourceId);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset();
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    const id = this.editingId();
    const model = {
      sourceId:   id === 'NEW' ? null : id,
      sourceName: this.form.value.sourceName!,
      isActive:   this.form.value.isActive ?? true,
      sortOrder:  this.form.value.sortOrder ?? 0,
    };
    this.saving.set(true);
    this.provider.apiCustomerSourceSavePost({ cUCustomerSourceModel: model }).subscribe({
      next: r => {
        this.saving.set(false);
        if (r.status) {
          this.alert.open(r.message ?? 'Lưu thành công.', { appearance: 'success' }).subscribe();
          this.editingId.set(null);
          this.form.reset();
          this.refData.reloadCustomerSources();
        } else {
          this.alert.open(r.message ?? 'Lưu thất bại.', { appearance: 'error' }).subscribe();
        }
      },
      error: () => {
        this.saving.set(false);
        this.alert.open('Đã xảy ra lỗi khi lưu.', { appearance: 'error' }).subscribe();
      },
    });
  }

  delete(src: CustomerSource): void {
    if (!confirm(`Xóa luồng khách "${src.sourceName}"?`)) return;
    this.deletingId.set(src.sourceId);
    this.provider.apiCustomerSourceDeletePost({ body: src.sourceId }).subscribe({
      next: r => {
        this.deletingId.set(null);
        if (r.status) {
          this.alert.open(r.message ?? 'Đã xóa.', { appearance: 'success' }).subscribe();
          this.refData.reloadCustomerSources();
        } else {
          this.alert.open(r.message ?? 'Xóa thất bại.', { appearance: 'error' }).subscribe();
        }
      },
      error: () => {
        this.deletingId.set(null);
        this.alert.open('Đã xảy ra lỗi khi xóa.', { appearance: 'error' }).subscribe();
      },
    });
  }

  asSource(item: unknown): CustomerSource { return item as CustomerSource; }
}
