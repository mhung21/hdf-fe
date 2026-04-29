import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiButton, TuiDialogContext, TuiIcon } from '@taiga-ui/core';
import { TuiTabs } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';

// ── Kiểu dữ liệu ──────────────────────────────────────────────────────────────
interface CapItem {
  label: string;
  note?: string; // ghi chú thêm (VD: "chỉ DRAFT", "chỉ chi nhánh mình")
}

interface CapGroup {
  icon: string;
  label: string; // tên nhóm chức năng
  allowed: CapItem[]; // danh sách được làm
  denied?: string[]; // danh sách KHÔNG được làm (hiển thị xám có gạch đỏ)
}

// ── Dữ liệu hardcoded theo nghiệp vụ ──────────────────────────────────────────
const ROLE_CAP_GROUPS: Record<string, CapGroup[]> = {
  ADMIN: [
    {
      icon: '@tui.layout-dashboard',
      label: 'Tổng quan',
      allowed: [{ label: 'Xem dashboard toàn hệ thống' }],
    },
    {
      icon: '@tui.users',
      label: 'Khách hàng',
      allowed: [
        { label: 'Xem danh sách & chi tiết khách hàng' },
        { label: 'Thêm mới khách hàng' },
        { label: 'Sửa thông tin khách hàng' },
        { label: 'Sửa & xem lịch sử nợ xấu' },
      ],
    },
    {
      icon: '@tui.file-text',
      label: 'Hợp đồng',
      allowed: [
        { label: 'Xem tất cả hợp đồng' },
        { label: 'Tạo hợp đồng mới' },
        { label: 'Sửa hợp đồng DRAFT' },
        { label: 'Duyệt / Giải ngân hợp đồng' },
        { label: 'Hủy hợp đồng' },
        { label: 'Tất toán hợp đồng' },
        { label: 'Đóng hợp đồng đặc biệt' },
      ],
    },
    {
      icon: '@tui.receipt',
      label: 'Thu / Chi',
      allowed: [
        { label: 'Xem phiếu thu chi' },
        { label: 'Tạo phiếu thu / chi' },
        { label: 'Sửa phiếu thu chi' },
        { label: 'Duyệt phiếu thu chi' },
        { label: 'In phiếu thu chi' },
      ],
    },
    {
      icon: '@tui.alert-triangle',
      label: 'Nợ xấu',
      allowed: [
        { label: 'Xem hồ sơ nợ xấu' },
        { label: 'Chuyển hợp đồng vào nợ xấu' },
        { label: 'Ghi nhận thu hồi nợ xấu' },
        { label: 'Đóng hồ sơ nợ xấu' },
      ],
    },
    {
      icon: '@tui.store',
      label: 'Chi nhánh',
      allowed: [
        { label: 'Xem tất cả chi nhánh' },
        { label: 'Tạo chi nhánh mới' },
        { label: 'Sửa thông tin chi nhánh' },
      ],
    },
    {
      icon: '@tui.user-cog',
      label: 'Người dùng',
      allowed: [
        { label: 'Xem danh sách người dùng' },
        { label: 'Thêm người dùng' },
        { label: 'Sửa thông tin người dùng' },
        { label: 'Vô hiệu hóa tài khoản' },
        { label: 'Reset mật khẩu' },
      ],
    },
    {
      icon: '@tui.bar-chart-2',
      label: 'Báo cáo',
      allowed: [
        { label: 'Xem báo cáo tất cả chi nhánh' },
        { label: 'Xem báo cáo tài chính chi tiết' },
        { label: 'Xuất báo cáo Excel / PDF' },
      ],
    },
    {
      icon: '@tui.lock',
      label: 'Khóa ngày',
      allowed: [{ label: 'Xem trạng thái khóa ngày' }, { label: 'Khóa / mở khóa ngày làm việc' }],
    },
    {
      icon: '@tui.settings',
      label: 'Hệ thống',
      allowed: [
        { label: 'Cấu hình thiết lập hệ thống' },
        { label: 'Xem nhật ký thao tác (audit log)' },
      ],
    },
  ],

  STORE_MANAGER: [
    {
      icon: '@tui.layout-dashboard',
      label: 'Tổng quan',
      allowed: [{ label: 'Xem dashboard chi nhánh' }],
    },
    {
      icon: '@tui.users',
      label: 'Khách hàng',
      allowed: [
        { label: 'Xem danh sách & chi tiết khách hàng', note: 'chi nhánh mình' },
        { label: 'Thêm mới khách hàng' },
        { label: 'Sửa thông tin khách hàng' },
        { label: 'Xem & sửa lịch sử nợ xấu khách hàng' },
      ],
    },
    {
      icon: '@tui.file-text',
      label: 'Hợp đồng',
      allowed: [
        { label: 'Xem hợp đồng', note: 'chi nhánh mình' },
        { label: 'Tạo hợp đồng mới' },
        { label: 'Sửa hợp đồng DRAFT' },
        { label: 'Duyệt / Giải ngân hợp đồng' },
        { label: 'Hủy hợp đồng' },
        { label: 'Tất toán hợp đồng' },
      ],
      denied: ['Đóng hợp đồng đặc biệt (chỉ Admin)'],
    },
    {
      icon: '@tui.receipt',
      label: 'Thu / Chi',
      allowed: [
        { label: 'Xem phiếu thu chi' },
        { label: 'Tạo phiếu thu / chi cho chi nhánh' },
        { label: 'Sửa phiếu thu chi' },
        { label: 'Duyệt phiếu thu chi' },
        { label: 'In phiếu thu chi' },
      ],
    },
    {
      icon: '@tui.alert-triangle',
      label: 'Nợ xấu',
      allowed: [
        { label: 'Xem hồ sơ nợ xấu' },
        { label: 'Chuyển hợp đồng vào nợ xấu' },
        { label: 'Ghi nhận thu hồi nợ xấu' },
        { label: 'Đóng hồ sơ nợ xấu' },
      ],
    },
    {
      icon: '@tui.store',
      label: 'Chi nhánh',
      allowed: [
        { label: 'Xem thông tin chi nhánh' },
        { label: 'Sửa thông tin chi nhánh của mình' },
      ],
      denied: ['Tạo chi nhánh mới (chỉ Admin)'],
    },
    {
      icon: '@tui.user-cog',
      label: 'Người dùng',
      allowed: [
        { label: 'Xem danh sách người dùng', note: 'chi nhánh mình' },
        { label: 'Thêm người dùng vào chi nhánh' },
        { label: 'Sửa thông tin người dùng' },
        { label: 'Reset mật khẩu người dùng' },
      ],
      denied: ['Vô hiệu hóa tài khoản (chỉ Admin)'],
    },
    {
      icon: '@tui.bar-chart-2',
      label: 'Báo cáo',
      allowed: [
        { label: 'Xem báo cáo chi nhánh' },
        { label: 'Xem báo cáo tài chính chi nhánh' },
        { label: 'Xuất báo cáo Excel / PDF' },
      ],
      denied: ['Xem báo cáo tất cả chi nhánh (chỉ Admin)'],
    },
    {
      icon: '@tui.lock',
      label: 'Khóa ngày',
      allowed: [{ label: 'Xem trạng thái khóa ngày' }, { label: 'Khóa / mở khóa ngày làm việc' }],
    },
  ],

  STAFF: [
    {
      icon: '@tui.layout-dashboard',
      label: 'Tổng quan',
      allowed: [{ label: 'Xem dashboard chi nhánh' }],
    },
    {
      icon: '@tui.users',
      label: 'Khách hàng',
      allowed: [
        { label: 'Xem danh sách & chi tiết khách hàng', note: 'chi nhánh mình' },
        { label: 'Thêm mới khách hàng' },
        { label: 'Sửa thông tin khách hàng' },
      ],
      denied: ['Sửa / xem lịch sử nợ xấu khách hàng'],
    },
    {
      icon: '@tui.file-text',
      label: 'Hợp đồng',
      allowed: [
        { label: 'Xem hợp đồng', note: 'chi nhánh mình' },
        { label: 'Tạo hợp đồng mới (trạng thái DRAFT)' },
        { label: 'Sửa hợp đồng DRAFT' },
        { label: 'Gửi hợp đồng lên duyệt' },
        { label: 'Hủy hợp đồng', note: 'khi trạng thái còn DRAFT / PENDING / chưa giải ngân' },
      ],
      denied: ['Duyệt / Giải ngân hợp đồng (cần Quản lý)', 'Tất toán hợp đồng (cần Quản lý)'],
    },
    {
      icon: '@tui.receipt',
      label: 'Thu / Chi',
      allowed: [
        { label: 'Xem phiếu thu chi' },
        { label: 'Tạo phiếu thu / chi' },
        { label: 'In phiếu thu chi' },
      ],
      denied: ['Sửa phiếu thu chi (cần Quản lý)', 'Duyệt phiếu thu chi (cần Quản lý)'],
    },
    {
      icon: '@tui.alert-triangle',
      label: 'Nợ xấu',
      allowed: [{ label: 'Xem hồ sơ nợ xấu', note: 'chỉ đọc' }],
      denied: ['Chuyển hợp đồng vào nợ xấu', 'Ghi nhận thu hồi nợ xấu', 'Đóng hồ sơ nợ xấu'],
    },
    {
      icon: '@tui.store',
      label: 'Chi nhánh',
      allowed: [{ label: 'Xem thông tin chi nhánh', note: 'chỉ đọc' }],
      denied: ['Sửa thông tin chi nhánh'],
    },
    {
      icon: '@tui.user-cog',
      label: 'Người dùng',
      allowed: [{ label: 'Xem thông tin tài khoản của chính mình' }],
      denied: ['Xem danh sách toàn bộ người dùng', 'Thêm / sửa người dùng'],
    },
    {
      icon: '@tui.bar-chart-2',
      label: 'Báo cáo',
      allowed: [{ label: 'Xem báo cáo chi nhánh', note: 'hạn chế' }],
      denied: ['Xem báo cáo tài chính chi tiết', 'Xuất báo cáo'],
    },
    {
      icon: '@tui.lock',
      label: 'Khóa ngày',
      allowed: [{ label: 'Xem trạng thái khóa ngày', note: 'chỉ đọc' }],
      denied: ['Khóa / mở khóa ngày làm việc'],
    },
  ],
};

const ROLE_BADGE: Record<string, { cls: string; label: string; desc: string }> = {
  ADMIN: {
    cls: 'bg-black text-white',
    label: 'Quản trị viên',
    desc: 'Toàn quyền hệ thống — quản lý tất cả chi nhánh, người dùng và cấu hình.',
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
          <button tuiTab type="button" (click)="selectedRole.set(role)">
            {{ badge(role).label }}
          </button>
        }
      </tui-tabs>

      <!-- Role description banner -->
      <div class="flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5" [class]="bannerClass()">
        <tui-icon icon="@tui.info" class="mt-0.5 shrink-0 text-sm" />
        <p class="text-sm leading-relaxed">{{ badge(selectedRole()).desc }}</p>
      </div>

      <!-- Permission groups -->
      <div class="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        @for (group of currentGroups(); track group.label) {
          <div class="rounded-lg border border-gray-100 bg-white px-3.5 py-3">
            <!-- Group header -->
            <div class="mb-2 flex items-center gap-2">
              <tui-icon [icon]="group.icon" class="text-base text-primary" />
              <span class="text-sm font-semibold text-gray-800">{{ group.label }}</span>
            </div>
            <!-- Allowed -->
            <div class="space-y-1">
              @for (item of group.allowed; track item.label) {
                <div class="flex items-start gap-2 text-sm">
                  <span class="mt-0.5 shrink-0 text-green-500">✓</span>
                  <span class="text-gray-700">
                    {{ item.label }}
                    @if (item.note) {
                      <span class="ml-1 text-xs text-gray-400">({{ item.note }})</span>
                    }
                  </span>
                </div>
              }
              <!-- Denied -->
              @for (label of group.denied ?? []; track label) {
                <div class="flex items-start gap-2 text-sm">
                  <span class="mt-0.5 shrink-0 text-red-400">✗</span>
                  <span class="text-gray-400 line-through">{{ label }}</span>
                </div>
              }
            </div>
          </div>
        }
      </div>

      <div class="flex justify-end border-t border-gray-100 pt-3">
        <button tuiButton appearance="outline" size="m" (click)="context.completeWith()">
          Đóng
        </button>
      </div>
    </div>
  `,
})
export class RoleDefaultPermissionsDialogComponent {
  readonly context = injectContext<TuiDialogContext<void, void>>();

  readonly roles = ['ADMIN', 'STORE_MANAGER', 'STAFF'] as const;
  readonly selectedRole = signal<string>('ADMIN');

  readonly currentGroups = computed(() => ROLE_CAP_GROUPS[this.selectedRole()] ?? []);

  badge(role: string) {
    return ROLE_BADGE[role] ?? { cls: '', label: role, desc: '' };
  }

  bannerClass() {
    const map: Record<string, string> = {
      ADMIN: 'border-gray-300 bg-gray-900 text-white',
      STORE_MANAGER: 'border-yellow-200 bg-yellow-50 text-yellow-800',
      STAFF: 'border-gray-200 bg-gray-50 text-gray-600',
    };
    return map[this.selectedRole()] ?? '';
  }
}
