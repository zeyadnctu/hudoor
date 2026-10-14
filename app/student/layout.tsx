import { StudentBottomNav } from "@/components/student-bottom-nav";
import { ViewAsBanner } from "@/components/console/ViewAsBanner";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ViewAsBanner />
      {children}
      <StudentBottomNav />
    </>
  );
}
