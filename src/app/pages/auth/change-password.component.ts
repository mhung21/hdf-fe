import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton, TuiIcon, TuiTextfield } from '@taiga-ui/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TuiButton, TuiIcon, TuiTextfield],
  template: `
    <div class="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
      <div class="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-8 text-white">
        <div class="mb-6">
          <p class="text-xs uppercase tracking-[0.3em] text-emerald-300/80">CrediFlow Identity</p>
          <h1 class="mt-2 text-2xl font-bold">Đổi mật khẩu</h1>
          <p class="mt-1 text-sm text-white/60">Tài khoản của bạn đang yêu cầu đặt lại mật khẩu.</p>
        </div>

        @if (errorMessage()) {
          <div class="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {{ errorMessage() }}
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-4">
          <div class="grid gap-1.5">
            <label class="text-xs font-semibold text-white/75">Mật khẩu hiện tại</label>
            <tui-textfield>
              <input tuiTextfield type="password" formControlName="currentPassword" autocomplete="current-password" />
              <tui-icon icon="@tui.lock" tuiTextfieldIconLeft></tui-icon>
            </tui-textfield>
          </div>

          <div class="grid gap-1.5">
            <label class="text-xs font-semibold text-white/75">Mật khẩu mới</label>
            <tui-textfield>
              <input tuiTextfield type="password" formControlName="newPassword" autocomplete="new-password" />
              <tui-icon icon="@tui.key-round" tuiTextfieldIconLeft></tui-icon>
            </tui-textfield>
          </div>

          <div class="grid gap-1.5">
            <label class="text-xs font-semibold text-white/75">Xác nhận mật khẩu mới</label>
            <tui-textfield>
              <input tuiTextfield type="password" formControlName="confirmPassword" autocomplete="new-password" />
              <tui-icon icon="@tui.check-check" tuiTextfieldIconLeft></tui-icon>
            </tui-textfield>
          </div>

          <button tuiButton type="submit" appearance="primary" size="l" [disabled]="submitting()">
            @if (submitting()) {
              Đang xử lý...
            } @else {
              Đổi mật khẩu
            }
          </button>
        </form>
      </div>
    </div>
  `,
})
export class ChangePasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: (group) => {
        const newPassword = group.get('newPassword')?.value;
        const confirmPassword = group.get('confirmPassword')?.value;
        return newPassword && confirmPassword && newPassword !== confirmPassword
          ? { passwordMismatch: true }
          : null;
      },
    }
  );

  submit(): void {
    this.errorMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Vui lòng kiểm tra lại thông tin mật khẩu.');
      return;
    }

    this.submitting.set(true);

    this.authService.changePassword(this.form.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.authService.logout();
      },
      error: (error) => {
        this.submitting.set(false);
        this.errorMessage.set(error?.error?.message ?? 'Không thể đổi mật khẩu. Vui lòng thử lại.');
      },
    });
  }
}
