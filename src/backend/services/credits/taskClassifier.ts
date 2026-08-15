/**
 * Coarse task classification for the `detailed` disclosure tier.
 *
 * READ THIS BEFORE TRUSTING THE OUTPUT.
 *
 * This is a keyword heuristic, not an intent detector. It answers "what shape
 * of work does this look like" well enough to draw a sponsor a pie chart. It
 * cannot answer "was this hackathon-related", and nothing in this codebase
 * should ever gate, deny, or penalise a request based on it.
 *
 * That restraint is deliberate. Classifying developer intent from a prompt is
 * unreliable in both directions: a participant debugging their submission's CI
 * looks identical to one debugging unrelated work, and someone asking about
 * recipes may genuinely be building a recipe app. During a time-boxed
 * hackathon, a false positive that blocks a working participant costs far more
 * than the leakage it prevents. So this is a reporting signal only — the real
 * controls are structural (budget cap, model allowlist, time window) and the
 * real deterrent is that spend is attributable and visible.
 *
 * Classification runs on already-redacted text and only its single-word label
 * is persisted, never the text that produced it.
 */

export const TASK_CLASSES = [
  "code",
  "debug",
  "review",
  "docs",
  "research",
  "data",
  "design",
  "ops",
  "chat",
  "other",
] as const;

export type TaskClass = (typeof TASK_CLASSES)[number];

interface Signal {
  taskClass: TaskClass;
  /** Weighted keywords; longer/more specific phrases score higher. */
  patterns: Array<[RegExp, number]>;
}

const SIGNALS: Signal[] = [
  {
    taskClass: "debug",
    patterns: [
      [/\b(stack ?trace|traceback|segfault|panic:|exception)\b/i, 3],
      [/\b(why (is|does|isn'?t|doesn'?t)|not working|broken|fails?|failing)\b/i, 2],
      [/\b(debug|fix this|error message|bug|crash)\b/i, 2],
    ],
  },
  {
    taskClass: "review",
    patterns: [
      [/\b(code review|review (this|my) (code|pr|diff)|pull request)\b/i, 3],
      [/\b(refactor|improve this|is this idiomatic|best practice)\b/i, 2],
    ],
  },
  {
    taskClass: "code",
    patterns: [
      [/\b(write|implement|create|build|add) (a |an |the )?(function|class|component|endpoint|test|script|module|api)\b/i, 3],
      [/```/, 2],
      [/\b(typescript|python|rust|solidity|javascript|golang|sql)\b/i, 1],
      [/\b(function|const |async |import |def |struct |impl )\b/, 1],
    ],
  },
  {
    taskClass: "docs",
    patterns: [
      [/\b(readme|changelog|docstring|documentation|write docs)\b/i, 3],
      [/\b(explain|summari[sz]e|write up|draft) (this|the|a) (doc|readme|guide|post)\b/i, 2],
    ],
  },
  {
    taskClass: "research",
    patterns: [
      [/\b(compare|pros and cons|trade-?offs?|which (should|is better)|evaluate options)\b/i, 3],
      [/\b(how does .{0,30} work|what is the difference|research)\b/i, 2],
    ],
  },
  {
    taskClass: "data",
    patterns: [
      [/\b(dataset|csv|dataframe|pandas|query|aggregate|schema|migration)\b/i, 2],
      [/\b(select .{0,40} from|group by|join .{0,20} on)\b/i, 3],
    ],
  },
  {
    taskClass: "design",
    patterns: [
      [/\b(ui|ux|layout|css|tailwind|figma|colou?r (scheme|palette)|responsive)\b/i, 2],
      [/\b(design (a|the) (system|architecture|schema|interface))\b/i, 3],
    ],
  },
  {
    taskClass: "ops",
    patterns: [
      [/\b(docker|kubernetes|k8s|terraform|ci\/cd|github actions|deploy(ment)?|nginx|pm2)\b/i, 2],
      [/\b(env var|secret manager|helm|systemd)\b/i, 2],
    ],
  },
];

/**
 * Classify already-redacted prompt text.
 *
 * Returns `chat` for very short input and `other` when nothing scores — both
 * are honest "we don't know" answers rather than a forced guess into a
 * plausible-looking bucket.
 */
export function classifyTask(redactedText: string): TaskClass {
  const text = redactedText.trim();
  if (text.length === 0) return "other";
  if (text.length < 24) return "chat";

  const scores = new Map<TaskClass, number>();
  for (const signal of SIGNALS) {
    let score = 0;
    for (const [pattern, weight] of signal.patterns) {
      if (pattern.test(text)) score += weight;
    }
    if (score > 0) scores.set(signal.taskClass, score);
  }

  if (scores.size === 0) return "other";

  let best: TaskClass = "other";
  let bestScore = 0;
  for (const [taskClass, score] of scores) {
    if (score > bestScore) {
      best = taskClass;
      bestScore = score;
    }
  }

  // A single weak keyword is not a classification.
  return bestScore >= 2 ? best : "other";
}
