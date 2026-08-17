import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readCapyConfig } from "@capy-kit/core";
import { defineCommand } from "citty";

export const initCommand = defineCommand({
  meta: { name: "init", description: "Configure a Capy API key and named projects." },
  args: {},
  async run() {
    if (!process.stdin.isTTY) throw new Error("capy init needs an interactive terminal; set CAPY_API_KEY and CAPY_PROJECT_ID instead.");
    const p = await import("@clack/prompts");
    const existing = readCapyConfig() ?? {};
    const key = await p.password({ message: "Capy API key" });
    if (p.isCancel(key)) return;

    const projects: Record<string, string> = { ...(existing.projects ?? {}) };
    let addProject = await p.confirm({ message: "Add a named Capy project?", initialValue: Object.keys(projects).length === 0 });
    if (p.isCancel(addProject)) return;
    while (addProject) {
      const name = await p.text({ message: "Project name (for example, central)", validate: (v) => !v.trim() ? "Project name is required." : undefined });
      if (p.isCancel(name)) return;
      const projectId = await p.text({ message: `Project ID for ${name}`, validate: (v) => !v.trim() ? "Project ID is required." : undefined });
      if (p.isCancel(projectId)) return;
      projects[name.trim()] = projectId.trim();
      addProject = await p.confirm({ message: "Add another project?", initialValue: false });
      if (p.isCancel(addProject)) return;
    }

    let defaultProject: string | undefined;
    const names = Object.keys(projects);
    if (names.length === 1) defaultProject = names[0];
    else if (names.length > 1) {
      const chosen = await p.select({ message: "Primary project", options: names.map((value) => ({ value, label: value, hint: projects[value] })) });
      if (p.isCancel(chosen)) return;
      defaultProject = chosen as string;
    }

    const dir = join(homedir(), ".capy");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "config.json");
    writeFileSync(path, JSON.stringify({ ...existing, apiKey: key, ...(names.length ? { projects, defaultProject } : {}) }, null, 2) + "\n", { mode: 0o600 });
    chmodSync(path, 0o600);
    p.outro(`Saved ${path}.`);
  },
});
