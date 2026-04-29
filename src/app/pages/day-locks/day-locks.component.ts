import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  TuiButton,
  TuiIcon,
  tuiDialog,
} from '@taiga-ui/core';

import { AuthService } from '../../services/auth.service';
import { RoleCode } from '../../models/role.model';
import { DayLockActionDialogComponent } from './day-lock-action-dialog.component';
import { StoreProvider } from '../../api/api/store.service';

interface DayLockItem { storeId: string; storeName?: string | null; lockedDate?: string | null; lockedBy?: string | null; lockedAt?: string | null; }
interface StoreItem { storeId: string; storeName?: string | null; storeCode?: string | null; isActive?: boolean | null; address?: string | null; }

@Component({
  selector: 'app-day-locks',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TuiButton,
    TuiIcon,
  ],
  templateUrl: './day-locks.component.html',
})
export class DayLocksComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly injector = inject(Injector);
  private readonly storeProvider = inject(StoreProvider);

  dayLocks = signal<DayLockItem[]>([]);
  stores = signal<StoreItem[]>([]);
  loading = signal(false);

  canManage = computed(() => this.authService.hasAnyRole([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER]));
  isAdmin = computed(() => this.authService.hasAnyRole([RoleCode.ADMIN]));

  ngOnInit(): void { this.loadStores(); }

  loadStores(): void {
    this.loading.set(true);
    this.storeProvider.apiStoreSearchPost({ searchStoreRequest: { pageIndex: 1, pageSize: 100 } }).subscribe({
      next: r => {
        if (r.status && r.data) {
          const data = r.data as { items?: StoreItem[] };
          this.stores.set(data.items ?? (Array.isArray(r.data) ? r.data as StoreItem[] : []));
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat('vi-VN').format(d);
  }
  formatDateTime(iso?: string | null): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(d);
  }

  openLockDialog(): void {
    tuiDialog(DayLockActionDialogComponent, {
      injector: this.injector,
      label: 'Khóa Ngày',
      size: 's',
    })('lock').subscribe();
  }

  openUnlockDialog(): void {
    tuiDialog(DayLockActionDialogComponent, {
      injector: this.injector,
      label: 'Mở Khóa Ngày',
      size: 's',
    })('unlock').subscribe();
  }
}
