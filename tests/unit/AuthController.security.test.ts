import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const authControllerPath = path.resolve(
  process.cwd(),
  "src/backend/modules/api/controllers/AuthController.ts",
);

describe("AuthController credential handling", () => {
  it("does not log password-reset or email-verification tokens", () => {
    const source = fs.readFileSync(authControllerPath, "utf8");
    expect(source).not.toMatch(/Password reset token for/);
    expect(source).not.toMatch(/console\.log\([\s\S]{0,200}resetToken/);
    expect(source).not.toMatch(/console\.log\([\s\S]{0,200}verificationToken/);
  });

  it("binds wallet identity to the verified SIWE address", () => {
    const source = fs.readFileSync(authControllerPath, "utf8");
    expect(source).toContain("resolveAuthenticatedAddress");
    expect(source).toContain("siweMessage.address");
    expect(source).not.toMatch(
      /const normalizedAddress = address\.toLowerCase\(\)/,
    );
  });
});
