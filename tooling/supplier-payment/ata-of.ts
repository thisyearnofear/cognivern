/** Print the derived associated token account for --mint and --owner. */
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v) {
    console.error(`missing --${name}`);
    process.exit(1);
  }
  return v;
}
const [ata] = await findAssociatedTokenPda({
  mint: arg('mint') as never,
  owner: arg('owner') as never,
  tokenProgram: TOKEN_PROGRAM_ADDRESS,
});
console.log(String(ata));
