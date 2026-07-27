import { NextRequest, NextResponse } from "next/server";
import { createProfile, getProfiles } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ profiles: getProfiles() });
}

export async function POST(request: NextRequest) {
  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const profile = createProfile(body.name);
    return NextResponse.json({ profile }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && (err as Error & { code?: string }).code === "DUPLICATE_PROFILE") {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create profile" },
      { status: 500 },
    );
  }
}
