import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LoginRequest } from '../../models/auth.model';
import { TuiButton, TuiIcon, TuiTextfield } from '@taiga-ui/core';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiButton,
    TuiIcon,
    TuiTextfield,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.less']
})
export class LoginComponent {
  // Form state using traditional properties for form binding
  username = signal('');
  password = signal('');
  rememberMe = signal(false);
  errorMessage = signal<string | null>(null);
  isLoading = signal(false);
  showPassword = signal(false);

  // Return URL
  private returnUrl: string = '/dashboard';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    // Get return URL from query params — chỉ cho phép path nội bộ ("/..."), block open redirect
    const raw = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    this.returnUrl = (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')) ? raw : '/dashboard';

    const reason = this.route.snapshot.queryParams['reason'];
    if (reason === 'session-expired') {
      this.errorMessage.set('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
  }

  /**
   * Handle login form submission
   */
  onLogin(): void {
    // Clear previous error
    this.errorMessage.set(null);

    // Validate inputs
    if (!this.username().trim()) {
      this.errorMessage.set('Vui lòng nhập tên đăng nhập');
      return;
    }

    if (!this.password().trim()) {
      this.errorMessage.set('Vui lòng nhập mật khẩu');
      return;
    }

    this.isLoading.set(true);

    const credentials: LoginRequest = {
      username: this.username().trim(),
      password: this.password().trim(),
      deviceInfo: this.getDeviceInfo()
    };

    this.authService.login(credentials).subscribe({
      next: (response) => {
        // Check if password change is required
        if (response.mustChangePassword) {
          this.router.navigate(['/change-password'], {
            queryParams: { required: true }
          });
        } else {
          this.router.navigate([this.returnUrl]);
        }
      },
      error: (error) => {
        this.isLoading.set(false);

        if (error.status === 401 || error.status === 400) {
          // Không hiển thị thông báo lỗi từ server (tránh username enumeration)
          this.errorMessage.set('Tên đăng nhập hoặc mật khẩu không đúng.');
        } else if (error.status === 0) {
          this.errorMessage.set('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối của bạn.');
        } else {
          this.errorMessage.set('Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại.');
        }
      }
    });
  }

  /**
   * Get device information for tracking
   */
  private getDeviceInfo(): string {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    return `${platform} - ${userAgent}`;
  }
}
