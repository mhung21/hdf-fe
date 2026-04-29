export enum RoleCode {
  ADMIN = 'ADMIN',
  REGIONAL_MANAGER = 'REGIONAL_MANAGER',
  STORE_MANAGER = 'STORE_MANAGER',
  STAFF = 'STAFF',
}

const NUMERIC_ROLE_MAP: Record<number, RoleCode> = {
  0: RoleCode.ADMIN,
  1: RoleCode.REGIONAL_MANAGER,
  2: RoleCode.STORE_MANAGER,
  3: RoleCode.STAFF,
};

const STRING_ROLE_ALIASES: Record<string, RoleCode> = {
  ADMIN: RoleCode.ADMIN,
  ROLE_ADMIN: RoleCode.ADMIN,
  SUPER_ADMIN: RoleCode.ADMIN,
  SUPERADMIN: RoleCode.ADMIN,

  REGIONAL_MANAGER: RoleCode.REGIONAL_MANAGER,
  REGIONALMANAGER: RoleCode.REGIONAL_MANAGER,
  ROLE_REGIONAL_MANAGER: RoleCode.REGIONAL_MANAGER,

  STORE_MANAGER: RoleCode.STORE_MANAGER,
  STOREMANAGER: RoleCode.STORE_MANAGER,
  MANAGER: RoleCode.STORE_MANAGER,
  ROLE_STORE_MANAGER: RoleCode.STORE_MANAGER,

  STAFF: RoleCode.STAFF,
  USER: RoleCode.STAFF,
  EMPLOYEE: RoleCode.STAFF,
  ROLE_STAFF: RoleCode.STAFF,
};

export function normalizeRoleCode(role: unknown): RoleCode | null {
  if (role === null || role === undefined) {
    return null;
  }

  if (typeof role === 'string') {
    const trimmed = role.trim();
    const upper = trimmed.toUpperCase();
    const canonical = upper.replace(/[\s-]+/g, '_');

    if (STRING_ROLE_ALIASES[canonical]) {
      return STRING_ROLE_ALIASES[canonical];
    }

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      return NUMERIC_ROLE_MAP[numeric] ?? null;
    }

    return null;
  }

  if (typeof role === 'number') {
    return NUMERIC_ROLE_MAP[role] ?? null;
  }

  return null;
}
