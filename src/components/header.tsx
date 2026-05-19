"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";

export function Header() {
  const { data: session, status } = useSession();
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">
          ittikar / self-service
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {status === "authenticated" && (
            <>
              <Link href="/new" className="hover:underline">
                New request
              </Link>
              <Link href="/requests" className="hover:underline">
                My requests
              </Link>
              <span className="text-zinc-500">{session?.user?.name}</span>
              <button
                onClick={() => signOut()}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Sign out
              </button>
            </>
          )}
          {status === "unauthenticated" && (
            <button
              onClick={() => signIn("github")}
              className="rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-1.5 hover:opacity-90"
            >
              Sign in with GitHub
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
