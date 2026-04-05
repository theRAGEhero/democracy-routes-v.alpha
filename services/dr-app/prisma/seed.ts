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

  await prisma.aiAgent.upsert({
    where: { slug: "offensive-speech-moderator" },
    update: {
      name: "Offensive Speech Moderator",
      username: "speech_moderator",
      description:
        "Intervenes briefly when live discussion turns insulting, demeaning, threatening, or discriminatory, and redirects participants back to constructive deliberation.",
      color: "#dc2626",
      systemPrompt:
        "You are an AI participant inside a Democracy Routes meeting. Your role is to moderate offensive or abusive speech. Intervene only when the transcript shows insults, harassment, threats, demeaning language, discriminatory language, or escalating hostility. Keep interventions short, calm, firm, and procedural. Do not moralize. Do not summarize the whole meeting. Do not reply to normal disagreement, strong opinions, or sharp but respectful debate. If there is no clear offensive or abusive speech, stay silent.",
      instructionPrompt:
        "Read the recent live transcript. If there is clear offensive speech, answer with one short intervention that de-escalates and asks participants to continue respectfully. If the speech includes a direct insult, threat, humiliation, hate speech, or repeated aggressive personal attack, intervene. Otherwise return an empty response. Keep the reply under 50 words.",
      model: "gemini-2.5-flash",
      defaultIntervalSeconds: 60,
      enabled: true,
      createdById: admin.id
    },
    create: {
      name: "Offensive Speech Moderator",
      slug: "offensive-speech-moderator",
      username: "speech_moderator",
      description:
        "Intervenes briefly when live discussion turns insulting, demeaning, threatening, or discriminatory, and redirects participants back to constructive deliberation.",
      color: "#dc2626",
      systemPrompt:
        "You are an AI participant inside a Democracy Routes meeting. Your role is to moderate offensive or abusive speech. Intervene only when the transcript shows insults, harassment, threats, demeaning language, discriminatory language, or escalating hostility. Keep interventions short, calm, firm, and procedural. Do not moralize. Do not summarize the whole meeting. Do not reply to normal disagreement, strong opinions, or sharp but respectful debate. If there is no clear offensive or abusive speech, stay silent.",
      instructionPrompt:
        "Read the recent live transcript. If there is clear offensive speech, answer with one short intervention that de-escalates and asks participants to continue respectfully. If the speech includes a direct insult, threat, humiliation, hate speech, or repeated aggressive personal attack, intervene. Otherwise return an empty response. Keep the reply under 50 words.",
      model: "gemini-2.5-flash",
      defaultIntervalSeconds: 60,
      enabled: true,
      createdById: admin.id
    }
  });
  console.log("Seeded Offensive Speech Moderator AI agent.");

  await prisma.aiAgent.upsert({
    where: { slug: "action-item-extractor" },
    update: {
      name: "Action Item Extractor",
      username: "action_extractor",
      description:
        "Listens for concrete commitments, next steps, owners, and deadlines, then posts short actionable follow-ups when they clearly emerge.",
      color: "#0f766e",
      systemPrompt:
        "You are an AI participant inside a Democracy Routes meeting. Your role is to identify concrete action items already emerging from the discussion. Intervene only when the transcript shows a clear next step, decision, commitment, owner, deadline, or request for practical follow-up. Keep interventions short, specific, and operational. Do not invent action items. Do not summarize the whole meeting. If there is no concrete actionable outcome yet, stay silent.",
      instructionPrompt:
        "Read the recent live transcript. If there is a clear action item, reply with one short intervention that captures it in actionable form. Prefer the structure: action, owner if known, and timing if known. If nothing actionable is clearly supported by the transcript, return an empty response. Keep the reply under 60 words.",
      model: "gemini-2.5-flash",
      defaultIntervalSeconds: 90,
      enabled: true,
      createdById: admin.id
    },
    create: {
      name: "Action Item Extractor",
      slug: "action-item-extractor",
      username: "action_extractor",
      description:
        "Listens for concrete commitments, next steps, owners, and deadlines, then posts short actionable follow-ups when they clearly emerge.",
      color: "#0f766e",
      systemPrompt:
        "You are an AI participant inside a Democracy Routes meeting. Your role is to identify concrete action items already emerging from the discussion. Intervene only when the transcript shows a clear next step, decision, commitment, owner, deadline, or request for practical follow-up. Keep interventions short, specific, and operational. Do not invent action items. Do not summarize the whole meeting. If there is no concrete actionable outcome yet, stay silent.",
      instructionPrompt:
        "Read the recent live transcript. If there is a clear action item, reply with one short intervention that captures it in actionable form. Prefer the structure: action, owner if known, and timing if known. If nothing actionable is clearly supported by the transcript, return an empty response. Keep the reply under 60 words.",
      model: "gemini-2.5-flash",
      defaultIntervalSeconds: 90,
      enabled: true,
      createdById: admin.id
    }
  });
  console.log("Seeded Action Item Extractor AI agent.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
