import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton, TuiIcon, TuiLabel, TuiTextfield, type TuiDialogContext } from '@taiga-ui/core';
import { injectContext } from '@taiga-ui/polymorpheus';

export interface LoanStatusActionDialogData {
  actionLabel: string;
  contractNo?: string | null;
  requiresReason?: boolean;
  hint?: string;
  isNegative?: boolean;
}

export interface LoanStatusActionDialogResult {
  reason: string | null;
}

@Component({
  selector: 'app-loan-status-action-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TuiButton, TuiIcon, TuiLabel, TuiTextfield],
  template: `
    <div class="space-y-4 p-1">
      <div class="flex items-start gap-3 rounded-lg border p-3"
           [class]="isNegative() ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'">
        <tui-icon
          [icon]="isNegative() ? '@tui.triangle-alert' : '@tui.circle-help'"
          class="mt-0.5 shrink-0"
          [class]="isNegative() ? 'text-red-500' : 'text-amber-500'" />
        <div>
          <p class="text-sm text-gray-700">
            Bạn xác nhận <b>{{ context.data.actionLabel }}</b>
            @if (context.data.contractNo) {
              hợp đồng
              <code class="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-800">
                {{ context.data.contractNo }}
              </code>
            }
            ?
          </p>
          @if (context.data.hint) {
            <p class="mt-1 text-xs" [class]="isNegative() ? 'text-red-600' : 'text-amber-600'">
              {{ context.data.hint }}
            </p>
          }
        </div>
      </div>

      @if (requiresReason()) {
        <div>
          <label tuiLabel>Lý do <span class="text-red-500">*</span></label>
          <tui-textfield>
            <input
              tuiTextfield
              [formControl]="reasonControl"
              placeholder="Nhập lý do..."
              autofocus />
          </tui-textfield>
          @if (reasonControl.invalid && reasonControl.touched) {
            <p class="mt-1 text-xs text-red-500">Vui lòng nhập lý do trước khi xác nhận.</p>
          }
        </div>
      }

      <div class="flex justify-end gap-2">
        <button tuiButton type="button" appearance="outline" size="m" (click)="context.$implicit.complete()">
          Đóng
        </button>
        <button
          tuiButton
          type="button"
          [appearance]="isNegative() ? 'destructive' : 'primary'"
          size="m"
          (click)="confirm()">
          Xác nhận
        </button>
      </div>
    </div>
  `,
})
export class LoanStatusActionDialogComponent {
  readonly context = injectContext<TuiDialogContext<LoanStatusActionDialogResult, LoanStatusActionDialogData>>();

  readonly reasonControl = new FormControl<string>('', { nonNullable: true });

  readonly requiresReason = computed(() => !!this.context.data.requiresReason);
  readonly isNegative = computed(() => !!this.context.data.isNegative);

  confirm(): void {
    if (this.requiresReason()) {
      this.reasonControl.addValidators(Validators.required);
      this.reasonControl.markAsTouched();
      this.reasonControl.updateValueAndValidity();
      if (this.reasonControl.invalid) return;
    }

    const reason = this.reasonControl.value.trim();
    this.context.completeWith({ reason: reason || null });
  }
}
