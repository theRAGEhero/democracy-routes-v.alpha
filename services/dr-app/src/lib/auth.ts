import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "@/lib/bcrypt";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, _req) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email }
        });

        if (!user || user.isDeleted) {
          return null;
        }

        const registrationSettings =
          (await prisma.registrationSettings.findFirst()) ??
          (await prisma.registrationSettings.create({ data: {} }));
        if (
          registrationSettings.requireEmailConfirmation &&
          !user.emailVerifiedAt &&
          user.emailVerificationToken
        ) {
          return null;
        }

        const passwordOk = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!passwordOk) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role as "ADMIN" | "USER",
          mustChangePassword: user.mustChangePassword,
          avatarUrl: user.avatarUrl ?? null
        };
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
        token.avatarUrl = user.avatarUrl ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "USER";
        session.user.mustChangePassword = token.mustChangePassword as boolean;
        session.user.avatarUrl = token.avatarUrl ?? null;
      }
      if (token.id) {
        const profile = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { avatarUrl: true }
        });
        if (session.user) {
          session.user.avatarUrl = profile?.avatarUrl ?? null;
        }
        token.avatarUrl = profile?.avatarUrl ?? null;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login"
  },
  secret: process.env.NEXTAUTH_SECRET
};
