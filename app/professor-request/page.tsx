export default function ProfRequest() {
  return (
    <main className="mx-auto max-w-sm p-6">
      <div className="rounded-2xl border p-5">
        <h1 className="text-2xl font-bold">Professor access</h1>
        <p className="mt-2 text-sm text-neutral-500">Your account was created with role professor and status pending. An admin must approve it before you can start sessions. You will be able to log in after approval.</p>
        <a className="mt-4 inline-block underline" href="/login">Back to login</a>
      </div>
    </main>
  );
}
