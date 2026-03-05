import { prisma } from "@/lib/prisma";

export async function getSiteSetting(key: string): Promise<string | null> {
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key } });
    return setting?.value ?? null;
  } catch {
    return null;
  }
}

export async function setSiteSetting(key: string, value: string) {
  await prisma.siteSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
}
