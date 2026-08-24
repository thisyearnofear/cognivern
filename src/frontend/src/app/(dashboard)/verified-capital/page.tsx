import { redirect } from "next/navigation";

export default function VerifiedCapitalRoute() {
  redirect("/spend?view=verified");
}
