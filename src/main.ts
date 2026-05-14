import 'zone.js';
import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

registerLocaleData(localeVi);

const originalConsoleError = console.error.bind(console);

function reportClientError(error: unknown, source: 'window.error' | 'unhandledrejection' | 'bootstrap'): void {
  const detail = error instanceof Error ? error.stack ?? error.message : String(error);
  originalConsoleError(`[FE:${source}]`, detail);
}

function renderFatalFallback(message: string): void {
  const root = document.getElementById('app-fatal-error');
  if (root) {
    return;
  }

  const container = document.createElement('div');
  container.id = 'app-fatal-error';
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.background = '#f8fafc';
  container.style.zIndex = '9999';
  container.innerHTML = `
    <div style="max-width:460px;width:90%;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
      <h2 style="margin:0 0 10px;color:#0f172a;font-size:20px;">Ung dung gap su co</h2>
      <p style="margin:0 0 16px;color:#334155;line-height:1.5;">${message}</p>
      <button id="app-fatal-reload" style="height:38px;padding:0 14px;border:0;border-radius:8px;background:#166534;color:#fff;font-weight:600;cursor:pointer;">Tai lai trang</button>
    </div>
  `;
  document.body.appendChild(container);

  const reloadBtn = document.getElementById('app-fatal-reload');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', () => window.location.reload());
  }
}

window.addEventListener('error', (event) => {
  reportClientError(event.error ?? event.message, 'window.error');
  renderFatalFallback('Đã xảy ra lỗi không mong muốn. Vui lòng tải lại trang hoặc đăng nhập lại.');
});

window.addEventListener('unhandledrejection', (event) => {
  reportClientError(event.reason, 'unhandledrejection');
  renderFatalFallback('Ứng dụng đang gặp lỗi tải dữ liệu. Vui lòng tải lại trang.');
});

// Tắt toàn bộ console output trên môi trường production
// để tránh lộ thông tin nhạy cảm qua DevTools
if (environment.production) {
  console.log   = () => {};
  console.debug = () => {};
  console.info  = () => {};
  // Keep warning/error for runtime diagnostics to avoid silent white-screen failures.
}

bootstrapApplication(App, appConfig)
  .catch((err) => {
    reportClientError(err, 'bootstrap');
    renderFatalFallback('Ứng dụng không thể khởi động. Vui lòng tải lại trang.');
  });
