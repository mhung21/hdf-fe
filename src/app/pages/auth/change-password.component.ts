import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ChangePasswordFormComponent } from './change-password-form.component';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ChangePasswordFormComponent],
  template: `
    <div class="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
      <div class="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-8 text-white">
        <div class="mb-6">
          <p class="text-xs uppercase tracking-[0.3em] text-emerald-300/80">CrediFlow Identity</p>
          <h1 class="mt-2 text-2xl font-bold">Đổi mật khẩu</h1>
          <p class="mt-1 text-sm text-white/60">Tài khoản của bạn đang yêu cầu đặt lại mật khẩu.</p>
        </div>

        <app-change-password-form theme="dark"></app-change-password-form>
      </div>
    </div>
  `,
})
export class ChangePasswordComponent {}
