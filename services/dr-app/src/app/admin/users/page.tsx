import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UsersTable } from "@/app/admin/users/UsersTable";
import { formatDateTime } from "@/lib/utils";
import { CreateUserModal } from "@/app/admin/users/CreateUserModal";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  if (session.user.role !== "ADMIN") {
    return <p className="text-sm text-slate-500">Access denied.</p>;
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerifiedAt: true,
      mustChangePassword: true,
      isDeleted: true,
      deletedAt: true,
      createdAt: true,
      _count: { select: { memberships: true } }
    }
  });

  const rows = users.map((user: (typeof users)[number]) => ({
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerifiedAtLabel: user.emailVerifiedAt ? formatDateTime(user.emailVerifiedAt) : null,
    mustChangePassword: user.mustChangePassword,
    isDeleted: user.isDeleted,
    deletedAtLabel: user.deletedAt ? formatDateTime(user.deletedAt) : null,
    createdAtLabel: formatDateTime(user.createdAt),
    meetingsCount: user._count.memberships
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Users
        </h1>
        <p className="text-sm text-slate-500">Manage platform users.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">All registered users.</p>
        <CreateUserModal />
      </div>

      <UsersTable initialUsers={rows} />
    </div>
  );
}
