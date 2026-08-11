import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readCapyConfig } from "@capy-kit/core";
import { defineCommand } from "citty";

export const projectsCommand = defineCommand({
  meta: { name: "projects", description: "Edit named Capy projects without changing the API key." },
  args: {},
  async run() {
    if (!process.stdin.isTTY) throw new Error("capy projects needs an interactive terminal.");
    const p = await import("@clack/prompts");
    const existing = readCapyConfig() ?? {};
    const projects: Record<string, string> = { ...(existing.projects ?? {}) };

    let addProject = await p.confirm({ message: "Add or update a named Capy project?", initialValue: true });
    if (p.isCancel(addProject)) return;
    while (addProject) {
      const name = await p.text({ message: "Project name (for example, central)", validate: (v) => !v.trim() ? "Project name is required." : undefined });
      if (p.isCancel(name)) return;
      const projectId = await p.text({ message: `Project ID for ${name}`, initialValue: projects[name.trim()], validate: (v) => !v.trim() ? "Project ID is required." : undefined });
      if (p.isCancel(projectId)) return;
      projects[name.trim()] = projectId.trim();
      addProject = await p.confirm({ message: "Add or update another project?", initialValue: false });
      if (p.isCancel(addProject)) return;
    }

    const names = Object.keys(projects);
    if (!names.length) { p.log.warn("No projects are configured; nothing changed."); return; }
    const defaultProject = await p.select({
      message: "Primary project",
      initialValue: existing.defaultProject && projects[existing.defaultProject] ? existing.defaultProject : names[0],
      options: names.map((value) => ({ value, label: value, hint: projects[value] })),
    });
    if (p.isCancel(defaultProject)) return;

    const dir = join(homedir(), ".capy");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "config.json");
    writeFileSync(path, JSON.stringify({ ...existing, projects, defaultProject }, null, 2) + "\n", { mode: 0o600 });
    chmodSync(path, 0o600);
    p.outro(`Saved projects to ${path}; API key unchanged.`);
  },
});
