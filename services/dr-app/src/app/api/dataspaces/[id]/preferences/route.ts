import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { dataspacePreferenceSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = dataspacePreferenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const membership = await prisma.dataspaceMember.findUnique({
    where: {
      dataspaceId_userId: {
        dataspaceId: params.id,
        userId: session.user.id
      }
    }
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a dataspace member" }, { status: 403 });
  }

  const subscription = await prisma.dataspaceSubscription.findUnique({
    where: {
      dataspaceId_userId: {
        dataspaceId: params.id,
        userId: session.user.id
      }
    }
  });

  if (!subscription) {
    return NextResponse.json({ error: "Not subscribed" }, { status: 400 });
  }

  const data: {
    notifyAllActivity?: boolean;
    notifyMeetings?: boolean;
    notifyPlans?: boolean;
    notifyTexts?: boolean;
  } = {};

  if (typeof parsed.data.notifyAllActivity === "boolean") {
    data.notifyAllActivity = parsed.data.notifyAllActivity;
  }
  if (typeof parsed.data.notifyMeetings === "boolean") {
    data.notifyMeetings = parsed.data.notifyMeetings;
  }
  if (typeof parsed.data.notifyPlans === "boolean") {
    data.notifyPlans = parsed.data.notifyPlans;
  }
  if (typeof parsed.data.notifyTexts === "boolean") {
    data.notifyTexts = parsed.data.notifyTexts;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes submitted" }, { status: 400 });
  }

  await prisma.dataspaceSubscription.update({
    where: {
      dataspaceId_userId: {
        dataspaceId: params.id,
        userId: session.user.id
      }
    },
    data
  });

  return NextResponse.json({ ok: true });
}
