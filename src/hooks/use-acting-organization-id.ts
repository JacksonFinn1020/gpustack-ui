import { currentOrganizationIdAtom } from '@/atoms/user';
import {
  readStoredMyOrganizations,
  resolveActingOrganizationId
} from '@/utils/org-context';
import { useAtomValue } from 'jotai';

export const useActingOrganizationId = () => {
  const selectedId = useAtomValue(currentOrganizationIdAtom);
  return resolveActingOrganizationId(
    readStoredMyOrganizations(),
    selectedId ?? null
  );
};
