import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TuiAlertService, TuiButton, TuiHint, TuiIcon, TuiTextfield, tuiDialog } from '@taiga-ui/core';

import { CollaboratorService, type CollaboratorDto } from '../../api/api/collaborator.extras';
import { AuthService } from '../../services/auth.service';
import { RoleCode } from '../../models/role.model';
import { DataTableComponent, ColumnDef } from '../../shared/components/data-table/data-table.component';
import {
  CollaboratorFormDialogComponent,
  type CollaboratorFormDialogData,
} from './collaborator-form-dialog.component';

@Component({
  selector: 'app-collaborators',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TuiButton, TuiHint, TuiIcon, TuiTextfield, DataTableComponent],
  templateUrl: './collaborators.component.html',
})
export class CollaboratorsComponent implements OnInit {
  private readonly collaboratorService = inject(CollaboratorService);
  private readonly authService = inject(AuthService);
  private readonly alert = inject(TuiAlertService);
  private readonly injector = inject(Injector);

  collaborators = signal<CollaboratorDto[]>([]);
  loading = signal(false);
  totalCount = signal(0);
  page = 0;
  size = 20;
  keyword = signal('');

  readonly canManage = computed(() =>
    this.authService.hasAnyRole([RoleCode.ADMIN, RoleCode.REGIONAL_MANAGER, RoleCode.STORE_MANAGER]),
  );

  readonly tableColumns: ColumnDef[] = [
    { key: 'name', label: 'Họ và tên' },
    { key: 'contact', label: 'Liên hệ' },
    { key: 'store', label: 'Chi nhánh' },
    { key: 'commission', label: 'Hoa hồng', align: 'center' },
    { key: 'status', label: 'Trạng thái', align: 'center' },
  ];

  maskId(id?: string | null): string {
    if (!id) return '-';
    if (id.length <= 6) return id;
    const visible = 4;
    const tail = 2;
    return id.slice(0, visible) + '****' + id.slice(-tail);
  }

  asCtv(item: unknown): CollaboratorDto {
    return item as CollaboratorDto;
  }

  ngOnInit(): void {
    this.loadCollaborators();
  }

  onKeywordChange(v: string): void {
    this.keyword.set(v);
    this.page = 0;
    this.loadCollaborators();
  }

  onPaginationChange(e: { page: number; size: number }): void {
    this.page = e.page;
    this.size = e.size;
    this.loadCollaborators();
  }

  loadCollaborators(): void {
    this.loading.set(true);
    this.collaboratorService
      .search({ keyword: this.keyword() || undefined, pageIndex: this.page + 1, pageSize: this.size })
      .subscribe({
        next: (r) => {
          this.loading.set(false);
          if (r.status && r.data) {
            const data = r.data as { items?: CollaboratorDto[]; total?: number };
            this.collaborators.set(data.items ?? []);
            this.totalCount.set(data.total ?? 0);
          }
        },
        error: () => this.loading.set(false),
      });
  }

  openCreateDialog(): void {
    tuiDialog(CollaboratorFormDialogComponent, {
      injector: this.injector,
      label: 'Thêm Cộng Tác Viên',
      size: 'm',
    })({ collaborator: null }).subscribe(() => this.loadCollaborators());
  }

  openEditDialog(ctv: CollaboratorDto): void {
    tuiDialog(CollaboratorFormDialogComponent, {
      injector: this.injector,
      label: 'Sửa Cộng Tác Viên',
      size: 'm',
    })({ collaborator: ctv }).subscribe(() => this.loadCollaborators());
  }

  toggleActive(ctv: CollaboratorDto): void {
    const model = {
      collaboratorId: ctv.collaboratorId,
      fullName: ctv.fullName,
      phone: ctv.phone ?? undefined,
      idNumber: ctv.idNumber ?? undefined,
      storeId: ctv.storeId ?? undefined,
      note: ctv.note ?? undefined,
      commissionRate: ctv.commissionRate ?? undefined,
      isActive: !ctv.isActive,
    };
    this.collaboratorService.save(model).subscribe({
      next: r => {
        if (r.status) {
          this.alert.open(
            ctv.isActive ? 'Cộng tác viên đã bị tạm dừng' : 'Cộng tác viên đã được kích hoạt lại',
            { appearance: r.status ? 'positive' : 'negative' },
          ).subscribe();
          this.loadCollaborators();
        }
      },
      error: () => this.alert.open('Có lỗi xảy ra', { appearance: 'negative' }).subscribe(),
    });
  }

  deleteCollaborator(ctv: CollaboratorDto): void {
    if (!confirm(`Xóa cộng tác viên "${ctv.fullName}"?`)) return;
    const model = {
      collaboratorId: ctv.collaboratorId,
      fullName: ctv.fullName,
      phone: ctv.phone ?? undefined,
      idNumber: ctv.idNumber ?? undefined,
      storeId: ctv.storeId ?? undefined,
      note: ctv.note ?? undefined,
      commissionRate: ctv.commissionRate ?? undefined,
      isActive: false,
    };
    this.collaboratorService.save(model).subscribe({
      next: r => {
        if (r.status) {
          this.alert.open('Xóa cộng tác viên thành công', { appearance: 'positive' }).subscribe();
          this.loadCollaborators();
        } else {
          this.alert.open(r.message ?? 'Có lỗi xảy ra', { appearance: 'negative' }).subscribe();
        }
      },
      error: () => this.alert.open('Có lỗi xảy ra', { appearance: 'negative' }).subscribe(),
    });
  }
}
