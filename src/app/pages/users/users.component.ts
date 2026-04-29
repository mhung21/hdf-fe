import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  OnInit,
  Injector,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  TuiAlertService,
  TuiButton,
  TuiHint,
  TuiIcon,
  tuiDialog,
} from '@taiga-ui/core';

import { AppUserProvider } from '../../api/api/app-user.service';
import { CUAppUserModel } from '../../api/model/cu-app-user-model';
import { SearchAppUserRequest } from '../../api/model/search-app-user-request';
import { RoleCode } from '../../models/role.model';
import { AuthService } from '../../services/auth.service';
import { ReferenceDataService } from '../../services/reference-data.service';
import { DataTableComponent, ColumnDef } from '../../shared/components/data-table/data-table.component';
import { ROLE_LABELS, UserFormDialogComponent } from './user-form-dialog.component';
import { AssignCustomRolesDialogComponent } from './assign-custom-roles-dialog.component';

export interface AppUser {
  userId: string;
  username: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  roleCode: string;
  storeId?: string | null;
  storeIds?: string[] | null;
  storeName?: string | null;
  isActive: boolean;
}

@Component({
  selector: 'app-users',
  imports: [
    CommonModule,
    TuiButton,
    TuiHint,
    TuiIcon,
    DataTableComponent,
  ],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersComponent implements OnInit {
  private readonly injector = inject(Injector);
  private readonly userProvider = inject(AppUserProvider);
  private readonly authService = inject(AuthService);
  private readonly refData = inject(ReferenceDataService);
  private readonly alerts = inject(TuiAlertService);

  // ─── State ────────────────────────────────────────────────
  users = signal<AppUser[]>([]);
  readonly storeList = this.refData.storeList;
  loading = signal(false);
  totalCount = signal(0);
  page = 0;
  size = 10;

  readonly tableColumns: ColumnDef[] = [
    { key: 'name', label: 'Họ tên' },
    { key: 'username', label: 'Tài khoản' },
    { key: 'role', label: 'Vai trò' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Số điện thoại' },
    { key: 'status', label: 'Trạng thái', align: 'center' },
  ];

  /** Type-safe cast for row template context */
  asUser(item: unknown): AppUser { return item as AppUser; }

  // Search
  keyword = signal('');

  // Edition
  editingUser = signal<AppUser | null>(null);

  // ─── Permissions (computed from AuthService) ─────────────
  canCreate = computed(() => this.authService.hasAnyRole([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER]));
  canEdit = computed(() => this.authService.hasAnyRole([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER]));
  canToggleStatus = computed(() => this.authService.hasRole(RoleCode.ADMIN));
  isAdmin = computed(() => this.authService.hasRole(RoleCode.ADMIN));
  /** Nhân viên chỉ được thấy profile của chính mình */
  isStaff = computed(() => this.authService.hasRole(RoleCode.STAFF));

  availableRoles = computed(() =>
    this.authService.hasRole(RoleCode.ADMIN)
      ? ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER', 'STAFF']
      : ['STAFF']
  );

  ngOnInit(): void {
    this.loadUsers();
  }

  onKeywordChange(value: string): void {
    this.keyword.set(value);
    this.page = 0;
    this.loadUsers();
  }

  onPaginationChange(event: { page: number; size: number }): void {
    this.page = event.page;
    this.size = event.size;
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);

    const req: SearchAppUserRequest = {
      keyword: this.keyword() || null,
      pageIndex: this.page + 1,
      pageSize: this.size,
      sortBy: 'Username',
      sortDesc: false,
    };

    this.userProvider.apiAppUserSearchPost({ searchAppUserRequest: req }).subscribe({
      next: result => {
        if (result.status && result.data) {
          const data = result.data as any;
          let items: AppUser[] = data?.items ?? data?.data ?? (Array.isArray(result.data) ? result.data : []);
          // Nhân viên chỉ xem được thông tin của chính mình
          if (this.isStaff()) {
            const currentUserId = this.authService.currentUser()?.userId;
            items = items.filter(u => u.userId === currentUserId);
          }
          this.users.set(items);
          const total = typeof data?.totalCount === 'number' ? data.totalCount :
                        typeof data?.total === 'number' ? data.total :
                        typeof data?.totalRecords === 'number' ? data.totalRecords :
                        items.length;
          this.totalCount.set(this.isStaff() ? items.length : total);
        } else {
          this.users.set([]);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showAlert('Không thể tải danh sách người dùng', 'error');
      },
    });
  }

  openCreateDialog(): void {
    tuiDialog(UserFormDialogComponent, {
      injector: this.injector,
      label: 'Thêm Người Dùng',
      size: 'l',
    })({
      user: null,
      availableRoles: this.availableRoles(),
      storeList: this.storeList(),
      isAdmin: this.isAdmin(),
      currentStoreId: this.authService.currentUser()?.storeId ?? null,
    }).subscribe(() => this.loadUsers());
  }

  openEditDialog(user: AppUser): void {
    tuiDialog(UserFormDialogComponent, {
      injector: this.injector,
      label: 'Chỉnh Sửa Người Dùng',
      size: 'm',
    })({
      user,
      availableRoles: this.availableRoles(),
      storeList: this.storeList(),
      isAdmin: this.isAdmin(),
      currentStoreId: this.authService.currentUser()?.storeId ?? null,
    }).subscribe(() => this.loadUsers());
  }

  openAssignRolesDialog(user: AppUser): void {
    tuiDialog(AssignCustomRolesDialogComponent, {
      injector: this.injector,
      label: `Cấp vai trò bổ sung — ${user.fullName}`,
      size: 'm',
    })({ user }).subscribe();
  }

  toggleStatus(user: AppUser): void {
    const action = user.isActive ? 'vô hiệu hóa' : 'kích hoạt';
    const model: CUAppUserModel = {
      userId: user.userId,
      username: user.username,
      fullName: user.fullName,
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
      roleCode: user.roleCode,
      storeId: user.storeId ?? undefined,
      isActive: !user.isActive,
    };

    this.userProvider.apiAppUserSavePost({ cUAppUserModel: model }).subscribe({
      next: result => {
        if (result.status) {
          this.showAlert(`Đã ${action} tài khoản ${user.username}`, 'success');
          this.loadUsers();
        } else {
          this.showAlert(result.message ?? 'Có lỗi xảy ra', 'error');
        }
      },
      error: () => this.showAlert('Có lỗi xảy ra', 'error'),
    });
  }

  getRoleLabel(code: string): string {
    return ROLE_LABELS[code] ?? code;
  }

  getRoleBadgeClass(roleCode: string): string {
    switch (roleCode) {
      case 'ADMIN': return 'bg-black text-white';
      case 'REGIONAL_MANAGER': return 'bg-blue-100 text-blue-800 border border-blue-300';
      case 'STORE_MANAGER': return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
      default: return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  }


  private showAlert(message: string, type: 'success' | 'error'): void {
    this.alerts
      .open(message, { appearance: type === 'success' ? 'positive' : 'negative', autoClose: 3000 })
      .subscribe();
  }
}
