import type { Metadata } from "next";
import AdminPortal from "@/components/AdminPortal";

export const metadata: Metadata = {
  title: "Admin — Near to me",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminPortal />;
}
