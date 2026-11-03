import type { Metadata } from "next";
import AccountExperience from "@/components/AccountExperience";

export const metadata: Metadata = {
  title: "Join Near to me — Your local life, a little closer",
  description: "Create your Near to me account, or set up a local business guide.",
};

export default function AccountPage() {
  return <AccountExperience />;
}
