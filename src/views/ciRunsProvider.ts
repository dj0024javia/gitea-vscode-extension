import * as vscode from "vscode";
import { GiteaApiClient } from "../api/giteaApiClient";
import { AuthManager } from "../auth/authManager";
import { RepoManager, RepoInfo } from "../context/repoManager";
import type { GiteaWorkflowRun, GiteaWorkflowJob } from "../api/types";

interface RepoCIState {
  runs: GiteaWorkflowRun[];
  page: number;
  hasMore: boolean;
  loading: boolean;
}

// ── Status icon helper ────────────────────────────────────────────────────────

export function iconForStatus(status: string): vscode.ThemeIcon {
  switch (status) {
    case "success":
      return new vscode.ThemeIcon(
        "pass",
        new vscode.ThemeColor("charts.green"),
      );
    case "failure":
      return new vscode.ThemeIcon("error", new vscode.ThemeColor("charts.red"));
    case "running":
      return new vscode.ThemeIcon("loading~spin");
    case "waiting":
    case "pending":
      return new vscode.ThemeIcon(
        "watch",
        new vscode.ThemeColor("charts.yellow"),
      );
    case "cancelled":
      return new vscode.ThemeIcon(
        "circle-slash",
        new vscode.ThemeColor("disabledForeground"),
      );
    case "skipped":
      return new vscode.ThemeIcon(
        "debug-step-over",
        new vscode.ThemeColor("disabledForeground"),
      );
    default:
      return new vscode.ThemeIcon("circle-outline");
  }
}

// ── Tree items ────────────────────────────────────────────────────────────────

export class RepoGroupItem extends vscode.TreeItem {
  constructor(
    public readonly repoInfo: RepoInfo,
    authed: boolean,
  ) {
    super(
      `${repoInfo.owner}/${repoInfo.repo}`,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    this.id = `repo:${repoInfo.key}`;
    this.contextValue = "repoGroup";
    this.description = repoInfo.currentBranch
      ? `(${repoInfo.currentBranch})`
      : "";
    this.iconPath = new vscode.ThemeIcon(authed ? "repo" : "repo-forked");
    this.tooltip = `${repoInfo.serverUrl}/${repoInfo.owner}/${repoInfo.repo}`;
  }
}

export class CIRunItem extends vscode.TreeItem {
  constructor(
    public readonly run: GiteaWorkflowRun,
    public readonly repoInfo: RepoInfo,
  ) {
    super(
      run.display_title || run.name || `Run #${run.run_number}`,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    this.id = `run:${repoInfo.key}:${run.id}`;
    this.contextValue = "ciRun";
    const eventDesc = `${run.event} · ${run.head_branch}`;
    const isRunning =
      run.status === "running" ||
      run.status === "waiting" ||
      run.status === "pending";
    this.description = isRunning ? `🔴 ${eventDesc}` : eventDesc;
    this.tooltip = new vscode.MarkdownString(
      `**${run.display_title || run.name}**\n\n` +
        `Status: \`${run.status}\` | Event: \`${run.event}\`\n\n` +
        `Branch: \`${run.head_branch}\` · ${run.head_commit?.message ?? ""}` +
        (isRunning ? "\n\n🔴 **Live**" : ""),
    );
    this.iconPath = iconForStatus(run.status);
  }
}

export class CIJobItem extends vscode.TreeItem {
  constructor(
    public readonly job: GiteaWorkflowJob,
    public readonly runId: number,
    public readonly repoInfo: RepoInfo,
  ) {
    super(job.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.id = `job:${repoInfo.key}:${runId}:${job.id}`;
    this.contextValue = "ciJob";
    const status = job.conclusion || job.status;
    const isRunning = job.status === "running" || job.status === "waiting";
    this.description = isRunning ? `🔴 ${status}` : status;
    this.iconPath = iconForStatus(status);
    this.tooltip = `${job.name} — ${status}${isRunning ? " (Live)" : ""}`;
  }
}

export class CIStepItem extends vscode.TreeItem {
  constructor(stepName: string, status: string, number: number) {
    super(`${number}. ${stepName}`, vscode.TreeItemCollapsibleState.None);
    this.description = status;
    this.iconPath = iconForStatus(status);
  }
}

export class CILoadMoreItem extends vscode.TreeItem {
  constructor(public readonly repoKey: string) {
    super("Load more...", vscode.TreeItemCollapsibleState.None);
    this.contextValue = "loadMore";
    this.iconPath = new vscode.ThemeIcon("ellipsis");
    this.command = {
      command: "gitea.loadMoreCI",
      title: "Load more runs",
      arguments: [repoKey],
    };
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class CIRunsProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private stateMap = new Map<string, RepoCIState>();
  private jobCache = new Map<number, GiteaWorkflowJob[]>();
  private pollingTimer?: ReturnType<typeof setInterval>;
  private isPolling = false;

  constructor(
    private readonly api: GiteaApiClient,
    private readonly repoManager: RepoManager,
    private readonly auth: AuthManager,
  ) {
    repoManager.onDidChange(() => this.refresh());
    auth.onDidChangeSession(() => this.refresh());
    this.startPolling();
  }

  refresh(): void {
    this.stateMap.clear();
    this.jobCache.clear();
    this._onDidChangeTreeData.fire();
  }

  async loadMore(repoKey: string): Promise<void> {
    const state = this.stateMap.get(repoKey);
    if (!state || state.loading || !state.hasMore) {
      return;
    }
    state.page += 1;
    const repoInfo = this.repoManager.getRepos().find((r) => r.key === repoKey);
    if (repoInfo) {
      await this.fetchForRepo(repoInfo, state);
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      const repos = this.repoManager.getRepos();
      if (repos.length === 0) {
        const item = new vscode.TreeItem(
          "No Gitea repositories detected",
          vscode.TreeItemCollapsibleState.None,
        );
        item.iconPath = new vscode.ThemeIcon("info");
        item.command = { command: "gitea.signIn", title: "Sign In" };
        return [item];
      }
      const items: vscode.TreeItem[] = [];
      for (const r of repos) {
        const session = await this.auth.getSession(r.serverUrl);
        items.push(new RepoGroupItem(r, !!session));
      }
      return items;
    }

    if (element instanceof RepoGroupItem) {
      const { repoInfo } = element;
      const session = await this.auth.getSession(repoInfo.serverUrl);
      if (!session) {
        const signIn = new vscode.TreeItem(
          "Sign in to load CI runs",
          vscode.TreeItemCollapsibleState.None,
        );
        signIn.iconPath = new vscode.ThemeIcon("account");
        signIn.command = { command: "gitea.signIn", title: "Sign In" };
        return [signIn];
      }
      return this.getRepoChildren(repoInfo);
    }

    if (element instanceof CIRunItem) {
      return this.getJobsForRun(element.run.id, element.repoInfo);
    }

    if (element instanceof CIJobItem) {
      return (element.job.steps ?? []).map(
        (s) => new CIStepItem(s.name, s.conclusion || s.status, s.number),
      );
    }

    return [];
  }

  private async getRepoChildren(
    repoInfo: RepoInfo,
  ): Promise<vscode.TreeItem[]> {
    let state = this.stateMap.get(repoInfo.key);
    if (!state) {
      state = { runs: [], page: 1, hasMore: false, loading: false };
      this.stateMap.set(repoInfo.key, state);
      await this.fetchForRepo(repoInfo, state);
      return [];
    }
    if (state.loading) {
      const item = new vscode.TreeItem(
        "Loading...",
        vscode.TreeItemCollapsibleState.None,
      );
      item.iconPath = new vscode.ThemeIcon("loading~spin");
      return [item];
    }
    if (state.runs.length === 0) {
      const empty = new vscode.TreeItem(
        "No CI runs found",
        vscode.TreeItemCollapsibleState.None,
      );
      empty.iconPath = new vscode.ThemeIcon("info");
      return [empty];
    }
    const items: vscode.TreeItem[] = state.runs.map(
      (r) => new CIRunItem(r, repoInfo),
    );
    if (state.hasMore) {
      items.push(new CILoadMoreItem(repoInfo.key));
    }
    return items;
  }

  private async fetchForRepo(
    repoInfo: RepoInfo,
    state: RepoCIState,
  ): Promise<void> {
    if (state.loading) {
      return;
    }
    state.loading = true;
    this._onDidChangeTreeData.fire();
    try {
      const config = vscode.workspace.getConfiguration("gitea");
      const limit: number = config.get<number>("itemsPerPage") ?? 20;
      const result = await this.api.listWorkflowRuns(
        repoInfo,
        undefined,
        state.page,
        limit,
      );
      state.runs =
        state.page === 1 ? result.items : [...state.runs, ...result.items];
      state.hasMore = result.hasMore;
    } catch (err) {
      vscode.window.showErrorMessage(
        `[${repoInfo.label}] Failed to load CI runs: ${(err as Error).message}`,
      );
      state.runs = [];
      state.hasMore = false;
    } finally {
      state.loading = false;
      this._onDidChangeTreeData.fire();
    }
  }

  private async getJobsForRun(
    runId: number,
    repoInfo: RepoInfo,
  ): Promise<vscode.TreeItem[]> {
    if (this.jobCache.has(runId)) {
      return (this.jobCache.get(runId) ?? []).map(
        (j) => new CIJobItem(j, runId, repoInfo),
      );
    }
    try {
      const jobs = await this.api.listWorkflowJobs(repoInfo, runId);
      this.jobCache.set(runId, jobs);
      return jobs.map((j) => new CIJobItem(j, runId, repoInfo));
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to load jobs: ${(err as Error).message}`,
      );
      return [];
    }
  }

  private startPolling(): void {
    // Poll every 5 seconds to check for running jobs
    this.pollingTimer = setInterval(() => {
      this.pollRunningJobs();
    }, 5000);
  }

  private async pollRunningJobs(): Promise<void> {
    if (this.isPolling) {
      return;
    }

    // Check if we have any running jobs
    let hasRunningJobs = false;
    for (const [_, state] of this.stateMap) {
      if (
        state.runs.some(
          (r) => r.status === "running" || r.status === "waiting" || r.status === "pending",
        )
      ) {
        hasRunningJobs = true;
        break;
      }
    }

    if (!hasRunningJobs) {
      return;
    }

    // Refresh to get latest status
    this.isPolling = true;
    try {
      // Refresh each repo that has running jobs
      for (const [repoKey, state] of this.stateMap) {
        const hasRunning = state.runs.some(
          (r) => r.status === "running" || r.status === "waiting" || r.status === "pending",
        );
        if (hasRunning) {
          const repoInfo = this.repoManager
            .getRepos()
            .find((r) => r.key === repoKey);
          if (repoInfo) {
            await this.fetchForRepo(repoInfo, state);
          }
        }
      }
    } finally {
      this.isPolling = false;
    }
  }

  dispose(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }
}
