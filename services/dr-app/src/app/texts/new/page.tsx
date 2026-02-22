import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TextComposer } from "@/app/texts/new/TextComposer";

export default async function NewTextPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const dataspaces = await prisma.dataspace.findMany({
    where: {
      members: {
        some: { userId: session.user.id }
      }
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true }
  });

  return <TextComposer dataspaces={dataspaces} />;
}
