import { NextRequest, NextResponse } from "next/server";
import { getShowById, searchShowByName, type TmdbShow } from "@/lib/tmdb";
import { getRecommendations } from "@/lib/claude";

interface RequestBody {
  tmdbIds: number[];
}

export interface RecommendationResult {
  title: string;
  firstAirYear: number;
  ambientWatchabilityScore: number;
  reason: string;
  tmdb: TmdbShow | null;
}

export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tmdbIds = Array.isArray(body.tmdbIds)
    ? body.tmdbIds.filter((id) => Number.isInteger(id))
    : [];

  if (tmdbIds.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one numeric tmdbIds entry" },
      { status: 400 },
    );
  }

  let inputShows: TmdbShow[];
  try {
    inputShows = await Promise.all(tmdbIds.map((id) => getShowById(id)));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch TMDB show data" },
      { status: 502 },
    );
  }

  let recommendations;
  try {
    recommendations = await getRecommendations(inputShows, 8);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get recommendations" },
      { status: 502 },
    );
  }

  const results: RecommendationResult[] = await Promise.all(
    recommendations.map(async (rec) => {
      const tmdb = await searchShowByName(rec.title).catch(() => null);
      return { ...rec, tmdb };
    }),
  );

  return NextResponse.json({ inputShows, results });
}
