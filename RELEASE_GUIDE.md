# Release Guide for v0.5.0

## 📸 Step 1: Save the Screenshot

1. Save the screenshot from your VS Code window showing the live log streaming feature
2. Save it as: `resources/screenshots/screenshot-live-logs.png`
3. The screenshot should show:
   - The "Live streaming" indicator with pulsing animation
   - The "in_progress" status badge
   - Real-time logs scrolling
   - The job name in the title (e.g., "📋 deploy-dev")

## 🔨 Step 2: Build the Extension (Optional - Automated)

**Note:** The extension is automatically built by GitHub Actions when you create a release! You only need to build manually if you want to test locally.

### Manual Build (Optional)
```bash
# Make sure all dependencies are installed
npm install

# Compile TypeScript
npm run compile

# Package the extension
npx vsce package --no-dependencies
```

This will create a `.vsix` file named something like `gitea-vscode-pullrequest-0.5.0.vsix`

## 🏷️ Step 3: Create a GitHub Release (Automated Build)

### Option A: Using GitHub Web Interface (Recommended - Automated Build)

1. Go to: https://github.com/dj0024javia/gitea-vscode-extension/releases/new
2. **Tag version**: `v0.5.0`
3. **Release title**: `v0.5.0 - Live CI/Actions with Real-time Log Streaming`
4. **Description**: Copy from CHANGELOG.md (the 0.5.0 section)
5. Click **Publish release**
6. ✨ **GitHub Actions will automatically build and attach the .vsix file!**

Wait a few minutes for the workflow to complete, then the `.vsix` file will appear in the release assets.

### Option B: Using GitHub CLI (Automated Build)

```bash
# Create tag
git tag -a v0.5.0 -m "Release v0.5.0 - Live CI/Actions with Real-time Log Streaming"
git push origin v0.5.0

# Create release with gh cli (GitHub Actions will build and attach .vsix)
gh release create v0.5.0 \
  --title "v0.5.0 - Live CI/Actions with Real-time Log Streaming" \
  --notes-file <(sed -n '/## \[0.5.0\]/,/## \[0.4.0\]/p' CHANGELOG.md | head -n -2)

# Wait for GitHub Actions to complete and attach the .vsix file
```

### Option C: Manual Build and Upload (Not Recommended)

If you need to build and upload manually:

```bash
# Build the extension
npm run compile
npx vsce package --no-dependencies

# Create tag and release
git tag -a v0.5.0 -m "Release v0.5.0"
git push origin v0.5.0

# Create release with the .vsix file
gh release create v0.5.0 \
  ./gitea-vscode-pullrequest-0.5.0.vsix \
  --title "v0.5.0 - Live CI/Actions with Real-time Log Streaming" \
  --notes-file <(sed -n '/## \[0.5.0\]/,/## \[0.4.0\]/p' CHANGELOG.md | head -n -2)
```

### 🤖 GitHub Actions Workflow

The repository includes a `.github/workflows/release.yml` that automatically:
1. Builds the extension when a release is published
2. Compiles TypeScript
3. Packages the extension into a `.vsix` file
4. Uploads the `.vsix` to the release assets

You can monitor the workflow progress at:
https://github.com/dj0024javia/gitea-vscode-extension/actions

## 🚀 Step 4: Publish to VS Code Marketplace (Automated!)

**Good news!** Publishing to the VS Code Marketplace is now **fully automated** via GitHub Actions!

When you create a release, the workflow will:
1. ✅ Build and package the extension
2. ✅ Upload the `.vsix` to GitHub release
3. ✅ **Automatically publish to VS Code Marketplace using your AZURE_TOKEN secret**

### Setup (One-time)

The `AZURE_TOKEN` secret is already configured in your repository! The workflow will use it automatically.

### Manual Publishing (If Needed)

If you ever need to publish manually:

```bash
# Install vsce globally
npm install -g @vscode/vsce

# Publish using your token
vsce publish -p YOUR_AZURE_TOKEN

# Or publish from the .vsix file
vsce publish --packagePath gitea-vscode-pullrequest-0.5.0.vsix -p YOUR_AZURE_TOKEN
```

### Verify Marketplace Publishing

After the release workflow completes, check:
- Marketplace page: https://marketplace.visualstudio.com/items?itemName=dj0024javia.gitea-vscode-pullrequest
- Or search for "Gitea" in VS Code Extensions


## 📋 Post-Release Checklist

- [ ] Screenshot saved to `resources/screenshots/screenshot-live-logs.png`
- [ ] All changes committed to git
- [ ] Git tag created and pushed (`v0.5.0`)
- [ ] GitHub release created with changelog
- [ ] ✨ GitHub Actions workflow completed successfully
- [ ] `.vsix` file automatically attached to release
- [ ] ✨ Extension automatically published to VS Code Marketplace
- [ ] Verify extension appears on marketplace
- [ ] Announcement/notification sent to users

## 🎯 Quick Release Commands

```bash
# Simplified release workflow (with automated build)

# 1. Commit changes
git add -A
git commit -m "Release v0.5.0 - Live CI/Actions with Real-time Log Streaming"

# 2. Create and push tag
git tag -a v0.5.0 -m "Release v0.5.0"
git push origin master
git push origin v0.5.0

# 3. Create GitHub release (GitHub Actions handles the build!)
gh release create v0.5.0 \
  --title "v0.5.0 - Live CI/Actions with Real-time Log Streaming" \
  --notes "$(sed -n '/## \[0.5.0\]/,/## \[0.4.0\]/p' CHANGELOG.md | head -n -2)"

# 4. Wait for GitHub Actions to complete (~2-3 minutes)
# The .vsix file will be automatically uploaded to the release
```

## 📝 Release Notes Template

For social media or announcements:

```
🎉 Gitea for VS Code v0.5.0 is here!

New in this release:
✨ Live CI/Actions status updates (auto-refresh every 5s)
📊 Real-time log streaming with auto-scroll
⏱️ Duration tracking for runs, jobs, and steps
🔴 Live indicators for running workflows
🎨 Better UX with collapsed-by-default tree items

📦 Install from VS Code Marketplace or GitHub:
- Marketplace: https://marketplace.visualstudio.com/items?itemName=dj0024javia.gitea-vscode-pullrequest
- GitHub: https://github.com/dj0024javia/gitea-vscode-extension/releases/tag/v0.5.0
```



```
# 1. Save your screenshot
# Save to: resources/screenshots/screenshot-live-logs.png

# 2. Commit everything
git add -A
git commit -m "Release v0.5.0 - Live CI/Actions with Real-time Log Streaming"

# 3. Tag and push
git tag -a v0.5.0 -m "Release v0.5.0"
git push origin master
git push origin v0.5.0

# 4. Create release (triggers automation!)
gh release create v0.5.0 \
  --title "v0.5.0 - Live CI/Actions with Real-time Log Streaming" \
  --notes "$(cat CHANGELOG.md | sed -n '/## \[0.5.0\]/,/## \[0.4.0\]/p' | head -n -2)"

# 5. Wait ~3-5 minutes for GitHub Actions to:
#    - Build the extension
#    - Upload .vsix to release
#    - Publish to VS Code Marketplace
```