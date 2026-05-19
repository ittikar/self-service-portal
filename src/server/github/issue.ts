import { appOctokit } from "./app";
import { GH_ORG, REPO_LABEL } from "~/lib/repos";

type CreateIssueArgs = {
  repoSlug: string;
  title: string;
  manifestYaml: string;
  requesterLogin: string;
  formFields: Record<string, unknown>;
};

export async function createRequestIssue(args: CreateIssueArgs) {
  const octokit = appOctokit();
  const body = buildIssueBody(args);

  await ensureLabel(args.repoSlug);

  const { data } = await octokit.rest.issues.create({
    owner: GH_ORG,
    repo: args.repoSlug,
    title: args.title,
    body,
    labels: [REPO_LABEL],
    assignees: args.requesterLogin ? [args.requesterLogin] : undefined,
  });

  return { url: data.html_url, number: data.number };
}

function buildIssueBody({ manifestYaml, requesterLogin, formFields }: CreateIssueArgs): string {
  const fieldRows = Object.entries(formFields)
    .map(([k, v]) => `| \`${k}\` | ${formatValue(v)} |`)
    .join("\n");

  return `Requested by @${requesterLogin}

### Fields
| Field | Value |
|---|---|
${fieldRows}

### Manifest
\`\`\`yaml
${manifestYaml.trim()}
\`\`\`

---
*Opened via the self-service portal. The platform team's TUI will process it.*
`;
}

function formatValue(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "boolean") return v ? "✓" : "✗";
  if (typeof v === "object") return `\`${JSON.stringify(v)}\``;
  return String(v);
}

async function ensureLabel(repoSlug: string) {
  const octokit = appOctokit();
  try {
    await octokit.rest.issues.getLabel({ owner: GH_ORG, repo: repoSlug, name: REPO_LABEL });
  } catch {
    try {
      await octokit.rest.issues.createLabel({
        owner: GH_ORG,
        repo: repoSlug,
        name: REPO_LABEL,
        color: "0e8a16",
        description: "Self-service portal request",
      });
    } catch {
      // label might already exist; ignore
    }
  }
}
