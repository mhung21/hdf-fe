/**
 * Extras cho RolePermissionProvider — thêm phương thức thủ công cho endpoint mới
 * chưa được tái sinh bởi OpenAPI Generator.
 * File này KHÔNG bị overwrite khi chạy `pnpm ga`.
 */

import { Injectable, Inject, Optional, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';

import { BASE_PATH } from '../variables';
import { Configuration } from '../configuration';
import { ResultAPI } from '../model/result-api';

@Injectable({ providedIn: 'root' })
export class RolePermissionExtras {
  private readonly http = inject(HttpClient);
  private readonly basePath: string;

  constructor(
    @Optional() @Inject(BASE_PATH) basePath: string | string[],
    @Optional() configuration?: Configuration,
  ) {
    const bp = configuration?.basePath ?? (Array.isArray(basePath) ? basePath[0] : basePath) ?? '';
    this.basePath = bp.replace(/\/+$/, '');
  }

  /**
   * Lấy danh sách quyền có thể gán cho vai trò tùy chỉnh.
   * Đã loại bỏ quyền mặc định của STAFF.
   * Admin: tất cả trừ STAFF defaults. StoreManager: phạm vi STORE_MANAGER trừ STAFF defaults.
   */
  getAssignablePermissions(options?: { context?: HttpContext }): Observable<ResultAPI> {
    return this.http.get<ResultAPI>(
      `${this.basePath}/api/RolePermission/GetAssignablePermissions`,
      { context: options?.context },
    );
  }

  /**
   * Ghi đè toàn bộ quyền mặc định của một vai trò. Chỉ ADMIN.
   */
  saveRolePermissions(
    roleCode: string,
    permissionIds: string[],
    options?: { context?: HttpContext },
  ): Observable<ResultAPI> {
    return this.http.post<ResultAPI>(
      `${this.basePath}/api/RolePermission/SaveRolePermissions`,
      { roleCode, permissionIds },
      { context: options?.context },
    );
  }

  /**
   * Xóa toàn bộ cache phân quyền. Chỉ ADMIN.
   */
  clearPermissionCache(options?: { context?: HttpContext }): Observable<ResultAPI> {
    return this.http.post<ResultAPI>(
      `${this.basePath}/api/RolePermission/ClearPermissionCache`,
      {},
      { context: options?.context },
    );
  }
}
