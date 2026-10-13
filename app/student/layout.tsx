import { AppNav } from "@/components/app-nav";
import { ViewAsBanner } from "@/components/console/ViewAsBanner";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ViewAsBanner />
      <AppNav role="student" />
      {children}
    </>
  );
}
