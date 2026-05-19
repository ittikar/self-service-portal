import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { manifestSchema } from "~/server/schemas";
import { findRepo, GH_ORG, INFRA_REPOS, REPO_LABEL } from "~/lib/repos";
import { renderManifestYAML } from "~/lib/yaml";
import { createRequestIssue } from "~/server/github/issue";
import { appOctokit } from "~/server/github/app";

const submitInput = z.object({
  repoSlug: z.string().min(1),
  manifest: manifestSchema,
});

function loginFromSession(session: unknown): string {
  return (
    (session as { ghLogin?: string } | null)?.ghLogin ??
    (session as { user?: { name?: string } } | null)?.user?.name ??
    "unknown"
  );
}

export const requestRouter = createTRPCRouter({
  submit: protectedProcedure.input(submitInput).mutation(async ({ input, ctx }) => {
    const repo = findRepo(input.repoSlug);
    if (!repo) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown repo" });

    const ghLogin = loginFromSession(ctx.session);
    const manifestYaml = renderManifestYAML(input.manifest);
    const name = (input.manifest as { name?: string }).name ?? "unnamed";
    const title = `Request: ${input.manifest.resource} — ${name}`;

    const issue = await createRequestIssue({
      repoSlug: repo.slug,
      title,
      manifestYaml,
      requesterLogin: ghLogin,
      formFields: input.manifest,
    });

    return { issueUrl: issue.url, issueNumber: issue.number };
  }),

  myRecent: protectedProcedure.query(async ({ ctx }) => {
    const ghLogin = loginFromSession(ctx.session);
    const octokit = appOctokit();

    const results = await Promise.all(
      INFRA_REPOS.map(async (r) => {
        try {
          const { data } = await octokit.rest.issues.listForRepo({
            owner: GH_ORG,
            repo: r.slug,
            labels: REPO_LABEL,
            state: "all",
            assignee: ghLogin,
            per_page: 20,
          });
          return data.map((issue) => ({
            repoSlug: r.slug,
            repoName: r.name,
            number: issue.number,
            title: issue.title,
            state: issue.state,
            url: issue.html_url,
            createdAt: issue.created_at,
          }));
        } catch {
          return [];
        }
      }),
    );
    return results.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }),
});
