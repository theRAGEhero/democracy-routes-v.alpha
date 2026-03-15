type MemberCandidate = {
  userId: string;
  role?: string | null;
  createdAt?: Date | string | null;
  user?: {
    email?: string | null;
  } | null;
};

export type AutoRemoteAssignment = {
  assignedUserId: string;
  assignedUserEmail: string;
  assignedRole: string | null;
};

export function chooseAutoRemoteAssignee(
  members: MemberCandidate[]
): AutoRemoteAssignment | null {
  const normalized = [...members]
    .filter((member) => member?.userId && member?.user?.email)
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });

  if (normalized.length === 0) return null;

  const preferred =
    normalized.find((member) => String(member.role || "").toUpperCase() !== "HOST") ??
    normalized[0];

  return {
    assignedUserId: preferred.userId,
    assignedUserEmail: String(preferred.user?.email || "").trim(),
    assignedRole: preferred.role ? String(preferred.role) : null
  };
}

export function parseAutoRemoteAssignment(payloadJson?: string | null): AutoRemoteAssignment | null {
  if (!payloadJson) return null;
  try {
    const payload = JSON.parse(payloadJson);
    const assignedUserId = String(payload?.assignedUserId || "").trim();
    const assignedUserEmail = String(payload?.assignedUserEmail || "").trim();
    if (!assignedUserId || !assignedUserEmail) return null;
    return {
      assignedUserId,
      assignedUserEmail,
      assignedRole: payload?.assignedRole ? String(payload.assignedRole) : null
    };
  } catch {
    return null;
  }
}

