export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-16 text-center">
      <h1 className="font-display tnum text-6xl font-bold">404</h1>
      <p className="mt-2 text-lg font-semibold">الصفحة غير موجودة · Page not found</p>
      <a
        href="/"
        className="mt-6 block min-h-[52px] rounded-md2 bg-register py-3.5 text-center font-semibold text-white hover:bg-register-dark"
      >
        الرئيسية · Home
      </a>
    </main>
  );
}
