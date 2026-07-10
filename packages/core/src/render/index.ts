// Pure formatters: (opName, data) -> string. INJECTED into shells; never reads argv/env.
// JSON is the universal fallback; per-op human views are keyed by op name so the CLI
// stays a thin `write(render(op.name, result, fmt))`.

import { stripVTControlCharacters } from "node:util";

export type OutputFormat = "human" | "json";

/** Strip terminal control sequences from untrusted API/config text before human display. */
export function sanitizeTerminalText(value: string): string {
  return stripVTControlCharacters(value)
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "");
}

/** Preserve only renderer-owned line breaks after every untrusted field has been sanitized. */
function sanitizeTerminalOutput(value: string): string {
  return stripVTControlCharacters(value)
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, "")
    .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "");
}

interface ThreadItem {
  id: string;
  title: string | null;
  status: string;
  runState: string;
  waitingOn: string[];
  blockedOn: string[];
  pendingWakeups?: number;
  tasks?: Array<{ identifier: string; status: string; title?: string }>;
  pullRequests?: Array<{ number: number; state: string; url: string; repoFullName?: string }>;
  updatedAt?: string;
}

interface DelegateResult {
  threadId: string;
  projectId: string;
  status: string;
  runState: string;
  model: string;
  url: string;
}

interface WaitResultShape {
  status: string;
  runState: string;
  terminal: boolean;
  timedOut: boolean;
  blockedOn: string[];
  elapsedMs: number;
  attempts: number;
}

interface StatusResult {
  projectId: string;
  count: number;
  threads: Array<
    ThreadItem & {
      pr: { number: number; state: string; url: string } | null;
      url: string;
    }
  >;
}

function dash(arr: string[] | undefined): string {
  return arr && arr.length > 0 ? arr.map(sanitizeTerminalText).join(", ") : "—";
}

function truncate(s: string, n: number): string {
  const clean = sanitizeTerminalText(s);
  return clean.length > n ? `${clean.slice(0, n - 1)}…` : clean;
}

function fmtDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`;
}

function table(rows: string[][]): string {
  if (rows.length === 0) return "";
  const cleanRows = rows.map((row) => row.map(sanitizeTerminalText));
  const widths: number[] = [];
  for (const row of cleanRows) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] ?? 0, cell.length);
    });
  }
  return cleanRows
    .map((row) => row.map((cell, i) => cell.padEnd(i === row.length - 1 ? 0 : (widths[i] ?? 0))).join("  ").trimEnd())
    .join("\n");
}

function renderDelegate(d: DelegateResult): string {
  return [
    `delegated → ${sanitizeTerminalText(d.threadId)}  project=${sanitizeTerminalText(d.projectId)}  model=${sanitizeTerminalText(d.model)}  status=${sanitizeTerminalText(d.status)} runState=${sanitizeTerminalText(d.runState)}`,
    sanitizeTerminalText(d.url),
  ].join("\n");
}

function renderThreadsList(page: { items: ThreadItem[]; hasMore: boolean }): string {
  if (page.items.length === 0) return "No threads.";
  const rows: string[][] = [["ID", "STATUS", "RUNSTATE", "TITLE"]];
  for (const t of page.items) {
    rows.push([t.id, t.status, t.runState, truncate(t.title ?? "(untitled)", 56)]);
  }
  const footer = `\n${page.items.length} thread(s)${page.hasMore ? " (more available — use --all or --cursor)" : ""}`;
  return table(rows) + footer;
}

function renderThread(t: ThreadItem): string {
  const lines: string[] = [];
  lines.push(`${sanitizeTerminalText(t.id)}  ${truncate(t.title ?? "(untitled)", 64)}`);
  lines.push(
    `status: ${sanitizeTerminalText(t.status)}   runState: ${sanitizeTerminalText(t.runState)}   pendingWakeups: ${sanitizeTerminalText(String(t.pendingWakeups ?? 0))}`,
  );
  lines.push(`waitingOn: ${dash(t.waitingOn)}   blockedOn: ${dash(t.blockedOn)}`);
  if (t.tasks && t.tasks.length > 0) {
    lines.push("tasks:");
    for (const task of t.tasks) {
      lines.push(
        `  ${sanitizeTerminalText(task.identifier)}  ${sanitizeTerminalText(task.status)}${task.title ? `  ${truncate(task.title, 56)}` : ""}`,
      );
    }
  }
  if (t.pullRequests && t.pullRequests.length > 0) {
    lines.push("PRs:");
    for (const pr of t.pullRequests) {
      lines.push(
        `  #${pr.number}  ${sanitizeTerminalText(pr.state)}  ${sanitizeTerminalText(pr.repoFullName ?? "")}  ${sanitizeTerminalText(pr.url)}`.replace(/\s+/g, " "),
      );
    }
  }
  return lines.join("\n");
}

function renderStatus(s: StatusResult): string {
  if (s.threads.length === 0) return "No threads.";
  const rows: string[][] = [["ID", "STATUS", "RUNSTATE", "WAITING", "BLOCKED", "PR", "TITLE"]];
  for (const t of s.threads) {
    rows.push([
      t.id,
      t.status,
      t.runState,
      dash(t.waitingOn),
      dash(t.blockedOn),
      t.pullRequests && t.pullRequests.length > 0
        ? t.pullRequests.map((pr) => `#${pr.number} ${pr.state}`).join(", ")
        : t.pr
          ? `#${t.pr.number} ${t.pr.state}`
          : "—",
      truncate(t.title ?? "(untitled)", 40),
    ]);
  }
  return table(rows) + `\n${s.count} thread(s)`;
}

interface ProjectShape {
  id: string;
  name: string;
  taskCode: string;
  repos?: Array<{ repoFullName: string; branch: string }>;
}

function renderProjectsList(page: { items: ProjectShape[]; hasMore: boolean }): string {
  if (page.items.length === 0) return "No projects.";
  const rows: string[][] = [["ID", "TASKCODE", "NAME"]];
  for (const p of page.items) {
    rows.push([p.id, p.taskCode, truncate(p.name, 56)]);
  }
  const footer = `\n${page.items.length} project(s)${page.hasMore ? " (more available — use --all or --cursor)" : ""}`;
  return table(rows) + footer;
}

function renderProject(p: ProjectShape): string {
  const lines = [
    `${sanitizeTerminalText(p.id)}  ${sanitizeTerminalText(p.name)}`,
    `taskCode: ${sanitizeTerminalText(p.taskCode)}`,
  ];
  if (p.repos && p.repos.length > 0) {
    lines.push("repos:");
    for (const r of p.repos) {
      lines.push(`  ${sanitizeTerminalText(r.repoFullName)}@${sanitizeTerminalText(r.branch)}`);
    }
  }
  return lines.join("\n");
}

function renderModels(result: {
  models: Array<{ id: string; name: string; provider: string; captainEligible: boolean }>;
}): string {
  if (result.models.length === 0) return "No models.";
  const rows: string[][] = [["ID", "PROVIDER", "CAPTAIN", "NAME"]];
  for (const model of result.models) {
    rows.push([model.id, model.provider, model.captainEligible ? "yes" : "no", model.name]);
  }
  return table(rows) + `\n${result.models.length} model(s)`;
}

interface MessageShape {
  id: string;
  source: string;
  content: string;
  createdAt: string;
}

function renderSendMessage(m: { id: string; status: string }): string {
  return `message ${sanitizeTerminalText(m.status)} → ${sanitizeTerminalText(m.id)}`;
}

function renderStopThread(result: { id: string; status: string }): string {
  return `stop requested → ${sanitizeTerminalText(result.id)} status=${sanitizeTerminalText(result.status)}`;
}

function renderMessages(page: { items: MessageShape[]; hasMore: boolean }): string {
  if (page.items.length === 0) return "No messages.";
  // items arrive oldest→newest; print as a top-to-bottom log.
  const lines = page.items.map(
    (m) => `[${sanitizeTerminalText(m.source)}] ${truncate(m.content.replace(/\s+/g, " "), 200)}`,
  );
  const footer = `\n${page.items.length} message(s)${page.hasMore ? " (older available — use --all or --cursor)" : ""}`;
  return lines.join("\n") + footer;
}

function renderWait(w: WaitResultShape): string {
  const verdict = w.status === "archived" || w.runState === "archived"
    ? "ARCHIVED (success not established)"
    : w.terminal
      ? "done"
    : w.timedOut
      ? "TIMED OUT"
      : `blocked (${dash(w.blockedOn)})`;
  return `runState=${sanitizeTerminalText(w.runState)} status=${sanitizeTerminalText(w.status)} terminal=${w.terminal} — ${verdict} (${fmtDuration(w.elapsedMs)}, ${w.attempts} poll${w.attempts === 1 ? "" : "s"})`;
}

/** Format an op result for the chosen output mode. */
export function render(opName: string, data: unknown, format: OutputFormat): string {
  if (format === "json") return JSON.stringify(data, null, 2);
  let output: string;
  switch (opName) {
    case "delegate":
      output = renderDelegate(data as DelegateResult);
      break;
    case "threads.list":
      output = renderThreadsList(data as { items: ThreadItem[]; hasMore: boolean });
      break;
    case "threads.get":
      output = renderThread(data as ThreadItem);
      break;
    case "threads.stop":
      output = renderStopThread(data as { id: string; status: string });
      break;
    case "threads.message":
      output = renderSendMessage(data as { id: string; status: string });
      break;
    case "threads.messages":
      output = renderMessages(data as { items: MessageShape[]; hasMore: boolean });
      break;
    case "status":
      output = renderStatus(data as StatusResult);
      break;
    case "projects.list":
      output = renderProjectsList(data as { items: ProjectShape[]; hasMore: boolean });
      break;
    case "projects.get":
      output = renderProject(data as ProjectShape);
      break;
    case "models.list":
      output = renderModels(
        data as { models: Array<{ id: string; name: string; provider: string; captainEligible: boolean }> },
      );
      break;
    case "wait":
      output = renderWait(data as WaitResultShape);
      break;
    default:
      output = JSON.stringify(data, null, 2);
  }
  return sanitizeTerminalOutput(output);
}
