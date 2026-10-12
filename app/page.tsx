import Link from "next/link";
import { Controls } from "@/components/providers";
import { ScanLine, QrCode, ShieldCheck, ClipboardList, Users, BookOpen } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-chalk text-ink dark:bg-inkdeep dark:text-neutral-100">
      <div className="mx-auto max-w-3xl px-5 pb-16">
        <nav className="flex items-center justify-between py-5">
          <div className="flex items-center gap-3">
            <span className="font-display grid h-11 w-11 place-items-center rounded-md2 bg-ink font-bold text-chalk dark:bg-chalk dark:text-ink">ح</span>
            <span className="font-display text-xl font-bold">حضور</span>
          </div>
          <div className="flex items-center gap-2">
            <Controls />
            <Link href="/login" className="rounded-md2 bg-register px-5 py-3 font-semibold text-white hover:bg-register-dark">دخول</Link>
          </div>
        </nav>

        {/* hero: the product truth, plain typography */}
        <section className="py-10">
          <h1 className="font-display max-w-xl text-4xl font-bold leading-[1.4] sm:text-5xl">
            بدل كشف الورق. امسح مرة واحدة وتسجل حضورك.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-neutral-600 dark:text-neutral-300">
            Retire the paper sheet. A code on the projector renews every few seconds, and each scan is checked against the course list, the student device, and the hall location.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-md2 bg-register px-7 py-3.5 text-lg font-semibold text-white hover:bg-register-dark">
              إنشاء حساب
            </Link>
            <Link href="/student/scan-in-app" className="rounded-md2 border-2 border-ink/20 px-7 py-3.5 text-lg font-semibold hover:border-register hover:text-register dark:border-white/25">
              <span className="inline-flex items-center gap-2"><ScanLine size={20} strokeWidth={2} /> افتح الماسح</span>
            </Link>
          </div>
        </section>

        {/* who is this for: structured rows, not cards */}
        <section className="border-t-2 border-ink/15 dark:border-white/20" aria-label="roles">
          <RoleRow icon={<BookOpen size={22} strokeWidth={1.75} />} title="طالب" en="Student" desc="واقف في قاعة زحمة وموبايلك في إيدك. امسح وشوف «حاضر»." href="/student" />
          <RoleRow icon={<QrCode size={22} strokeWidth={1.75} />} title="أستاذ" en="Professor" desc="رمز ضخم على البروجيكتور يتجدد تلقائياً، وعداد حي بأسماء الحاضرين." href="/professor" />
          <RoleRow icon={<Users size={22} strokeWidth={1.75} />} title="إدارة" en="Admin" desc="موافقات وتسجيل مواد وكشف محاولات الغش وتقارير." href="/admin" />
        </section>

        {/* how cheating fails here */}
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold">ليه الغش مش هينفع</h2>
          <ul className="mt-4 space-y-4">
            <WhyRow icon={<QrCode size={22} strokeWidth={1.75} />} text="صورة الرمز المبعوتة لصاحبك بتنتهي صلاحيتها خلال ثواني." />
            <WhyRow icon={<ShieldCheck size={22} strokeWidth={1.75} />} text="جهاز واحد مربوط بكل طالب. جهاز تاني معناه رفض وتسجيل محاولة." />
            <WhyRow icon={<ClipboardList size={22} strokeWidth={1.75} />} text="لازم تكون جوه القاعة. الموقع الوهمي مرفوض." />
          </ul>
        </section>

        <footer className="mt-12 border-t border-ink/15 pt-4 text-sm text-neutral-500 dark:border-white/15">
          حضور · يعمل كتطبيق على الموبايل · عربي أولاً
        </footer>
      </div>
    </main>
  );
}

function RoleRow({ icon, title, en, desc, href }: { icon: React.ReactNode; title: string; en: string; desc: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-4 border-b border-ink/15 py-5 transition-colors hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/5">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md2 bg-register-light text-register-dark dark:bg-register/25 dark:text-sky-200">{icon}</span>
      <span className="flex-1">
        <span className="font-display text-lg font-bold">{title} <span className="text-sm font-medium text-neutral-500">{en}</span></span>
        <span className="block text-[15px] text-neutral-600 dark:text-neutral-300">{desc}</span>
      </span>
    </Link>
  );
}

function WhyRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-md2 bg-stamp-light text-stamp-dark dark:bg-stamp/20 dark:text-emerald-300">{icon}</span>
      <span className="text-[16px] leading-relaxed">{text}</span>
    </li>
  );
}
