"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/client";
import { GenericForm } from "~/components/forms/generic-form";
import type { ResourceDef } from "~/server/schemas/_types";
import type { Manifest } from "~/server/schemas";

export default function NewRequestPage() {
  const router = useRouter();
  const repos = api.catalog.repos.useQuery();
  const resources = api.catalog.resources.useQuery();
  const submit = api.request.submit.useMutation({
    onSuccess: (res) => {
      router.push(`/requests?last=${res.issueNumber}`);
      router.refresh();
    },
  });

  const [repoSlug, setRepoSlug] = useState<string>("");
  const [resourceType, setResourceType] = useState<string>("");

  const groupedResources = useMemo(() => {
    const groups = new Map<string, Array<{ type: string; label: string; description: string }>>();
    for (const r of resources.data ?? []) {
      const key = r.layer;
      const arr = groups.get(key) ?? [];
      arr.push({ type: r.type, label: r.label, description: r.description });
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [resources.data]);

  if (repos.isLoading || resources.isLoading) {
    return <Loading />;
  }
  if (!repos.data || !resources.data) {
    return <ErrorPanel message="Failed to load catalog. Are you signed in?" />;
  }

  const repoGroups = (["itti", "mondevo"] as const).map((g) => ({
    label: g === "itti" ? "ittikar" : "mondevo",
    repos: repos.data.filter((r) => r.group === g),
  }));

  const selectedDef = resources.data.find((r) => r.type === resourceType) as
    | (ResourceDef & { layer: string })
    | undefined;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New request</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Pick the target repo and the resource type, then fill in the details.
        </p>
      </header>

      <section className="space-y-2">
        <label className="block text-sm font-medium">Target repo</label>
        <select
          value={repoSlug}
          onChange={(e) => setRepoSlug(e.target.value)}
          className="block w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        >
          <option value="">Select a repo…</option>
          {repoGroups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.repos.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name} — {r.slug} {r.hasWorkflows ? "" : "(no CI)"}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {repoSlug && (
          <p className="text-xs text-zinc-500">
            {repos.data.find((r) => r.slug === repoSlug)?.description}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <label className="block text-sm font-medium">Resource type</label>
        <select
          value={resourceType}
          onChange={(e) => setResourceType(e.target.value)}
          disabled={!repoSlug}
          className="block w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="">Select a resource…</option>
          {groupedResources.map(([layer, list]) => (
            <optgroup key={layer} label={layer}>
              {list.map((r) => (
                <option key={r.type} value={r.type}>
                  {r.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {selectedDef && (
          <p className="text-xs text-zinc-500">{selectedDef.description}</p>
        )}
      </section>

      {repoSlug && resourceType && (
        <ResourceFormSection
          resourceType={resourceType}
          repoSlug={repoSlug}
          disabled={submit.isPending}
          onSubmit={(manifest) => submit.mutate({ repoSlug, manifest })}
        />
      )}
      {submit.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{submit.error.message}</p>
      )}
    </div>
  );
}

function ResourceFormSection({
  resourceType,
  disabled,
  onSubmit,
}: {
  resourceType: string;
  repoSlug: string;
  disabled: boolean;
  onSubmit: (m: Manifest) => void;
}) {
  const def = api.catalog.resourceDef.useQuery({ type: resourceType });
  if (def.isLoading) return <p className="text-sm text-zinc-500">Loading form…</p>;
  if (!def.data) return <ErrorPanel message="Unknown resource type" />;
  return (
    <section className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
      <GenericForm def={def.data} onSubmit={onSubmit} disabled={disabled} />
    </section>
  );
}

function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-sm text-zinc-500">
      Loading…
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-4 text-sm text-red-800 dark:text-red-300">
        {message}
      </div>
    </div>
  );
}
