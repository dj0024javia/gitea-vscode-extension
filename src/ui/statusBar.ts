import * as vscode from 'vscode';
import { RepoManager } from '../context/repoManager';
import { AuthManager } from '../auth/authManager';

export class StatusBarManager implements vscode.Disposable {
    private readonly repoItem: vscode.StatusBarItem;
    private readonly authItem: vscode.StatusBarItem;
    private disposables: vscode.Disposable[] = [];

    constructor(
        private readonly repoManager: RepoManager,
        private readonly auth: AuthManager
    ) {
        this.repoItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.repoItem.command = 'gitea.switchRepo';
        this.repoItem.tooltip = 'Click to switch Gitea repository';

        this.authItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
        this.authItem.command = 'gitea.signIn';
        this.authItem.tooltip = 'Gitea: Click to sign in';

        this.disposables.push(
            this.repoItem,
            this.authItem,
            repoManager.onDidChange(() => this.refresh()),
            auth.onDidChangeSession(() => this.refresh())
        );

        this.refresh();
    }

    refresh(): void {
        const info = this.repoManager.info;
        const servers = this.auth.getServerUrls();

        if (info) {
            const branch = info.currentBranch ? ` (${info.currentBranch})` : '';
            this.repoItem.text = `$(gitea-icon)$(repo) ${info.owner}/${info.repo}${branch}`;
            this.repoItem.text = `$(git-branch) ${info.owner}/${info.repo}${branch}`;
            this.repoItem.show();
        } else {
            this.repoItem.hide();
        }

        if (servers.length > 0) {
            const accounts = this.auth.getAccountMap();
            const firstServer = servers[0];
            const username = accounts[firstServer]?.username ?? 'Signed in';
            this.authItem.text = `$(account) ${username}`;
            this.authItem.tooltip = `Gitea: Signed in as ${username} — click to manage`;
            this.authItem.command = 'gitea.signOut';
            this.authItem.show();
        } else {
            this.authItem.text = '$(account) Sign in to Gitea';
            this.authItem.tooltip = 'Click to sign in to Gitea';
            this.authItem.command = 'gitea.signIn';
            this.authItem.show();
        }
    }

    dispose(): void {
        for (const d of this.disposables) { d.dispose(); }
        this.disposables = [];
    }
}
