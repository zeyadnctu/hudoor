import { AppNav } from "@/components/app-nav";

export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav role="professor" />
      {children}
    </>
  );
}
