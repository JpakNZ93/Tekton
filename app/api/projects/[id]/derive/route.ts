import { spawn } from "node:child_process";
import { NextResponse } from "next/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const code = await new Promise<number>((resolve) => {
    const child = spawn("node", ["scripts/orchestrate-project.mjs", "--project", id], {
      cwd: process.cwd(),
    });
    child.on("close", resolve);
  });
  if (code !== 0) {
    return NextResponse.json({ error: "Pipeline failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
