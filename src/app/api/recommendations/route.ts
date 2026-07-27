import { NextRequest, NextResponse } from "next/server";
import { getShowById, searchShowByName, type TmdbShow } from "@/lib/tmdb";
import { getRecommendations } from "@/lib/claude";
import {
  getDislikedShows,
  getExclusionSet,
  getLibrary,
  getProfile,
  getTasteShows,
  upsertLibraryEntry,
} from "@/lib/db";

interface RequestBody {
  profileId: number;
  newTmdbIds: number[];
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

  const profileId = Number(body.profileId);
  if (!Number.isInteger(profileId)) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }
  if (!getProfile(profileId)) {
    return NextResponse.json({ error: "Unknown profile" }, { status: 404 });
  }

  const newTmdbIds = Array.isArray(body.newTmdbIds)
    ? body.newTmdbIds.filter((id) => Number.isInteger(id))
    : [];

  // Fetch and seed any newly-selected shows into this profile's library.
  let newlySeeded: TmdbShow[];
  try {
    newlySeeded = await Promise.all(newTmdbIds.map((id) => getShowById(id)));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch TMDB show data" },
      { status: 502 },
    );
  }
  for (const show of newlySeeded) {
    upsertLibraryEntry({
      profileId,
      tmdbId: show.id,
      name: show.name,
      firstAirYear: show.firstAirDate ? Number(show.firstAirDate.slice(0, 4)) : null,
      source: "seed",
    });
  }

  const library = getLibrary(profileId);
  if (library.length === 0) {
    return NextResponse.json(
      { error: "Add at least one show you like before requesting recommendations" },
      { status: 400 },
    );
  }

  const tasteEntries = getTasteShows(profileId);
  let tasteShows: TmdbShow[];
  try {
    tasteShows = await Promise.all(tasteEntries.map((e) => getShowById(e.tmdbId)));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch TMDB show data" },
      { status: 502 },
    );
  }

  const alreadyKnownNames = library.map((e) => `${e.name}${e.firstAirYear ? ` (${e.firstAirYear})` : ""}`);
  const dislikedNames = getDislikedShows(profileId).map((e) => e.name);
  const exclusionSet = getExclusionSet(profileId);

  let recommendations;
  try {
    recommendations = await getRecommendations(tasteShows, alreadyKnownNames, dislikedNames, 8);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get recommendations" },
      { status: 502 },
    );
  }

  const resolved = await Promise.all(
    recommendations.map(async (rec) => {
      const tmdb = await searchShowByName(rec.title, rec.firstAirYear).catch(() => null);
      return { ...rec, tmdb };
    }),
  );

  // Server-side dedupe: never surface something already in this profile's library,
  // even if Claude's prompt-level exclusion instruction was ignored.
  const results: RecommendationResult[] = resolved.filter(
    (r) => !r.tmdb || !exclusionSet.has(r.tmdb.id),
  );

  return NextResponse.json({ inputShows: tasteShows, results });
}
