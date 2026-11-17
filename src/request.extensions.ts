// Identity hook for build-time request-interceptor extensions. Tooling
// may overwrite this file to inject extra interceptors (e.g. context
// headers); the original is restored on cleanup. Mirrors
// `src/access.extensions.ts` and `config/routes.extensions.ts`.
//
// Each interceptor follows the umi/max signature: it receives
// `(url, options)` and returns `{ url, options }` — typed loosely
// here so this file has no dependency on the framework's exact
// option types.
import { orgTenantHeaders } from '@/utils/org-context';

export type RequestInterceptor = (
  url: string,
  options: Record<string, any>
) => { url: string; options: Record<string, any> };

export const getTenantHeaders = (
  _method?: string
): Record<string, string> => orgTenantHeaders();

export const extraRequestInterceptors: RequestInterceptor[] = [
  (url, options) => {
    const extra = getTenantHeaders(options?.method);
    if (!Object.keys(extra).length) {
      return { url, options };
    }
    const existing = options?.headers || {};
    if (existing['X-Organization-Id'] || existing['x-organization-id']) {
      return { url, options };
    }
    return {
      url,
      options: {
        ...options,
        headers: {
          ...existing,
          ...extra
        }
      }
    };
  }
];

export type ResponseInterceptor = (response: any) => any;

export const extraResponseInterceptors: ResponseInterceptor[] = [];
