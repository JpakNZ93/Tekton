import { NextResponse } from "next/server";
import { readMeta } from "../../../../../lib/project-store.mjs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(await readMeta(id));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    throw err;
  }
}
