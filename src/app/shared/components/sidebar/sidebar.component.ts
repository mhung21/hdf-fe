import { Component, signal, computed, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TuiIcon } from '@taiga-ui/core';
import { TuiDrawer } from '@taiga-ui/kit';
import { TuiPopup } from '@taiga-ui/core';
import { MenuItem } from '../../../models/dashboard/dashboard.model';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, TuiIcon],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.less'],
})
export class SidebarComponent {
  isCollapsed = model<boolean>(false);
  open = signal(false);

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  // Current user từ AuthService
  currentUser = computed(() => this.authService.currentUser());

  // Menu items với phân quyền theo role
  menuItems = signal<MenuItem[]>([
    {
      label: 'Tổng Quan',
      icon: '@tui.chart-bar',
      route: '/dashboard',
      roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER', 'STAFF'],
    },
    {
      label: 'Khách Hàng',
      icon: '@tui.users',
      route: '/customers',
      roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER', 'STAFF'],
    },
    {
      label: 'Hợp Đồng',
      icon: '@tui.file-text',
      route: '/loans',
      roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER', 'STAFF'],
    },
    {
      label: 'Thu Chi',
      icon: '@tui.dollar-sign',
      route: '/vouchers',
      roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER', 'STAFF'],
    },
    {
      label: 'Nợ Xấu',
      icon: '@tui.alert-triangle',
      route: '/bad-debts',
      roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER', 'STAFF'],
    },
    {
      label: 'Báo Cáo',
      icon: '@tui.bar-chart-2',
      children: [
        {
          label: 'Báo Cáo Chi Nhánh',
          route: '/reports/store',
          roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER'],
        },
        { label: 'Báo Cáo Toàn Hệ Thống', route: '/reports/all', roles: ['ADMIN'] },
        {
          label: 'Báo Cáo Tài Chính',
          route: '/reports/financial',
          roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER'],
        },
        {
          label: 'Nợ & Rủi Ro',
          route: '/reports/risk',
          roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER', 'STAFF'],
        },
        {
          label: 'Khách Hàng',
          route: '/reports/customers',
          roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER', 'STAFF'],
        },
        {
          label: 'KPI Nhân Viên',
          route: '/reports/employees',
          roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER'],
        },
        {
          label: 'Tài Sản Đảm Bảo',
          route: '/reports/collaterals',
          roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER'],
        },
        {
          label: 'Hoa Hồng CTV',
          route: '/reports/commission',
          roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER'],
        },
      ],
      roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER', 'STAFF'],
    },
    {
      label: 'Quản Lý Chi Nhánh',
      icon: '@tui.home',
      children: [
        {
          label: 'Danh Sách Chi Nhánh',
          route: '/stores',
          roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER'],
        },
      ],
      roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER'],
    },
    {
      label: 'Người Dùng',
      icon: '@tui.user',
      children: [
        {
          label: 'Danh Sách Người Dùng',
          route: '/users',
          roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER'],
        },
        {
          label: 'Quản lý Vai trò',
          route: '/users/roles',
          roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER'],
        },
      ],
      roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER'],
    },
    {
      label: 'Cộng Tác Viên',
      icon: '@tui.handshake',
      route: '/collaborators',
      roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER'],
    },
    // {
    //   label: 'Nhật Ký',
    //   icon: '@tui.activity',
    //   children: [
    //     { label: 'Nhật Ký Hệ Thống', route: '/audit-logs', roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER'] },
    //     { label: 'Lịch Sử Đăng Nhập', route: '/login-history', roles: ['ADMIN'] }
    //   ],
    //   roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER']
    // },
    {
      label: 'Cấu Hình',
      icon: '@tui.settings',
      children: [
        { label: 'Chính Sách', route: '/policies', roles: ['ADMIN'] },
        {
          label: 'Sản Phẩm',
          route: '/loan-products',
          roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER'],
        },
        {
          label: 'Luồng Khách',
          route: '/customer-sources',
          roles: ['ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER'],
        },
      ],
      roles: ['ADMIN'],
    },
  ]);

  // Filter menu items theo quyền của user
  visibleMenuItems = computed(() => {
    const userRole = this.currentUser()?.role;
    if (!userRole) return [];

    return this.menuItems().filter((item) => this.hasAccess(item, userRole));
  });

  // Kiểm tra quyền truy cập menu
  hasAccess(item, userRole: string): boolean {
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.includes(userRole);
  }

  // Kiểm tra có ít nhất 1 menu con được phép truy cập
  hasAccessibleChildren(item, userRole: string): boolean {
    if (!item.children || item.children.length === 0) return false;
    return item.children.some((child) => this.hasAccess(child, userRole));
  }

  // Toggle submenu
  toggleSubmenu(item, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const hasChildren = item.children && item.children.length > 0;
    if (hasChildren) {
      // Toggle submenu logic (sẽ implement với signal)
      console.log('Toggle submenu:', item.label);
    } else if (item.route) {
      this.router.navigate([item.route]);
    }
  }

  // Navigate to route
  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  // Logout
  logout(): void {
    this.authService.logout();
  }
}
