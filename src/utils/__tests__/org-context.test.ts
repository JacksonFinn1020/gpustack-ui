import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isTrustedOrgOwner,
  orgTenantHeaders,
  persistMyOrganizations,
  resetOrgContextForTests,
  resolveActingOrganizationId
} from '../org-context';

const personal = {
  organization: { id: 2, name: 'alice', is_personal: true },
  role: 'owner' as const
};
const platformOwner = {
  organization: {
    id: 10,
    name: 'default',
    is_personal: false,
    is_platform: true
  },
  role: 'owner' as const
};
const platformMember = {
  organization: {
    id: 10,
    name: 'default',
    is_personal: false,
    is_platform: true
  },
  role: 'member' as const
};
const acmeOwner = {
  organization: { id: 44, name: 'acme', is_personal: false },
  role: 'owner' as const
};

test('acting org header matches Owner, member, admin-all, and personal', () => {
  resetOrgContextForTests();
  persistMyOrganizations([personal, platformOwner]);
  assert.equal(
    resolveActingOrganizationId([personal, platformOwner], null),
    10
  );
  assert.deepEqual(orgTenantHeaders([personal, platformOwner], null), {
    'X-Organization-Id': '10'
  });
  assert.equal(isTrustedOrgOwner([personal, platformOwner], null), true);

  assert.equal(resolveActingOrganizationId([personal, acmeOwner], 44), 44);
  assert.equal(isTrustedOrgOwner([personal, acmeOwner], 44), true);

  assert.equal(
    isTrustedOrgOwner([personal, platformMember], 10),
    false
  );
  assert.deepEqual(orgTenantHeaders([personal, platformMember], 10), {
    'X-Organization-Id': '10'
  });

  assert.equal(resolveActingOrganizationId([personal], 2), null);
  assert.deepEqual(orgTenantHeaders([personal], 2), {});
  assert.equal(isTrustedOrgOwner([personal], 2), false);

  assert.equal(resolveActingOrganizationId([], null), null);
  assert.deepEqual(orgTenantHeaders([], null), {});
});

test('does not silently pick a tenant when more than one non-personal org exists', () => {
  assert.equal(
    resolveActingOrganizationId([personal, platformOwner, acmeOwner], null),
    null
  );
  assert.deepEqual(
    orgTenantHeaders([personal, platformOwner, acmeOwner], null),
    {}
  );
  assert.equal(
    isTrustedOrgOwner([personal, platformOwner, acmeOwner], null),
    false
  );
  assert.equal(
    resolveActingOrganizationId([personal, platformOwner, acmeOwner], 44),
    44
  );
  assert.equal(
    isTrustedOrgOwner([personal, platformOwner, acmeOwner], 10),
    true
  );
});
