import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { CommandDef } from "citty";

// Convenience SNAPSHOT of a few ids — can lag the platform. The full alias map comes from
// /v1/models (later milestone); any id the API accepts still works via `capy delegate --model`.
const MODEL_CHOICES = [
  { value: "claude-opus-4-8", label: "claude-opus-4-8 (default)" },
  { value: "claude-sonnet-4-6", label: "claude-sonnet-4-6" },
  { value: "claude-haiku-4-5", label: "claude-haiku-4-5" },
];

export const initCommand: CommandDef = {
  meta: { name: "init", description: "Interactive setup → ~/.capy/config.json (mode 0600)." },
  args: {},
  async run() {
    if (!process.stdin.isTTY) {
      process.stderr.write(
        "capy init needs an interactive terminal.\n" +
          "Non-interactive setup: set CAPY_API_KEY (and optionally CAPY_PROJECT_ID / CAPY_ORG_ID).\n",
      );
      process.exitCode = 1;
      return;
    }

    const p = await import("@clack/prompts");
    p.intro("capy init");

    const apiKey = await p.password({
      message: "Capy API key (capy_…) — create at capy.ai/settings/tokens",
      validate: (v) => (v && v.length > 0 ? undefined : "Required"),
    });
    if (p.isCancel(apiKey)) return p.cancel("Cancelled.");

    const store = await p.confirm({
      message: "Store the key in ~/.capy/config.json (0600)? (No → use the CAPY_API_KEY env var)",
      initialValue: false,
    });
    if (p.isCancel(store)) return p.cancel("Cancelled.");

    const projectId = await p.text({
      message: "Default project id (optional)",
      placeholder: "uuid, e.g. 550e8400-…",
    });
    if (p.isCancel(projectId)) return p.cancel("Cancelled.");

    const orgId = await p.text({ message: "Org id for usage (optional)", placeholder: "org_…" });
    if (p.isCancel(orgId)) return p.cancel("Cancelled.");

    const authorEmail = await p.text({
      message: "Your email — defaults `capy status` to your own threads on shared projects (optional)",
      placeholder: "you@company.com",
    });
    if (p.isCancel(authorEmail)) return p.cancel("Cancelled.");

    const defaultModel = await p.select({
      message: "Default model",
      options: MODEL_CHOICES,
      initialValue: "claude-opus-4-8",
    });
    if (p.isCancel(defaultModel)) return p.cancel("Cancelled.");

    const dir = join(homedir(), ".capy");
    mkdirSync(dir, { recursive: true });
    const cfgPath = join(dir, "config.json");
    const existing: Record<string, unknown> = existsSync(cfgPath)
      ? (JSON.parse(readFileSync(cfgPath, "utf8")) as Record<string, unknown>)
      : {};

    const cfg: Record<string, unknown> = { ...existing, defaultModel };
    if (store) cfg.apiKey = apiKey;
    else delete cfg.apiKey;
    if (typeof projectId === "string" && projectId.trim()) cfg.projectId = projectId.trim();
    if (typeof orgId === "string" && orgId.trim()) cfg.orgId = orgId.trim();
    if (typeof authorEmail === "string" && authorEmail.trim()) cfg.authorEmail = authorEmail.trim();

    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
    chmodSync(cfgPath, 0o600);

    const keyNote = store
      ? "API key stored (0600)."
      : "API key NOT stored — export CAPY_API_KEY in your shell.";
    p.outro(`Saved ${cfgPath}. ${keyNote}`);
  },
};
