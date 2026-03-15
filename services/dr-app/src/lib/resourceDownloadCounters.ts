import fs from "node:fs/promises";
import path from "node:path";

export const RESOURCE_DOWNLOADS = {
  whitepaper: {
    key: "whitepaper",
    label: "Whitepaper",
    fileName: "democracy-routes-whitepaper-2.0.pdf",
    publicPath: "/resources/democracy-routes-whitepaper-2.0.pdf"
  },
  popp: {
    key: "popp",
    label: "PoPP",
    fileName: "proof-of-political-power-2.pdf",
    publicPath: "/resources/proof-of-political-power-2.pdf"
  }
} as const;

export type ResourceDownloadKey = keyof typeof RESOURCE_DOWNLOADS;

type DownloadCounters = Record<ResourceDownloadKey, number>;

const DEFAULT_COUNTS: DownloadCounters = {
  whitepaper: 0,
  popp: 0
};

function getCounterFilePath() {
  return path.join(process.cwd(), "data", "resource-download-counts.json");
}

async function ensureCounterFile() {
  const filePath = getCounterFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, `${JSON.stringify(DEFAULT_COUNTS, null, 2)}\n`, "utf8");
  }
  return filePath;
}

export async function readResourceDownloadCounts(): Promise<DownloadCounters> {
  const filePath = await ensureCounterFile();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<DownloadCounters>;
    return {
      whitepaper: Number(parsed.whitepaper) || 0,
      popp: Number(parsed.popp) || 0
    };
  } catch {
    return { ...DEFAULT_COUNTS };
  }
}

export async function incrementResourceDownloadCount(key: ResourceDownloadKey) {
  const filePath = await ensureCounterFile();
  const counts = await readResourceDownloadCounts();
  counts[key] = (counts[key] || 0) + 1;
  await fs.writeFile(filePath, `${JSON.stringify(counts, null, 2)}\n`, "utf8");
  return counts;
}
