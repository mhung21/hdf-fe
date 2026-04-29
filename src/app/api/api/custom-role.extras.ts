/**
 * Companion file cho CustomRoleProvider (generated).
 * Thêm shorthand methods, interfaces, và re-exports để các component không phải dùng
 * tên API dài như apiCustomRoleGetAllGet().
 * File này KHÔNG bị overwrite khi chạy `pnpm ga`.
 */

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpContext } from '@angular/common/http';

import { CustomRoleProvider } from './custom-role.service';
import { CUCustomRoleModel } from '../model/cu-custom-role-model';
import { ResultAPI } from '../model/result-api';

// Re-export để component import 1 chỗ
export type { CUCustomRoleModel };

export interface CustomRoleDto {
  customRoleId: string;
  roleName: string;
  description?: string | null;
  isActive: boolean;
  /** null = vai trò toàn hệ thống (Admin tạo); có giá trị = chỉ trong store cụ thể (StoreManager tạo). */
  storeId?: string | null;
  permissionCount: number;
  userCount: number;
  createdAt: string;
}

export interface AssignRolesToUserPayload {
  userId: string;
  customRoleIds: string[];
}

export interface SavePermissionsPayload {
  customRoleId: string;
  permissionIds: string[];
}

/**
 * Shorthand wrapper quanh CustomRoleProvider.
 * Inject cái này khi cần API ngắn gọn hơn.
 * Cũng import và re-export CustomRoleProvider gốc nên component chỉ cần import file này.
 */
@Injectable({ providedIn: 'root' })
export class CustomRoleService {
  private readonly provider = inject(CustomRoleProvider);

  getAll(options?: { context?: HttpContext }): Observable<ResultAPI> {
    return this.provider.apiCustomRoleGetAllGet(undefined, undefined, options);
  }

  save(model: CUCustomRoleModel, options?: { context?: HttpContext }): Observable<ResultAPI> {
    return this.provider.apiCustomRoleSavePost({ cUCustomRoleModel: model }, undefined, undefined, options);
  }

  getPermissions(roleId: string, options?: { context?: HttpContext }): Observable<ResultAPI> {
    return this.provider.apiCustomRoleGetPermissionsPost({ body: JSON.stringify(roleId) }, undefined, undefined, options);
  }

  savePermissions(payload: SavePermissionsPayload, options?: { context?: HttpContext }): Observable<ResultAPI> {
    return this.provider.apiCustomRoleSavePermissionsPost(
      { saveCustomRolePermissionsRequest: { customRoleId: payload.customRoleId, permissionIds: payload.permissionIds } },
      undefined, undefined, options,
    );
  }

  getRolesForUser(userId: string, options?: { context?: HttpContext }): Observable<ResultAPI> {
    return this.provider.apiCustomRoleGetRolesForUserPost({ body: JSON.stringify(userId) }, undefined, undefined, options);
  }

  assignRolesToUser(payload: AssignRolesToUserPayload, options?: { context?: HttpContext }): Observable<ResultAPI> {
    return this.provider.apiCustomRoleAssignRolesToUserPost(
      { assignCustomRolesToUserRequest: { userId: payload.userId, customRoleIds: payload.customRoleIds } },
      undefined, undefined, options,
    );
  }

  deleteRole(roleId: string, options?: { context?: HttpContext }): Observable<ResultAPI> {
    return this.provider.apiCustomRoleDeletePost({ body: JSON.stringify(roleId) }, undefined, undefined, options);
  }
}
