import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiIcon } from '@taiga-ui/core';

import {
  DataTableComponent,
  ColumnDef,
} from '../../shared/components/data-table/data-table.component';
import {
  ActivityLogItem,
  ActivityLogService,
} from '../../services/activity-log.service';

const MODULE_LABELS: Record<string, string> = {
  CUSTOMER: 'Khách hàng',
  LOAN_CONTRACT: 'Hợp đồng',
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
  ASSIGN: 'Chuyển giao',
  STATUS_CHANGE: 'Đổi trạng thái',
  VIEW: 'Xem chi tiết',
  SEARCH: 'Tìm kiếm',
  EXPORT: 'Xuất dữ liệu',
  IMPORT: 'Nhập dữ liệu',
};

@Component({
  selector: 'app-activity-logs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TuiButton, TuiIcon, DataTableComponent],
  templateUrl: './activity-logs.component.html',
})
export class ActivityLogsComponent implements OnInit {
  private readonly activityLogService = inject(ActivityLogService);

  logs = signal<ActivityLogItem[]>([]);
  loading = signal(false);
  totalCount = signal(0);

  page = 0;
  size = 20;
  keyword = signal('');
  sortBy = signal<string | null>('changedAtUtc');
  sortDesc = signal(true);

  selectedModule = signal<string | null>(null);
  selectedAction = signal<string | null>(null);

  readonly tableColumns: ColumnDef[] = [
    { key: 'time', label: 'Thời gian', sortKey: 'changedAtUtc', class: 'min-w-44' },
    { key: 'module', label: 'Module', sortKey: 'moduleCode', class: 'min-w-32' },
    { key: 'action', label: 'Hành động', sortKey: 'actionCode', class: 'min-w-36' },
    { key: 'actor', label: 'Người thao tác', sortKey: 'changedBy', class: 'min-w-40' },
    { key: 'summary', label: 'Mô tả', class: 'min-w-72' },
    { key: 'target', label: 'Đối tượng', class: 'min-w-40' },
  ];

  readonly moduleOptions = ['CUSTOMER', 'LOAN_CONTRACT'];
  readonly actionOptions = ['CREATE', 'UPDATE', 'ASSIGN', 'STATUS_CHANGE', 'VIEW', 'SEARCH'];

  hasFilter = computed(() => !!this.selectedModule() || !!this.selectedAction());

  ngOnInit(): void {
    this.loadLogs();
  }

  asLog(item: unknown): ActivityLogItem {
    return item as ActivityLogItem;
  }

  onKeywordChange(v: string): void {
    this.keyword.set(v);
    this.page = 0;
    this.loadLogs();
  }

  onPaginationChange(e: { page: number; size: number }): void {
    this.page = e.page;
    this.size = e.size;
    this.loadLogs();
  }

  onSortChange(e: { sortBy: string | null; sortDesc: boolean }): void {
    this.sortBy.set(e.sortBy);
    this.sortDesc.set(e.sortDesc);
    this.page = 0;
    this.loadLogs();
  }

  setModule(code: string | null): void {
    this.selectedModule.set(code);
    this.page = 0;
    this.loadLogs();
  }

  setAction(code: string | null): void {
    this.selectedAction.set(code);
    this.page = 0;
    this.loadLogs();
  }

  clearFilters(): void {
    this.selectedModule.set(null);
    this.selectedAction.set(null);
    this.page = 0;
    this.loadLogs();
  }

  loadLogs(): void {
    this.loading.set(true);

    this.activityLogService
      .search({
        keyword: this.keyword() || null,
        pageIndex: this.page + 1,
        pageSize: this.size,
        sortBy: this.sortBy(),
        sortDesc: this.sortDesc(),
        moduleCodes: this.selectedModule() ? [this.selectedModule()!] : null,
        actionCodes: this.selectedAction() ? [this.selectedAction()!] : null,
      })
      .subscribe({
        next: (res) => {
          this.logs.set(res.items ?? []);
          this.totalCount.set(res.totalCount ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.logs.set([]);
          this.totalCount.set(0);
          this.loading.set(false);
        },
      });
  }

  moduleLabel(code?: string | null): string {
    if (!code) return '-';
    return MODULE_LABELS[code] ?? code;
  }

  actionLabel(code?: string | null): string {
    if (!code) return '-';
    return ACTION_LABELS[code] ?? code;
  }

  actionBadgeClass(code?: string | null): string {
    switch (code) {
      case 'CREATE':
        return 'bg-green-50 text-green-700 border border-green-200';
      case 'UPDATE':
      case 'STATUS_CHANGE':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'ASSIGN':
        return 'bg-sky-50 text-sky-700 border border-sky-200';
      case 'VIEW':
      case 'SEARCH':
        return 'bg-zinc-100 text-zinc-700 border border-zinc-200';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  }
}
