import Link from "next/link";

type Props = {
  userId?: string | null;
  email: string;
  className?: string;
};

export function UserProfileLink({ userId, email, className }: Props) {
  if (!userId) {
    return <span className={className}>{email}</span>;
  }

  return (
    <Link href={`/users/${userId}`} className={className ?? "text-slate-700 hover:underline"}>
      {email}
    </Link>
  );
}
