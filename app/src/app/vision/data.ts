// Every word and number on /vision lives here. Source of truth: the platform vision (VISION.md) and
// what the prototype really does (FACTS.md). Doors 02-08 are the platform design, never presented as built.
import { TIDE_NETWORK } from "@/components/tide";

export type VisionIconName =
  | "mail" | "heartPulse" | "landmark" | "briefcase" | "wallet" | "home" | "activity" | "mic"
  | "flag" | "users" | "code" | "globe";

export const META = {
  title: "Heirloom | One engine, many doors",
  description: "Heirloom is the first app on a bigger idea: release rules that no company, admin or single relative can override.",
};

export const HERO = {
  eyebrow: "The platform vision",
  title: "One engine. Every decision that must outlive us.",
  subline: "Mai's vault is only the first door.",
  lead: "Heirloom is the first app on a bigger idea: release rules that no company, admin or single relative can override. Today one party holds that power. With Tide, nobody does: it emerges only when the people you chose agree.",
  primary: { label: "Explore the doors", href: "#doors" },
  secondary: { label: "Try the prototype", href: "/" },
  pillarsLabel: "Every door, the same three guarantees",
  pillars: ["Sealed in the owner's browser", "Decided by independent seats", "Opened by the Tide network"],
};

/** Hero motif: the real threshold of this network, lit one node at a time. */
export const NETWORK = {
  total: TIDE_NETWORK.total,
  required: TIDE_NETWORK.required,
  /** Ring positions (0 = top, clockwise) in the order they agree. Length must equal `required`. */
  litOrder: [0, 7, 13, 3, 16, 10, 1, 19, 6, 11, 4, 14, 8, 17],
  countLabel: `of ${TIDE_NETWORK.required} needed`,
  met: "Threshold met: the key opens for the named person only",
  caption: `On ${TIDE_NETWORK.label}, ${TIDE_NETWORK.required} of ${TIDE_NETWORK.total} independent nodes must agree before any key is released.`,
  sub: "No company, admin or single relative ever holds the whole key.",
  legendOn: "Node agrees",
  legendOff: "Not needed for this key",
};

export type Figure = { big: string; unit?: string; label: string; meaning: string; source: string; url: string };

export const NUMBERS: { eyebrow: string; title: string; description: string; sourcePrefix: string; newTab: string; items: Figure[] } = {
  eyebrow: "Why it cannot wait",
  title: "The people who need this are already here.",
  description: "Loss of capacity, a transfer between generations, a wish nobody wrote down: each one is a decision that must outlive the person who made it.",
  sourcePrefix: "Source:",
  newTab: "(opens in a new tab)",
  items: [
    {
      big: "57", unit: "million",
      label: "people were living with dementia worldwide in 2021, with nearly 10 million new cases every year.",
      meaning: "A timer cannot tell when someone stops being able to decide. Independent seats can.",
      source: "WHO, Dementia fact sheet",
      url: "https://www.who.int/news-room/fact-sheets/detail/dementia",
    },
    {
      big: "$124", unit: "trillion",
      label: "of wealth is expected to transfer in the US through 2048, to heirs and to charity.",
      meaning: "Every transfer needs a key that opens for the right person, and only for them.",
      source: "Cerulli Associates, December 2024",
      url: "https://www.cerulli.com/press-releases/cerulli-anticipates-124-trillion-in-wealth-will-transfer-through-2048",
    },
    {
      big: "36.7%",
      label: "of US adults had completed an advance directive, across 150 studies from 2011 to 2016.",
      meaning: "About two in three have no advance directive at all for the day they cannot speak for themselves.",
      source: "Yadav et al., Health Affairs, 2017",
      url: "https://doi.org/10.1377/hlthaff.2017.0175",
    },
  ],
};

export type Door = {
  id: string;
  n: string;
  icon: VisionIconName;
  title: string;
  short: string;
  tagline: string;
  live: boolean;
  sealedBy: string;
  sealed: string;
  opensFor: string;
  when: string;
  seats: [string, string, string];
  /** Shown after "The company", which is never a seat on any door. */
  never: string[];
  /** Door-specific detail for Seal, Name, Approve, Open. */
  engine: [string, string, string, string];
  liveNote?: string;
};

export const EXPLORER = {
  id: "doors",
  eyebrow: "One engine, many doors",
  title: "Eight doors. The same four steps.",
  description: "Only the names change: who seals, who it opens for, and which independent seats decide. Door 01 runs today in this prototype. Doors 02 to 08 are the platform design.",
  pickLabel: "Choose a door",
  doorWord: "Door",
  live: "Live in this prototype",
  liveTag: "Live",
  showing: "Showing",
  design: "Platform design",
  sealedBy: "Sealed by",
  opensFor: "Opens for",
  decidedBy: "Decided by",
  never: "Never decided by",
  seatsRule: "Any 2 of 3 independent seats",
  seatsRuleShort: "2 of 3",
  company: "The company",
  companyNote: "Heirloom, or whoever runs the servers, is never a seat.",
  engineTitle: "The engine",
  engineSteps: ["Seal", "Name", "Approve", "Open"] as [string, string, string, string],
  cardLabel: "Release rule",
};

export const DOORS: Door[] = [
  {
    id: "inheritance", n: "01", icon: "mail", live: true,
    title: "Digital inheritance",
    short: "Logins, letters, a recovery phrase",
    tagline: "Mai seals her care wishes for her daughter and her bank logins for her son. Each item opens for one child only.",
    sealedBy: "The parent, in their own browser",
    sealed: "Logins, letters, a wallet recovery phrase",
    opensFor: "The heir named on each item",
    when: "and nothing addressed to anyone else",
    seats: ["Notary", "Family doctor", "A relative"],
    never: ["A timer"],
    engine: ["Encrypted on Mai's device", "One heir per item", "Seats sign in the Tide enclave", "Only that heir's role"],
    liveNote: "In this prototype one notary seat decides, because the free licence caps linked accounts at 3. Production: 2 of 3.",
  },
  {
    id: "care", n: "02", icon: "heartPulse", live: false,
    title: "Advance care wishes",
    short: "Treatment wishes, DNR, organ donation",
    tagline: "Treatment wishes reach the treating doctor at the moment the patient can no longer say them.",
    sealedBy: "The patient, while they can still decide",
    sealed: "Treatment preferences, do-not-resuscitate, organ donation",
    opensFor: "The treating doctor",
    when: "when the patient lacks capacity",
    seats: ["GP", "A family member", "Hospital ethics lead"],
    never: ["One relative alone"],
    engine: ["Sealed while capable", "The treating doctor", "Seats confirm incapacity", "Doctor reads, nobody else"],
  },
  {
    id: "attorney", n: "03", icon: "landmark", live: false,
    title: "Power of attorney at the bank",
    short: "Spending authority, with limits",
    tagline: "Spending authority, with its limits, passes to the attorney without one child or one banker deciding.",
    sealedBy: "The account holder",
    sealed: "Spending authority with limits",
    opensFor: "The named attorney",
    when: "when the holder can no longer manage money",
    seats: ["Doctor", "Lawyer", "A family member"],
    never: ["The bank alone", "One child"],
    engine: ["Limits set by the holder", "The attorney", "Seats agree", "Authority within limits"],
  },
  {
    id: "continuity", n: "04", icon: "briefcase", live: false,
    title: "Business continuity",
    short: "Admin keys, treasury, client files",
    tagline: "A founder's keys pass to the co-founder or the board, not to whoever controls the IT console.",
    sealedBy: "The founder",
    sealed: "Admin keys, treasury signer, client files",
    opensFor: "The co-founder or the board",
    when: "if the founder is incapacitated or gone",
    seats: ["Board chair", "Independent director", "Investor director"],
    never: ["The IT admin", "One shareholder"],
    engine: ["Keys sealed by the founder", "Co-founder or board", "Board members sign", "Keys, not the console"],
  },
  {
    id: "crypto", n: "05", icon: "wallet", live: false,
    title: "Self-custody crypto",
    short: "A 12-word recovery phrase",
    tagline: "A wallet's 12-word recovery phrase reaches the heirs with no timer and no custodian.",
    sealedBy: "The holder, in their own browser",
    sealed: "A 12-word recovery phrase",
    opensFor: "The named heirs",
    when: "after death, confirmed by the seats",
    seats: ["Notary", "Family lawyer", "A trusted friend"],
    never: ["A custodian", "A timer"],
    engine: ["Phrase sealed by the holder", "The heirs", "Seats confirm", "Phrase in the heir's browser"],
  },
  {
    id: "guardianship", n: "06", icon: "home", live: false,
    title: "Children's guardianship plan",
    short: "Who raises the children",
    tagline: "Who raises the children, with their school and medical records, reaches the guardian the parents chose.",
    sealedBy: "The parents",
    sealed: "The guardian choice, school and medical records",
    opensFor: "The named guardian",
    when: "if the parents can no longer care for them",
    seats: ["First guardian", "Second guardian", "Family lawyer"],
    never: ["One relative alone"],
    engine: ["Plan sealed by the parents", "The guardian", "Guardians and lawyer agree", "Records for the guardian"],
  },
  {
    id: "breakglass", n: "07", icon: "activity", live: false,
    title: "Break-glass medical records",
    short: "An unconscious patient's record",
    tagline: "An unconscious patient's record opens for the emergency doctor, and every opening is recorded.",
    sealedBy: "The patient, through their clinic",
    sealed: "An unconscious patient's medical record",
    opensFor: "The emergency doctor",
    when: "in an emergency, with every opening recorded",
    seats: ["On-call physician", "Charge nurse", "Duty consultant"],
    never: ["The hospital IT admin"],
    engine: ["Record sealed at the clinic", "The emergency doctor", "On-call clinicians approve", "Opened and recorded"],
  },
  {
    id: "testimony", n: "08", icon: "mic", live: false,
    title: "Sealed testimony",
    short: "Evidence held for a lawyer or journalist",
    tagline: "Evidence held for a lawyer or journalist opens only when trusted people agree, not when a switch fires.",
    sealedBy: "A witness or a source",
    sealed: "Evidence or a statement",
    opensFor: "A named lawyer or journalist",
    when: "only if the trusted seats agree",
    seats: ["Editor-in-chief", "Media lawyer", "Independent editor"],
    never: ["A dead man's switch"],
    engine: ["Statement sealed by the source", "The lawyer or journalist", "Trusted seats agree", "Released, not leaked"],
  },
];

export const CONTRAST = {
  id: "why-tide",
  eyebrow: "Why only Tide makes this credible",
  title: "Remove the trusted party, and the rule still holds.",
  description: "If an app would work the same with ordinary login and backend permissions, its rules are only as strong as its admins.",
  ordinary: { label: "Ordinary login + backend permissions", kicker: "Promises.", foot: "Whoever runs the server can always read or grant." },
  tide: { label: "Heirloom on Tide", kicker: "Guarantees, by design.", foot: "The operator cannot override, by design. Not even Heirloom." },
  rows: [
    { topic: "Who can read it", ordinary: "Whoever runs the server holds the keys, so the company can read.", tide: "Keys never exist whole anywhere. The company stores only ciphertext." },
    { topic: "Who can release it", ordinary: "One admin with the right permission can grant access to anyone.", tide: "A release is a governed change that seats approve in the Tide enclave. No admin can grant it alone." },
    { topic: "What enforces the rule", ordinary: "Backend code, which the operator can change at any time.", tide: `The Tide network enforces the signed policy: ${TIDE_NETWORK.required} of ${TIDE_NETWORK.total} independent nodes on ${TIDE_NETWORK.label} must agree.` },
  ],
  proof: {
    label: "Proven in the prototype today",
    lines: ["Refused by the Tide network: 0 of 14 nodes would release this key", "403 from TideCloak: not a seat"],
    note: "Real responses from the live Tide network and TideCloak, shown on the Server dump page.",
  },
};

export type Horizon = { id: string; horizon: string; name: string; status?: string; icon: VisionIconName; points: string[]; partners?: string[]; statement?: string };

export const ROADMAP: { id: string; eyebrow: string; title: string; description: string; partnersLabel: string; horizons: Horizon[] } = {
  id: "roadmap",
  eyebrow: "Roadmap",
  title: "From one family to every institution that holds a key.",
  description: "Honest about today, ambitious about where the same engine goes next.",
  partnersLabel: "Built in by",
  horizons: [
    {
      id: "now", horizon: "Now", name: "This prototype", status: "Live today", icon: "flag",
      points: [
        "One synthetic family, two sealed items",
        "One approver seat: the free licence caps linked accounts at 3",
        `Real Tide network: ${TIDE_NETWORK.required} of ${TIDE_NETWORK.total} nodes must agree`,
        "Real enclave approval for every release",
      ],
    },
    {
      id: "next", horizon: "Next", name: "Pilot", icon: "users",
      points: [
        "2 of 3 independent seats: notaries and family doctors",
        "A capacity-assessment workflow",
        "The owner can revoke while still capable",
        "Mobile app, in Vietnamese and English",
      ],
    },
    {
      id: "then", horizon: "Then", name: "Platform", icon: "code",
      points: [
        "A Release Rules API and SDK",
        "Governed release built into other products, without ever holding a master key",
      ],
      partners: ["Banks", "Hospitals", "Law firms", "Wallet providers"],
    },
    {
      id: "vision", horizon: "Vision", name: "North star", icon: "globe",
      points: [],
      statement: "No institution needs to be trusted with a family's most private decisions.",
    },
  ],
};

export const CTA = {
  eyebrow: "Start with the first door",
  title: "Mai's vault is the first door. The engine opens the rest.",
  body: "Try the real flow: seal an item, watch the Tide network refuse, approve in the Tide enclave, then open it as the named heir.",
  primary: { label: "Try the prototype", href: "/" },
  secondary: { label: "How it works", href: "/help" },
  footnote: "Doors 02 to 08 are platform designs, not built yet. Every person and record in the prototype is synthetic.",
};
