export const MY_ORGANIZATIONS_KEY = 'myOrganizations';
export const CURRENT_ORGANIZATION_ID_KEY = 'currentOrganizationId';

export const OrgRole = {
  owner: 'owner',
  member: 'member'
} as const;

export type OrgRoleValue = (typeof OrgRole)[keyof typeof OrgRole];

export type MyOrganizationPublic = {
  id: number;
  name?: string | null;
  display_name?: string | null;
  is_personal?: boolean;
  is_platform?: boolean;
};

export type MyOrganization = {
  organization: MyOrganizationPublic;
  role?: OrgRoleValue | string | null;
};

const memory = new Map<string, string>();
const STORAGE_PREFIX = 'gpustack:';

const namespacedKey = (key: string) => `${STORAGE_PREFIX}${key}`;

const browserLocal = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const readRaw = (key: string): string | null => {
  try {
    const value = browserLocal()?.getItem(namespacedKey(key));
    if (value != null && value !== '') {
      return value;
    }
  } catch {
    // Node tests have no localStorage.
  }
  return memory.get(key) ?? null;
};

const writeRaw = (key: string, value: string) => {
  memory.set(key, value);
  try {
    browserLocal()?.setItem(namespacedKey(key), value);
  } catch {
    // Node tests and environments without localStorage.
  }
};

export const resetOrgContextForTests = () => {
  memory.clear();
  try {
    browserLocal()?.removeItem(namespacedKey(MY_ORGANIZATIONS_KEY));
    browserLocal()?.removeItem(namespacedKey(CURRENT_ORGANIZATION_ID_KEY));
  } catch {
    // ignore
  }
};

export const persistMyOrganizations = (items: MyOrganization[] = []) => {
  writeRaw(MY_ORGANIZATIONS_KEY, JSON.stringify(items));
};

export const readStoredMyOrganizations = (): MyOrganization[] => {
  const raw = readRaw(MY_ORGANIZATIONS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const persistCurrentOrganizationId = (id: number | null) => {
  if (id == null) {
    memory.delete(CURRENT_ORGANIZATION_ID_KEY);
    try {
      browserLocal()?.removeItem(namespacedKey(CURRENT_ORGANIZATION_ID_KEY));
    } catch {
      // ignore
    }
    return;
  }
  writeRaw(CURRENT_ORGANIZATION_ID_KEY, JSON.stringify(id));
};

export const readStoredCurrentOrganizationId = (): number | null => {
  const raw = readRaw(CURRENT_ORGANIZATION_ID_KEY);
  if (!raw) {
    return null;
  }
  try {
    const value = JSON.parse(raw);
    return typeof value === 'number' ? value : null;
  } catch {
    const asNumber = Number(raw);
    return Number.isFinite(asNumber) ? asNumber : null;
  }
};

export const isPersonalOrganization = (org?: MyOrganizationPublic | null) =>
  Boolean(org?.is_personal);

export const isOrgOwnerRole = (role?: string | null) =>
  String(role || '').toLowerCase() === OrgRole.owner;

export const findMembership = (
  memberships: MyOrganization[] = [],
  organizationId?: number | null
) => {
  if (organizationId == null) {
    return undefined;
  }
  return memberships.find(
    (item) => item?.organization?.id === organizationId
  );
};

export const nonPersonalMemberships = (memberships: MyOrganization[] = []) =>
  memberships.filter(
    (item) =>
      item?.organization?.id != null &&
      !isPersonalOrganization(item.organization)
  );

export const resolveActingOrganizationId = (
  memberships: MyOrganization[] = [],
  selectedId: number | null = readStoredCurrentOrganizationId()
): number | null => {
  if (selectedId != null) {
    const selected = findMembership(memberships, selectedId);
    if (!selected || isPersonalOrganization(selected.organization)) {
      return null;
    }
    return selected.organization.id;
  }
  const orgs = nonPersonalMemberships(memberships);
  if (orgs.length === 1) {
    return orgs[0].organization.id;
  }
  return null;
};

export const isTrustedOrgOwner = (
  memberships: MyOrganization[] = [],
  selectedId: number | null = readStoredCurrentOrganizationId()
) => {
  const actingId = resolveActingOrganizationId(memberships, selectedId);
  if (actingId == null) {
    return false;
  }
  const membership = findMembership(memberships, actingId);
  return Boolean(
    membership &&
      !isPersonalOrganization(membership.organization) &&
      isOrgOwnerRole(membership.role)
  );
};

export const orgTenantHeaders = (
  memberships: MyOrganization[] = readStoredMyOrganizations(),
  selectedId: number | null = readStoredCurrentOrganizationId()
): Record<string, string> => {
  const actingId = resolveActingOrganizationId(memberships, selectedId);
  if (actingId == null) {
    return {};
  }
  return { 'X-Organization-Id': String(actingId) };
};

export const getOrgAccessSnapshot = (
  memberships: MyOrganization[] = readStoredMyOrganizations(),
  selectedId: number | null = readStoredCurrentOrganizationId()
) => ({
  myOrganizations: memberships,
  currentOrganizationId: selectedId,
  actingOrganizationId: resolveActingOrganizationId(memberships, selectedId)
});
