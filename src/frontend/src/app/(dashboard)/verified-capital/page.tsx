import { redirect } from "next/navigation";

export default function VerifiedCapitalRoute() {
  redirect("/capital?view=verified");
}
