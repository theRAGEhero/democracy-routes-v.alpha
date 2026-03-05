import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin1234";
  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD is required");
  }
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existing) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: "ADMIN",
        mustChangePassword: false
      }
    });
    console.log("Seeded admin user.");
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        role: "ADMIN",
        isGuest: false,
        mustChangePassword: false
      }
    });
    console.log("Admin user updated from env.");
  }

  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    throw new Error("Admin user missing after seed.");
  }

  const citizenAssembly = await prisma.planTemplate.findFirst({
    where: { name: "Citizen Assembly", createdById: admin.id }
  });

  if (!citizenAssembly) {
    const blocks = [
      { type: "TEXT", durationSeconds: 300 },
      { type: "ROUND", durationSeconds: 1200, roundMaxParticipants: null },
      { type: "TEXT", durationSeconds: 600 },
      { type: "ROUND", durationSeconds: 1200, roundMaxParticipants: null },
      {
        type: "FORM",
        durationSeconds: 600,
        formQuestion: "Where are we converging?",
        formChoices: [
          { key: "strong-agree", label: "Strong agreement" },
          { key: "some-agree", label: "Some agreement" },
          { key: "open", label: "Open questions remain" },
          { key: "disagree", label: "Disagreement remains" }
        ]
      },
      { type: "TEXT", durationSeconds: 300 },
      { type: "ROUND", durationSeconds: 900, roundMaxParticipants: null }
    ];

    await prisma.planTemplate.create({
      data: {
        name: "Citizen Assembly",
        description:
          "Structured deliberation: framing, small-group rounds, synthesis, and convergence check.",
        blocksJson: JSON.stringify(blocks),
        createdById: admin.id,
        isPublic: true
      }
    });
    console.log("Seeded Citizen Assembly template.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
