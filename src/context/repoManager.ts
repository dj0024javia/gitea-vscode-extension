import * as vscode from "vscode";

export interface RepoInfo {
  serverUrl: string;
  owner: string;
  repo: string;
  currentBranch?: string;
  rootPath: string;
  label: string; // "owner/repo"
  key: string; // unique: "serverUrl|owner/repo"
}

function parseRemoteUrl(
  url: string,
  rootPath: string,
  serverUrlOverride?: string,
): RepoInfo | undefined {
  url = url.trim();
  let owner: string | undefined;
  let repo: string | undefined;
  let detectedServerUrl: string | undefined;

  // https://[user[:pass]@]gitea.example.com[:port]/owner/repo[.git]
  const httpsMatch = url.match(
    /^https?:\/\/(?:[^@/]+@)?([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?$/,
  );
  if (httpsMatch) {
    const [, hostport, o, r] = httpsMatch;
    detectedServerUrl = `https://${hostport}`;
    owner = o;
    repo = r;
  } else {
    // git@host:owner/repo[.git]
    const sshMatch = url.match(/^git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (sshMatch) {
      const [, host, o, r] = sshMatch;
      detectedServerUrl = `https://${host}`;
      owner = o;
      repo = r;
    }
  }

  if (!owner || !repo || !detectedServerUrl) {
    return undefined;
  }

  // Use the user-configured override if set, otherwise use the detected URL
  const serverUrl = serverUrlOverride
    ? serverUrlOverride.replace(/\/$/, "")
    : detectedServerUrl;
  return {
    serverUrl,
    owner,
    repo,
    rootPath,
    label: `${owner}/${repo}`,
    key: `${serverUrl}|${owner}/${repo}`,
  };
}

export class RepoManager {
  private _repos: RepoInfo[] = [];
  private _onDidChange = new vscode.EventEmitter<RepoInfo[]>();
  readonly onDidChange = this._onDidChange.event;
  private disposables: vscode.Disposable[] = [];

  async initialize(): Promise<void> {
    await this.detect();

    // Watch VS Code git extension for repo open/close and HEAD changes
    const gitExt = vscode.extensions.getExtension("vscode.git");
    if (gitExt) {
      try {
        const gitApi = (
          gitExt.isActive ? gitExt.exports : await gitExt.activate()
        ).getAPI(1);
        this.disposables.push(
          gitApi.onDidOpenRepository(async () => {
            // Re-attach HEAD watchers when a new repo is opened
            await this.detect();
            for (const r of gitApi.repositories) {
              r.state.onDidChange(() => this.detect());
            }
          }),
          gitApi.onDidCloseRepository(() => this.detect()),
        );
        for (const r of gitApi.repositories) {
          this.disposables.push(r.state.onDidChange(() => this.detect()));
        }
      } catch {
        /* git ext unavailable */
      }
    }
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.detect()),
    );
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("gitea.serverUrl")) {
          this.detect();
        }
      }),
    );
  }

  async detect(): Promise<void> {
    const found: RepoInfo[] = [];
    const seen = new Set<string>();

    const config = vscode.workspace.getConfiguration("gitea");
    const serverUrlOverride =
      config.get<string>("serverUrl")?.trim() || undefined;

    const gitExt = vscode.extensions.getExtension("vscode.git");
    if (gitExt && gitExt.isActive) {
      try {
        const gitApi = gitExt.exports.getAPI(1);
        // git.repositories includes all repos — root + every submodule
        for (const gitRepo of gitApi.repositories) {
          const remotes: Array<{
            name: string;
            fetchUrl?: string;
            pushUrl?: string;
          }> = gitRepo.state.remotes;
          // Prefer 'origin', fall back to first remote
          const remote =
            remotes.find((r: { name: string }) => r.name === "origin") ??
            remotes[0];
          if (!remote) {
            continue;
          }
          const url = (remote.fetchUrl ?? remote.pushUrl ?? "").trim();
          if (!url) {
            continue;
          }
          const info = parseRemoteUrl(
            url,
            gitRepo.rootUri.fsPath,
            serverUrlOverride,
          );
          if (!info || seen.has(info.key)) {
            continue;
          }
          info.currentBranch = gitRepo.state.HEAD?.name;
          seen.add(info.key);
          found.push(info);
        }
      } catch {
        /* ignore parse errors */
      }
    }

    this._repos = found;
    this._onDidChange.fire(found);
  }

  getRepos(): RepoInfo[] {
    return this._repos;
  }

  /** First detected repo — for legacy single-repo code paths (e.g. status bar) */
  get info(): RepoInfo | undefined {
    return this._repos[0];
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
    this._onDidChange.dispose();
  }
}
