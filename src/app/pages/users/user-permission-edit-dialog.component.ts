import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { TuiCheckbox, TuiChevron, TuiComboBox } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiStringMatcher, TuiStringHandler } from '@taiga-ui/cdk';

import { AppUserProvider } from '../../api/api/app-user.service';
import type { CUAppUserModel } from '../../api/model/cu-app-user-model';
import type { StoreOption } from '../../services/reference-data.service';
import { ROLE_LABELS } from './user-form-dialog.component';
import type { AppUser } from './users.component';
import { CommonModule } from '@angular/common';

export interface UserPermissionEditData {
  user: AppUser;
  storeList: StoreOption[];
}

@Component({
  selector: 'app-user-permission-edit-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiButton,
    TuiCheckbox,
    TuiChevron,
    TuiComboBox,
    TuiLabel,
    TuiTextfield,
    TuiDataList,
    TuiIcon,
  ],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" class="p-1 space-y-4">
      <!-- Thông tin user (readonly) -->
      <div class="p-3 rounded-lg bg-gray-50 border border-gray-200">
        <p class="font-semibold text-gray-800">{{ user().fullName }}</p>
        <p class="text-sm text-gray-500 font-mono">{{ user().username }}</p>
      </div>

      <!-- Vai trò -->
      <div>
        <label tuiLabel>Vai trò <span class="text-red-500">*</span></label>
        <tui-textfield tuiChevron [stringify]="roleStringify">
          <input
            tuiComboBox
            formControlName="roleCode"
            placeholder="Chọn vai trò"
            [matcher]="matcherRole"
          />
          <tui-data-list *tuiTextfieldDropdown>
            @for (role of allRoles; track role) {
              <button new tuiOption type="button" [value]="role">
                {{ roleStringify(role) }}
              </button>
            }
          </tui-data-list>
        </tui-textfield>
      </div>

      <!-- Chi nhánh (ẩn nếu Admin) -->
      @if (showStoreField()) {
        <div>
          <label tuiLabel>Chi nhánh</label>
          <tui-textfield tuiChevron [stringify]="storeStringify">
            <input
              tuiComboBox
              formControlName="storeId"
              placeholder="Chọn chi nhánh"
              [matcher]="matcherStore"
            />
            <tui-data-list *tuiTextfieldDropdown>
              @for (store of storeList(); track store.storeId) {
                <button new tuiOption type="button" [value]="store.storeId">
                  {{ store.storeName }}
                </button>
              }
            </tui-data-list>
          </tui-textfield>
        </div>
      }

      <!-- Trạng thái -->
      <div class="flex items-center gap-2">
        <input tuiCheckbox type="checkbox" formControlName="isActive" id="perm-isActive" />
        <label for="perm-isActive" tuiLabel class="cursor-pointer">Tài khoản đang hoạt động</label>
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button tuiButton type="button" appearance="outline" size="m" (click)="context.$implicit.complete()">
          Huỷ
        </button>
        <button tuiButton type="submit" appearance="primary" size="m" [disabled]="saving()">
          @if (saving()) {
            <tui-icon icon="@tui.loader-2" class="mr-1 animate-spin" />
          }
          Lưu Phân Quyền
        </button>
      </div>
    </form>
  `,
})
export class UserPermissionEditDialogComponent {
  readonly context = injectContext<TuiDialogContext<void, UserPermissionEditData>>();
  private readonly fb = inject(FormBuilder);
  private readonly userProvider = inject(AppUserProvider);
  private readonly alerts = inject(TuiAlertService);

  readonly saving = signal(false);
  readonly selectedRole = signal<string>('STAFF');

  readonly user = computed(() => this.context.data.user);
  readonly storeList = computed(() => this.context.data.storeList);
  readonly showStoreField = computed(() => this.selectedRole() !== 'ADMIN');

  readonly allRoles = ['ADMIN', 'STORE_MANAGER', 'STAFF'];

  readonly roleStringify: TuiStringHandler<string> = (code) => ROLE_LABELS[code] ?? code;
  protected readonly matcherRole: TuiStringMatcher<string> = (id, query) => {
    const label = ROLE_LABELS[id] ?? id;
    return String(id) === query || label.toLowerCase() === query.toLowerCase();
  };

  readonly storeStringify: TuiStringHandler<string> = (id) =>
    this.storeList().find((s) => s.storeId === String(id))?.storeName ?? '';
  protected readonly matcherStore: TuiStringMatcher<string> = (id, query) => {
    const item = this.storeList().find((s) => s.storeId === String(id));
    if (!item) return false;
    return String(id) === query || item.storeName.toLowerCase() === query.toLowerCase();
  };

  readonly form = this.fb.group({
    roleCode: [this.context.data.user.roleCode, Validators.required],
    storeId: [this.context.data.user.storeId ?? null as string | null],
    isActive: [this.context.data.user.isActive],
  });

  constructor() {
    this.selectedRole.set(this.context.data.user.roleCode);
    this.form.get('roleCode')!.valueChanges.subscribe((role) => {
      this.selectedRole.set(role ?? 'STAFF');
      if (role === 'ADMIN') {
        this.form.get('storeId')!.setValue(null);
      }
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const u = this.user();
    const v = this.form.value;

    const model: CUAppUserModel = {
      userId: u.userId,
      username: u.username,
      fullName: u.fullName,
      email: u.email ?? undefined,
      phone: u.phone ?? undefined,
      roleCode: v.roleCode!,
      storeId: v.storeId ?? undefined,
      isActive: v.isActive ?? true,
    };

    this.userProvider.apiAppUserSavePost({ cUAppUserModel: model }).subscribe({
      next: (result) => {
        this.saving.set(false);
        if (result.status) {
          this.alerts.open('Cập nhật phân quyền thành công', { appearance: 'positive' }).subscribe();
          this.context.completeWith();
        } else {
          this.alerts.open(result.message ?? 'Không thể lưu phân quyền', { appearance: 'negative' }).subscribe();
        }
      },
      error: () => {
        this.saving.set(false);
        this.alerts.open('Có lỗi xảy ra khi lưu phân quyền', { appearance: 'negative' }).subscribe();
      },
    });
  }
}
