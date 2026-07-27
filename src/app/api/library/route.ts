import { NextRequest, NextResponse } from "next/server";
import { getLibrary, getProfile, upsertLibraryEntry } from "@/lib/db";

export async function GET(request: NextRequest) {
  const profileIdRaw = request.nextUrl.searchParams.get("profileId");
  const profileId = Number(profileIdRaw);

  if (!profileIdRaw || !Number.isInteger(profileId)) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  if (!getProfile(profileId)) {
    return NextResponse.json({ error: "Unknown profile" }, { status: 404 });
  }

  return NextResponse.json({ library: getLibrary(profileId) });
}

interface UpsertBody {
  profileId?: unknown;
  tmdbId?: unknown;
  name?: unknown;
  firstAirYear?: unknown;
  source?: unknown;
  watched?: unknown;
  rating?: unknown;
}

export async function POST(request: NextRequest) {
  let body: UpsertBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const profileId = Number(body.profileId);
  const tmdbId = Number(body.tmdbId);

  if (!Number.isInteger(profileId) || !Number.isInteger(tmdbId)) {
    return NextResponse.json({ error: "profileId and tmdbId are required integers" }, { status: 400 });
  }
  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (body.source !== "seed" && body.source !== "recommendation") {
    return NextResponse.json({ error: "source must be 'seed' or 'recommendation'" }, { status: 400 });
  }
  if (body.rating !== undefined && body.rating !== null && body.rating !== "liked" && body.rating !== "disliked") {
    return NextResponse.json({ error: "rating must be 'liked', 'disliked', or omitted" }, { status: 400 });
  }

  if (!getProfile(profileId)) {
    return NextResponse.json({ error: "Unknown profile" }, { status: 404 });
  }

  const entry = upsertLibraryEntry({
    profileId,
    tmdbId,
    name: body.name,
    firstAirYear: typeof body.firstAirYear === "number" ? body.firstAirYear : null,
    source: body.source,
    watched: Boolean(body.watched),
    rating: (body.rating as "liked" | "disliked" | null) ?? null,
  });

  return NextResponse.json({ entry });
}
