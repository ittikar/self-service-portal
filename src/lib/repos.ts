export type InfraRepo = {
  slug: string;
  name: string;
  description: string;
  defaultBranch: string;
  hasWorkflows: boolean;
  group: "itti" | "mondevo";
};

export const INFRA_REPOS: InfraRepo[] = [
  // --- itti ---
  {
    slug: "itti-bank-ai-infra",
    name: "Bank AI",
    description: "ECS + ALB for bank-ai agents (concierge, onboarding, market intelligence)",
    defaultBranch: "dev",
    hasWorkflows: true,
    group: "itti",
  },
  {
    slug: "itti-bank-core-infra",
    name: "Bank Core",
    description: "Banking core APIs — ECS, ALB, task defs",
    defaultBranch: "dev",
    hasWorkflows: true,
    group: "itti",
  },
  {
    slug: "itti-customer-core-infra",
    name: "Customer Core",
    description: "Customer core platform — VPC, compute, ACM",
    defaultBranch: "dev",
    hasWorkflows: true,
    group: "itti",
  },
  {
    slug: "itti-docs-infra",
    name: "Docs",
    description: "Static docs site — S3 + CloudFront + Route53",
    defaultBranch: "main",
    hasWorkflows: true,
    group: "itti",
  },
  {
    slug: "itti-finance-infra",
    name: "Finance",
    description: "Finance services — ECS, ALB, task defs",
    defaultBranch: "dev",
    hasWorkflows: true,
    group: "itti",
  },
  {
    slug: "itti-siav-infra",
    name: "SIAV",
    description: "SIAV workload — shared + compute layers",
    defaultBranch: "dev",
    hasWorkflows: true,
    group: "itti",
  },
  {
    slug: "itti-network-infra",
    name: "Network",
    description: "Hub VPC, Transit Gateway, route tables",
    defaultBranch: "dev",
    hasWorkflows: false,
    group: "itti",
  },
  {
    slug: "itti-ui-infra",
    name: "UI",
    description: "Merchant + customer UIs — S3 + CloudFront",
    defaultBranch: "main",
    hasWorkflows: false,
    group: "itti",
  },
  // --- mondevo (also hosted under ittikar org) ---
  {
    slug: "mondevo-org-infra",
    name: "Mondevo Org",
    description: "Organization-level — accounts, SCPs, IAM users",
    defaultBranch: "main",
    hasWorkflows: false,
    group: "mondevo",
  },
  {
    slug: "mondevo-customer-core-infra",
    name: "Mondevo Customer Core",
    description: "Mondevo customer-core compute + networking",
    defaultBranch: "main",
    hasWorkflows: false,
    group: "mondevo",
  },
  {
    slug: "mondevo-network-infra",
    name: "Mondevo Network",
    description: "Mondevo network hub — VPC, TGW, RAM",
    defaultBranch: "main",
    hasWorkflows: false,
    group: "mondevo",
  },
  {
    slug: "mondevo-shared-intelligence-infra",
    name: "Mondevo Shared Intelligence",
    description: "Shared intelligence services — ECS + network",
    defaultBranch: "main",
    hasWorkflows: false,
    group: "mondevo",
  },
];

export const GH_ORG = "ittikar";

export const REPO_LABEL = "portal:request";

export function findRepo(slug: string): InfraRepo | undefined {
  return INFRA_REPOS.find((r) => r.slug === slug);
}
