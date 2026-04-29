import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  TuiAlertService,
  TuiButton,
  TuiDataList,
  TuiLabel,
  TuiNumberFormat,
  TuiNumberFormatSettings,
  TuiTextfield,
  type TuiDialogContext,
} from '@taiga-ui/core';
import { TuiChevron, TuiInputNumber, TuiSelect } from '@taiga-ui/kit';
import { TuiStringHandler } from '@taiga-ui/cdk';
import { injectContext } from '@taiga-ui/polymorpheus';
import { CommonModule } from '@angular/common';

import { CollaboratorService, type CollaboratorDto } from '../../api/api/collaborator.extras';
import { ReferenceDataService } from '../../services/reference-data.service';
import { AuthService } from '../../services/auth.service';
import { RoleCode } from '../../models/role.model';
import { TuiCurrencyPipe } from '@taiga-ui/addon-commerce';

export interface CollaboratorFormDialogData {
  collaborator: CollaboratorDto | null;
}

@Component({
  selector: 'app-collaborator-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiButton,
    TuiChevron,
    TuiDataList,
    TuiLabel,
    TuiTextfield,
    TuiSelect,
    TuiInputNumber,
    TuiNumberFormat,
    TuiInputNumber,
  ],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" class="p-1 space-y-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <!-- Họ tên -->
        <div>
          <label tuiLabel>Họ và tên <span class="text-red-500">*</span></label>
          <tui-textfield>
            <input tuiTextfield formControlName="fullName" placeholder="Nguyễn Văn A" />
          </tui-textfield>
          @if (form.get('fullName')?.invalid && form.get('fullName')?.touched) {
            <p class="mt-1 text-xs text-red-500">Vui lòng nhập họ tên</p>
          }
        </div>

        <!-- Số điện thoại -->
        <div>
          <label tuiLabel>Số điện thoại <span class="text-red-500">*</span></label>
          <tui-textfield>
            <input tuiTextfield formControlName="phone" placeholder="0901 234 567" />
          </tui-textfield>
          @if (form.get('phone')?.invalid && form.get('phone')?.touched) {
            <p class="mt-1 text-xs text-red-500">Vui lòng nhập số điện thoại</p>
          }
        </div>

        <!-- CCCD/CMND -->
        <div>
          <label tuiLabel>CCCD/CMND <span class="text-red-500">*</span></label>
          <tui-textfield>
            <input tuiTextfield formControlName="idNumber" placeholder="12 số CCCD" />
          </tui-textfield>
          @if (form.get('idNumber')?.invalid && form.get('idNumber')?.touched) {
            <p class="mt-1 text-xs text-red-500">Vui lòng nhập số CCCD</p>
          }
        </div>

        <!-- Tỷ lệ hoa hồng -->
        <div>
          <label tuiLabel>Tỷ lệ hoa hồng (%) <span class="text-red-500">*</span></label>
          <tui-textfield>
            <input
              tuiInputNumber
              [tuiNumberFormat]="numberFormat"
              [postfix]="' %'"
              formControlName="commissionRate"
              placeholder="VD: 2.5"
            />
          </tui-textfield>
          @if (form.get('commissionRate')?.invalid && form.get('commissionRate')?.touched) {
            <p class="mt-1 text-xs text-red-500">Vui lòng nhập tỷ lệ hoa hồng</p>
          }
        </div>

        <!-- Chi nhánh liên kết (chỉ Admin mới chọn được) -->
        @if (isAdmin()) {
          <div>
            <label tuiLabel>Chi nhánh liên kết</label>
            <tui-textfield tuiChevron [stringify]="stringifyStore">
              <input tuiSelect formControlName="storeId" placeholder="Chọn chi nhánh..." />
              <tui-data-list *tuiTextfieldDropdown new>
                @for (store of storeList(); track store.storeId) {
                  <button new tuiOption type="button" [value]="store.storeId">
                    {{ store.storeName }}
                  </button>
                }
              </tui-data-list>
            </tui-textfield>
          </div>
        }

        <!-- Ghi chú -->
        <div [class.sm:col-span-2]="isAdmin()">
          <label tuiLabel>Ghi chú</label>
          <tui-textfield>
            <input tuiTextfield formControlName="note" placeholder="Ghi chú thêm..." />
          </tui-textfield>
        </div>

        <!-- Trạng thái -->
        @if (editingCollaborator()) {
          <div class="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              id="isActive"
              formControlName="isActive"
              class="w-4 h-4 border-gray-300 rounded"
            />
            <label for="isActive" class="text-sm text-gray-700 cursor-pointer"
              >Đang hoạt động</label
            >
          </div>
        }
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          tuiButton
          type="button"
          appearance="outline"
          size="m"
          (click)="context.$implicit.complete()"
        >
          Huỷ
        </button>
        <button tuiButton type="submit" appearance="primary" size="m" [disabled]="saving()">
          {{ saving() ? 'Đang lưu...' : editingCollaborator() ? 'Cập nhật' : 'Thêm CTV' }}
        </button>
      </div>
    </form>
  `,
})
export class CollaboratorFormDialogComponent implements OnInit {
  readonly context = injectContext<TuiDialogContext<void, CollaboratorFormDialogData>>();
  private readonly fb = inject(FormBuilder);
  private readonly collaboratorService = inject(CollaboratorService);
  private readonly alerts = inject(TuiAlertService);
  private readonly refData = inject(ReferenceDataService);
  private readonly authService = inject(AuthService);

  readonly saving = signal(false);
  readonly editingCollaborator = computed(() => this.context.data.collaborator);
  readonly storeList = computed(() => this.refData.storeList());
  readonly isAdmin = computed(() => this.authService.hasRole(RoleCode.ADMIN));

  protected numberFormat: Partial<TuiNumberFormatSettings> = {
    decimalSeparator: ',',
    thousandSeparator: '.',
  };

  readonly stringifyStore: TuiStringHandler<string> = (id) =>
    this.storeList().find((s) => s.storeId === id)?.storeName ?? id ?? '';

  form = this.fb.group({
    collaboratorId: [null as string | null],
    fullName: ['', Validators.required],
    phone: [null as string | null, Validators.required],
    idNumber: [null as string | null, Validators.required],
    storeId: [null as string | null],
    note: [null as string | null],
    commissionRate: [null as number | null, [Validators.required, Validators.min(0), Validators.max(100)]],
    isActive: [true],
  });

  ngOnInit(): void {
    // Non-Admin: tự gán storeId của mình
    if (!this.isAdmin()) {
      this.form.get('storeId')!.setValue(this.authService.currentUser()?.storeId ?? null);
    }

    const c = this.editingCollaborator();
    if (c) {
      this.form.reset({
        collaboratorId: c.collaboratorId,
        fullName: c.fullName,
        phone: c.phone ?? null,
        idNumber: c.idNumber ?? null,
        storeId: c.storeId ?? null,
        note: c.note ?? null,
        commissionRate: c.commissionRate ?? null,
        isActive: c.isActive,
      });
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.collaboratorService
      .save({
        collaboratorId: v.collaboratorId ?? undefined,
        fullName: v.fullName ?? undefined,
        phone: v.phone ?? undefined,
        idNumber: v.idNumber ?? undefined,
        storeId: v.storeId ?? undefined,
        note: v.note ?? undefined,
        commissionRate: v.commissionRate ?? undefined,
        isActive: v.isActive ?? true,
      })
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          if (result.status) {
            this.alerts
              .open(
                this.editingCollaborator() ? 'Cập nhật CTV thành công' : 'Thêm CTV thành công',
                { appearance: 'positive' },
              )
              .subscribe();
            this.context.completeWith();
          } else {
            this.alerts
              .open(result.message ?? 'Có lỗi xảy ra', { appearance: 'negative' })
              .subscribe();
          }
        },
        error: () => {
          this.saving.set(false);
          this.alerts
            .open('Có lỗi xảy ra, vui lòng thử lại', { appearance: 'negative' })
            .subscribe();
        },
      });
  }
}
