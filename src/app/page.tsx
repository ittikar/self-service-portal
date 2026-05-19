import Link from "next/link";
import { auth, signIn } from "~/server/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            Self-service infrastructure
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Submit a request to provision AWS resources in any of the ittikar infra
            repos. We open a GitHub Issue with your manifest; the platform team
            reviews, generates the OpenTofu code, and applies it on the dev branch.
          </p>
        </header>

        {session ? (
          <div className="flex gap-3">
            <Link
              href="/new"
              className="rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 text-sm font-medium hover:opacity-90"
            >
              New request →
            </Link>
            <Link
              href="/requests"
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-5 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              My requests
            </Link>
          </div>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/new" });
            }}
          >
            <button
              type="submit"
              className="rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 text-sm font-medium hover:opacity-90"
            >
              Sign in with GitHub to get started
            </button>
            <p className="mt-3 text-xs text-zinc-500">
              Access is restricted to members of the <code>ittikar</code> GitHub org.
            </p>
          </form>
        )}

        <section className="pt-8 border-t border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3">
            How it works
          </h2>
          <ol className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300 list-decimal pl-5">
            <li>Pick a target infra repo and a resource type.</li>
            <li>Fill in the form. We validate it and generate a manifest.</li>
            <li>
              The portal opens a GitHub Issue in the target repo with your manifest.
            </li>
            <li>
              The platform team processes the queue daily — generates OpenTofu code
              and applies on the <code>dev</code> branch.
            </li>
            <li>Your issue is closed with a summary when the resource is live.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
