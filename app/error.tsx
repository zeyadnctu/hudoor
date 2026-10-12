"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-16 text-center">
      <h1 className="font-display text-2xl font-bold">حدث خطأ · Something went wrong</h1>
      <p className="tnum mt-2 text-sm text-neutral-500" dir="auto">{error.message}</p>
      <button
        onClick={reset}
        className="mt-6 min-h-[52px] w-full rounded-md2 bg-register font-semibold text-white hover:bg-register-dark"
      >
        حاول مجدداً · Try again
      </button>
      <a href="/" className="mt-3 block font-semibold text-register underline-offset-4 hover:underline">الرئيسية · Home</a>
    </main>
  );
}
