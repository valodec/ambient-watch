import { NextRequest, NextResponse } from "next/server";
import { searchShows } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (query.length === 0) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchShows(query);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TMDB search failed" },
      { status: 502 },
    );
  }
}
