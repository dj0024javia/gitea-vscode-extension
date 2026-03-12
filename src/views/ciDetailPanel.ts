import * as vscode from "vscode";
import { GiteaApiClient } from "../api/giteaApiClient";
import { LiveLogPanel } from "./liveLogPanel";
import type { RepoInfo } from "../context/repoManager";
import type { GiteaWorkflowRun, GiteaWorkflowJob } from "../api/types";

export class CIDetailPanel {
  private static panels = new Map<number, CIDetailPanel>();
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private pollingTimer?: NodeJS.Timeout;
  private isRunning: boolean = false;

  static async show(
    api: GiteaApiClient,
    repoInfo: RepoInfo,
    run: GiteaWorkflowRun,
  ): Promise<void> {
    const existing = CIDetailPanel.panels.get(run.id);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.One);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "giteaCIDetail",
      `Run #${run.run_number}: ${run.display_title || run.name}`,
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    const instance = new CIDetailPanel(panel, api, repoInfo, run);
    CIDetailPanel.panels.set(run.id, instance);
    await instance.update(run);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly api: GiteaApiClient,
    private readonly repoInfo: RepoInfo,
    private run: GiteaWorkflowRun,
  ) {
    this.panel = panel;
    panel.onDidDispose(() => this.dispose(), null, this.disposables);
    panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this.disposables,
    );

    // Check if run is in progress
    this.isRunning =
      run.status === "running" ||
      run.status === "waiting" ||
      run.status === "pending" ||
      run.status === "in_progress";

    // Start auto-refresh for running workflows
    if (this.isRunning) {
      this.startPolling();
    }
  }

  private async handleMessage(msg: {
    command: string;
    jobId?: number;
  }): Promise<void> {
    switch (msg.command) {
      case "refresh":
        this.run = await this.api.getWorkflowRun(this.repoInfo, this.run.id);
        await this.update(this.run);
        break;
      case "openInBrowser":
        vscode.env.openExternal(vscode.Uri.parse(this.run.html_url));
        break;
      case "rerun":
        try {
          await this.api.rerunWorkflow(this.repoInfo, this.run.id);
          vscode.window.showInformationMessage("Workflow re-run triggered.");
        } catch (err) {
          vscode.window.showErrorMessage(
            `Rerun failed: ${(err as Error).message}`,
          );
        }
        break;
      case "cancel":
        try {
          await this.api.cancelWorkflowRun(this.repoInfo, this.run.id);
          vscode.window.showInformationMessage("Run cancelled.");
          this.run = await this.api.getWorkflowRun(this.repoInfo, this.run.id);
          await this.update(this.run);
        } catch (err) {
          vscode.window.showErrorMessage(
            `Cancel failed: ${(err as Error).message}`,
          );
        }
        break;
      case "viewLogs":
        if (msg.jobId !== undefined) {
          await this.showLiveLogs(msg.jobId);
        }
        break;
    }
  }

  private async showLiveLogs(jobId: number): Promise<void> {
    try {
      const jobs = await this.api.listWorkflowJobs(this.repoInfo, this.run.id);
      const job = jobs.find((j) => j.id === jobId);
      if (job) {
        await LiveLogPanel.show(this.api, this.repoInfo, job);
      }
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to open logs: ${(err as Error).message}`,
      );
    }
  }

  async update(run: GiteaWorkflowRun): Promise<void> {
    try {
      // Update running state
      const wasRunning = this.isRunning;
      this.isRunning =
        run.status === "running" ||
        run.status === "waiting" ||
        run.status === "pending" ||
        run.status === "in_progress";

      // Start or stop polling based on status
      if (!wasRunning && this.isRunning) {
        this.startPolling();
      } else if (wasRunning && !this.isRunning) {
        this.stopPolling();
      }

      const jobs = await this.api.listWorkflowJobs(this.repoInfo, run.id);
      this.panel.webview.html = this.renderHtml(run, jobs);
    } catch (err) {
      this.panel.webview.html = `<!DOCTYPE html><html><body><h2>Error loading run</h2><p>${escHtml((err as Error).message)}</p></body></html>`;
    }
  }

  private startPolling(): void {
    if (this.pollingTimer) {
      return;
    }
    // Poll every 3 seconds
    this.pollingTimer = setInterval(async () => {
      try {
        this.run = await this.api.getWorkflowRun(this.repoInfo, this.run.id);
        await this.update(this.run);
      } catch (err) {
        // Silently handle polling errors
        console.error("Polling error:", err);
      }
    }, 3000);
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }

  private renderHtml(run: GiteaWorkflowRun, jobs: GiteaWorkflowJob[]): string {
    const statusIcons: Record<string, string> = {
      success: "✅",
      completed: "✅",
      failure: "❌",
      failed: "❌",
      running: "⏳",
      in_progress: "⏳",
      waiting: "⏸",
      pending: "⏸",
      cancelled: "🚫",
      skipped: "⏭",
      unknown: "❓",
      blocked: "🔒",
    };
    const icon = statusIcons[run.status] ?? "❓";

    // Calculate duration
    const getDuration = (
      started?: string,
      completed?: string,
    ): string | null => {
      if (!started) {
        return null;
      }
      const start = new Date(started).getTime();
      const end = completed ? new Date(completed).getTime() : Date.now();
      const durationMs = end - start;
      const seconds = Math.floor(durationMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
      } else {
        return `${seconds}s`;
      }
    };

    const runDuration = getDuration(run.run_started_at, run.updated_at);

    const jobsHtml =
      jobs.length === 0
        ? '<p class="empty">No jobs found.</p>'
        : jobs
            .map((j) => {
              const jIcon = statusIcons[j.conclusion || j.status] ?? "❓";
              const jobDuration = getDuration(j.started_at, j.completed_at);
              const stepsHtml = (j.steps ?? [])
                .map(
                  (s) => {
                    const stepDuration = getDuration(s.started_at, s.completed_at);
                    const stepStatus = s.conclusion || s.status;
                    const isRunning = stepStatus === "running" || stepStatus === "in_progress";
                    const isCompleted = stepStatus === "success" || stepStatus === "completed";
                    const stepIcon = isRunning ? '<span class="spinner">⏳</span>' : (statusIcons[stepStatus] ?? "•");
                    const statusClass = isRunning ? 'step-running' : isCompleted ? 'step-completed' : '';
                    const executingLabel = isRunning ? '<span class="executing-label">⚡ EXECUTING</span>' : '';
                    return `<div class="step ${stepStatus} ${statusClass}">${stepIcon} <span class="step-name">${escHtml(s.name)}</span> ${executingLabel}<span class="badge badge-${stepStatus}">${escHtml(stepStatus)}</span>${stepDuration ? ` <span class="duration">${stepDuration}</span>` : (isRunning ? ' <span class="duration running-indicator">Running...</span>' : '')}</div>`;
                  },
                )
                .join("");
              return `
                <div class="job">
                    <div class="job-header">
                        <span class="job-icon">${jIcon}</span>
                        <strong>${escHtml(j.name)}</strong>
                        <span class="badge badge-${(j.conclusion || j.status).toLowerCase()}">${escHtml(j.conclusion || j.status)}</span>
                        ${jobDuration ? `<span class="duration">⏱ ${jobDuration}</span>` : ""}
                        <button class="small" onclick="post('viewLogs', {jobId: ${j.id}})">📋 Logs</button>
                    </div>
                    <div class="steps">${stepsHtml || '<p class="empty">No steps.</p>'}</div>
                </div>`;
            })
            .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Run #${run.run_number}</title>
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 12px 20px; }
  h1 { font-size: 1.3em; margin-bottom: 4px; }
  .meta { color: var(--vscode-descriptionForeground); font-size: 0.85em; margin-bottom: 16px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.78em; font-weight: 600; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 0.9em; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button.small { padding: 2px 8px; font-size: 0.78em; margin-left: auto; }
  .job { border: 1px solid var(--vscode-panel-border); border-radius: 6px; margin-bottom: 12px; overflow: hidden; }
  .job-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--vscode-sideBarSectionHeader-background); }
  .job-icon { font-size: 1.1em; }
  .steps { padding: 8px 12px; }
  .step { padding: 3px 6px; font-size: 0.85em; border-bottom: 1px solid var(--vscode-panel-border); display: flex; align-items: center; gap: 8px; }
  .step:last-child { border-bottom: none; }
  .step-running { background: rgba(255, 255, 0, 0.05); border-left: 3px solid var(--vscode-charts-yellow); }
  .step-completed { opacity: 0.7; }
  .step-name { flex: 1; }
  .executing-label { 
    color: var(--vscode-charts-yellow); 
    font-weight: 700; 
    font-size: 0.75em; 
    background: rgba(255, 255, 0, 0.2); 
    padding: 2px 6px; 
    border-radius: 3px;
    margin-right: 4px;
    letter-spacing: 0.5px;
  }
  .spinner { display: inline-block; animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .running-indicator { color: var(--vscode-charts-yellow); font-weight: 500; }
  .empty { color: var(--vscode-descriptionForeground); font-style: italic; font-size: 0.85em; }
  .duration { color: var(--vscode-descriptionForeground); font-size: 0.85em; margin-left: auto; font-family: var(--vscode-editor-font-family); }
  .live-indicator { display: inline-flex; align-items: center; gap: 4px; color: var(--vscode-charts-green); font-size: 0.85em; }
  .pulse { width: 8px; height: 8px; background: var(--vscode-charts-green); border-radius: 50%; animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  .badge-running, .badge-in_progress { background: var(--vscode-charts-yellow); color: var(--vscode-editor-background); }
  .badge-success, .badge-completed { background: var(--vscode-charts-green); color: var(--vscode-editor-background); }
  .badge-failure, .badge-failed { background: var(--vscode-charts-red); color: var(--vscode-editor-foreground); }
</style>
</head>
<body>
<h1>${icon} Run #${run.run_number}: ${escHtml(run.display_title || run.name)}</h1>
<div class="meta">
  Status: <span class="badge">${escHtml(run.status)}</span>
  ${this.isRunning ? '<span class="live-indicator"><span class="pulse"></span>Live</span>' : ""}
  &nbsp;·&nbsp;Event: <code>${escHtml(run.event)}</code>
  &nbsp;·&nbsp;Branch: <code>${escHtml(run.head_branch)}</code>
  ${runDuration ? `&nbsp;·&nbsp;Duration: <strong>${runDuration}</strong>` : ""}
  <br>${new Date(run.created_at).toLocaleString()}
  ${run.head_commit ? `<br><small>${escHtml(run.head_commit.message)}</small>` : ""}
</div>
<div class="actions">
  <button onclick="post('openInBrowser')">🔗 Open in Browser</button>
  <button class="secondary" onclick="post('rerun')">↺ Re-run</button>
  ${run.status === "running" || run.status === "waiting" ? `<button class="secondary" onclick="post('cancel')">⏹ Cancel</button>` : ""}
  <button class="secondary" onclick="post('refresh')">🔄 Refresh</button>
</div>
<h2>Jobs</h2>
${jobsHtml}
<script>
  const vscode = acquireVsCodeApi();
  function post(command, extra) {
    vscode.postMessage(Object.assign({ command }, extra || {}));
  }
</script>
</body>
</html>`;
  }

  dispose(): void {
    CIDetailPanel.panels.delete(this.run.id);
    this.stopPolling();
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

function escHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
