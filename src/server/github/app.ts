import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";

let cached: Octokit | null = null;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function appOctokit(): Octokit {
  if (cached) return cached;
  const privateKey = requireEnv("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n");
  cached = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: requireEnv("GITHUB_APP_ID"),
      privateKey,
      installationId: requireEnv("GITHUB_APP_INSTALLATION_ID"),
    },
    userAgent: "ittikar-self-service-portal",
  });
  return cached;
}
