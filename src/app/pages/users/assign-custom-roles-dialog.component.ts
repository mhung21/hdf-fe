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
import { AppUser } from './users.component';

export interface AssignCustomRolesDialogData {
  user: AppUser;
}

@Component({
  selector: 'app-assign-custom-roles-dialog',
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
      <!-- User info -->
      <div class="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100">
          <span class="text-sm font-bold text-yellow-700">
            {{ user().fullName.charAt(0).toUpperCase() }}
          </span>
        </div>
        <div>
          <p class="font-semibold text-gray-900">{{ user().fullName }}</p>
          <p class="text-xs text-gray-500">{{ user().username }}</p>
        </div>
      </div>

      <p class="text-sm text-gray-600">
        Chọn các vai trò bổ sung để cấp thêm quyền cho người dùng này ngoài quyền chức danh mặc định.
      </p>

      @if (loading()) {
        <div class="flex justify-center py-6">
          <tui-icon icon="@tui.loader-2" class="animate-spin text-xl text-primary" />
        </div>
      }

      @if (!loading()) {
        @if (allRoles().length === 0) {
          <div class="rounded-xl border border-dashed border-gray-200 py-8 text-center">
            <tui-icon icon="@tui.shield-plus" class="mb-2 text-3xl text-gray-300" />
            <p class="text-sm text-gray-400">Chưa có vai trò bổ sung nào trong hệ thống</p>
          </div>
        } @else {
          <div class="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            @for (role of allRoles(); track role.customRoleId) {
              <label
                class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition"
                [class.border-primary]="isChecked(role.customRoleId)"
                [class.bg-green-50]="isChecked(role.customRoleId)"
                [class.border-gray-200]="!isChecked(role.customRoleId)"
                [class.hover:bg-gray-50]="!isChecked(role.customRoleId)"
              >
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm checkbox-primary mt-0.5 shrink-0"
                  [checked]="isChecked(role.customRoleId)"
                  (change)="toggleRole(role.customRoleId)"
                />
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-gray-900">{{ role.roleName }}</p>
                  @if (role.description) {
                    <p class="text-xs text-gray-500">{{ role.description }}</p>
                  }
                  <p class="mt-0.5 text-xs text-gray-400">
                    <tui-icon icon="@tui.shield" class="inline text-xs text-primary" />
                    {{ role.permissionCount }} quyền
                  </p>
                </div>
                @if (!role.isActive) {
                  <span class="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    Vô hiệu
                  </span>
                }
              </label>
            }
          </div>

          <p class="text-xs text-gray-400">
            Đã chọn {{ selectedIds().length }} / {{ allRoles().length }} vai trò
          </p>
        }
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
        @if (allRoles().length > 0) {
          <button tuiButton appearance="primary" size="m" [disabled]="saving()" (click)="onSave()">
            {{ saving() ? 'Đang lưu...' : 'Lưu thay đổi' }}
          </button>
        }
      </div>
    </div>
  `,
})
export class AssignCustomRolesDialogComponent implements OnInit {
  readonly context = injectContext<TuiDialogContext<boolean, AssignCustomRolesDialogData>>();
  private readonly provider = inject(CustomRoleService);
  private readonly alerts = inject(TuiAlertService);

  readonly user = computed(() => this.context.data.user);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMsg = signal<string | null>(null);

  allRoles = signal<CustomRoleDto[]>([]);
  selectedIds = signal<string[]>([]);

  ngOnInit(): void {
    // Load all active custom roles + current user's assigned roles in parallel
    this.provider.getAll().subscribe({
      next: (allRes) => {
        const roles = (allRes.data as CustomRoleDto[] | null) ?? [];
        this.allRoles.set(roles.filter(r => r.isActive));

        this.provider.getRolesForUser(this.user().userId).subscribe({
          next: (userRes) => {
            const assigned = (userRes.data as CustomRoleDto[] | null) ?? [];
            this.selectedIds.set(assigned.map(r => r.customRoleId));
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => {
        this.errorMsg.set('Không thể tải danh sách vai trò');
        this.loading.set(false);
      },
    });
  }

  isChecked(roleId: string): boolean {
    return this.selectedIds().includes(roleId);
  }

  toggleRole(roleId: string): void {
    const current = this.selectedIds();
    if (current.includes(roleId)) {
      this.selectedIds.set(current.filter(id => id !== roleId));
    } else {
      this.selectedIds.set([...current, roleId]);
    }
  }

  onSave(): void {
    this.saving.set(true);
    this.errorMsg.set(null);

    this.provider.assignRolesToUser({
      userId: this.user().userId,
      customRoleIds: this.selectedIds(),
    }).subscribe({
      next: (res) => {
        if (res.status) {
          this.alerts.open('Đã cập nhật vai trò cho người dùng', { appearance: 'positive', autoClose: 2000 }).subscribe();
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
