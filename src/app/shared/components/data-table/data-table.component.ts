import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  TemplateRef,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { TuiButton, TuiHint, TuiIcon, TuiTextfield } from '@taiga-ui/core';
import { TuiTablePagination } from '@taiga-ui/addon-table';

import { ColumnToggleComponent, ColumnDef } from '../column-toggle/column-toggle.component';

export type { ColumnDef };

/**
 * Generic data list table with search toolbar, column visibility toggle,
 * loading/empty states, and pagination.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    FormsModule,
    TuiButton,
    TuiHint,
    TuiIcon,
    TuiTextfield,
    TuiTablePagination,
    ColumnToggleComponent,
  ],
  template: `
    <div class="space-y-3">

      <!-- ─── Toolbar ──────────────────────────────────────────── -->
      <div class="flex flex-wrap items-center gap-2 p-2.5 bg-white border border-gray-200 shadow-sm rounded-xl">
        <!-- Left toolbar slot (e.g. for filters next to search) -->
        <ng-content select="[leftToolbar]" />

        <tui-textfield class="flex-1 min-w-40 max-w-xs">
          <input
            tuiTextfield
            [placeholder]="searchPlaceholder()"
            [ngModel]="localKeyword()"
            (ngModelChange)="onKeywordInput($event)"
          />
          <tui-icon icon="@tui.search" />
        </tui-textfield>

        <div class="flex items-center gap-1.5 ml-auto">
          <app-column-toggle
            [columns]="columns()"
            [hiddenColumns]="hiddenColumns()"
            (hiddenColumnsChange)="hiddenColumns.set($event)"
          />
          <button
            tuiButton
            appearance="outline"
            size="m"
            [tuiHint]="'Làm mới dữ liệu'"
            tuiHintDirection="top"
            (click)="reload.emit()"
          >
            <tui-icon icon="@tui.refresh-cw" />
          </button>
          <!-- Slot for extra toolbar actions (e.g. Add button) -->
          <ng-content select="[tableToolbar]" />
        </div>
      </div>

      <!-- ─── Table card ───────────────────────────────────────── -->
      <div class="overflow-hidden bg-white border border-gray-200 shadow-sm rounded-xl">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="border-b border-gray-100 bg-gray-50/60">
              <tr>
                @for (col of columns(); track col.key) {
                  @if (!hiddenColumns().includes(col.key)) {
                    <th
                      class="px-4 py-3 text-sm font-semibold text-gray-600"
                      [class]="colClass(col)"
                    >{{ col.label }}</th>
                  }
                }
                @if (showActionsColumn()) {
                  <th class="px-4 py-3 text-sm font-semibold text-center text-gray-600">Thao tác</th>
                }
              </tr>

              @if (!loading() && rows().length > 0 && summaryTopTpl) {
                <ng-container
                  *ngTemplateOutlet="
                    summaryTopTpl;
                    context: { isHidden: isHiddenFn, colspan: visibleColumnCount() }
                  "
                />
              }
            </thead>
            <tbody>
              @if (loading()) {
                <tr>
                  <td [attr.colspan]="visibleColumnCount()" class="py-12 text-center text-gray-400">
                    <tui-icon icon="@tui.loader-2" class="mr-2 animate-spin" />
                    Đang tải...
                  </td>
                </tr>
              } @else if (rows().length === 0) {
                <tr>
                  <td [attr.colspan]="visibleColumnCount()" class="py-12 text-center text-gray-400">
                    <tui-icon [icon]="emptyIcon()" class="block mx-auto mb-2 text-3xl text-gray-300" />
                    {{ emptyText() }}
                  </td>
                </tr>
              } @else {
                @for (item of rows(); track $index) {
                  <tr class="transition-colors border-t border-gray-100 hover:bg-amber-50/30">
                    @if (rowTpl) {
                      <ng-container
                        *ngTemplateOutlet="rowTpl; context: { $implicit: item, isHidden: isHiddenFn }"
                      />
                    }
                    @if (showActionsColumn()) {
                      <td class="px-4 py-3 text-center align-top">
                        <div class="flex items-center justify-center gap-1">
                          @if (rowActionsTpl) {
                            <ng-container
                              *ngTemplateOutlet="rowActionsTpl; context: { $implicit: item }"
                            />
                          }
                        </div>
                      </td>
                    }
                  </tr>
                }
              }
            </tbody>

            @if (!loading() && rows().length > 0 && summaryBottomTpl) {
              <tfoot>
                <ng-container
                  *ngTemplateOutlet="
                    summaryBottomTpl;
                    context: { isHidden: isHiddenFn, colspan: visibleColumnCount() }
                  "
                />
              </tfoot>
            }
          </table>
        </div>

        @if (totalCount() > 0) {
          <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
            <p class="text-sm text-gray-500">
              Tổng <span class="font-medium text-gray-700">{{ totalCount() }}</span> bản ghi
            </p>
            <tui-table-pagination
              [total]="totalCount()"
              [items]="pageSizeItems()"
              [page]="page()"
              [size]="size()"
              (paginationChange)="onPaginationChange($event)"
            />
          </div>
        }
      </div>

    </div>
  `,
})
export class DataTableComponent {
  // ─── Inputs ─────────────────────────────────────────────────────
  columns = input<ColumnDef[]>([]);
  rows = input<unknown[]>([]);
  loading = input(false);
  totalCount = input(0);
  page = input(0);
  size = input(10);
  pageSizeItems = input<readonly number[]>([10, 20, 50, 100]);
  searchPlaceholder = input('Tìm kiếm...');
  emptyIcon = input('@tui.inbox');
  emptyText = input('Không có dữ liệu');
  showActionsColumn = input(true);

  // ─── Outputs ─────────────────────────────────────────────────────
  keywordChange = output<string>();
  reload = output<void>();
  pageChange = output<{ page: number; size: number }>();

  // ─── Content projection ──────────────────────────────────────────
  @ContentChild('row') rowTpl?: TemplateRef<unknown>;
  @ContentChild('rowActions') rowActionsTpl?: TemplateRef<unknown>;
  @ContentChild('summaryTop') summaryTopTpl?: TemplateRef<unknown>;
  @ContentChild('summaryBottom') summaryBottomTpl?: TemplateRef<unknown>;

  // ─── Internal state ──────────────────────────────────────────────
  hiddenColumns = signal<string[]>([]);
  localKeyword = signal('');

  /** Stable function reference passed as template context — reads signal at call time */
  readonly isHiddenFn = (key: string): boolean => this.hiddenColumns().includes(key);

  visibleColumnCount = computed(() => {
    const visible = this.columns().filter(c => !this.hiddenColumns().includes(c.key)).length;
    return visible + (this.showActionsColumn() ? 1 : 0);
  });

  colClass = (col: ColumnDef): string =>
    col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';

  private readonly ks = new Subject<string>();

  constructor() {
    this.ks
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(v => this.keywordChange.emit(v));
  }

  onKeywordInput(value: string): void {
    this.localKeyword.set(value);
    this.ks.next(value);
  }

  onPaginationChange(e: { page: number; size: number }): void {
    this.pageChange.emit(e);
  }
}
