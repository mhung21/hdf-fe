import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { forkJoin, map, Observable } from 'rxjs';
import {
  TuiAlertService,
  TuiButton,
  TuiCalendar,
  TuiDataList,
  TuiHint,
  TuiIcon,
  TuiLabel,
  TuiTextfield,
  TuiWithDropdownOpen,
  type TuiDialogContext,
} from '@taiga-ui/core';
import { TuiChevron, TuiComboBox, TuiInputDate, TuiSkeleton } from '@taiga-ui/kit';
import { TuiDay, TuiStringHandler, TuiStringMatcher } from '@taiga-ui/cdk';
import { injectContext } from '@taiga-ui/polymorpheus';
import { CommonModule } from '@angular/common';

import {
  CustomerDocumentService,
  CustomerDocument,
} from '../../services/customer-document.service';

import { CustomerProvider } from '../../api/api/customer.service';
import type { CUCustomerModel } from '../../api/model/cu-customer-model';

import { ReferenceDataService } from '../../services/reference-data.service';
import { AuthService } from '../../services/auth.service';
import { RoleCode } from '../../models/role.model';

export interface CustomerFormDialogData {
  customer: CustomerFormItem | null;
}

export interface CustomerFormItem {
  customerId: string;
  nationalId?: string | null;
  fullName: string;
  phone: string | null;
  address?: string | null;
  dateOfBirth?: TuiDay | null;
  gender?: string | null;
  firstSourceType?: string | null;
  firstStoreId?: string | null;
  hasBadHistory: boolean;
  badHistoryNote?: string | null;
}

const GENDER_LABELS: Record<string, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
};

const GENDER_IDS = Object.keys(GENDER_LABELS);

@Component({
  selector: 'app-customer-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiButton,
    TuiChevron,
    TuiComboBox,
    TuiDataList,
    TuiHint,
    TuiIcon,
    TuiLabel,
    TuiSkeleton,
    TuiTextfield,
    TuiCalendar,
    TuiWithDropdownOpen,
    TuiInputDate,
  ],
  templateUrl: './customer-form-dialog.component.html',
})
export class CustomerFormDialogComponent implements OnInit, OnDestroy {
  readonly context = injectContext<TuiDialogContext<void, CustomerFormDialogData>>();
  private readonly fb = inject(FormBuilder);
  private readonly customerProvider = inject(CustomerProvider);
  private readonly alerts = inject(TuiAlertService);
  private readonly refData = inject(ReferenceDataService);
  private readonly authService = inject(AuthService);
  protected readonly customerDocSvc = inject(CustomerDocumentService);

  readonly saving = signal(false);
  readonly checkingNationalId = signal(false);
  /** none = chưa kiểm tra, found = đã tồn tại, not-found = chưa có */
  readonly nationalIdCheckStatus = signal<'none' | 'found' | 'not-found'>('none');

  // ── Ảnh CCCD đang chờ upload (tạo mới) —————————————————————————
  private pendingDocCounter = 0;
  pendingCccd1 = signal<{ id: number; file: File; previewUrl: string } | null>(null);
  pendingCccd2 = signal<{ id: number; file: File; previewUrl: string } | null>(null);

  // ── Ảnh CCCD đã lưu (chế độ xem/sửa — chỉ Admin/Manager) ———————————————
  readonly existingDocs = signal<CustomerDocument[]>([]);
  readonly loadingDocs = signal(false);
  readonly uploadingCccd = signal(false);
  /** Map documentId -> blob URL (quản lý tự để revoke khi destroy) */
  private readonly blobUrls = new Map<string, string>();
  readonly docBlobUrls = signal<Record<string, string>>({});
  readonly existingCccd1 = computed(
    () => this.existingDocs().find((d) => d.documentType === 'ID_FRONT') ?? null,
  );
  readonly existingCccd2 = computed(
    () => this.existingDocs().find((d) => d.documentType === 'ID_BACK') ?? null,
  );

  readonly editingCustomer = computed(() => this.context.data.customer);
  readonly canPickStore = computed(() =>
    this.authService.hasAnyRole([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER]),
  );
  readonly storeList = computed(() => {
    const all = this.refData.storeList();
    const user = this.authService.currentUser();
    if (this.authService.hasRole(RoleCode.ADMIN)) return all;
    if (this.authService.hasRole(RoleCode.REGIONAL_MANAGER)) {
      const allowed = new Set(user?.storeIds ?? []);
      return all.filter((s) => allowed.has(s.storeId));
    }
    const storeId = user?.storeId;
    return storeId ? all.filter((s) => s.storeId === storeId) : [];
  });
  /** Nhân viên không được sửa trường lịch sử nợ xấu — chỉ Admin/STORE_MANAGER mới có quyền */
  readonly canEditBadHistory = computed(
    () =>
      this.authService.hasAnyRole([
        RoleCode.ADMIN,
        RoleCode.REGIONAL_MANAGER,
        RoleCode.STORE_MANAGER,
      ]) || this.authService.hasPermission('CUSTOMER_UPDATE'),
  );
  readonly isAdmin = computed(() => this.authService.hasRole(RoleCode.ADMIN));
  /** Admin và StoreManager mới được xem ảnh CCCD */
  readonly canViewCccd = computed(() =>
    this.authService.hasAnyRole([
      RoleCode.ADMIN,
      RoleCode.REGIONAL_MANAGER,
      RoleCode.STORE_MANAGER,
    ]),
  );

  /**
   * Chỉ cho phép nhấn "Tạo mới" khi CCCD đã được kiểm tra, chưa có trong hệ thống
   * và đã tải lên đủ cả 2 ảnh CCCD.
   * Trong chế độ sửa (edit) thì luôn cho phép lưu.
   */
  readonly canSubmit = computed(
    () =>
      !!this.editingCustomer() ||
      (this.nationalIdCheckStatus() === 'not-found' &&
        !!this.pendingCccd1() &&
        !!this.pendingCccd2()),
  );

  readonly genderIds = GENDER_IDS;
  readonly stringifyGender: TuiStringHandler<string> = (code) => GENDER_LABELS[code] ?? code ?? '';

  readonly stringifyStore: TuiStringHandler<string> = (id) => {
    if (!id) return '';
    return this.storeList().find((s) => s.storeId === id)?.storeName ?? id;
  };
  readonly matcherStore: TuiStringMatcher<string> = (id, query) => {
    if (!id || !query) return false;
    return this.normalizeVi(this.stringifyStore(id)).includes(this.normalizeVi(query));
  };

  form = this.fb.group({
    customerId: [null as string | null],
    nationalId: ['', [Validators.required, Validators.pattern(/^\d{12}$/)]],
    fullName: ['', Validators.required],
    dateOfBirth: [null as TuiDay | null],
    gender: ['MALE'],
    phone: ['', Validators.required],
    address: [''],
    firstStoreId: [null as string | null],
    hasBadHistory: [false],
    badHistoryNote: [''],
  });

  private normalizeVi(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  ngOnInit(): void {
    const c = this.editingCustomer();
    if (c) {
      this.form.reset({
        customerId: c.customerId,
        nationalId: c.nationalId
          ? c.nationalId.length >= 8
            ? c.nationalId.slice(0, 5) + '***' + c.nationalId.slice(-3)
            : c.nationalId
          : '',
        fullName: c.fullName,
        dateOfBirth:
          c.dateOfBirth instanceof TuiDay
            ? c.dateOfBirth
            : typeof (c.dateOfBirth as unknown) === 'string' && c.dateOfBirth
              ? TuiDay.jsonParse(c.dateOfBirth as unknown as string)
              : null,
        gender: c.gender ?? 'MALE',
        phone: c.phone ?? '',
        address: c.address ?? '',
        firstStoreId: c.firstStoreId ?? null,
        hasBadHistory: c.hasBadHistory,
        badHistoryNote: c.badHistoryNote ?? '',
      });
      this.form.get('nationalId')!.disable();
      // Tải ảnh CCCD đã lưu (chỉ Admin/Manager mới được xem)
      if (this.canViewCccd()) this.loadExistingDocs(c.customerId);
    }

    // Non-Admin: tự động set Chi nhánh tiếp nhận theo chi nhánh của người dùng
    if (!this.canPickStore()) {
      this.form.get('firstStoreId')!.setValue(this.authService.currentUser()?.storeId ?? null);
      this.form.get('firstStoreId')!.disable();
    } else if (!this.form.get('firstStoreId')!.value) {
      const first = this.storeList()[0]?.storeId ?? null;
      if (first) this.form.get('firstStoreId')!.setValue(first);
    }

    // Khi CCCD thay đổi → reset trạng thái kiểm tra (bắt buộc kiểm tra lại)
    this.form.get('nationalId')!.valueChanges.subscribe(() => {
      if (this.nationalIdCheckStatus() !== 'none') {
        this.nationalIdCheckStatus.set('none');
      }
    });
  }

  ngOnDestroy(): void {
    const c1 = this.pendingCccd1();
    const c2 = this.pendingCccd2();
    if (c1) URL.revokeObjectURL(c1.previewUrl);
    if (c2) URL.revokeObjectURL(c2.previewUrl);
    // Thu hồi blob URLs của ảnh đã lưu
    for (const url of this.blobUrls.values()) URL.revokeObjectURL(url);
    this.blobUrls.clear();
  }

  // ── Tải ảnh CCCD đã lưu (chỉ Admin/Manager) ──────────────────────────────
  private loadExistingDocs(customerId: string): void {
    this.loadingDocs.set(true);
    this.customerDocSvc.getByCustomer(customerId).subscribe({
      next: (result: any) => {
        this.loadingDocs.set(false);
        if (result.status && result.data) {
          const docs = result.data as CustomerDocument[];
          this.existingDocs.set(docs);
          // Fetch blob URLs cho từng ảnh
          docs.forEach((doc) => {
            this.customerDocSvc.fetchBlobUrl(doc.documentId).subscribe({
              next: (url) => {
                this.blobUrls.set(doc.documentId, url);
                this.docBlobUrls.update((m) => ({ ...m, [doc.documentId]: url }));
              },
            });
          });
        }
      },
      error: () => this.loadingDocs.set(false),
    });
  }

  // ── Chọn file CCCD ────────────────────────────────────────────────────────

  onCccd1Selected(event: Event): void {
    const file = this.pickFile(event);
    if (!file) return;
    const old = this.pendingCccd1();
    if (old) URL.revokeObjectURL(old.previewUrl);
    this.pendingCccd1.set({
      id: ++this.pendingDocCounter,
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }

  onCccd2Selected(event: Event): void {
    const file = this.pickFile(event);
    if (!file) return;
    const old = this.pendingCccd2();
    if (old) URL.revokeObjectURL(old.previewUrl);
    this.pendingCccd2.set({
      id: ++this.pendingDocCounter,
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }

  removePendingCccd1(): void {
    const old = this.pendingCccd1();
    if (old) URL.revokeObjectURL(old.previewUrl);
    this.pendingCccd1.set(null);
  }

  removePendingCccd2(): void {
    const old = this.pendingCccd2();
    if (old) URL.revokeObjectURL(old.previewUrl);
    this.pendingCccd2.set(null);
  }

  /** Upload trực tiếp khi đang ở chế độ sửa (customer đã tồn tại). */
  onEditCccdSelected(event: Event, side: 'ID_FRONT' | 'ID_BACK'): void {
    const file = this.pickFile(event);
    if (!file || !this.editingCustomer()) return;
    const customerId = this.editingCustomer()!.customerId;
    this.uploadingCccd.set(true);
    this.customerDocSvc.upload(customerId, file, side).subscribe({
      next: (result: any) => {
        this.uploadingCccd.set(false);
        if (result.status) {
          this.alerts
            .open('Cập nhật ảnh CCCD thành công.', { appearance: 'positive', autoClose: 3000 })
            .subscribe();
          // Tải lại danh sách ảnh
          this.loadExistingDocs(customerId);
        } else {
          this.alerts
            .open(result.message ?? 'Upload thất bại.', { appearance: 'negative' })
            .subscribe();
        }
      },
      error: () => {
        this.uploadingCccd.set(false);
        this.alerts.open('Có lỗi xảy ra khi upload ảnh.', { appearance: 'negative' }).subscribe();
      },
    });
  }

  private pickFile(event: Event): File | null {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    return file;
  }

  checkNationalId(): void {
    const nationalId = this.form.get('nationalId')?.value?.trim();
    if (!nationalId || !/^\d{12}$/.test(nationalId)) return;

    this.checkingNationalId.set(true);
    this.customerProvider
      .apiCustomerGetByNationalIdPost({ body: JSON.stringify(nationalId) })
      .subscribe({
        next: (result) => {
          this.checkingNationalId.set(false);
          if (result.status && result.data) {
            // Khách đã tồn tại → KHÔNG điền thông tin, chặn tạo mới
            const raw = result.data as Record<string, unknown>;
            this.nationalIdCheckStatus.set('found');
            this.alerts
              .open(
                `Khách hàng "${raw['fullName']}" đã tồn tại trong hệ thống. Không thể tạo mới.`,
                { appearance: 'warning', autoClose: 5000 },
              )
              .subscribe();
          } else {
            this.nationalIdCheckStatus.set('not-found');
            this.alerts
              .open('CCCD chưa có trong hệ thống, vui lòng điền thông tin khách hàng mới', {
                appearance: 'positive',
                autoClose: 3000,
              })
              .subscribe();
          }
        },
        error: () => {
          this.checkingNationalId.set(false);
          this.nationalIdCheckStatus.set('none');
          this.alerts.open('Không thể kiểm tra CCCD', { appearance: 'negative' }).subscribe();
        },
      });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.canSubmit()) {
      if (!this.editingCustomer() && (!this.pendingCccd1() || !this.pendingCccd2())) {
        this.alerts
          .open('Vui lòng tải lên đủ ảnh CCCD mặt trước và mặt sau.', {
            appearance: 'warning',
            autoClose: 4000,
          })
          .subscribe();
      }
      return;
    }

    this.saving.set(true);
    const v = this.form.getRawValue();
    const model: CUCustomerModel = {
      customerId: v.customerId ?? undefined,
      nationalId: v.nationalId ?? undefined,
      customerCode: undefined,
      fullName: v.fullName ?? undefined,
      dateOfBirth: v.dateOfBirth ? v.dateOfBirth.toJSON() : undefined,
      gender: v.gender || undefined,
      phone: v.phone || undefined,
      address: v.address || undefined,
      firstStoreId: v.firstStoreId ?? undefined,
      hasBadHistory: v.hasBadHistory ?? false,
      badHistoryNote: v.badHistoryNote || undefined,
    };

    if (this.editingCustomer()) {
      this.saveCustomer(model);
      return;
    }

    const storeId = v.firstStoreId ?? null;
    if (!storeId) {
      this.saving.set(false);
      this.alerts.open('Vui lòng chọn Chi nhánh tiếp nhận.', { appearance: 'warning' }).subscribe();
      return;
    }

    this.generateCustomerCode(storeId).subscribe({
      next: (customerCode) => {
        this.saveCustomer({ ...model, customerCode });
      },
      error: () => {
        this.saving.set(false);
        this.alerts
          .open('Không thể tạo mã khách hàng tự động, vui lòng thử lại.', {
            appearance: 'negative',
          })
          .subscribe();
      },
    });
  }

  private saveCustomer(model: CUCustomerModel): void {
    model.firstSourceType = 'VANG_LAI';
    this.customerProvider.apiCustomerSavePost({ cUCustomerModel: model }).subscribe({
      next: (result) => {
        this.saving.set(false);
        if (result.status) {
          const savedCustomerId = (result.data as any)?.customerId as string | undefined;
          // Upload ảnh CCCD nếu có (sau khi tạo mới khách hàng thành công)
          if (savedCustomerId) this.uploadPendingCccd(savedCustomerId);
          this.alerts
            .open(
              this.editingCustomer()
                ? 'Cập nhật khách hàng thành công'
                : 'Thêm khách hàng thành công',
              {
                appearance: 'positive',
              },
            )
            .subscribe();
          this.context.completeWith();
        } else {
          this.alerts
            .open(result.message ?? 'Có lỗi xảy ra', { appearance: 'negative' })
            .subscribe();
        }
      },
      error: () => {
        this.saving.set(false);
        this.alerts.open('Có lỗi xảy ra, vui lòng thử lại', { appearance: 'negative' }).subscribe();
      },
    });
  }

  private generateCustomerCode(storeId: string): Observable<string> {
    const year2 = String(new Date().getFullYear() % 100).padStart(2, '0');
    const storeName = this.storeList().find((s) => s.storeId === storeId)?.storeName ?? storeId;
    const storeToken = this.toStoreToken(storeName);
    const prefix = `${year2}${storeToken}`;

    return this.customerProvider.apiCustomerGetAllGet().pipe(
      map((result) => {
        const raw = result.data as any;
        const items: Array<{ firstStoreId?: string | null; customerCode?: string | null }> =
          Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];

        const matcher = new RegExp(`^${prefix}-(\\d{5})$`);
        let maxSeq = 0;

        for (const item of items) {
          if ((item.firstStoreId ?? null) !== storeId) continue;
          const code = item.customerCode ?? '';
          const match = matcher.exec(code);
          if (!match) continue;
          const seq = Number.parseInt(match[1], 10);
          if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
        }

        return `${prefix}-${String(maxSeq + 1).padStart(5, '0')}`;
      }),
    );
  }

  private toStoreToken(storeName: string): string {
    const ascii = storeName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim()
      .toUpperCase();

    const token = ascii
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('');

    return token || 'CN';
  }

  private uploadPendingCccd(customerId: string): void {
    const uploads: ReturnType<typeof this.customerDocSvc.upload>[] = [];
    const c1 = this.pendingCccd1();
    const c2 = this.pendingCccd2();
    if (c1) uploads.push(this.customerDocSvc.upload(customerId, c1.file, 'ID_FRONT'));
    if (c2) uploads.push(this.customerDocSvc.upload(customerId, c2.file, 'ID_BACK'));
    if (!uploads.length) return;
    forkJoin(uploads).subscribe({
      error: () =>
        this.alerts
          .open('Lưu khách hàng thành công nhưng ảnh CCCD không upload được. Vui lòng thử lại.', {
            appearance: 'warning',
          })
          .subscribe(),
    });
  }
}
