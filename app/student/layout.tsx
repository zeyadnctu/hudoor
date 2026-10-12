import { AppNav } from "@/components/app-nav";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav role="student" />
      {children}
    </>
  );
}
