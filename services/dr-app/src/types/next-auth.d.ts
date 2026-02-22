import "next-auth";
import "next-auth/jwt";

type Role = "ADMIN" | "USER";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: Role;
      mustChangePassword: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    role: Role;
    mustChangePassword: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    mustChangePassword?: boolean;
  }
}
