function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function WelcomeHeader({ name }: { name: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">
        {greeting()}, {name}
      </h1>
      <p className="mt-1 text-sm text-ink-500 md:text-base">Continue your SSC preparation.</p>
    </div>
  );
}
