// Pure formatters: (opName, data) -> string. INJECTED into shells; never reads argv/env.
// JSON is the universal fallback; per-op human views are keyed by op name so the CLI
// stays a thin `write(render(op.name, result, fmt))`.

export type OutputFormat = "human" | "json";

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
  return arr && arr.length > 0 ? arr.join(", ") : "—";
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function fmtDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`;
}

function table(rows: string[][]): string {
  if (rows.length === 0) return "";
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] ?? 0, cell.length);
    });
  }
  return rows
    .map((row) => row.map((cell, i) => cell.padEnd(i === row.length - 1 ? 0 : (widths[i] ?? 0))).join("  ").trimEnd())
    .join("\n");
}

function renderDelegate(d: DelegateResult): string {
  return [
    `delegated → ${d.threadId} (${d.model})  status=${d.status} runState=${d.runState}`,
    d.url,
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
  lines.push(`${t.id}  ${truncate(t.title ?? "(untitled)", 64)}`);
  lines.push(
    `status: ${t.status}   runState: ${t.runState}   pendingWakeups: ${t.pendingWakeups ?? 0}`,
  );
  lines.push(`waitingOn: ${dash(t.waitingOn)}   blockedOn: ${dash(t.blockedOn)}`);
  if (t.tasks && t.tasks.length > 0) {
    lines.push("tasks:");
    for (const task of t.tasks) {
      lines.push(`  ${task.identifier}  ${task.status}${task.title ? `  ${truncate(task.title, 56)}` : ""}`);
    }
  }
  if (t.pullRequests && t.pullRequests.length > 0) {
    lines.push("PRs:");
    for (const pr of t.pullRequests) {
      lines.push(`  #${pr.number}  ${pr.state}  ${pr.repoFullName ?? ""}  ${pr.url}`.replace(/\s+/g, " "));
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
      t.pr ? `#${t.pr.number} ${t.pr.state}` : "—",
      truncate(t.title ?? "(untitled)", 40),
    ]);
  }
  return table(rows) + `\n${s.count} thread(s)`;
}

function renderWait(w: WaitResultShape): string {
  const verdict = w.terminal
    ? "done"
    : w.timedOut
      ? "TIMED OUT"
      : `blocked (${dash(w.blockedOn)})`;
  return `runState=${w.runState} status=${w.status} terminal=${w.terminal} — ${verdict} (${fmtDuration(w.elapsedMs)}, ${w.attempts} poll${w.attempts === 1 ? "" : "s"})`;
}

/** Format an op result for the chosen output mode. */
export function render(opName: string, data: unknown, format: OutputFormat): string {
  if (format === "json") return JSON.stringify(data, null, 2);
  switch (opName) {
    case "delegate":
      return renderDelegate(data as DelegateResult);
    case "threads.list":
      return renderThreadsList(data as { items: ThreadItem[]; hasMore: boolean });
    case "threads.get":
      return renderThread(data as ThreadItem);
    case "status":
      return renderStatus(data as StatusResult);
    case "wait":
      return renderWait(data as WaitResultShape);
    default:
      return JSON.stringify(data, null, 2);
  }
}
