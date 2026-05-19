// Thin Worklap REST client. Caches the bearer token in-process for 50 minutes,
// re-logs in transparently when expired.

type LoginResponse = {
  // Worklap wraps login under { response: { authToken, appUserUuid, orgUuid, ... } }
  response?: {
    authToken?: string;
    appUserUuid?: string;
    orgUuid?: string;
    [k: string]: unknown;
  };
  // Other endpoints sometimes return { status, message, data }
  status?: string | number;
  message?: string;
  data?: unknown;
};

type CachedToken = { token: string; expiresAt: number };

let cached: CachedToken | null = null;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function baseUrl(): string {
  // QA: https://wlqa.testingmonkey.com/api
  // Prod: https://api.worklap.com
  return requireEnv("WORKLAP_API_URL").replace(/\/$/, "");
}

const NGROK_HEADER = { "ngrok-skip-browser-warning": "true" };

async function login(): Promise<string> {
  const url = `${baseUrl()}/auth/login/native`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...NGROK_HEADER,
    },
    body: JSON.stringify({
      email: requireEnv("WORKLAP_EMAIL"),
      password: requireEnv("WORKLAP_PASSWORD"),
    }),
  });
  if (!res.ok) {
    throw new Error(`Worklap login failed: ${res.status} ${await res.text()}`);
  }
  const body: LoginResponse = await res.json();
  const token = body.response?.authToken;
  if (!token) {
    throw new Error(
      `Worklap login: could not find authToken in response body=${JSON.stringify(body).slice(0, 300)}`,
    );
  }
  cached = { token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return token;
}

async function getToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  return login();
}

export type WorklapResponse<T = unknown> = {
  status?: string | number;
  message?: string;
  data?: T;
};

export async function worklapFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<WorklapResponse<T>> {
  let token = await getToken();
  let res = await doRequest(token);
  if (res.status === 401 || res.status === 403) {
    cached = null;
    token = await login();
    res = await doRequest(token);
  }
  if (!res.ok) {
    throw new Error(`Worklap ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();

  async function doRequest(t: string) {
    return fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${t}`,
        ...NGROK_HEADER,
        ...(init.headers ?? {}),
      },
    });
  }
}
