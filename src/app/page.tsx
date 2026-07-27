"use client";

import { useEffect, useState } from "react";
import { ProfilePicker } from "@/components/ProfilePicker";
import { RecommendationScreen } from "@/components/RecommendationScreen";

interface Profile {
  id: number;
  name: string;
}

const STORAGE_KEY = "ambient-watch-profile";

export default function Home() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setProfile(JSON.parse(raw));
        return;
      } catch {
        // fall through to picker
      }
    }
    setProfile(null);
  }, []);

  function selectProfile(p: Profile) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    setProfile(p);
  }

  function switchProfile() {
    localStorage.removeItem(STORAGE_KEY);
    setProfile(null);
  }

  if (profile === undefined) {
    return <div className="flex flex-1 bg-zinc-50 dark:bg-black" />;
  }

  if (profile === null) {
    return <ProfilePicker onSelect={selectProfile} />;
  }

  return <RecommendationScreen profile={profile} onSwitchProfile={switchProfile} />;
}
