import assert from 'node:assert/strict';
import test from 'node:test';
import access from './access';
import { applyAccessExtensions } from './access.extensions';

test('OSS menu gate uses canSeeOrgAdmin from is_admin; this is not the Org Owner mapping', () => {
  const owner = access({
    currentUser: { is_admin: true, username: 'admin' } as Global.UserInfo
  });
  const member = access({
    currentUser: { is_admin: false, username: 'member' } as Global.UserInfo
  });
  assert.equal(owner.canSeeOrgAdmin, true);
  assert.equal(owner.canSeeAdmin, true);
  assert.equal(owner.canManageCurrentOrg, false);
  assert.equal(member.canSeeOrgAdmin, false);
  assert.equal(member.canSeeAdmin, false);
  assert.equal(member.canSeeUser, true);
  assert.equal(member.canManageCurrentOrg, false);
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
