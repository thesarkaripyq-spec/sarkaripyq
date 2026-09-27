import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-content px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-ink-900">Page not found</h1>
      <p className="mt-2 text-ink-500">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="mt-4 inline-block text-brand-500 hover:underline">
        Back to home
      </Link>
    </div>
  );
}
