/**
 * Screens that run BEFORE any retrieval (01B §4.6), so a crisis question never reaches a "parent voice"
 * and an identity question is never answered as if the AI were the author (AC-09, AC-10).
 *
 * ⚕ The patterns and wording are a working default and need review by a qualified clinician or
 * safe-messaging specialist before any real person uses the product (R4 safety risks).
 */
const CRISIS = [
  /\b(kill|killing|hurt|hurting|harm|harming|cut|cutting)\s+(myself|me)\b/i,
  /\bsuicid/i,
  /\bself[\s-]?harm/i,
  /\b(want|wanted|going|plan|planning)\s+to\s+die\b/i,
  /\b(don'?t|do not)\s+want\s+to\s+(live|be alive|be here|wake up)\b/i,
  /\bend\s+(my\s+life|it\s+all)\b/i,
  /\b(no\s+reason\s+to\s+live|better\s+off\s+dead|better\s+off\s+without\s+me)\b/i,
  /\boverdos/i,
  /\b(take|took|swallow)\w*\s+(all\s+)?(my\s+|the\s+)?(pills|tablets)\b/i,
  /\b(someone|somebody|he|she|they)\s+(is|are|keeps?)\s+(hurting|hitting|abusing|threatening)\s+me\b/i,
  /\b(i'?m|i\s+am)\s+in\s+danger\b/i,
];

const IDENTITY = [
  /\bare\s+you\s+(really\s+|actually\s+)?(my\s+)?(dad|daddy|mum|mummy|mom|mommy|father|mother|parent|papa|mama|gran|granny|grandma|grandpa)\b/i,
  /\bare\s+you\s+(real|alive|human|a\s+person|him|her|them|an?\s+ai|a\s+bot|a\s+robot|a\s+computer)\b/i,
  /\bis\s+(this|that)\s+(really\s+)?(you|my\s+(dad|mum|mom|father|mother|parent))\b/i,
  /\bwho\s+(are|am)\s+(you|i\s+talking\s+to)\b/i,
  /\bwhat\s+are\s+you\b/i,
];

export function isCrisis(question: string): boolean {
  return CRISIS.some((r) => r.test(question));
}

export function isIdentityQuestion(question: string): boolean {
  return IDENTITY.some((r) => r.test(question));
}

/**
 * South African help lines, checked 17 November 2026 against several published listings
 * (SADAG / therapyroute.com / national press). Re-verify before any pilot and add other countries
 * when the pilot cohort is known.
 */
export const HELP_RESOURCES = [
  { name: "Emergency (from a mobile phone)", contact: "112", note: "If you are in immediate danger." },
  { name: "Police / Ambulance", contact: "10111 / 10177", note: "South Africa." },
  { name: "SADAG Suicide Crisis Helpline", contact: "0800 567 567", note: "Free, 24 hours." },
  { name: "LifeLine South Africa", contact: "0861 322 322", note: "24-hour counselling." },
] as const;
