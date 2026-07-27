import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { TmdbShow } from "./tmdb";

const client = new Anthropic();

const RecommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      title: z
        .string()
        .describe(
          "The show's title ONLY, exactly as listed on TMDB — no annotations, prefixes, or commentary (e.g. 'Fargo', never 'A darker pick: Fargo' or 'Fargo (like The Office)')",
        ),
      firstAirYear: z.number().describe("Year the series first aired, to disambiguate remakes/reboots"),
      ambientWatchabilityScore: z
        .number()
        .describe("1-10 score for how easy this is to follow by ear/glance while doing a hands-on activity"),
      reason: z
        .string()
        .describe("One or two sentences on why this fits ambient watching and how it relates to the input shows"),
    }),
  ),
});

export type Recommendation = z.infer<typeof RecommendationSchema>["recommendations"][number];

const SYSTEM_PROMPT = `You recommend TV series that are great to have on in the background while doing a hands-on activity that occupies the eyes and hands — painting, jigsaw puzzles, cooking. That means:
- Plot can be followed mostly by ear; long stretches without dialogue or with dense visual-only storytelling are a poor fit
- Episodic or loosely-serialized structure is preferred over shows demanding frame-by-frame attention or dense visual mystery clues
- Familiar formats (procedurals, sitcoms, panel/talk shows, low-stakes competition, character-driven dramedies) tend to score well
- Shows with subtitles-only foreign dialogue, rapid subtitle-dependent jokes, or heavy visual spectacle as the main draw score poorly

Given a list of TV series the user already enjoys, recommend similar shows that also score well on ambient watchability. Do not recommend any show already in the input list. The "title" field must contain only the show's bare title — never add a descriptive prefix, suffix, or parenthetical commentary to it; put any framing or comparison in the "reason" field instead.`;

export async function getRecommendations(
  tasteShows: TmdbShow[],
  alreadyKnownNames: string[],
  dislikedNames: string[],
  count: number,
): Promise<Recommendation[]> {
  const showSummaries = tasteShows
    .map(
      (s) =>
        `- "${s.name}" (${s.firstAirDate?.slice(0, 4) ?? "?"}) — genres: ${s.genres.join(", ") || "unknown"}; keywords: ${s.keywords.slice(0, 8).join(", ") || "none"}\n  ${s.overview}`,
    )
    .join("\n\n");

  const exclusionLine =
    alreadyKnownNames.length > 0
      ? `\n\nDo not recommend any of these — I already know them or have already seen them: ${alreadyKnownNames.join(", ")}.`
      : "";
  const dislikedLine =
    dislikedNames.length > 0
      ? `\n\nI disliked these — avoid recommending shows with a similar tone or style: ${dislikedNames.join(", ")}.`
      : "";

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: zodOutputFormat(RecommendationSchema),
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here are the shows I like:\n\n${showSummaries}${exclusionLine}${dislikedLine}\n\nRecommend ${count} TV series good for painting, puzzling, or cooking along to, based on these.`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return a parseable recommendation list");
  }

  return response.parsed_output.recommendations;
}
