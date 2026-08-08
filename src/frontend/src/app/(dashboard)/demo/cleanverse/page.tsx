import { redirect } from "next/navigation";

/** Legacy demo path — Cleanverse is a first-class spend rail at /verified-capital. */
export default function CleanverseDemoRedirect() {
  redirect("/verified-capital");
}
