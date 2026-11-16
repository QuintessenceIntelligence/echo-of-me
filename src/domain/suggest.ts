/**
 * Automatic theme suggestions (ADR-006). This is NOT AI: a small, transparent keyword list that runs
 * inside the application, sends nothing to any third party and costs nothing (DR-054). It exists so the
 * "suggestion → author decides" flow (P6 → approved) is real and testable before an AI provider is
 * chosen (ADR-007). Suggestions are always shown as unapproved and are never citable (AC-04).
 */
export const THEME_KEYWORDS: Record<string, string[]> = {
  family: ["family", "mother", "father", "mom", "mum", "dad", "brother", "sister", "grandma", "grandpa", "granny", "son", "daughter", "children", "kids", "parents"],
  love: ["love", "loved", "loving", "marriage", "married", "wedding"],
  resilience: ["failure", "failed", "fail", "setback", "hard times", "struggle", "difficult", "persevere", "keep going", "gave up", "never give up"],
  work: ["work", "job", "career", "business", "boss", "office", "promotion", "employer"],
  money: ["money", "save", "saving", "savings", "debt", "budget", "spend", "invest", "salary"],
  education: ["school", "teacher", "exam", "study", "studied", "university", "college", "learning", "homework"],
  faith: ["faith", "god", "prayer", "pray", "church", "temple", "mosque", "spiritual"],
  health: ["health", "hospital", "doctor", "illness", "sick", "exercise"],
  friendship: ["friend", "friends", "friendship"],
  honesty: ["honest", "honesty", "truth", "lie", "lying", "integrity"],
  kindness: ["kind", "kindness", "generous", "generosity", "help others", "compassion"],
  courage: ["courage", "brave", "afraid", "fear", "scared"],
  gratitude: ["grateful", "gratitude", "thankful", "thank you"],
  home: ["home", "house", "neighbourhood", "neighborhood", "village", "town"],
  travel: ["travel", "trip", "journey", "holiday", "vacation", "abroad"],
  food: ["food", "cook", "cooking", "recipe", "meal", "dinner", "kitchen"],
  humour: ["funny", "laugh", "laughed", "joke", "humour", "humor"],
};

/** Returns at most `max` theme labels whose keywords appear as whole words in the text. */
export function suggestThemes(text: string, max = 5): string[] {
  const t = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, " ").replace(/\s+/g, " ")} `;
  const scored: [string, number][] = [];
  for (const [theme, words] of Object.entries(THEME_KEYWORDS)) {
    let hits = 0;
    for (const w of words) if (t.includes(` ${w} `)) hits += 1;
    if (hits) scored.push([theme, hits]);
  }
  return scored.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([theme]) => theme);
}
