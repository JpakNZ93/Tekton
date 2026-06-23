import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

async function readArtifact(id: string, filename: string) {
  const path = join(process.cwd(), "artifacts/projects", id, filename);
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(await readArtifact(id, "scaffold-spec.json"));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Scaffold spec not found" }, { status: 404 });
    }
    throw err;
  }
}
