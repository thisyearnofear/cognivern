import { redirect } from "next/navigation";

// The replay is folded into /verify's auction mode. This route only exists
// to keep old links working; /verify?round=sandbox-replay is canonical.
export default function ProcureDemoPage() {
  redirect("/verify?round=sandbox-replay");
}
