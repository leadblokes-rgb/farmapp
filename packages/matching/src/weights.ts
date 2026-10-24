// Tuning knobs for the rule-based ranker. Each set sums to 100.

export const APPLICANT_WEIGHTS = {
  availability: 30,
  distance: 20,
  transport: 15,
  experience: 20,
  reliability: 15,
} as const;

export const FEED_WEIGHTS = {
  availability: 35,
  distance: 25,
  pay: 15,
  accommodation: 15,
  transport: 10,
} as const;

/** Beyond this distance the distance score is 0. */
export const MAX_USEFUL_DISTANCE_KM = 300;

/** Score used for reliability until a worker has ratings. */
export const UNRATED_RELIABILITY_SCORE = 0.6;

/** Pay this far above the award minimum (in cents/hour) earns the full pay score. */
export const PAY_SCORE_CEILING_ABOVE_MIN_CENTS = 800;

/**
 * Job alerts: new jobs normally go into a once-a-day digest. A job scoring at least this much
 * for a worker (0–100, from rankJobsForWorker) is "a great match" and is sent straight away to
 * workers who've turned on instant alerts, at most JOB_ALERT_MAX_INSTANT_PER_DAY a day.
 */
export const JOB_ALERT_INSTANT_MIN_SCORE = 80;
export const JOB_ALERT_MAX_INSTANT_PER_DAY = 3;
