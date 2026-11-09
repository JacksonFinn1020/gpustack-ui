import {
  isTrustedOrgOwner,
  MyOrganization,
  readStoredCurrentOrganizationId,
  readStoredMyOrganizations
} from '@/utils/org-context';
import { applyAccessExtensions } from './access.extensions';

export default (initialState: {
  currentUser?: Global.UserInfo;
  hasKubernetesCluster?: boolean;
  hasResourceEvents?: boolean;
  myOrganizations?: MyOrganization[];
  currentOrganizationId?: number | null;
}) => {
  const isPlatformAdmin = !!(
    initialState &&
    initialState.currentUser &&
    initialState.currentUser.is_admin
  );
  const canSeeUser = !!(
    initialState &&
    initialState.currentUser &&
    !initialState.currentUser.is_admin
  );
  // GPU Service is Kubernetes-only. We only gate visibility down when
  // the probe in `getInitialState` came back with a definitive answer;
  // `undefined` (probe failed / not yet ready) collapses to the
  // role-based default so a transient network blip can't lock anyone
  // out of the menu.
  const hasKubernetesCluster = initialState?.hasKubernetesCluster;
  // Having run GPU/CPU instances or storage (any resource_events) also unlocks
  // GPU Service / the full Usage page — a user who used it keeps seeing it even
  // without a current cluster. MaaS-only users (no cluster, no events) don't.
  const hasResourceEvents = !!initialState?.hasResourceEvents;

  // Predicate roles, top-down by strictness:
  //   * `canSeeAdmin` — strictly platform admin (`users.is_admin`).
  //     Gates Users.
  //   * `canSeeOrgAdmin` — admin-style menus that work cross-org
  //     (Dashboard, Resources, Models, Cluster Management, TOS).
  //     Platform `is_admin`, or GET /users/me/organizations role=owner
  //     with organization.is_personal=false and X-Organization-Id set
  //     to that organization.id (selected org, or the only non-personal
  //     membership). Personal owner rows stay false. Members stay false.
  //   * `canSeeGpuService` — GPU Service menu. Anyone allowed to
  //     manage clusters (admins, Org owners) sees it; non-admins fall
  //     through to "show only if a Kubernetes cluster is actually
  //     reachable" so Org members without scheduling access don't see
  //     a dead-end menu item.
  //   * `canManageCurrentOrg` — pages that only make sense inside a
  //     specific org context (member / group management). Defaults to
  //     `false`; extensions widen when both an org is selected AND
  //     the caller is admin of it.
  // Pass through `applyAccessExtensions` so build-time tooling can
  // widen these without editing this file. Default is a no-op.
  const memberships =
    initialState?.myOrganizations ?? readStoredMyOrganizations();
  const selectedOrganizationId =
    initialState?.currentOrganizationId !== undefined
      ? initialState.currentOrganizationId
      : readStoredCurrentOrganizationId();
  const canSeeCurrentOrgOwner = isTrustedOrgOwner(
    memberships,
    selectedOrganizationId ?? null
  );

  return applyAccessExtensions({
    canSeeAdmin: isPlatformAdmin,
    canSeeOrgAdmin: isPlatformAdmin || canSeeCurrentOrgOwner,
    canSeeGpuService:
      isPlatformAdmin || hasKubernetesCluster !== false || hasResourceEvents,
    canManageCurrentOrg: false,
    canSeeUser,
    canDelete: true,
    canLogin: true
  });
};
