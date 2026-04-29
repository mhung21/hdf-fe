import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiCheckbox } from '@taiga-ui/kit';

export interface ColumnDef {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
}

@Component({
  selector: 'app-column-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TuiButton, TuiIcon, TuiCheckbox],
  host: { '(document:click)': 'onDocumentClick($event)' },
  template: `
    <div class="relative">
      <button
        #toggleBtn
        tuiButton
        appearance="outline"
        size="m"
        title="Tùy chỉnh cột hiển thị"
        (click)="toggle($event)"
      >
        <tui-icon icon="@tui.columns-3" />
      </button>

      @if (open()) {
        <div
          class="absolute right-0 z-50 p-2 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg top-full min-w-44"
        >
          <p class="px-2 pb-1 mb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase border-b border-gray-100">
            Hiển thị cột
          </p>
          @for (col of columns(); track col.key) {
            <label
              class="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-amber-50 text-sm text-gray-700"
            >
              <input
                tuiCheckbox
                type="checkbox"
                [ngModel]="!isHidden(col.key)"
                (ngModelChange)="onToggle(col.key)"
              />
              {{ col.label }}
            </label>
          }
        </div>
      }
    </div>
  `,
})
export class ColumnToggleComponent {
  private readonly el = inject(ElementRef);

  columns = input<ColumnDef[]>([]);
  hiddenColumns = model<string[]>([]);

  open = signal(false);

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.open.update(v => !v);
  }

  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.el.nativeElement.contains(event.target)) {
      this.open.set(false);
    }
  }

  isHidden(key: string): boolean {
    return this.hiddenColumns().includes(key);
  }

  onToggle(key: string): void {
    const current = this.hiddenColumns();
    if (this.isHidden(key)) {
      this.hiddenColumns.set(current.filter(k => k !== key));
    } else {
      this.hiddenColumns.set([...current, key]);
    }
  }
}
