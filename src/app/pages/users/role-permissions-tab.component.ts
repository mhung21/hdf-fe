import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  TuiAlertService,
  TuiButton,
  TuiDataList,
  TuiIcon,
  TuiTextfield,
  TuiTitle,
  tuiDialog,
} from '@taiga-ui/core';
import { TuiBadge, TuiChevron, TuiComboBox, TuiDataListWrapper } from '@taiga-ui/kit';
import { TuiCard, TuiHeader } from '@taiga-ui/layout';
import { TuiStringMatcher, TuiStringHandler } from '@taiga-ui/cdk';

import { RolePermissionProvider } from '../../api/api/role-permission.service';
import { CustomRoleService, CustomRoleDto } from '../../api/api/custom-role.extras';
import { AuthService } from '../../services/auth.service';
import { RoleCode } from '../../models/role.model';
import { ROLE_LABELS } from './user-form-dialog.component';
import { RoleDefaultPermissionsDialogComponent } from './role-default-permissions-dialog.component';
import { CustomRoleFormDialogComponent } from './custom-role-form-dialog.component';
import { CustomRolePermissionsDialogComponent } from './custom-role-permissions-dialog.component';

export interface PermissionModel {
  permissionId: string;
  permissionCode: string;
  permissionName: string;
  resource: string;
  action: string;
  description?: string | null;
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: 'Quản trị viên hệ thống - Toàn quyền truy cập tất cả tính năng',
  STORE_MANAGER: 'Quản lý chi nhánh - Quản lý hoạt động chi nhánh, báo cáo, duyệt hợp đồng',
  STAFF: 'Nhân viên - Nhập liệu cơ bản, xem dữ liệu (không được edit/delete)',
};
export { ROLE_DESCRIPTIONS };

@Component({
  selector: 'app-role-permissions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiBadge,
    TuiButton,
    TuiCard,
    TuiDataList,
    TuiDataListWrapper,
    TuiHeader,
    TuiIcon,
    TuiTextfield,
    TuiTitle,
  ],
  templateUrl: './role-permissions-tab.component.html',
  styleUrls: ['./role-permissions-tab.component.less'],
})
export class RolePermissionsTabComponent implements OnInit {
  private readonly injector = inject(Injector);
  private readonly rolePermissionProvider = inject(RolePermissionProvider);
  private readonly customRoleProvider = inject(CustomRoleService);
  private readonly authService = inject(AuthService);
  private readonly alerts = inject(TuiAlertService);

  readonly ROLE_LABELS = ROLE_LABELS;
  readonly ROLE_DESCRIPTIONS = ROLE_DESCRIPTIONS;
  readonly availableRoles = ['ADMIN', 'STORE_MANAGER', 'STAFF'] as const;

  // ── Permissions (built-in role viewer) ────────────────
  readonly roleControl = new FormControl<string | null>('ADMIN');
  selectedRole = signal<string | null>('ADMIN');
  permissions = signal<PermissionModel[]>([]);
  loading = signal(false);

  // ── Custom roles list ──────────────────────────────────
  customRoles = signal<CustomRoleDto[]>([]);
  customRolesLoading = signal(false);

  readonly isAdmin = computed(() => this.authService.hasRole(RoleCode.ADMIN));
  readonly isStoreManager = computed(() => this.authService.hasRole(RoleCode.STORE_MANAGER));

  /** Admin: quản lý tất cả. StoreManager: chỉ quản lý role của store mình. */
  readonly canManage = computed(() => this.isAdmin() || this.isStoreManager());

  readonly roleStringify: TuiStringHandler<string | null> = (code) =>
    code ? (ROLE_LABELS[code] ?? code) : '';

  protected readonly matcherRole: TuiStringMatcher<string | null> = (id, query) => {
    if (!id) return false;
    const label = ROLE_LABELS[id] ?? id;
    return String(id) === query || label.toLowerCase().includes(query.toLowerCase());
  };

  readonly groupedPermissions = computed(() => {
    const groups: Record<string, PermissionModel[]> = {};
    for (const perm of this.permissions()) {
      if (!groups[perm.resource]) groups[perm.resource] = [];
      groups[perm.resource].push(perm);
    }
    return Object.entries(groups)
      .map(([resource, permissions]) => ({ resource, permissions }))
      .sort((a, b) => a.resource.localeCompare(b.resource));
  });

  ngOnInit(): void {
    this.loadPermissions('ADMIN');
    this.loadCustomRoles();
  }

  constructor() {
    this.roleControl.valueChanges.subscribe((roleCode) => this.onRoleChange(roleCode));
  }

  onRoleChange(roleCode: string | null): void {
    this.selectedRole.set(roleCode);
    if (!roleCode) {
      this.permissions.set([]);
      return;
    }
    this.loadPermissions(roleCode);
  }

  private loadPermissions(roleCode: string): void {
    this.loading.set(true);
    this.rolePermissionProvider
      .apiRolePermissionGetPermissionsByRolePost({ body: JSON.stringify(roleCode) })
      .subscribe({
        next: (response) => {
          this.permissions.set(
            response.status && response.data ? (response.data as PermissionModel[]) : [],
          );
          this.loading.set(false);
        },
        error: () => {
          this.permissions.set([]);
          this.loading.set(false);
        },
      });
  }

  loadCustomRoles(): void {
    this.customRolesLoading.set(true);
    this.customRoleProvider.getAll().subscribe({
      next: (res) => {
        this.customRoles.set(res.status && res.data ? (res.data as CustomRoleDto[]) : []);
        this.customRolesLoading.set(false);
      },
      error: () => this.customRolesLoading.set(false),
    });
  }

  // ── Dialogs ────────────────────────────────────────────

  openDefaultPermissionsDialog(): void {
    tuiDialog(RoleDefaultPermissionsDialogComponent, {
      injector: this.injector,
      label: 'Quyền mặc định theo vai trò hệ thống',
      size: 'm',
    })({} as unknown as void).subscribe();
  }

  /** Mở dialog tạo vai trò mới — đã tích hợp chọn quyền */
  openAddRoleDialog(): void {
    tuiDialog(CustomRoleFormDialogComponent, {
      injector: this.injector,
      label: 'Thêm vai trò bổ sung',
      size: 'l',
    })({ role: null }).subscribe((saved) => {
      if (saved) this.loadCustomRoles();
    });
  }

  /** Mở dialog chỉnh sửa vai trò — đã tích hợp chọn quyền */
  openEditRoleDialog(role: CustomRoleDto): void {
    tuiDialog(CustomRoleFormDialogComponent, {
      injector: this.injector,
      label: `Chỉnh sửa vai trò: ${role.roleName}`,
      size: 'l',
    })({ role }).subscribe((saved) => {
      if (saved) this.loadCustomRoles();
    });
  }

  /** Mở dialog quản lý quyền (nhanh, không thay đổi thông tin role) */
  openManagePermissionsDialog(role: CustomRoleDto): void {
    tuiDialog(CustomRolePermissionsDialogComponent, {
      injector: this.injector,
      label: `Quản lý quyền: ${role.roleName}`,
      size: 'l',
    })({ role }).subscribe((saved) => {
      if (saved) this.loadCustomRoles();
    });
  }

  /** Kiểm tra xem user hiện tại có thể sửa role này không */
  canEditRole(role: CustomRoleDto): boolean {
    if (this.isAdmin()) return true;
    // StoreManager chỉ sửa được role của store mình (storeId != null)
    if (this.isStoreManager()) return role.storeId != null;
    return false;
  }

  toggleRoleActive(role: CustomRoleDto): void {
    const model = {
      customRoleId: role.customRoleId,
      roleName: role.roleName,
      description: role.description,
      isActive: !role.isActive,
    };
    this.customRoleProvider.save(model).subscribe({
      next: (res) => {
        if (res.status) {
          this.alerts
            .open(role.isActive ? 'Đã vô hiệu hóa vai trò' : 'Đã kích hoạt vai trò', {
              appearance: 'positive',
              autoClose: 2000,
            })
            .subscribe();
          this.loadCustomRoles();
        } else {
          this.alerts.open(res.message ?? 'Có lỗi xảy ra', { appearance: 'negative' }).subscribe();
        }
      },
      error: () =>
        this.alerts.open('Không thể kết nối máy chủ', { appearance: 'negative' }).subscribe(),
    });
  }
}
