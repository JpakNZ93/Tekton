import { NextResponse } from "next/server";
import { createProject, listProjects } from "../../../lib/project-store.mjs";

export async function GET() {
  return NextResponse.json(await listProjects());
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = await createProject({
    site_name: body.site_name,
    address: body.address ?? "",
  });
  return NextResponse.json({ id }, { status: 201 });
}
