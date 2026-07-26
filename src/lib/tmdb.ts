const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

export interface TmdbShow {
  id: number;
  name: string;
  overview: string;
  genres: string[];
  posterUrl: string | null;
  firstAirDate: string | null;
  voteAverage: number;
  numberOfSeasons: number | null;
  keywords: string[];
}

interface TmdbGenre {
  id: number;
  name: string;
}

interface TmdbTvDetailsResponse {
  id: number;
  name: string;
  overview: string;
  genres: TmdbGenre[];
  poster_path: string | null;
  first_air_date: string | null;
  vote_average: number;
  number_of_seasons: number | null;
}

interface TmdbKeywordsResponse {
  results: { id: number; name: string }[];
}

interface TmdbSearchResponse {
  results: {
    id: number;
    name: string;
    overview: string;
    poster_path: string | null;
    first_air_date: string | null;
    vote_average: number;
  }[];
}

function tmdbHeaders(): HeadersInit {
  const token = process.env.TMDB_API_READ_TOKEN;
  if (!token) {
    throw new Error("TMDB_API_READ_TOKEN environment variable is not set");
  }
  return {
    Authorization: `Bearer ${token}`,
    accept: "application/json",
  };
}

export async function getShowById(tmdbId: number): Promise<TmdbShow> {
  const [detailsRes, keywordsRes] = await Promise.all([
    fetch(`${TMDB_API_BASE}/tv/${tmdbId}`, { headers: tmdbHeaders() }),
    fetch(`${TMDB_API_BASE}/tv/${tmdbId}/keywords`, { headers: tmdbHeaders() }),
  ]);

  if (!detailsRes.ok) {
    throw new Error(`TMDB show ${tmdbId} not found (status ${detailsRes.status})`);
  }

  const details: TmdbTvDetailsResponse = await detailsRes.json();
  const keywords: TmdbKeywordsResponse = keywordsRes.ok
    ? await keywordsRes.json()
    : { results: [] };

  return {
    id: details.id,
    name: details.name,
    overview: details.overview,
    genres: details.genres.map((g) => g.name),
    posterUrl: details.poster_path ? `${TMDB_IMAGE_BASE}${details.poster_path}` : null,
    firstAirDate: details.first_air_date,
    voteAverage: details.vote_average,
    numberOfSeasons: details.number_of_seasons,
    keywords: keywords.results.map((k) => k.name),
  };
}

export async function searchShowByName(name: string): Promise<TmdbShow | null> {
  const res = await fetch(
    `${TMDB_API_BASE}/search/tv?query=${encodeURIComponent(name)}&include_adult=false`,
    { headers: tmdbHeaders() },
  );
  if (!res.ok) return null;

  const data: TmdbSearchResponse = await res.json();
  const top = data.results[0];
  if (!top) return null;

  return getShowById(top.id);
}
