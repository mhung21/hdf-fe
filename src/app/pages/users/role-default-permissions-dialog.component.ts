import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiAlertService, TuiButton, TuiDialogContext, TuiIcon } from '@taiga-ui/core';
import { TuiTabs } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';

import { RolePermissionProvider } from '../../api/api/role-permission.service';
import { RolePermissionExtras } from '../../api/api/role-permission.extras';

// ── Types ────────────────────────────────────────────────────────────────────────
interface PermissionItem {
  permissionId: string;
  permissionCode: string;
  permissionName: string;
  resource: string;
  action: string;
  description?: string | null;
}

interface PermissionGroup {
  resource: string;
  permissions: PermissionItem[];
}

// ── Role metadata ────────────────────────────────────────────────────────────────
const ROLE_BADGE: Record<string, { cls: string; label: string; desc: string }> = {
  ADMIN: {
    cls: 'bg-black text-white',
    label: 'Quản trị viên',
    desc: 'Toàn quyền hệ thống — quản lý tất cả chi nhánh, người dùng và cấu hình.',
  },
  REGIONAL_MANAGER: {
    cls: 'bg-purple-100 text-purple-800 border border-purple-300',
    label: 'Quản lý vùng',
    desc: 'Quản lý nhiều chi nhánh — giám sát hoạt động, duyệt nghiệp vụ liên vùng.',
  },
  STORE_MANAGER: {
    cls: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
    label: 'Quản lý chi nhánh',
    desc: 'Toàn quyền trong chi nhánh — duyệt hợp đồng, thu chi, nợ xấu, quản lý nhân viên.',
  },
  STAFF: {
    cls: 'bg-gray-100 text-gray-700 border border-gray-200',
    label: 'Nhân viên',
    desc: 'Nhập liệu cơ bản — tạo khách hàng, hợp đồng, phiếu thu chi. Cần Quản lý duyệt.',
  },
};

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

@Component({
  selector: 'app-role-default-permissions-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TuiButton, TuiIcon, TuiTabs],
  template: `
    <div class="space-y-4 p-2">
      <!-- Role selector tabs -->
      <tui-tabs>
        @for (role of roles; track role) {
          <button tuiTab type="button" (click)="selectRole(role)">
            {{ badge(role).label }}
          </button>
        }
      </tui-tabs>

      <!-- Role description banner -->
      <div class="flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5" [class]="bannerClass()">
        <tui-icon icon="@tui.info" class="mt-0.5 shrink-0 text-sm" />
        <p class="text-sm leading-relaxed">{{ badge(selectedRole()).desc }}</p>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="flex justify-center py-8">
          <tui-icon icon="@tui.loader-2" class="animate-spin text-2xl text-primary" />
        </div>
      }

      <!-- Permission groups matrix -->
      @if (!loading()) {
        <div class="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          @for (group of groupedPermissions(); track group.resource) {
            <div class="rounded-lg border border-gray-100 bg-white px-3.5 py-3">
              <!-- Group header -->
              <div class="mb-2 flex items-center justify-between">
                <span class="text-sm font-semibold text-gray-800">{{ resourceLabel(group.resource) }}</span>
                <span class="text-xs text-gray-400">{{ countChecked(group) }}/{{ group.permissions.length }}</span>
              </div>

              <!-- Permissions -->
              <div class="space-y-1.5">
                @for (perm of group.permissions; track perm.permissionId) {
                  <label
                    class="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      class="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary accent-[#526ed3]"
                      [checked]="isChecked(perm.permissionId)"
                      (change)="togglePermission(perm.permissionId)"
                      [disabled]="!isAdmin()"
                    />
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-gray-800 leading-tight">{{ perm.permissionName }}</p>
                      @if (perm.description) {
                        <p class="mt-0.5 text-xs text-gray-400 leading-snug">{{ perm.description }}</p>
                      }
                      <p class="mt-0.5 font-mono text-[10px] text-gray-300">{{ perm.permissionCode }}</p>
                    </div>
                  </label>
                }
              </div>
            </div>
          }
        </div>

        <!-- Summary -->
        <div class="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5">
          <span class="text-sm text-gray-600">
            Đã chọn <strong class="text-primary">{{ checkedIds().length }}</strong> / {{ allPermissions().length }} quyền
          </span>
          @if (isAdmin() && hasChanges()) {
            <span class="text-xs text-amber-600">● Chưa lưu</span>
          }
        </div>
      }

      <!-- Actions -->
      <div class="flex justify-end gap-2 border-t border-gray-100 pt-3">
        @if (isAdmin()) {
          <button
            tuiButton appearance="flat" size="m"
            [disabled]="saving()"
            (click)="clearCache()"
            title="Xóa cache phân quyền trên server"
          >
            <tui-icon icon="@tui.refresh-cw" class="mr-1" />
            Xóa cache
          </button>
          <div class="flex-1"></div>
          <button
            tuiButton appearance="outline" size="m"
            (click)="context.completeWith()"
          >Đóng</button>
          <button
            tuiButton appearance="primary" size="m"
            [disabled]="saving() || !hasChanges()"
            (click)="save()"
          >
            @if (saving()) {
              <tui-icon icon="@tui.loader-2" class="mr-1 animate-spin" />
            }
            Lưu thay đổi
          </button>
        } @else {
          <button tuiButton appearance="outline" size="m" (click)="context.completeWith()">
            Đóng
          </button>
        }
      </div>
    </div>
  `,
})
export class RoleDefaultPermissionsDialogComponent implements OnInit {
  readonly context = injectContext<TuiDialogContext<void, void>>();
  private readonly rolePermProvider = inject(RolePermissionProvider);
  private readonly rolePermExtras = inject(RolePermissionExtras);
  private readonly alerts = inject(TuiAlertService);

  readonly roles = ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER', 'STAFF'] as const;
  readonly selectedRole = signal<string>('ADMIN');
  readonly loading = signal(false);
  readonly saving = signal(false);

  // Tất cả permissions trong hệ thống
  readonly allPermissions = signal<PermissionItem[]>([]);
  // IDs đã check cho role hiện tại
  readonly checkedIds = signal<string[]>([]);
  // IDs gốc (từ DB) để detect thay đổi
  private originalIds = new Set<string>();

  // Kiểm tra user hiện tại có phải Admin
  readonly isAdmin = signal(true); // sẽ được set trong constructor nếu cần

  readonly groupedPermissions = computed<PermissionGroup[]>(() => {
    const groups: Record<string, PermissionItem[]> = {};
    for (const perm of this.allPermissions()) {
      if (!groups[perm.resource]) groups[perm.resource] = [];
      groups[perm.resource].push(perm);
    }
    return Object.entries(groups)
      .map(([resource, permissions]) => ({ resource, permissions }))
      .sort((a, b) => a.resource.localeCompare(b.resource));
  });

  readonly hasChanges = computed(() => {
    const current = new Set(this.checkedIds());
    if (current.size !== this.originalIds.size) return true;
    for (const id of current) {
      if (!this.originalIds.has(id)) return true;
    }
    return false;
  });

  ngOnInit(): void {
    this.loadAllPermissions();
    this.loadRolePermissions('ADMIN');
  }

  selectRole(role: string): void {
    if (role === this.selectedRole()) return;
    this.selectedRole.set(role);
    this.loadRolePermissions(role);
  }

  isChecked(permId: string): boolean {
    return this.checkedIds().includes(permId);
  }

  togglePermission(permId: string): void {
    const current = [...this.checkedIds()];
    const idx = current.indexOf(permId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(permId);
    }
    this.checkedIds.set(current);
  }

  countChecked(group: PermissionGroup): number {
    const ids = this.checkedIds();
    return group.permissions.filter((p) => ids.includes(p.permissionId)).length;
  }

  save(): void {
    this.saving.set(true);
    this.rolePermExtras
      .saveRolePermissions(this.selectedRole(), this.checkedIds())
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          if (res.status) {
            this.originalIds = new Set(this.checkedIds());
            this.alerts
              .open(`Đã cập nhật quyền cho ${this.badge(this.selectedRole()).label}`, {
                appearance: 'positive',
                autoClose: 3000,
              })
              .subscribe();
          } else {
            this.alerts
              .open(res.message ?? 'Có lỗi xảy ra', { appearance: 'negative', autoClose: 3000 })
              .subscribe();
          }
        },
        error: () => {
          this.saving.set(false);
          this.alerts
            .open('Không thể kết nối máy chủ', { appearance: 'negative', autoClose: 3000 })
            .subscribe();
        },
      });
  }

  clearCache(): void {
    this.rolePermExtras.clearPermissionCache().subscribe({
      next: (res) => {
        if (res.status) {
          this.alerts
            .open('Đã xóa cache phân quyền toàn hệ thống', {
              appearance: 'positive',
              autoClose: 3000,
            })
            .subscribe();
        } else {
          this.alerts
            .open(res.message ?? 'Có lỗi xảy ra', { appearance: 'negative', autoClose: 3000 })
            .subscribe();
        }
      },
      error: () =>
        this.alerts
          .open('Không thể kết nối máy chủ', { appearance: 'negative', autoClose: 3000 })
          .subscribe(),
    });
  }

  badge(role: string) {
    return ROLE_BADGE[role] ?? { cls: '', label: role, desc: '' };
  }

  resourceLabel(resource: string): string {
    return RESOURCE_LABELS[resource] ?? resource;
  }

  bannerClass() {
    const map: Record<string, string> = {
      ADMIN: 'border-gray-300 bg-gray-900 text-white',
      REGIONAL_MANAGER: 'border-purple-200 bg-purple-50 text-purple-800',
      STORE_MANAGER: 'border-yellow-200 bg-yellow-50 text-yellow-800',
      STAFF: 'border-gray-200 bg-gray-50 text-gray-600',
    };
    return map[this.selectedRole()] ?? '';
  }

  // ── Private ────────────────────────────────────────────

  private loadAllPermissions(): void {
    this.rolePermProvider.apiRolePermissionGetAllPermissionsGet().subscribe({
      next: (res) => {
        if (res.status && res.data) {
          this.allPermissions.set(res.data as PermissionItem[]);
        }
      },
    });
  }

  private loadRolePermissions(roleCode: string): void {
    this.loading.set(true);
    this.rolePermProvider
      .apiRolePermissionGetPermissionsByRolePost({ body: JSON.stringify(roleCode) })
      .subscribe({
        next: (res) => {
          const perms = res.status && res.data ? (res.data as PermissionItem[]) : [];
          const ids = perms.map((p) => p.permissionId);
          this.checkedIds.set(ids);
          this.originalIds = new Set(ids);
          this.loading.set(false);
        },
        error: () => {
          this.checkedIds.set([]);
          this.originalIds = new Set();
          this.loading.set(false);
        },
      });
  }
}
