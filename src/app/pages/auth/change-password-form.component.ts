import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton, TuiIcon, TuiTextfield } from '@taiga-ui/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-change-password-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TuiButton, TuiIcon, TuiTextfield],
  template: `
    @if (errorMessage()) {
      <div class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        {{ errorMessage() }}
      </div>
    }

    @if (successMessage()) {
      <div class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        {{ successMessage() }}
        @if (redirectCountdown() > 0) {
          <div class="mt-1 text-xs text-emerald-600">
            Hệ thống sẽ đăng xuất sau {{ redirectCountdown() }} giây để áp dụng bảo mật mới.
          </div>
        }
      </div>
    }

    <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-4">
      <div class="grid gap-1.5">
        <label class="text-xs font-semibold" [class]="labelClass">Mật khẩu hiện tại</label>
        <div class="flex items-center gap-2">
          <tui-textfield class="flex-1">
            <input
              tuiTextfield
              [type]="showCurrentPassword() ? 'text' : 'password'"
              formControlName="currentPassword"
              autocomplete="current-password"
            />
            <tui-icon icon="@tui.lock" tuiTextfieldIconLeft></tui-icon>
          </tui-textfield>
          <button tuiButton type="button" appearance="flat" size="s" (click)="toggleCurrentPassword()">
            {{ showCurrentPassword() ? 'Ẩn' : 'Hiện' }}
          </button>
        </div>
      </div>

      <div class="grid gap-1.5">
        <label class="text-xs font-semibold" [class]="labelClass">Mật khẩu mới</label>
        <div class="flex items-center gap-2">
          <tui-textfield class="flex-1">
            <input
              tuiTextfield
              [type]="showNewPassword() ? 'text' : 'password'"
              formControlName="newPassword"
              autocomplete="new-password"
            />
            <tui-icon icon="@tui.key-round" tuiTextfieldIconLeft></tui-icon>
          </tui-textfield>
          <button tuiButton type="button" appearance="flat" size="s" (click)="toggleNewPassword()">
            {{ showNewPassword() ? 'Ẩn' : 'Hiện' }}
          </button>
        </div>
        @if (form.get('newPassword')?.invalid && form.get('newPassword')?.touched) {
          <p class="text-xs text-red-600">Mật khẩu mới phải có ít nhất 6 ký tự.</p>
        }
      </div>

      <div class="grid gap-1.5">
        <label class="text-xs font-semibold" [class]="labelClass">Xác nhận mật khẩu mới</label>
        <div class="flex items-center gap-2">
          <tui-textfield class="flex-1">
            <input
              tuiTextfield
              [type]="showConfirmPassword() ? 'text' : 'password'"
              formControlName="confirmPassword"
              autocomplete="new-password"
            />
            <tui-icon icon="@tui.check-check" tuiTextfieldIconLeft></tui-icon>
          </tui-textfield>
          <button tuiButton type="button" appearance="flat" size="s" (click)="toggleConfirmPassword()">
            {{ showConfirmPassword() ? 'Ẩn' : 'Hiện' }}
          </button>
        </div>
      </div>

      @if (form.hasError('passwordMismatch') && form.get('confirmPassword')?.touched) {
        <p class="text-xs text-red-600">Mật khẩu mới và xác nhận mật khẩu không khớp.</p>
      }

      <button tuiButton type="submit" appearance="primary" size="l" [disabled]="submitting() || !!successMessage()">
        @if (submitting()) {
          Đang xử lý...
        } @else {
          Đổi mật khẩu
        }
      </button>
    </form>
  `,
})
export class ChangePasswordFormComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  @Input() theme: 'light' | 'dark' = 'light';

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly redirectCountdown = signal(0);
  readonly showCurrentPassword = signal(false);
  readonly showNewPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  private logoutTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

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

  get labelClass(): string {
    return this.theme === 'dark' ? 'text-white/75' : 'text-zinc-700';
  }

  toggleCurrentPassword(): void {
    this.showCurrentPassword.update((value) => !value);
  }

  toggleNewPassword(): void {
    this.showNewPassword.update((value) => !value);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update((value) => !value);
  }

  submit(): void {
    this.errorMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Vui lòng kiểm tra lại thông tin mật khẩu.');
      return;
    }

    this.submitting.set(true);

    this.authService.changePassword(this.form.getRawValue()).subscribe({
      next: (response) => {
        this.submitting.set(false);
        this.successMessage.set(response.message ?? 'Đổi mật khẩu thành công.');
        this.startLogoutCountdown();
      },
      error: (error) => {
        this.submitting.set(false);
        this.errorMessage.set(error?.error?.message ?? 'Không thể đổi mật khẩu. Vui lòng thử lại.');
      },
    });
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  private startLogoutCountdown(): void {
    this.clearTimers();
    this.form.disable();
    this.redirectCountdown.set(2);

    this.countdownTimer = setInterval(() => {
      this.redirectCountdown.update((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);

    this.logoutTimer = setTimeout(() => {
      this.clearTimers();
      this.authService.logout();
    }, 2000);
  }

  private clearTimers(): void {
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
      this.logoutTimer = null;
    }

    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }
}
