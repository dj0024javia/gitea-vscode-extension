import * as assert from "assert";
import { RepoContext } from "../../context/repoContext";

suite("RepoContext", () => {
  test("parseGitConfig handles https URL", async () => {
    const ctx = new RepoContext();
    // @ts-expect-error accessing private method for testing
    const info = ctx.parseGitConfig(
      '[remote "origin"]\n\turl = https://gitea.example.com/alice/myrepo.git\n',
    );
    assert.strictEqual(info?.serverUrl, "https://gitea.example.com");
    assert.strictEqual(info?.owner, "alice");
    assert.strictEqual(info?.repo, "myrepo");
  });

  test("parseGitConfig handles ssh URL", async () => {
    const ctx = new RepoContext();
    // @ts-expect-error accessing private method for testing
    const info = ctx.parseGitConfig(
      '[remote "origin"]\n\turl = git@gitea.example.com:alice/myrepo.git\n',
    );
    assert.strictEqual(info?.serverUrl, "https://gitea.example.com");
    assert.strictEqual(info?.owner, "alice");
    assert.strictEqual(info?.repo, "myrepo");
  });

  test("parseGitConfig returns undefined for non-Gitea URL pattern", async () => {
    const ctx = new RepoContext();
    // @ts-expect-error accessing private method for testing
    const info = ctx.parseGitConfig('[remote "origin"]\n\turl = not-a-url\n');
    assert.strictEqual(info, undefined);
  });
});
