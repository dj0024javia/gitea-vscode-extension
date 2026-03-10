import * as vscode from "vscode";
import { AuthManager } from "../auth/authManager";
import { GiteaApiClient } from "../api/giteaApiClient";
import { RepoManager } from "../context/repoManager";
import { PullRequestProvider } from "../views/pullRequestProvider";
import { CIRunsProvider } from "../views/ciRunsProvider";
import { StatusBarManager } from "../ui/statusBar";

export function registerAuthCommands(
  context: vscode.ExtensionContext,
  auth: AuthManager,
  api: GiteaApiClient,
  repoManager: RepoManager,
  prProvider: PullRequestProvider,
  ciProvider: CIRunsProvider,
  statusBar: StatusBarManager,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("gitea.signIn", async () => {
      await cmdSignIn(auth, prProvider, ciProvider, statusBar);
    }),
    vscode.commands.registerCommand("gitea.signOut", async () => {
      await cmdSignOut(auth, prProvider, ciProvider, statusBar);
    }),
    vscode.commands.registerCommand("gitea.addServer", async () => {
      await cmdSignIn(auth, prProvider, ciProvider, statusBar);
    }),
    vscode.commands.registerCommand("gitea.switchRepo", async () => {
      await repoManager.detect();
      prProvider.refresh();
      ciProvider.refresh();
      statusBar.refresh();
      vscode.window.showInformationMessage("Gitea: repositories re-scanned.");
    }),
  );
}

async function cmdSignIn(
  auth: AuthManager,
  prProvider: PullRequestProvider,
  ciProvider: CIRunsProvider,
  statusBar: StatusBarManager,
): Promise<void> {
  const serverUrl = await vscode.window.showInputBox({
    prompt: "Enter your Gitea server URL (e.g. https://gitea.example.com)",
    placeHolder: "https://gitea.example.com",
    ignoreFocusOut: true,
    validateInput: (v) => {
      if (!v) {
        return "URL is required";
      }
      try {
        new URL(v);
        return null;
      } catch {
        return "Invalid URL";
      }
    },
  });
  if (!serverUrl) {
    return;
  }

  const token = await vscode.window.showInputBox({
    prompt: `Enter your API token for ${serverUrl}`,
    placeHolder: "Gitea API Token",
    password: true,
    ignoreFocusOut: true,
    validateInput: (v) => (v ? null : "Token is required"),
  });
  if (!token) {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Signing in to Gitea...",
    },
    async () => {
      try {
        const account = await auth.signIn(serverUrl, token);
        await vscode.commands.executeCommand(
          "setContext",
          "gitea.authenticated",
          true,
        );
        // Auto-set the server URL override so SSH remotes resolve correctly
        const cfg = vscode.workspace.getConfiguration("gitea");
        if (!cfg.get<string>("serverUrl")) {
          await cfg.update(
            "serverUrl",
            account.serverUrl,
            vscode.ConfigurationTarget.Global,
          );
        }
        vscode.window.showInformationMessage(
          `Signed in as ${account.username} @ ${serverUrl}`,
        );
        prProvider.refresh();
        ciProvider.refresh();
        statusBar.refresh();
      } catch (err) {
        vscode.window.showErrorMessage(
          `Sign in failed: ${(err as Error).message}`,
        );
      }
    },
  );
}

async function cmdSignOut(
  auth: AuthManager,
  prProvider: PullRequestProvider,
  ciProvider: CIRunsProvider,
  statusBar: StatusBarManager,
): Promise<void> {
  const servers = auth.getServerUrls();
  if (servers.length === 0) {
    vscode.window.showInformationMessage("Not signed in to any Gitea server.");
    return;
  }
  const choice =
    servers.length === 1
      ? servers[0]
      : await vscode.window.showQuickPick(["Sign out of all", ...servers], {
          placeHolder: "Select server to sign out of",
        });
  if (!choice) {
    return;
  }

  await auth.signOut(choice === "Sign out of all" ? undefined : choice);
  const remaining = auth.getServerUrls();
  await vscode.commands.executeCommand(
    "setContext",
    "gitea.authenticated",
    remaining.length > 0,
  );
  vscode.window.showInformationMessage("Signed out.");
  prProvider.refresh();
  ciProvider.refresh();
  statusBar.refresh();
}
