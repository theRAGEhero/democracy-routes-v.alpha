import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TextComposer } from "@/app/texts/new/TextComposer";

export default async function TextDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const text = await prisma.text.findUnique({
    where: { id: params.id },
    select: { id: true, content: true, dataspaceId: true, createdById: true }
  });

  if (!text || text.createdById !== session.user.id) {
    return <p className="text-sm text-slate-600">Text not found.</p>;
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

  return (
    <TextComposer
      dataspaces={dataspaces}
      initialText={{
        id: text.id,
        content: text.content,
        dataspaceId: text.dataspaceId
      }}
    />
  );
}
