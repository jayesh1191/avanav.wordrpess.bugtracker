import type { BugTrackerConfig } from '@/types';

export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;
  data: Record<string, unknown>;
  constructor(message: string, status: number, code = 'error', fields: Record<string, string> = {}, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.data = data;
  }
}

export const config = (): BugTrackerConfig => window.BugTrackerConfig;

let nonce = '';

type Params = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, params?: Params) {
  const url = new URL(config().restUrl.replace(/\/?$/, '/') + path.replace(/^\//, ''), window.location.origin);
  // Plain permalinks use ?rest_route=… – keep it intact when appending params.
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function request<T>(method: string, path: string, opts: { params?: Params; body?: unknown; form?: FormData } = {}): Promise<T> {
  if (!nonce) nonce = config().nonce;
  const headers: Record<string, string> = { 'X-WP-Nonce': nonce, Accept: 'application/json' };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.params), { method, headers, body, credentials: 'same-origin' });
  } catch {
    throw new ApiError('Network error – check your connection and try again.', 0, 'network');
  }
  const fresh = res.headers.get('X-BT-Nonce');
  if (fresh) nonce = fresh;

  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON (e.g. PHP notice) */ }

  if (!res.ok) {
    const msg =
      json?.message ||
      (res.status === 403 || res.status === 401
        ? 'You do not have permission to do that. Try reloading the page.'
        : `Request failed (${res.status}).`);
    throw new ApiError(msg, res.status, json?.code, json?.data?.fields ?? {}, json?.data ?? {});
  }
  if (json === null) throw new ApiError('The server returned an unexpected response.', res.status, 'bad_response');
  return json as T;
}

export const api = {
  get: <T>(path: string, params?: Params) => request<T>('GET', path, { params }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body: body ?? {} }),
  del: <T>(path: string, params?: Params) => request<T>('DELETE', path, { params }),
  upload: <T>(path: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<T>('POST', path, { form });
  },
};
