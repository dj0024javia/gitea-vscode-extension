import * as vscode from 'vscode';
import { GiteaApiClient } from '../api/giteaApiClient';
import type { RepoInfo } from '../context/repoManager';
import type { GiteaIssue, GiteaComment } from '../api/types';

export class IssueDetailPanel {
    private static panels = new Map<string, IssueDetailPanel>();
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    static async show(
        extensionUri: vscode.Uri,
        api: GiteaApiClient,
        repoInfo: RepoInfo,
        issue: GiteaIssue
    ): Promise<void> {
        const key = `${repoInfo.key}#${issue.number}`;
        const existing = IssueDetailPanel.panels.get(key);
        if (existing) {
            existing.panel.reveal(vscode.ViewColumn.One);
            return;
        }
        const panel = vscode.window.createWebviewPanel(
            'giteaIssueDetail',
            `Issue #${issue.number}: ${issue.title}`,
            vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true }
        );
        const instance = new IssueDetailPanel(panel, extensionUri, api, repoInfo, issue, key);
        IssueDetailPanel.panels.set(key, instance);
        await instance.update(issue);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        private readonly extensionUri: vscode.Uri,
        private readonly api: GiteaApiClient,
        private readonly repoInfo: RepoInfo,
        private issue: GiteaIssue,
        private readonly key: string
    ) {
        this.panel = panel;
        panel.onDidDispose(() => this.dispose(), null, this.disposables);
        panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables);
    }

    private async handleMessage(msg: { command: string; body?: string }): Promise<void> {
        switch (msg.command) {
            case 'addComment':
                await this.addComment(msg.body ?? '');
                break;
            case 'close':
                await this.changeState('closed');
                break;
            case 'reopen':
                await this.changeState('open');
                break;
            case 'refresh':
                this.issue = await this.api.getIssue(this.repoInfo, this.issue.number);
                await this.update(this.issue);
                break;
            case 'openInBrowser':
                vscode.env.openExternal(vscode.Uri.parse(this.issue.html_url));
                break;
        }
    }

    private async addComment(body: string): Promise<void> {
        if (!body.trim()) { vscode.window.showWarningMessage('Comment cannot be empty.'); return; }
        try {
            await this.api.addIssueComment(this.repoInfo, this.issue.number, body);
            vscode.window.showInformationMessage('Comment posted.');
            this.issue = await this.api.getIssue(this.repoInfo, this.issue.number);
            await this.update(this.issue);
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to add comment: ${(err as Error).message}`);
        }
    }

    private async changeState(state: 'open' | 'closed'): Promise<void> {
        try {
            this.issue = state === 'closed'
                ? await this.api.closeIssue(this.repoInfo, this.issue.number)
                : await this.api.reopenIssue(this.repoInfo, this.issue.number);
            await this.update(this.issue);
            vscode.window.showInformationMessage(`Issue #${this.issue.number} ${state === 'closed' ? 'closed' : 're-opened'}.`);
        } catch (err) {
            vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
        }
    }

    async update(issue: GiteaIssue): Promise<void> {
        try {
            const comments = await this.api.listIssueComments(this.repoInfo, issue.number);
            this.panel.webview.html = this.renderHtml(issue, comments);
        } catch (err) {
            this.panel.webview.html = `<!DOCTYPE html><html><body><h2>Error</h2><p>${escHtml((err as Error).message)}</p></body></html>`;
        }
    }

    private renderHtml(issue: GiteaIssue, comments: GiteaComment[]): string {
        const stateIcon = issue.state === 'open' ? '🟢' : '🟣';
        const labels = issue.labels?.map(l =>
            `<span style="background:#${l.color};color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;margin-right:4px">${escHtml(l.name)}</span>`
        ).join('') ?? '';
        const assignees = issue.assignees?.map(a => escHtml(a.login)).join(', ') ?? '';
        const milestone = issue.milestone ? `<span title="Milestone">🏁 ${escHtml(issue.milestone.title)}</span>` : '';

        const commentsHtml = comments.map(c => `
            <div style="border:1px solid var(--vscode-widget-border);border-radius:6px;padding:12px;margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                    <strong>${escHtml(c.user.login)}</strong>
                    <span style="color:var(--vscode-descriptionForeground);font-size:12px">${new Date(c.created_at).toLocaleString()}</span>
                </div>
                <div style="white-space:pre-wrap">${escHtml(c.body)}</div>
            </div>`).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 20px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 1.4em; margin-bottom: 4px; }
  .meta { color: var(--vscode-descriptionForeground); font-size: 13px; margin-bottom: 16px; }
  .body-box { background: var(--vscode-textBlockQuote-background); border-left: 3px solid var(--vscode-textBlockQuote-border); padding: 12px 16px; border-radius: 4px; white-space: pre-wrap; margin-bottom: 24px; }
  .section-title { font-size: 13px; font-weight: 600; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.05em; margin: 20px 0 10px; }
  textarea { width: 100%; box-sizing: border-box; min-height: 80px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; padding: 8px; font-family: inherit; font-size: 13px; resize: vertical; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; margin-right: 8px; margin-top: 8px; font-size: 13px; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button.danger { background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-inputValidation-errorForeground); }
  .actions { margin-bottom: 20px; }
</style>
</head>
<body>
<div class="meta">${stateIcon} Issue #${issue.number} · ${escHtml(issue.user.login)} opened ${new Date(issue.created_at).toLocaleDateString()}</div>
<h1>${escHtml(issue.title)}</h1>
<div style="margin-bottom:16px">${labels}${assignees ? `<span style="margin-left:8px">👤 ${assignees}</span>` : ''}${milestone ? `<span style="margin-left:8px">${milestone}</span>` : ''}</div>

<div class="body-box">${escHtml(issue.body || '(no description)')}</div>

<div class="actions">
    <button onclick="post('openInBrowser')">Open in Browser</button>
    <button onclick="post('refresh')" class="secondary">Refresh</button>
    ${issue.state === 'open'
        ? `<button class="danger" onclick="post('close')">Close Issue</button>`
        : `<button onclick="post('reopen')">Re-open Issue</button>`
    }
</div>

${comments.length > 0 ? `<div class="section-title">${comments.length} Comment${comments.length !== 1 ? 's' : ''}</div>${commentsHtml}` : ''}

<div class="section-title">Add a Comment</div>
<textarea id="commentBody" placeholder="Leave a comment…"></textarea>
<br>
<button onclick="submitComment()">Post Comment</button>

<script>
const vscode = acquireVsCodeApi();
function post(command, extra) { vscode.postMessage({ command, ...extra }); }
function submitComment() {
    const body = document.getElementById('commentBody').value.trim();
    if (!body) return;
    post('addComment', { body });
    document.getElementById('commentBody').value = '';
}
</script>
</body>
</html>`;
    }

    private dispose(): void {
        IssueDetailPanel.panels.delete(this.key);
        for (const d of this.disposables) { d.dispose(); }
        this.disposables = [];
    }
}

function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
