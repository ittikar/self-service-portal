import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const allowedOrg = process.env.ALLOWED_GITHUB_ORG ?? "ittikar";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      authorization: {
        params: { scope: "read:user user:email read:org" },
      },
    }),
  ],
  callbacks: {
    async signIn({ account }) {
      if (!account?.access_token) return false;
      const res = await fetch(`https://api.github.com/user/orgs`, {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "User-Agent": "ittikar-self-service-portal",
          Accept: "application/vnd.github+json",
        },
      });
      if (!res.ok) return false;
      const orgs: Array<{ login: string }> = await res.json();
      return orgs.some((o) => o.login.toLowerCase() === allowedOrg.toLowerCase());
    },
    async jwt({ token, profile }) {
      if (profile && (profile as { login?: string }).login) {
        (token as { ghLogin?: string }).ghLogin = (profile as { login: string }).login;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      (session as { ghLogin?: string }).ghLogin = (token as { ghLogin?: string }).ghLogin;
      return session;
    },
  },
  pages: { signIn: "/" },
});
