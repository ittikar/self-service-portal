import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { manifestSchema } from "~/server/schemas";
import { findRepo, GH_ORG, INFRA_REPOS, REPO_LABEL } from "~/lib/repos";
import { renderManifestYAML } from "~/lib/yaml";
import { createRequestIssue } from "~/server/github/issue";
import { appOctokit } from "~/server/github/app";
import { createWorklapTask, worklapEnabled } from "~/server/worklap/task";

const submitInput = z.object({
  repoSlug: z.string().min(1),
  manifest: manifestSchema,
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatWorklapValue(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.join(", ");
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>);
    return entries.length === 0 ? "—" : entries.map(([k, val]) => `${k}=${val}`).join(", ");
  }
  return String(v);
}

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

    let worklapTaskUuid: string | undefined;
    let worklapError: string | undefined;
    if (worklapEnabled()) {
      try {
        const fields = Object.entries(input.manifest as Record<string, unknown>)
          .filter(([k]) => k !== "resource")
          .map(([k, v]) => `<li><b>${escapeHtml(k)}</b>: ${escapeHtml(formatWorklapValue(v))}</li>`)
          .join("");

        const description = [
          `<p>Portal request from <b>@${escapeHtml(ghLogin)}</b></p>`,
          `<p><b>Repo:</b> ${escapeHtml(repo.slug)}<br>`,
          `<b>Resource:</b> ${escapeHtml(input.manifest.resource)}</p>`,
          `<p><b>GitHub issue:</b> <a href="${issue.url}">${issue.url}</a></p>`,
          `<p><b>Details:</b></p>`,
          `<ul>${fields}</ul>`,
        ].join("");

        const wl = await createWorklapTask({ title, description });
        worklapTaskUuid = wl.workItemUuid;
      } catch (err) {
        worklapError = err instanceof Error ? err.message : String(err);
        console.error("[submit] Worklap task creation failed:", worklapError);
      }
    }

    return { issueUrl: issue.url, issueNumber: issue.number, worklapTaskUuid, worklapError };
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
