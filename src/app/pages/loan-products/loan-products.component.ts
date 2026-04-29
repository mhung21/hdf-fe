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
import { FormsModule } from '@angular/forms';
import {
  TuiAlertService,
  TuiButton,
  TuiHint,
  TuiIcon,
  TuiTextfield,
  tuiDialog,
} from '@taiga-ui/core';

import { LoanProductProvider } from '../../api/api/loan-product.service';
import { SearchLoanProductRequest } from '../../api/model/search-loan-product-request';
import { AuthService } from '../../services/auth.service';
import { RoleCode } from '../../models/role.model';
import {
  DataTableComponent,
  ColumnDef,
} from '../../shared/components/data-table/data-table.component';
import {
  LoanProductFormDialogComponent,
  LoanProductFormItem,
} from './loan-product-form-dialog.component';

interface LoanProductItem {
  loanProductId: string;
  productCode?: string | null;
  productName?: string | null;
  description?: string | null;
  minPrincipalAmount?: number | null;
  maxPrincipalAmount?: number | null;
  minTermMonths?: number | null;
  maxTermMonths?: number | null;
  interestRateMonthly?: number | null;
  qlkvRateMonthly?: number | null;
  qltsRateMonthly?: number | null;
  fixedMonthlyFeeAmount?: number | null;
  defaultFileFeeAmount?: number | null;
  defaultInsuranceRate?: number | null;
  isActive?: boolean | null;
  storeId?: string | null;
  storeName?: string | null;
}

@Component({
  selector: 'app-loan-products',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TuiButton,
    TuiHint,
    TuiIcon,
    TuiTextfield,
    DataTableComponent,
  ],
  templateUrl: './loan-products.component.html',
})
export class LoanProductsComponent implements OnInit {
  private readonly productProvider = inject(LoanProductProvider);
  private readonly authService = inject(AuthService);
  private readonly alert = inject(TuiAlertService);
  private readonly injector = inject(Injector);
  deleting = signal(false);

  products = signal<LoanProductItem[]>([]);
  loading = signal(false);
  totalCount = signal(0);
  page = 0;
  size = 10;
  keyword = signal('');

  readonly tableColumns: ColumnDef[] = [
    { key: 'code', label: 'Mã sản phẩm' },
    { key: 'name', label: 'Tên sản phẩm' },
    { key: 'interest', label: 'Lãi suất', align: 'center' },
    { key: 'amount', label: 'Hạn mức' },
    { key: 'term', label: 'Kỳ hạn', align: 'center' },
    { key: 'status', label: 'Trạng thái', align: 'center' },
  ];

  canManage = computed(() =>
    this.authService.hasAnyRole([
      RoleCode.ADMIN,
      RoleCode.REGIONAL_MANAGER,
      RoleCode.STORE_MANAGER,
    ]),
  );

  asProduct(item: unknown): LoanProductItem {
    return item as LoanProductItem;
  }

  formatCurrency(val?: number | null): string {
    if (val == null) return '-';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  }

  ngOnInit(): void {
    this.loadProducts();
  }
  onKeywordChange(v: string): void {
    this.keyword.set(v);
    this.page = 0;
    this.loadProducts();
  }
  onPaginationChange(e: { page: number; size: number }): void {
    this.page = e.page;
    this.size = e.size;
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading.set(true);
    const req: SearchLoanProductRequest = {
      keyword: this.keyword() || null,
      pageIndex: this.page + 1,
      pageSize: this.size,
    };
    this.productProvider.apiLoanProductSearchPost({ searchLoanProductRequest: req }).subscribe({
      next: (r) => {
        if (r.status && r.data) {
          const data = r.data as { items?: LoanProductItem[]; totalCount?: number };
          this.products.set(
            data.items ?? (Array.isArray(r.data) ? (r.data as LoanProductItem[]) : []),
          );
          this.totalCount.set(data.totalCount ?? this.products().length);
        } else {
          this.products.set([]);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreateDialog(): void {
    tuiDialog(LoanProductFormDialogComponent, {
      injector: this.injector,
      label: 'Thêm Sản Phẩm',
      size: 'l',
    })(null).subscribe(() => this.loadProducts());
  }

  openEditDialog(item: LoanProductItem): void {
    tuiDialog(LoanProductFormDialogComponent, {
      injector: this.injector,
      label: 'Sửa Sản Phẩm',
      size: 'l',
    })(item as LoanProductFormItem).subscribe(() => this.loadProducts());
  }

  softDeleteProduct(item: LoanProductItem): void {
    if (
      !confirm(
        `Vô hiệu hóa sản phẩm “${item.productName}”? Sản phẩm sẽ không hiển thị trong danh sách nữa nhưng vừán giữ trong hệ thống.`,
      )
    )
      return;
    this.deleting.set(true);
    this.productProvider
      .apiLoanProductSavePost({
        cULoanProductModel: {
          loanProductId: item.loanProductId,
          productCode: item.productCode ?? '',
          productName: item.productName ?? '',
          description: item.description,
          storeId: item.storeId,
          minPrincipalAmount: item.minPrincipalAmount ?? undefined,
          maxPrincipalAmount: item.maxPrincipalAmount ?? undefined,
          minTermMonths: item.minTermMonths ?? undefined,
          maxTermMonths: item.maxTermMonths ?? undefined,
          interestRateMonthly: item.interestRateMonthly ?? undefined,
          qlkvRateMonthly: item.qlkvRateMonthly ?? undefined,
          qltsRateMonthly: item.qltsRateMonthly ?? undefined,
          fixedMonthlyFeeAmount: item.fixedMonthlyFeeAmount ?? undefined,
          defaultFileFeeAmount: item.defaultFileFeeAmount ?? undefined,
          defaultInsuranceRate: item.defaultInsuranceRate ?? undefined,
          isActive: false,
        },
      })
      .subscribe({
        next: (r) => {
          this.deleting.set(false);
          if (r.status) {
            this.alert
              .open('Vô hiệu hóa sản phẩm thành công.', { appearance: 'positive' })
              .subscribe();
            this.loadProducts();
          } else {
            this.alert.open(r.message ?? 'Có lỗi xảy ra.', { appearance: 'negative' }).subscribe();
          }
        },
        error: () => {
          this.deleting.set(false);
          this.alert.open('Lỗi kết nối.', { appearance: 'negative' }).subscribe();
        },
      });
  }
}
