import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideEventPlugins } from '@taiga-ui/event-plugins';
import { provideAnimations } from '@angular/platform-browser/animations';
import { tuiDateFormatProvider } from '@taiga-ui/core';
import { TUI_LANGUAGE } from '@taiga-ui/i18n';
import { TUI_VIETNAMESE_LANGUAGE } from '@taiga-ui/i18n/languages/vietnamese';
import { of } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { BASE_PATH } from './api/variables';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    provideEventPlugins(),
    { provide: BASE_PATH, useValue: environment.apiUrl },
    tuiDateFormatProvider({ mode: 'DMY', separator: '/' }),
    { provide: TUI_LANGUAGE, useValue: of(TUI_VIETNAMESE_LANGUAGE) },
  ],
};
