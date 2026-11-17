import assert from 'node:assert/strict';
import test from 'node:test';
import access from './access';
import { applyAccessExtensions } from './access.extensions';
import {
  persistMyOrganizations,
  resetOrgContextForTests
} from './utils/org-context';

const platformOrg = {
  organization: {
    id: 10,
    name: 'default',
    is_personal: false,
    is_platform: true
  },
  role: 'owner'
};

const personal = {
  organization: { id: 2, name: 'alice', is_personal: true, is_platform: false },
  role: 'owner'
};

test('platform is_admin keeps canSeeOrgAdmin without inventing org_role on UserInfo', () => {
  resetOrgContextForTests();
  persistMyOrganizations([]);
  const admin = access({
    currentUser: { is_admin: true, username: 'admin' } as Global.UserInfo,
    myOrganizations: [],
    currentOrganizationId: null
  });
  assert.equal(admin.canSeeOrgAdmin, true);
  assert.equal(admin.canSeeAdmin, true);
  assert.equal(admin.canManageCurrentOrg, false);
});

test('Default Org Owner with is_admin=false is allowed; member and personal are not', () => {
  resetOrgContextForTests();
  const owner = access({
    currentUser: { is_admin: false, username: 'owner' } as Global.UserInfo,
    myOrganizations: [personal, platformOrg],
    currentOrganizationId: null
  });
  assert.equal(owner.canSeeOrgAdmin, true);
  assert.equal(owner.canSeeAdmin, false);

  const selectedOwner = access({
    currentUser: { is_admin: false, username: 'owner' } as Global.UserInfo,
    myOrganizations: [
      personal,
      {
        organization: { id: 44, name: 'acme', is_personal: false },
        role: 'owner'
      }
    ],
    currentOrganizationId: 44
  });
  assert.equal(selectedOwner.canSeeOrgAdmin, true);

  const member = access({
    currentUser: { is_admin: false, username: 'member' } as Global.UserInfo,
    myOrganizations: [
      personal,
      {
        organization: {
          id: 10,
          name: 'default',
          is_personal: false,
          is_platform: true
        },
        role: 'member'
      }
    ],
    currentOrganizationId: 10
  });
  assert.equal(member.canSeeOrgAdmin, false);
  assert.equal(member.canSeeUser, true);

  const personalOnly = access({
    currentUser: { is_admin: false, username: 'solo' } as Global.UserInfo,
    myOrganizations: [personal],
    currentOrganizationId: 2
  });
  assert.equal(personalOnly.canSeeOrgAdmin, false);

  const ambiguous = access({
    currentUser: { is_admin: false, username: 'owner' } as Global.UserInfo,
    myOrganizations: [
      personal,
      platformOrg,
      {
        organization: { id: 44, name: 'acme', is_personal: false },
        role: 'owner'
      }
    ],
    currentOrganizationId: null
  });
  assert.equal(ambiguous.canSeeOrgAdmin, false);
});

test('access.extensions is a no-op in OSS and does not invent Org Owner', () => {
  const base = {
    canSeeAdmin: true,
    canSeeOrgAdmin: true,
    canManageCurrentOrg: false,
    canSeeUser: false,
    canDelete: true,
    canLogin: true
  };
  assert.deepEqual(applyAccessExtensions(base), base);
  const memberBase = {
    ...base,
    canSeeAdmin: false,
    canSeeOrgAdmin: false,
    canSeeUser: true
  };
  assert.equal(applyAccessExtensions(memberBase).canSeeOrgAdmin, false);
});
