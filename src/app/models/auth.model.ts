import { RoleCode } from './role.model';

export interface LoginRequest {
  username: string;
  password: string;
  deviceInfo?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AuthResponse {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  roleCode: string | number;
  storeId?: string;
  storeName?: string;
  /** Only for REGIONAL_MANAGER: managed store ids */
  storeIds?: string[];
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  permissions: string[];
  mustChangePassword: boolean;
}

export interface CurrentUser {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  role: RoleCode;
  storeId?: string;
  storeName?: string;
  /** Only for REGIONAL_MANAGER: managed store ids */
  storeIds?: string[];
  avatar?: string;
}
