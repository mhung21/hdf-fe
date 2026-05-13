import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiAnimated } from '@taiga-ui/cdk';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { TuiIcon } from '@taiga-ui/core';
import { TuiBadgeNotification } from '@taiga-ui/kit';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { AuthService } from '../../../services/auth.service';

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Tổng Quan',
  '/users': 'Quản Lý Người Dùng',
  '/stores': 'Danh sách chi nhánh',
  '/customers': 'Danh Sách Khách Hàng',
  '/customers/bad-history': 'Lịch Sử Nợ Xấu',
  '/loans': 'Danh Sách Hợp Đồng',
  '/vouchers': 'Phiếu Thu Chi',
  '/collections': 'Thu Hồi Nợ',
  '/bad-debts': 'Danh Sách Nợ Xấu',
  '/bad-debts/transfer': 'Chuyển Nợ Xấu',
  '/bad-debts/recovery': 'Thu Hồi Nợ Xấu',
  '/reports/store': 'Báo Cáo Chi Nhánh',
  '/reports/all': 'Báo Cáo Toàn Hệ Thống',
  '/reports/financial': 'Báo Cáo Tài Chính',
  '/reports/risk': 'Báo Cáo Nợ/Rủi Ro',
  '/reports/customers': 'Báo Cáo Khách Hàng',
  '/reports/commission': 'Hoa Hồng Cộng Tác Viên',
  '/reports/export': 'Xuất Báo Cáo',
  '/day-locks': 'Khóa Ngày',
  '/users/roles': 'Quản lý Vai trò',
  '/logs': 'Nhật Ký Hoạt Động',
  '/settings': 'Cài Đặt',
  '/settings/system': 'Cài Đặt Hệ Thống',
  '/settings/interest': 'Cài Đặt Lãi Suất',
  '/loan-products': 'Sản Phẩm',
  '/policies': 'Chính Sách',
  '/activity-logs': 'Nhật Ký Hoạt Động',
};

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TuiIcon,
    TuiBadgeNotification,
    SidebarComponent,
    TuiAnimated,
  ],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.less'],
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  isSidebarCollapsed = signal(false);
  isMobileMenuOpen = signal(false);
  notificationDropdownOpen = signal(false);
  profileDropdownOpen = signal(false);
  private currentPath = signal('');
  readonly today = new Date();
  currentUser = computed(() => this.authService.currentUser());

  currentPageTitle = computed(() => {
    const path = this.currentPath();
    // const role = this.currentUser()?.role;
    // if (path === '/dashboard') {
    //   if (role === 'ADMIN') return 'Tổng Quan Hệ Thống';
    //   if (role === 'STORE_MANAGER') return 'Tổng Quan Chi Nhánh';
    //   return 'Tổng Quan';
    // }
    return ROUTE_TITLES[path] ?? 'Trang Chủ';
  });

  isDashboard = computed(() => this.currentPath() === '/dashboard');

  roleTitleBadge = computed(() => {
    if (!this.isDashboard()) return null;
    const role = this.currentUser()?.role;
    if (role === 'ADMIN') return { label: 'Quản Trị', cls: 'bg-green-100 text-green-800' };
    if (role === 'REGIONAL_MANAGER')
      return { label: 'Q. Lý Vùng', cls: 'bg-blue-100 text-blue-800' };
    if (role === 'STORE_MANAGER') return { label: 'Quản Lý', cls: 'bg-teal-100 text-teal-800' };
    return { label: 'Nhân Viên', cls: 'bg-gray-100 text-gray-600' };
  });

  constructor() {
    this.updateTitle(this.router.url);
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => this.updateTitle((e as NavigationEnd).urlAfterRedirects));
  }

  private updateTitle(url: string): void {
    this.currentPath.set(url.split('?')[0]);
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed.update((v) => !v);
  }
  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((v) => !v);
  }
  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  toggleNotificationDropdown(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.profileDropdownOpen.set(false);
    this.notificationDropdownOpen.update((v) => !v);
  }

  closeNotificationDropdown(): void {
    this.notificationDropdownOpen.set(false);
  }

  toggleProfileDropdown(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.notificationDropdownOpen.set(false);
    this.profileDropdownOpen.update((v) => !v);
  }

  closeProfileDropdown(): void {
    this.profileDropdownOpen.set(false);
  }

  logout(): void {
    this.profileDropdownOpen.set(false);
    this.authService.logout();
  }

  getRoleLabel(role: string): string {
    const map: Record<string, string> = {
      ADMIN: 'Quản Trị',
      REGIONAL_MANAGER: 'Quản lý vùng',
      STORE_MANAGER: 'Quản lý chi nhánh',
      STAFF: 'Nhân viên',
    };
    return map[role] ?? role;
  }

  getRoleCls(role: string): string {
    const map: Record<string, string> = {
      ADMIN: 'text-green-700',
      REGIONAL_MANAGER: 'text-blue-600',
      STORE_MANAGER: 'text-teal-600',
      STAFF: 'text-blue-600',
    };
    return map[role] ?? 'text-zinc-500';
  }

  ngOnInit(): void {
    document.addEventListener('click', this.onDocumentClick.bind(this));
  }
  ngOnDestroy(): void {
    document.removeEventListener('click', this.onDocumentClick.bind(this));
  }

  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;
    if (this.notificationDropdownOpen()) {
      const el = document.querySelector('#notif-dropdown-wrap');
      if (!el?.contains(target)) this.closeNotificationDropdown();
    }
    if (this.profileDropdownOpen()) {
      const el = document.querySelector('#profile-dropdown-wrap');
      if (!el?.contains(target)) this.closeProfileDropdown();
    }
  }
}
