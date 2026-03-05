const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const TYPE_MAP = {
  ROUND: "PAIRING",
  MEDITATION: "PAUSE",
  POSTER: "PROMPT",
  TEXT: "NOTES"
};

function remapType(type) {
  return TYPE_MAP[type] || type;
}

async function migratePlanBlocks() {
  for (const [oldType, newType] of Object.entries(TYPE_MAP)) {
    await prisma.planBlock.updateMany({
      where: { type: oldType },
      data: { type: newType }
    });
  }
}

async function migratePlanTemplates() {
  const templates = await prisma.planTemplate.findMany({
    select: { id: true, blocksJson: true }
  });

  for (const template of templates) {
    let blocks = [];
    try {
      blocks = JSON.parse(template.blocksJson || "[]");
    } catch {
      continue;
    }
    let changed = false;
    const nextBlocks = blocks.map((block) => {
      if (!block || typeof block !== "object") return block;
      const type = String(block.type || "");
      const mapped = remapType(type);
      if (mapped !== type) {
        changed = true;
        return { ...block, type: mapped };
      }
      return block;
    });

    if (changed) {
      await prisma.planTemplate.update({
        where: { id: template.id },
        data: { blocksJson: JSON.stringify(nextBlocks) }
      });
    }
  }
}

async function main() {
  await migratePlanBlocks();
  await migratePlanTemplates();
  console.log("Block type migration complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
