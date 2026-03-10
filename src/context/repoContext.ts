import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export interface RepoInfo {
  serverUrl: string;
  owner: string;
  repo: string;
  currentBranch?: string;
}

export class RepoContext {
  private _info: RepoInfo | undefined;
  private _onDidChange = new vscode.EventEmitter<RepoInfo | undefined>();
  readonly onDidChange = this._onDidChange.event;

  async initialize(): Promise<void> {
    this._info = await this.detectFromWorkspace();
    this._onDidChange.fire(this._info);
  }

  get info(): RepoInfo | undefined {
    return this._info;
  }

  setInfo(info: RepoInfo | undefined): void {
    this._info = info;
    this._onDidChange.fire(info);
  }

  private async detectFromWorkspace(): Promise<RepoInfo | undefined> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return undefined;
    }

    for (const folder of folders) {
      const gitConfigPath = path.join(folder.uri.fsPath, ".git", "config");
      if (!fs.existsSync(gitConfigPath)) {
        continue;
      }
      try {
        const content = fs.readFileSync(gitConfigPath, "utf8");
        const info = this.parseGitConfig(content);
        if (info) {
          info.currentBranch = this.readCurrentBranch(folder.uri.fsPath);
          return info;
        }
      } catch {
        // ignore parse errors
      }
    }
    return undefined;
  }

  private readCurrentBranch(workspaceRoot: string): string | undefined {
    try {
      const headPath = path.join(workspaceRoot, ".git", "HEAD");
      const content = fs.readFileSync(headPath, "utf8").trim();
      const match = content.match(/^ref: refs\/heads\/(.+)$/);
      return match ? match[1] : undefined;
    } catch {
      return undefined;
    }
  }

  private parseGitConfig(content: string): RepoInfo | undefined {
    const urlMatch = content.match(/url\s*=\s*(.+)/);
    if (!urlMatch) {
      return undefined;
    }
    const rawUrl = urlMatch[1].trim();

    // https://gitea.example.com/owner/repo.git
    const httpsMatch = rawUrl.match(
      /^(https?:\/\/[^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?$/,
    );
    if (httpsMatch) {
      return {
        serverUrl: httpsMatch[1],
        owner: httpsMatch[2],
        repo: httpsMatch[3],
      };
    }

    // git@gitea.example.com:owner/repo.git
    const sshMatch = rawUrl.match(/^git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (sshMatch) {
      return {
        serverUrl: `https://${sshMatch[1]}`,
        owner: sshMatch[2],
        repo: sshMatch[3],
      };
    }

    return undefined;
  }
}
