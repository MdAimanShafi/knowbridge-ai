/**
 * Safe API request client with automatic JSON verification,
 * retry on server startup, and error insulation.
 */

export interface ApiResponse<T> {
  ok: boolean;
  data: T | null;
  status: number;
  error?: string;
}

export async function safeFetchJson<T>(
  url: string,
  options: RequestInit = {},
  retries = 2,
  delayMs = 500
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('kb_token');
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...options, headers });
      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok) {
          return { ok: true, data: data as T, status: res.status };
        } else {
          return {
            ok: false,
            data: null,
            status: res.status,
            error: data.error || `Request failed with status ${res.status}`,
          };
        }
      }

      // Received HTML or non-JSON (e.g. during server startup or reload)
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
        continue;
      }

      return {
        ok: false,
        data: null,
        status: res.status,
        error: 'Received non-JSON response from server.',
      };
    } catch (err: any) {
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
        continue;
      }
      return {
        ok: false,
        data: null,
        status: 0,
        error: err?.message || 'Network request failed',
      };
    }
  }

  return { ok: false, data: null, status: 0, error: 'Max retries exceeded' };
}
