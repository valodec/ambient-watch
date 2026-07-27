"use client";

import { useEffect, useState } from "react";

interface Profile {
  id: number;
  name: string;
}

const AVATAR_COLORS = [
  "#FF3B30", // red
  "#FF9500", // orange
  "#FFCC00", // yellow
  "#34C759", // green
  "#5AC8FA", // teal
  "#007AFF", // blue
  "#5856D6", // indigo
  "#AF52DE", // purple
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function ProfilePicker({ onSelect }: { onSelect: (profile: Profile) => void }) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profiles")
      .then((res) => res.json())
      .then((data) => setProfiles(data.profiles))
      .catch(() => setProfiles([]));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create profile");
      onSelect(json.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create profile");
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <h1 className="mb-8 text-2xl font-semibold text-black dark:text-zinc-50">
        Who&apos;s watching?
      </h1>

      <div className="grid grid-cols-3 gap-5 sm:grid-cols-4">
        {profiles?.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="flex min-h-[44px] flex-col items-center gap-2 rounded-2xl p-2 transition-transform active:scale-95"
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-semibold text-white shadow-sm"
              style={{ backgroundColor: colorForName(p.name) }}
            >
              {p.name.charAt(0).toUpperCase()}
            </div>
            <span className="max-w-[72px] truncate text-sm text-zinc-800 dark:text-zinc-200">
              {p.name}
            </span>
          </button>
        ))}

        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex min-h-[44px] flex-col items-center gap-2 rounded-2xl p-2 transition-transform active:scale-95"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 text-2xl text-zinc-400 dark:border-zinc-700 dark:text-zinc-600">
              +
            </div>
            <span className="text-sm text-zinc-500 dark:text-zinc-500">Add Person</span>
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleCreate} className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <input
            autoFocus
            type="text"
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
          <button
            type="submit"
            className="min-h-[44px] w-full rounded-xl bg-black px-4 py-3 text-base font-medium text-white transition-transform active:scale-95 dark:bg-white dark:text-black"
          >
            Done
          </button>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}

      {profiles === null && (
        <p className="mt-4 text-sm text-zinc-500">Loading profiles…</p>
      )}
    </div>
  );
}
