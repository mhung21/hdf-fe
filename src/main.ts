import 'zone.js';
import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

registerLocaleData(localeVi);

// Tắt toàn bộ console output trên môi trường production
// để tránh lộ thông tin nhạy cảm qua DevTools
if (environment.production) {
  console.log   = () => {};
  console.debug = () => {};
  console.info  = () => {};
  console.warn  = () => {};
  console.error = () => {};
}

bootstrapApplication(App, appConfig)
  .catch((err) => { if (!environment.production) console.error(err); });
