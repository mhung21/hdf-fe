import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  TuiAlertService,
  TuiButton,
  TuiDialogContext,
  TuiIcon,
  TuiLabel,
  TuiTextfield,
} from '@taiga-ui/core';
import { TuiCheckbox } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  CustomRoleService,
  CustomRoleDto,
  CUCustomRoleModel,
} from '../../api/api/custom-role.extras';
import { RolePermissionExtras } from '../../api/api/role-permission.extras';
import { PermissionModel } from './role-permissions-tab.component';

export interface CustomRoleFormDialogData {
  role: CustomRoleDto | null;
}

// Nhãn tiếng Việt cho resource group
const RESOURCE_LABELS: Record<string, string> = {
  customers: 'Khách hàng',
  loan_contracts: 'Hợp đồng',
  cash_vouchers: 'Phiếu thu chi',
  reports: 'Báo cáo',
  bad_debt_cases: 'Nợ xấu',
  stores: 'Chi nhánh',
  app_users: 'Người dùng',
  store_day_locks: 'Khóa ngày',
  audit_logs: 'Nhật ký hệ thống',
  system: 'Cấu hình hệ thống',
  loan_products: 'Sản phẩm',
  policy_settings: 'Chính sách',
  custom_roles: 'Vai trò tùy chỉnh',
};

const RESOURCE_ICONS: Record<string, string> = {
  customers: '@tui.users',
  loan_contracts: '@tui.file-text',
  cash_vouchers: '@tui.receipt',
  reports: '@tui.bar-chart-2',
  bad_debt_cases: '@tui.alert-triangle',
  stores: '@tui.store',
  app_users: '@tui.user-check',
  store_day_locks: '@tui.calendar-x',
  audit_logs: '@tui.search',
  system: '@tui.settings',
  loan_products: '@tui.package',
  policy_settings: '@tui.shield',
  custom_roles: '@tui.shield-plus',
};

interface PermTreeGroup {
  resource: string;
  label: string;
  icon: string;
  isExpanded: boolean;
  permissions: (PermissionModel & { checked: boolean })[];
}

@Component({
  selector: 'app-custom-role-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TuiButton, TuiCheckbox, TuiIcon, TuiLabel, TuiTextfield],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4 p-2">
      <!-- ── Thông tin cơ bản ────────────────────────────────── -->
      <div class="space-y-3">
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">
            Tên vai trò <span class="text-red-500">*</span>
          </label>
          <tui-textfield>
            <input
              tuiTextfield
              formControlName="roleName"
              placeholder="VD: Kế toán thu, Nhân viên tư vấn..."
              autocomplete="off"
            />
          </tui-textfield>
          @if (form.get('roleName')?.invalid && form.get('roleName')?.touched) {
            <p class="mt-1 text-xs text-red-500">
              Tên vai trò không được để trống (tối thiểu 2 ký tự)
            </p>
          }
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">Mô tả</label>
          <tui-textfield>
            <input
              tuiTextfield
              formControlName="description"
              placeholder="Mô tả ngắn về vai trò này..."
              autocomplete="off"
            />
          </tui-textfield>
        </div>

        @if (isEdit()) {
          <label tuiLabel class="flex cursor-pointer items-center gap-2">
            <input tuiCheckbox formControlName="isActive" type="checkbox" />
            <span class="text-sm text-gray-700">Đang hoạt động</span>
          </label>
        }
      </div>

      <!-- ── Phân quyền bổ sung ──────────────────────────────── -->
      <div class="space-y-2">
        <div class="flex items-center gap-2 border-t border-gray-100 pt-3">
          <tui-icon icon="@tui.shield-check" class="text-sm text-primary" />
          <span class="text-sm font-semibold text-gray-800">Phân quyền bổ sung</span>
        </div>

        <div class="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Chỉ hiển thị quyền <strong>vượt mức Nhân viên</strong> mặc định. Nhân viên đã có quyền
          xem, tạo cơ bản.
        </div>

        @if (permsLoading()) {
          <div class="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
            <tui-icon icon="@tui.loader-2" class="animate-spin text-primary" />
            Đang tải danh sách quyền...
          </div>
        }

        @if (!permsLoading()) {
          <!-- Thanh công cụ -->
          <div class="flex items-center justify-between text-xs text-gray-500">
            <span>
              <strong class="text-gray-800">{{ totalChecked() }}</strong>
              / {{ totalPerms() }} quyền đã chọn
            </span>
            <div class="flex gap-3">
              <button type="button" class="text-blue-600 hover:underline" (click)="selectAll()">
                Chọn tất cả
              </button>
              <span class="text-gray-300">|</span>
              <button type="button" class="text-gray-500 hover:underline" (click)="deselectAll()">
                Bỏ chọn tất cả
              </button>
            </div>
          </div>

          <!-- Treeview -->
          <div
            class="max-h-72 overflow-y-auto space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-2"
          >
            @for (group of permGroups(); track group.resource) {
              <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <!-- Group header -->
                <div
                  class="flex cursor-pointer select-none items-center gap-2 p-2.5 hover:bg-gray-50"
                  (click)="toggleExpand(group.resource)"
                >
                  <!-- Chevron -->
                  <tui-icon
                    [icon]="group.isExpanded ? '@tui.chevron-down' : '@tui.chevron-right'"
                    class="shrink-0 text-xs text-gray-400"
                  />

                  <!-- Group checkbox (stop click from bubbling to header) -->
                  <input
                    type="checkbox"
                    class="checkbox checkbox-xs checkbox-primary shrink-0"
                    [checked]="groupState(group) !== 'none'"
                    [class.opacity-50]="groupState(group) === 'some'"
                    (click)="$event.stopPropagation(); toggleGroupAll(group.resource)"
                    (change)="$event.stopPropagation()"
                  />

                  <!-- Icon + label -->
                  <tui-icon [icon]="group.icon" class="shrink-0 text-sm text-primary" />
                  <span class="flex-1 text-sm font-medium text-gray-900">{{ group.label }}</span>

                  <!-- Count badge -->
                  <span
                    class="rounded-full px-2 py-0.5 text-xs font-medium"
                    [class]="
                      groupState(group) === 'none'
                        ? 'bg-gray-100 text-gray-400'
                        : groupState(group) === 'all'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                    "
                  >
                    {{ countGroupChecked(group) }}/{{ group.permissions.length }}
                  </span>
                </div>

                <!-- Permission items (collapsible) -->
                @if (group.isExpanded) {
                  <div class="border-t border-gray-100 divide-y divide-gray-50">
                    @for (perm of group.permissions; track perm.permissionCode) {
                      <label
                        class="flex cursor-pointer items-start gap-2.5 px-4 py-2 hover:bg-gray-50"
                        (click)="
                          $event.preventDefault(); togglePerm(group.resource, perm.permissionCode)
                        "
                      >
                        <input
                          type="checkbox"
                          class="checkbox checkbox-xs checkbox-primary mt-0.5 shrink-0"
                          [checked]="perm.checked"
                          (change)="$event.preventDefault()"
                        />
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium text-gray-900">{{ perm.permissionName }}</p>
                          @if (perm.description) {
                            <p class="truncate text-xs text-gray-400">{{ perm.description }}</p>
                          }
                        </div>
                      </label>
                    }
                  </div>
                }
              </div>
            }

            @if (permGroups().length === 0 && !permsLoading()) {
              <div class="py-6 text-center text-sm text-gray-400">Không có quyền nào khả dụng</div>
            }
          </div>
        }
      </div>

      <!-- ── Error bar ───────────────────────────────────────── -->
      @if (errorMsg()) {
        <div class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {{ errorMsg() }}
        </div>
      }

      <!-- ── Actions ─────────────────────────────────────────── -->
      <div class="flex justify-end gap-2 border-t border-gray-100 pt-3">
        <button
          tuiButton
          appearance="outline"
          size="m"
          type="button"
          (click)="context.completeWith(false)"
        >
          Hủy
        </button>
        <button tuiButton appearance="primary" size="m" type="submit" [disabled]="saving()">
          {{ saving() ? 'Đang lưu...' : isEdit() ? 'Cập nhật' : 'Tạo vai trò' }}
        </button>
      </div>
    </form>
  `,
})
export class CustomRoleFormDialogComponent implements OnInit {
  readonly context = injectContext<TuiDialogContext<boolean, CustomRoleFormDialogData>>();
  private readonly fb = inject(FormBuilder);
  private readonly customRoleService = inject(CustomRoleService);
  private readonly rolePermExtras = inject(RolePermissionExtras);
  private readonly alerts = inject(TuiAlertService);

  readonly saving = signal(false);
  readonly permsLoading = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly isEdit = signal(false);

  /** Dữ liệu cây quyền */
  readonly permGroups = signal<PermTreeGroup[]>([]);

  readonly totalChecked = computed(() =>
    this.permGroups().reduce((sum, g) => sum + g.permissions.filter((p) => p.checked).length, 0),
  );
  readonly totalPerms = computed(() =>
    this.permGroups().reduce((sum, g) => sum + g.permissions.length, 0),
  );

  readonly form = this.fb.group({
    roleName: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    isActive: [true],
  });

  ngOnInit(): void {
    const role = this.context.data.role;
    if (role) {
      this.isEdit.set(true);
      this.form.patchValue({
        roleName: role.roleName,
        description: role.description ?? '',
        isActive: role.isActive,
      });
    }
    this.loadPermissions(role?.customRoleId ?? null);
  }

  private loadPermissions(existingRoleId: string | null): void {
    this.permsLoading.set(true);

    // Tải quyền khả dụng + quyền hiện có của role (nếu edit)
    const perms$ = this.rolePermExtras
      .getAssignablePermissions()
      .pipe(catchError(() => of({ status: false, data: [] })));
    const current$ = existingRoleId
      ? this.customRoleService
          .getPermissions(existingRoleId)
          .pipe(catchError(() => of({ status: false, data: [] })))
      : of({ status: true, data: [] });

    forkJoin([perms$, current$]).subscribe(([allRes, currentRes]) => {
      const allPerms = (allRes.data as PermissionModel[]) ?? [];
      const currentIds = new Set(
        ((currentRes.data as PermissionModel[]) ?? []).map((p) => p.permissionId),
      );

      // Nhóm theo resource
      const groupMap = new Map<string, PermTreeGroup>();
      for (const perm of allPerms) {
        if (!groupMap.has(perm.resource)) {
          groupMap.set(perm.resource, {
            resource: perm.resource,
            label: RESOURCE_LABELS[perm.resource] ?? perm.resource,
            icon: RESOURCE_ICONS[perm.resource] ?? '@tui.shield',
            isExpanded: false,
            permissions: [],
          });
        }
        groupMap.get(perm.resource)!.permissions.push({
          ...perm,
          checked: currentIds.has(perm.permissionId),
        });
      }

      // Mở các group đã có quyền checked (khi edit)
      const groups = Array.from(groupMap.values());
      for (const g of groups) {
        if (g.permissions.some((p) => p.checked)) g.isExpanded = true;
      }

      this.permGroups.set(groups);
      this.permsLoading.set(false);
    });
  }

  // ── Treeview helpers ───────────────────────────────────────────────────

  groupState(group: PermTreeGroup): 'all' | 'some' | 'none' {
    const count = group.permissions.filter((p) => p.checked).length;
    if (count === 0) return 'none';
    if (count === group.permissions.length) return 'all';
    return 'some';
  }

  countGroupChecked(group: PermTreeGroup): number {
    return group.permissions.filter((p) => p.checked).length;
  }

  toggleExpand(resource: string): void {
    this.permGroups.update((groups) =>
      groups.map((g) => (g.resource === resource ? { ...g, isExpanded: !g.isExpanded } : g)),
    );
  }

  toggleGroupAll(resource: string): void {
    this.permGroups.update((groups) => {
      return groups.map((g) => {
        if (g.resource !== resource) return g;
        const newChecked = this.groupState(g) !== 'all';
        return {
          ...g,
          isExpanded: true,
          permissions: g.permissions.map((p) => ({ ...p, checked: newChecked })),
        };
      });
    });
  }

  togglePerm(resource: string, permCode: string): void {
    this.permGroups.update((groups) =>
      groups.map((g) =>
        g.resource === resource
          ? {
              ...g,
              permissions: g.permissions.map((p) =>
                p.permissionCode === permCode ? { ...p, checked: !p.checked } : p,
              ),
            }
          : g,
      ),
    );
  }

  selectAll(): void {
    this.permGroups.update((groups) =>
      groups.map((g) => ({
        ...g,
        permissions: g.permissions.map((p) => ({ ...p, checked: true })),
      })),
    );
  }

  deselectAll(): void {
    this.permGroups.update((groups) =>
      groups.map((g) => ({
        ...g,
        permissions: g.permissions.map((p) => ({ ...p, checked: false })),
      })),
    );
  }

  // ── Submit ─────────────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMsg.set(null);

    const existingRole = this.context.data.role;
    const model: CUCustomRoleModel = {
      customRoleId: existingRole?.customRoleId ?? null,
      roleName: this.form.value.roleName!.trim(),
      description: this.form.value.description?.trim() || null,
      isActive: this.form.value.isActive ?? true,
    };

    this.customRoleService.save(model).subscribe({
      next: (res) => {
        if (!res.status) {
          this.errorMsg.set(res.message ?? 'Có lỗi xảy ra');
          this.saving.set(false);
          return;
        }

        // Lấy ID của role vừa tạo/cập nhật
        const savedRoleId: string =
          (res.data as { customRoleId: string })?.customRoleId ?? existingRole?.customRoleId ?? '';

        // Lưu danh sách quyền
        const permissionIds = this.permGroups()
          .flatMap((g) => g.permissions)
          .filter((p) => p.checked)
          .map((p) => p.permissionId);

        this.customRoleService
          .savePermissions({ customRoleId: savedRoleId, permissionIds })
          .subscribe({
            next: (permRes) => {
              if (permRes.status) {
                this.alerts
                  .open(existingRole ? 'Đã cập nhật vai trò và quyền' : 'Đã tạo vai trò mới', {
                    appearance: 'positive',
                    autoClose: 2000,
                  })
                  .subscribe();
                this.context.completeWith(true);
              } else {
                this.errorMsg.set(permRes.message ?? 'Lưu quyền thất bại');
              }
              this.saving.set(false);
            },
            error: () => {
              this.errorMsg.set('Không thể lưu danh sách quyền');
              this.saving.set(false);
            },
          });
      },
      error: () => {
        this.errorMsg.set('Không thể kết nối đến máy chủ');
        this.saving.set(false);
      },
    });
  }
}
