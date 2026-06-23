import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { readScaffoldConfig, writeScaffoldConfig } from "../../../../../lib/project-store.mjs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(await readScaffoldConfig(id));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Scaffold config not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const data = await writeScaffoldConfig(id, body);
    return NextResponse.json(data);
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", issues: err.issues }, { status: 400 });
    }
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    throw err;
  }
}
