import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import {
  TuiAlertService,
  TuiButton,
  TuiDataList,
  TuiIcon,
  TuiLabel,
  TuiTextfield,
  type TuiDialogContext,
} from '@taiga-ui/core';
import { TuiCheckbox, TuiChevron, TuiComboBox, TuiDataListWrapper, TuiInputChip, TuiMultiSelect } from '@taiga-ui/kit';
import { TuiFilterByInputPipe } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';

import { AppUserProvider } from '../../api/api/app-user.service';
import type { CUAppUserModel } from '../../api/model/cu-app-user-model';
import type { StoreOption } from '../../services/reference-data.service';
import type { AppUser } from './users.component';
import { TuiStringMatcher, TuiStringHandler } from '@taiga-ui/cdk';

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản Trị Hệ Thống',
  REGIONAL_MANAGER: 'Quản Lý Vùng',
  STORE_MANAGER: 'Quản Lý Chi Nhánh',
  STAFF: 'Nhân Viên',
};

export interface UserFormDialogData {
  user: AppUser | null;
  availableRoles: string[];
  storeList: StoreOption[];
  isAdmin: boolean;
  currentStoreId: string | null;
}

@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    TuiButton,
    TuiCheckbox,
    TuiChevron,
    TuiComboBox,
    TuiDataListWrapper,
    TuiIcon,
    TuiInputChip,
    TuiLabel,
    TuiMultiSelect,
    TuiTextfield,
    TuiDataList,
    TuiFilterByInputPipe,
  ],
  templateUrl: './user-form-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserFormDialogComponent {
  readonly context = injectContext<TuiDialogContext<void, UserFormDialogData>>();
  private readonly fb = inject(FormBuilder);
  private readonly userProvider = inject(AppUserProvider);
  private readonly alerts = inject(TuiAlertService);

  readonly saving = signal(false);
  readonly selectedRole = signal('STAFF');
  readonly selectedStoreIds = signal<string[]>([]);

  readonly editingUser = computed(() => this.context.data.user);
  readonly availableRoles = computed(() => this.context.data.availableRoles);
  readonly storeList = computed(() =>
    this.context.data.storeList.filter((s) => s.storeName !== 'Tổng công ty'),
  );
  readonly isAdmin = computed(() => this.context.data.isAdmin);
  /** Hiển thị chọn 1 chi nhánh cho STORE_MANAGER / STAFF */
  readonly showSingleStoreField = computed(
    () => this.isAdmin() && this.selectedRole() !== 'ADMIN' && this.selectedRole() !== 'REGIONAL_MANAGER',
  );
  /** Hiển thị chọn nhiều chi nhánh cho REGIONAL_MANAGER */
  readonly showMultiStoreField = computed(
    () => this.isAdmin() && this.selectedRole() === 'REGIONAL_MANAGER',
  );

  readonly roleStringify: TuiStringHandler<string> = (code) => ROLE_LABELS[code] ?? code;
  protected readonly matcherRole: TuiStringMatcher<string> = (id, query) => {
    if (!id || !query) return false;
    const qn = this.normalizeVi(query);
    const roleName = this.normalizeVi(ROLE_LABELS[id] ?? id);
    return roleName === qn || this.normalizeVi(id) === qn;
  };
  protected readonly matcherRoleFilter: TuiStringMatcher<string> = (id, query) => {
    if (!id || !query) return false;
    const qn = this.normalizeVi(query);
    const roleName = this.normalizeVi(ROLE_LABELS[id] ?? id);
    return roleName.includes(qn) || this.normalizeVi(id).includes(qn);
  };

  readonly storeStringify: TuiStringHandler<StoreOption | string> = (id) =>
    this.storeList().find((s) => s.storeId === String(id))?.storeName ?? '';

  /** Stringify cho multi-select (nhận storeId dạng string) */
  readonly storeStringifyById: TuiStringHandler<string> = (id) =>
    this.storeList().find((s) => s.storeId === id)?.storeName ?? id;

  protected readonly matcherStore: TuiStringMatcher<string> = (id, query) => {
    if (!id || !query) return false;
    const store = this.storeList().find((item) => item.storeId === String(id));
    if (!store) return false;
    const qn = this.normalizeVi(query);
    return this.normalizeVi(store.storeName) === qn || this.normalizeVi(store.storeId) === qn;
  };
  protected readonly matcherStoreFilter: TuiStringMatcher<StoreOption> = (store, query) => {
    if (!store || !query) return false;
    const qn = this.normalizeVi(query);
    const name = this.normalizeVi(store.storeName);
    const code = this.normalizeVi(store.storeCode ?? '');
    return name.includes(qn) || code.includes(qn) || this.normalizeVi(store.storeId).includes(qn);
  };

  private normalizeVi(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .trim();
  }

  readonly form = this.fb.group({
    userId: [null as string | null],
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: [''],
    fullName: ['', Validators.required],
    email: ['', Validators.email],
    phone: [''],
    roleCode: ['STAFF', Validators.required],
    storeId: [null as string | null],
    isActive: [true],
    mustChangePassword: [false],
  });

  constructor() {
    const { user, isAdmin, currentStoreId } = this.context.data;

    if (user) {
      this.form.reset({
        userId: user.userId,
        username: user.username,
        password: '',
        fullName: user.fullName,
        email: user.email ?? '',
        phone: user.phone ?? '',
        roleCode: user.roleCode,
        storeId: user.storeId ?? null,
        isActive: user.isActive,
        mustChangePassword: false,
      });
      this.form.get('password')!.clearValidators();
      this.selectedRole.set(user.roleCode);
      if (user.roleCode === 'REGIONAL_MANAGER') {
        this.selectedStoreIds.set(user.storeIds ?? []);
      }
    } else {
      this.form.get('password')!.setValidators([Validators.required, Validators.minLength(6)]);
      if (!isAdmin) {
        // Store manager: role và store được tự động điền, không cần chọn
        this.form.patchValue({ roleCode: 'STAFF', storeId: currentStoreId });
        this.selectedRole.set('STAFF');
      }
    }
    this.form.get('password')!.updateValueAndValidity();

    if (isAdmin) {
      // Admin: storeId required khi vai trò không phải ADMIN / REGIONAL_MANAGER
      const updateStoreValidator = (role: string | null) => {
        const storeCtrl = this.form.get('storeId')!;
        if (role === 'ADMIN' || role === 'REGIONAL_MANAGER') {
          storeCtrl.setValue(null);
          storeCtrl.clearValidators();
        } else {
          storeCtrl.setValidators(Validators.required);
        }
        storeCtrl.updateValueAndValidity();
      };
      updateStoreValidator(this.form.get('roleCode')!.value);
      this.form.get('roleCode')!.valueChanges.subscribe((role) => {
        this.selectedRole.set(role ?? 'STAFF');
        if (role !== 'REGIONAL_MANAGER') this.selectedStoreIds.set([]);
        updateStoreValidator(role);
      });
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // REGIONAL_MANAGER phải chọn ít nhất 1 chi nhánh
    if (this.selectedRole() === 'REGIONAL_MANAGER' && this.selectedStoreIds().length === 0) {
      this.alerts.open('Vui lòng chọn ít nhất một chi nhánh cho Quản lý vùng.', { appearance: 'warning', autoClose: 3000 }).subscribe();
      return;
    }

    this.saving.set(true);
    const v = this.form.value;

    const model: CUAppUserModel & { storeIds?: string[] } = {
      userId: v.userId ?? undefined,
      username: v.username!,
      password: v.password || undefined,
      fullName: v.fullName!,
      email: v.email || undefined,
      phone: v.phone || undefined,
      roleCode: v.roleCode!,
      storeId: v.storeId ?? undefined,
      storeIds: this.selectedRole() === 'REGIONAL_MANAGER' ? this.selectedStoreIds() : undefined,
      isActive: v.isActive ?? true,
      mustChangePassword: v.mustChangePassword ?? false,
    };

    this.userProvider.apiAppUserSavePost({ cUAppUserModel: model }).subscribe({
      next: (result) => {
        this.saving.set(false);
        if (result.status) {
          const msg = this.editingUser() ? 'Cập nhật thành công' : 'Tạo người dùng thành công';
          this.alerts.open(msg, { appearance: 'positive', autoClose: 3000 }).subscribe();
          this.context.completeWith();
        } else {
          this.alerts
            .open(result.message ?? 'Có lỗi xảy ra', { appearance: 'negative', autoClose: 3000 })
            .subscribe();
        }
      },
      error: () => {
        this.saving.set(false);
        this.alerts
          .open('Có lỗi xảy ra, vui lòng thử lại', { appearance: 'negative', autoClose: 3000 })
          .subscribe();
      },
    });
  }
}
