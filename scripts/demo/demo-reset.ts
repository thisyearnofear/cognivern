import { creRunStore } from "../src/cre/storage/CreRunStore.js";

async function main() {
  await creRunStore.reset();
  console.log("Demo reset complete: CRE runs cleared.");
}

main().catch((error) => {
  console.error("Demo reset failed:", error);
  process.exit(1);
});
