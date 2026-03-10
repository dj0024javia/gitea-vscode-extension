import * as vscode from "vscode";

export interface GiteaAccount {
  serverUrl: string;
  token: string;
  username: string;
  label: string;
}

const SECRET_KEY_PREFIX = "gitea.token.";
const ACCOUNT_MAP_KEY = "gitea.accounts";

export class AuthManager {
  private _onDidChangeSession = new vscode.EventEmitter<void>();
  readonly onDidChangeSession = this._onDidChangeSession.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async initialize(): Promise<void> {
    // Auth is lazy — populated via signIn command
  }

  async signIn(serverUrl: string, token: string): Promise<GiteaAccount> {
    const normalized = serverUrl.replace(/\/$/, "");
    const response = await fetch(`${normalized}/api/v1/user`, {
      headers: { Authorization: `token ${token}` },
    });
    if (!response.ok) {
      throw new Error(
        `Authentication failed: ${response.status} ${response.statusText}`,
      );
    }
    const user = (await response.json()) as { login: string };
    const account: GiteaAccount = {
      serverUrl: normalized,
      token,
      username: user.login,
      label: `${user.login} @ ${normalized}`,
    };
    await this.context.secrets.store(
      `${SECRET_KEY_PREFIX}${normalized}`,
      token,
    );
    const accounts = this.getAccountMap();
    accounts[normalized] = { username: user.login, label: account.label };
    await this.context.globalState.update(ACCOUNT_MAP_KEY, accounts);
    this._onDidChangeSession.fire();
    return account;
  }

  async signOut(serverUrl?: string): Promise<void> {
    const accounts = this.getAccountMap();
    if (serverUrl) {
      const normalized = serverUrl.replace(/\/$/, "");
      await this.context.secrets.delete(`${SECRET_KEY_PREFIX}${normalized}`);
      delete accounts[normalized];
    } else {
      for (const url of Object.keys(accounts)) {
        await this.context.secrets.delete(`${SECRET_KEY_PREFIX}${url}`);
      }
      for (const key of Object.keys(accounts)) {
        delete accounts[key];
      }
    }
    await this.context.globalState.update(ACCOUNT_MAP_KEY, accounts);
    this._onDidChangeSession.fire();
  }

  async getSession(serverUrl?: string): Promise<GiteaAccount | undefined> {
    const accounts = this.getAccountMap();
    const urls = serverUrl
      ? [serverUrl.replace(/\/$/, "")]
      : Object.keys(accounts);
    for (const url of urls) {
      const token = await this.context.secrets.get(
        `${SECRET_KEY_PREFIX}${url}`,
      );
      if (token && accounts[url]) {
        return {
          serverUrl: url,
          token,
          username: accounts[url].username,
          label: accounts[url].label,
        };
      }
    }
    return undefined;
  }

  getAccountMap(): Record<string, { username: string; label: string }> {
    return (
      this.context.globalState.get<
        Record<string, { username: string; label: string }>
      >(ACCOUNT_MAP_KEY) ?? {}
    );
  }

  getServerUrls(): string[] {
    return Object.keys(this.getAccountMap());
  }
}
