import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      departmentId: string | null;
      employeeId: string | null;
    };
  }
}

// next-auth@5 beta's published types break `declare module "next-auth/jwt"`
// augmentation once the credentials provider is imported in the same file,
// so the extra JWT fields are typed locally instead and applied via casts
// in the callbacks below.
export type AppJWT = {
  id?: string;
  role?: Role;
  departmentId?: string | null;
  employeeId?: string | null;
};

// Edge-safe config shared by middleware (no DB/bcrypt access here) and the
// full server-side auth() in auth.ts. Providers are added only in auth.ts.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      const t = token as AppJWT;
      if (user) {
        const u = user as {
          id: string;
          role: Role;
          departmentId: string | null;
          employeeId: string | null;
        };
        t.id = u.id;
        t.role = u.role;
        t.departmentId = u.departmentId;
        t.employeeId = u.employeeId;
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as AppJWT;
      session.user.id = t.id ?? "";
      session.user.role = t.role ?? "VIEWER";
      session.user.departmentId = t.departmentId ?? null;
      session.user.employeeId = t.employeeId ?? null;
      return session;
    },
  },
} satisfies NextAuthConfig;
