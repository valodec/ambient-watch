"use client";

import { useState } from "react";
import type { RecommendationResult } from "@/app/api/recommendations/route";

interface ApiResponse {
  inputShows: { id: number; name: string }[];
  results: RecommendationResult[];
}

export default function Home() {
  const [idsInput, setIdsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setData(null);

    const tmdbIds = idsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isInteger(n));

    if (tmdbIds.length === 0) {
      setError("Enter at least one TMDB show ID (comma-separated).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tmdbIds }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Something went wrong");
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Ambient Watch
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Enter TMDB IDs of shows you like. We&apos;ll recommend series that are
            easy to follow by ear — perfect for painting, puzzling, or cooking
            along to.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor="tmdbIds" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            TMDB show IDs
          </label>
          <input
            id="tmdbIds"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 1418, 2316, 4614"
            value={idsInput}
            onChange={(e) => setIdsInput(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-black px-4 py-3 text-base font-medium text-white transition-colors disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? "Finding shows…" : "Get recommendations"}
          </button>
        </form>

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
              {data.results.map((r) => (
                <li
                  key={r.title}
                  className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {r.tmdb?.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.tmdb.posterUrl}
                      alt={r.title}
                      className="h-28 w-20 flex-shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-28 w-20 flex-shrink-0 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                  )}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-black dark:text-white">
                        {r.title}
                      </span>
                      <span className="text-xs text-zinc-500">{r.firstAirYear}</span>
                    </div>
                    <span className="w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      Ambient score: {r.ambientWatchabilityScore}/10
                    </span>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{r.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
