import axios, { type AxiosInstance } from 'axios';
import { env } from '../lib/config.js';
import type { Target } from '../schemas/scraper-config.js';

function cookieHeader(cookies: Target['cookies']): string | undefined {
  if (!cookies) return undefined;
  if (typeof cookies === 'string') return cookies;
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/** One axios instance per run, carrying the target's headers, cookies and auth. */
export function createClient(target: Target = {}): AxiosInstance {
  const headers: Record<string, string> = {
    'user-agent': env.userAgent,
    accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
    ...(target.headers ?? {}),
  };

  const cookie = cookieHeader(target.cookies);
  if (cookie) headers.cookie = cookie;

  const auth = target.auth;
  if (auth?.type === 'bearer' && auth.token) headers.authorization = `Bearer ${auth.token}`;
  if (auth?.type === 'header' && auth.header && auth.token) headers[auth.header.toLowerCase()] = auth.token;

  return axios.create({
    timeout: target.timeout_ms ?? env.defaultTimeout,
    headers,
    maxRedirects: 5,
    validateStatus: undefined,
    auth:
      auth?.type === 'basic' && auth.username
        ? { username: auth.username, password: auth.password ?? '' }
        : undefined,
  } as never);
}

export async function fetchHtml(client: AxiosInstance, url: string): Promise<string> {
  const res = await client.get(url, { responseType: 'text', transformResponse: (d) => d });
  if (res.status >= 400) throw new Error(`GET ${url} responded ${res.status}`);
  return String(res.data ?? '');
}
