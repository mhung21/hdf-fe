import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TuiAlertService,
  TuiButton,
  TuiDialogContext,
  TuiIcon,
} from '@taiga-ui/core';
import { injectContext } from '@taiga-ui/polymorpheus';

import { CustomRoleService, CustomRoleDto } from '../../api/api/custom-role.extras';
import { RolePermissionProvider } from '../../api/api/role-permission.service';
import { PermissionModel } from './role-permissions-tab.component';

export interface CustomRolePermissionsDialogData {
  role: CustomRoleDto;
}

interface PermissionGroupVm {
  resource: string;
  permissions: (PermissionModel & { checked: boolean })[];
}

@Component({
  selector: 'app-custom-role-permissions-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TuiButton,
    TuiIcon,
  ],
  template: `
    <div class="space-y-4 p-2">
      <div class="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
        Vai trò: <strong>{{ role().roleName }}</strong>
        @if (role().description) { — {{ role().description }} }
      </div>

      @if (loading()) {
        <div class="flex justify-center py-6">
          <tui-icon icon="@tui.loader-2" class="animate-spin text-2xl text-primary" />
        </div>
      }

      @if (!loading()) {
        <div class="flex items-center justify-between text-sm text-gray-600">
          <span>{{ checkedCount() }} / {{ allPermissions().length }} quyền đã chọn</span>
          <div class="flex gap-2">
            <button class="text-xs text-blue-600 hover:underline" (click)="selectAll()">Chọn tất cả</button>
            <span class="text-gray-300">|</span>
            <button class="text-xs text-gray-500 hover:underline" (click)="deselectAll()">Bỏ chọn tất cả</button>
          </div>
        </div>

        <div class="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          @for (group of groupedPermissions(); track group.resource) {
            <div class="rounded-lg border bg-base-100 p-3">
              <div class="mb-2 flex items-center gap-2">
                <span class="rounded bg-base-200 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                  {{ group.resource }}
                </span>
                <span class="text-xs text-gray-400">
                  ({{ countChecked(group.permissions) }} / {{ group.permissions.length }})
                </span>
              </div>
              <div class="space-y-1.5">
                @for (perm of group.permissions; track perm.permissionCode) {
                  <label class="flex cursor-pointer items-start gap-2.5 rounded p-1 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm checkbox-primary mt-0.5 shrink-0"
                      [(ngModel)]="perm.checked"
                    />
                    <div class="flex-1 text-sm">
                      <p class="font-medium text-gray-900">{{ perm.permissionName }}</p>
                      @if (perm.description) {
                        <p class="text-xs text-gray-500">{{ perm.description }}</p>
                      }
                      <p class="font-mono text-xs text-gray-400">{{ perm.permissionCode }}</p>
                    </div>
                  </label>
                }
              </div>
            </div>
          }
        </div>
      }

      @if (errorMsg()) {
        <div class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {{ errorMsg() }}
        </div>
      }

      <div class="flex justify-end gap-2 pt-2">
        <button tuiButton appearance="outline" size="m" (click)="context.completeWith(false)">
          Hủy
        </button>
        <button tuiButton appearance="primary" size="m" [disabled]="saving()" (click)="onSave()">
          {{ saving() ? 'Đang lưu...' : 'Lưu quyền' }}
        </button>
      </div>
    </div>
  `,
})
export class CustomRolePermissionsDialogComponent implements OnInit {
  readonly context = injectContext<TuiDialogContext<boolean, CustomRolePermissionsDialogData>>();
  private readonly customRoleProvider = inject(CustomRoleService);
  private readonly rolePermissionProvider = inject(RolePermissionProvider);
  private readonly alerts = inject(TuiAlertService);

  readonly role = computed(() => this.context.data.role);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMsg = signal<string | null>(null);

  allPermissions = signal<(PermissionModel & { checked: boolean })[]>([]);

  readonly checkedCount = computed(() => this.allPermissions().filter(p => p.checked).length);

  readonly groupedPermissions = computed((): PermissionGroupVm[] => {
    const groups: Record<string, (PermissionModel & { checked: boolean })[]> = {};
    for (const perm of this.allPermissions()) {
      if (!groups[perm.resource]) groups[perm.resource] = [];
      groups[perm.resource].push(perm);
    }
    return Object.entries(groups)
      .map(([resource, permissions]) => ({ resource, permissions }))
      .sort((a, b) => a.resource.localeCompare(b.resource));
  });

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    this.rolePermissionProvider.apiRolePermissionGetAllPermissionsGet().subscribe({
      next: (allRes) => {
        const allPerms = (allRes.data as PermissionModel[]) ?? [];
        // Then load current role's permissions
        this.customRoleProvider.getPermissions(this.role().customRoleId).subscribe({
          next: (roleRes) => {
            const rolePermIds = new Set(
              ((roleRes.data as PermissionModel[]) ?? []).map(p => p.permissionId),
            );
            this.allPermissions.set(
              allPerms.map(p => ({ ...p, checked: rolePermIds.has(p.permissionId) })),
            );
            this.loading.set(false);
          },
          error: () => {
            this.allPermissions.set(allPerms.map(p => ({ ...p, checked: false })));
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.errorMsg.set('Không thể tải danh sách quyền');
        this.loading.set(false);
      },
    });
  }

  selectAll(): void {
    this.allPermissions.update(perms => perms.map(p => ({ ...p, checked: true })));
  }

  deselectAll(): void {
    this.allPermissions.update(perms => perms.map(p => ({ ...p, checked: false })));
  }

  countChecked(perms: { checked: boolean }[]): number {
    return perms.filter(p => p.checked).length;
  }

  onSave(): void {
    this.saving.set(true);
    this.errorMsg.set(null);
    const selectedIds = this.allPermissions()
      .filter(p => p.checked)
      .map(p => p.permissionId);

    this.customRoleProvider.savePermissions({
      customRoleId: this.role().customRoleId,
      permissionIds: selectedIds,
    }).subscribe({
      next: (res) => {
        if (res.status) {
          this.alerts.open('Đã lưu danh sách quyền', { appearance: 'positive', autoClose: 2000 }).subscribe();
          this.context.completeWith(true);
        } else {
          this.errorMsg.set(res.message ?? 'Có lỗi xảy ra');
        }
        this.saving.set(false);
      },
      error: () => {
        this.errorMsg.set('Không thể kết nối đến máy chủ');
        this.saving.set(false);
      },
    });
  }
}
