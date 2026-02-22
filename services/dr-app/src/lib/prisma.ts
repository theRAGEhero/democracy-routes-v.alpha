import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = (() => {
  const client =
    global.prisma ||
    new PrismaClient({
      log: ["error"]
    });

  if (process.env.NODE_ENV !== "production") {
    global.prisma = client;
  }

  return client;
})();
