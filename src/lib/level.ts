const LEVELS = [
  { label: "Beginner", min: 0 },
  { label: "Intermediate", min: 25 },
  { label: "Advanced", min: 100 },
  { label: "Pro", min: 300 },
  { label: "Expert", min: 750 },
] as const;

export function getLevel(totalAttempts: number) {
  let current: (typeof LEVELS)[number] = LEVELS[0];
  for (const tier of LEVELS) {
    if (tier.min <= totalAttempts) current = tier;
  }

  const next = LEVELS.find((tier) => tier.min > totalAttempts) ?? null;

  const progress = next
    ? Math.min(100, Math.round(((totalAttempts - current.min) / (next.min - current.min)) * 100))
    : 100;

  return { label: current.label, next, progress };
}
