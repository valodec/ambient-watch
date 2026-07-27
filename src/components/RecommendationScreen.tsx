"use client";

import { useEffect, useRef, useState } from "react";
import type { RecommendationResult } from "@/app/api/recommendations/route";

interface Profile {
  id: number;
  name: string;
}

interface SearchResult {
  id: number;
  name: string;
  year: number | null;
  posterUrl: string | null;
  overview: string;
}

interface SelectedShow {
  id: number;
  name: string;
  year: number | null;
}

interface ApiResponse {
  inputShows: { name: string }[];
  results: RecommendationResult[];
}

interface Feedback {
  watched: boolean;
  rating: "liked" | "disliked" | null;
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="h-5 w-5 text-zinc-400"
      aria-hidden
    >
      <path
        d="M9 3a6 6 0 1 0 3.874 10.586l3.77 3.77a1 1 0 0 0 1.415-1.414l-3.77-3.77A6 6 0 0 0 9 3Zm-4 6a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconButton({
  active,
  activeColor,
  onClick,
  label,
  children,
}: {
  active: boolean;
  activeColor: string;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
      style={{
        backgroundColor: active ? activeColor : "transparent",
        color: active ? "white" : undefined,
      }}
    >
      {children}
    </button>
  );
}

export function RecommendationScreen({
  profile,
  onSwitchProfile,
}: {
  profile: Profile;
  onSwitchProfile: () => void;
}) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SelectedShow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [feedback, setFeedback] = useState<Record<number, Feedback>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query.trim())}`);
        const json = await res.json();
        setSearchResults(json.results ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function addShow(show: SearchResult) {
    if (selected.some((s) => s.id === show.id)) return;
    setSelected((prev) => [...prev, { id: show.id, name: show.name, year: show.year }]);
    setQuery("");
    setSearchResults([]);
  }

  function removeShow(id: number) {
    setSelected((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleSubmit() {
    if (selected.length === 0) {
      setError("Search for at least one show you like and add it first.");
      return;
    }
    setError(null);
    setLoading(true);
    setData(null);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: profile.id, newTmdbIds: selected.map((s) => s.id) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      setData(json);
      setSelected([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function updateFeedback(tmdbId: number, rec: RecommendationResult, next: Feedback) {
    setFeedback((prev) => ({ ...prev, [tmdbId]: next }));
    try {
      await fetch("/api/library", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profileId: profile.id,
          tmdbId,
          name: rec.title,
          firstAirYear: rec.firstAirYear,
          source: "recommendation",
          watched: next.watched,
          rating: next.rating,
        }),
      });
    } catch {
      // Best-effort; feedback stays reflected locally even if the write fails.
    }
  }

  function toggleRating(tmdbId: number, rec: RecommendationResult, rating: "liked" | "disliked") {
    const current = feedback[tmdbId] ?? { watched: false, rating: null };
    const next: Feedback = { ...current, rating: current.rating === rating ? null : rating };
    updateFeedback(tmdbId, rec, next);
  }

  function toggleWatched(tmdbId: number, rec: RecommendationResult) {
    const current = feedback[tmdbId] ?? { watched: false, rating: null };
    const next: Feedback = { ...current, watched: !current.watched };
    updateFeedback(tmdbId, rec, next);
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-5 px-4 py-6 sm:px-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Ambient Watch
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Hi {profile.name} — shows that are easy to follow by ear.
            </p>
          </div>
          <button
            onClick={onSwitchProfile}
            className="min-h-[44px] rounded-full px-3 text-sm font-medium text-zinc-600 transition-transform active:scale-95 dark:text-zinc-400"
          >
            Switch
          </button>
        </header>

        {selected.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {selected.map((s) => (
              <li
                key={s.id}
                className="flex min-h-[36px] items-center gap-1.5 rounded-full bg-zinc-200 px-3 py-1 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {s.name}
                {s.year ? ` (${s.year})` : ""}
                <button
                  onClick={() => removeShow(s.id)}
                  aria-label={`Remove ${s.name}`}
                  className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-zinc-500 transition-transform active:scale-90 dark:text-zinc-400"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="relative">
          <div className="flex min-h-[44px] items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2.5 dark:border-zinc-700 dark:bg-zinc-900">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search a show you like…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-base text-black outline-none dark:text-white"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-300 text-sm text-white transition-transform active:scale-90 dark:bg-zinc-600"
              >
                ×
              </button>
            )}
          </div>

          {(searchResults.length > 0 || searching) && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
              {searching && searchResults.length === 0 && (
                <li className="px-4 py-3 text-sm text-zinc-500">Searching…</li>
              )}
              {searchResults.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => addShow(r)}
                    className="flex min-h-[44px] w-full items-center gap-3 px-3 py-2 text-left transition-colors active:bg-zinc-100 dark:active:bg-zinc-800"
                  >
                    {r.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.posterUrl}
                        alt=""
                        className="h-12 w-9 flex-shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="h-12 w-9 flex-shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
                    )}
                    <span className="flex flex-col">
                      <span className="text-sm font-medium text-black dark:text-white">
                        {r.name}
                      </span>
                      <span className="text-xs text-zinc-500">{r.year ?? "—"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="min-h-[44px] w-full rounded-xl bg-black px-4 py-3 text-base font-medium text-white transition-transform active:scale-95 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "Finding shows…" : "Get recommendations"}
        </button>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {data && (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Based on: {data.inputShows.map((s) => s.name).join(", ")}
            </h2>
            <ul className="flex flex-col gap-3">
              {data.results.map((r) => {
                const tmdbId = r.tmdb?.id;
                const fb = tmdbId ? feedback[tmdbId] ?? { watched: false, rating: null } : null;
                return (
                  <li
                    key={r.title}
                    className="flex gap-4 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    {r.tmdb?.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.tmdb.posterUrl}
                        alt={r.title}
                        className="h-28 w-20 flex-shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="h-28 w-20 flex-shrink-0 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                    )}
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-black dark:text-white">{r.title}</span>
                        <span className="text-xs text-zinc-500">{r.firstAirYear}</span>
                      </div>
                      <span className="w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        Ambient score: {r.ambientWatchabilityScore}/10
                      </span>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{r.reason}</p>

                      {tmdbId && fb && (
                        <div className="mt-1 flex items-center gap-1">
                          <IconButton
                            active={fb.rating === "liked"}
                            activeColor="#34C759"
                            onClick={() => toggleRating(tmdbId, r, "liked")}
                            label="Liked it"
                          >
                            👍
                          </IconButton>
                          <IconButton
                            active={fb.rating === "disliked"}
                            activeColor="#FF3B30"
                            onClick={() => toggleRating(tmdbId, r, "disliked")}
                            label="Disliked it"
                          >
                            👎
                          </IconButton>
                          <IconButton
                            active={fb.watched}
                            activeColor="#007AFF"
                            onClick={() => toggleWatched(tmdbId, r)}
                            label="Mark watched"
                          >
                            ✓
                          </IconButton>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
