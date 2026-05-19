"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "~/trpc/client";

export default function RequestsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <RequestsInner />
    </Suspense>
  );
}

function RequestsInner() {
  const search = useSearchParams();
  const lastIssueNumber = search.get("last");
  const requests = api.request.myRecent.useQuery();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">My requests</h1>
        <p className="text-sm text-zinc-500 mt-1">
          All requests you've opened via the portal across the 8 infra repos.
        </p>
      </header>

      {lastIssueNumber && (
        <div className="rounded-md border border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4 text-sm text-green-800 dark:text-green-300">
          Request submitted as issue #{lastIssueNumber}.
        </div>
      )}

      {requests.isLoading && <p className="text-sm text-zinc-500">Loading…</p>}
      {requests.error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {requests.error.message}
        </p>
      )}

      {requests.data && requests.data.length === 0 && (
        <p className="text-sm text-zinc-500">No requests yet.</p>
      )}

      {requests.data && requests.data.length > 0 && (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          {requests.data.map((r) => (
            <li
              key={`${r.repoSlug}-${r.number}`}
              className="px-4 py-3 flex items-center justify-between"
            >
              <div className="min-w-0">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium hover:underline"
                >
                  {r.title}
                </a>
                <p className="text-xs text-zinc-500">
                  {r.repoName} · #{r.number} ·{" "}
                  {new Date(r.createdAt).toLocaleString()}
                </p>
              </div>
              <StatusBadge state={r.state} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ state }: { state: string }) {
  const className =
    state === "open"
      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded ${className}`}>
      {state}
    </span>
  );
}

function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-sm text-zinc-500">
      Loading…
    </div>
  );
}
