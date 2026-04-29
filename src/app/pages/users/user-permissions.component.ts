import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TuiAlertService,
  TuiButton,
  TuiDataList,
  TuiIcon,
  TuiTextfield,
  tuiDialog,
} from '@taiga-ui/core';
import { TuiChevron, TuiComboBox, TuiDataListWrapper } from '@taiga-ui/kit';
import { TuiStringMatcher, TuiStringHandler } from '@taiga-ui/cdk';

import { AppUserProvider } from '../../api/api/app-user.service';
import { SearchAppUserRequest } from '../../api/model/search-app-user-request';
import { DataTableComponent, ColumnDef } from '../../shared/components/data-table/data-table.component';
import { ReferenceDataService } from '../../services/reference-data.service';
import { ROLE_LABELS } from './user-form-dialog.component';
import {
  UserPermissionEditDialogComponent,
  UserPermissionEditData,
} from './user-permission-edit-dialog.component';
import type { AppUser } from './users.component';

const ROLE_BADGE_CLASSES: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700 border border-purple-200',
  STORE_MANAGER: 'bg-blue-50 text-blue-700 border border-blue-200',
  STAFF: 'bg-gray-100 text-gray-600 border border-gray-200',
};

@Component({
  selector: 'app-user-permissions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TuiButton,
    TuiDataList,
    TuiIcon,
    TuiTextfield,
    TuiChevron,
    TuiComboBox,
    TuiDataListWrapper,
    DataTableComponent,
  ],
  templateUrl: './user-permissions.component.html',
})
export class UserPermissionsComponent implements OnInit {
  private readonly injector = inject(Injector);
  private readonly userProvider = inject(AppUserProvider);
  private readonly refData = inject(ReferenceDataService);
  private readonly alerts = inject(TuiAlertService);

  users = signal<AppUser[]>([]);
  loading = signal(false);
  totalCount = signal(0);

  keyword = signal('');
  filterRole = signal<string | null>(null);
  page = 0;
  size = 15;

  readonly storeList = this.refData.storeList;

  readonly allRoles = ['ADMIN', 'STORE_MANAGER', 'STAFF'];

  readonly tableColumns: ColumnDef[] = [
    { key: 'name', label: 'Họ tên' },
    { key: 'username', label: 'Tài khoản' },
    { key: 'role', label: 'Vai trò', align: 'center' },
    { key: 'branch', label: 'Chi nhánh' },
    { key: 'status', label: 'Trạng thái', align: 'center' },
  ];

  /** Type-safe cast */
  asUser(item: unknown): AppUser { return item as AppUser; }

  getRoleLabel(code: string): string { return ROLE_LABELS[code] ?? code; }
  getRoleBadgeClass(code: string): string { return ROLE_BADGE_CLASSES[code] ?? ROLE_BADGE_CLASSES['STAFF']; }

  readonly roleStringify: TuiStringHandler<string | null> = (code) =>
    code ? (ROLE_LABELS[code] ?? code) : 'Tất cả vai trò';
  protected readonly matcherRole: TuiStringMatcher<string | null> = (id, query) => {
    if (!id) return 'tất cả'.includes(query.toLowerCase());
    const label = ROLE_LABELS[id] ?? id;
    return String(id) === query || label.toLowerCase().includes(query.toLowerCase());
  };

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

  onRoleFilterChange(role: string | null): void {
    this.filterRole.set(role);
    this.page = 0;
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    const request: SearchAppUserRequest = {
      keyword: this.keyword() || null,
      pageIndex: this.page + 1,
      pageSize: this.size,
    };

    this.userProvider.apiAppUserSearchPost({ searchAppUserRequest: request }).subscribe({
      next: (result) => {
        const data = result.data as {
          items?: unknown[];
          data?: unknown[];
          totalCount?: number;
        } | null;

        let items: AppUser[] = (
          Array.isArray(data?.items) ? data!.items :
          Array.isArray(data?.data) ? data!.data :
          []
        ).map((raw: any) => ({
          userId: raw.userId ?? '',
          username: raw.username ?? '',
          fullName: raw.fullName ?? '',
          email: raw.email ?? null,
          phone: raw.phone ?? null,
          roleCode: raw.roleCode ?? 'STAFF',
          storeId: raw.storeId ?? null,
          storeName: raw.storeName ?? null,
          isActive: raw.isActive ?? true,
        })).filter((u: AppUser) => u.userId);

        // Lọc theo vai trò nếu có
        if (this.filterRole()) {
          items = items.filter(u => u.roleCode === this.filterRole());
        }

        this.users.set(items);
        const total = typeof data?.totalCount === 'number' ? data.totalCount :
                      typeof (data as any)?.total === 'number' ? (data as any).total :
                      typeof (data as any)?.totalRecords === 'number' ? (data as any).totalRecords :
                      items.length;
        this.totalCount.set(total);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.alerts.open('Không thể tải danh sách người dùng', { appearance: 'negative', autoClose: 3000 }).subscribe();
      },
    });
  }

  openEditDialog(user: AppUser): void {
    const data: UserPermissionEditData = {
      user,
      storeList: this.storeList(),
    };

    tuiDialog(UserPermissionEditDialogComponent, {
      injector: this.injector,
      label: 'Phân Quyền: ' + user.fullName,
      size: 'm',
    })(data).subscribe(() => this.loadUsers());
  }
}
