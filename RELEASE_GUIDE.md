# Release Guide for v0.5.0

## 📸 Step 1: Save the Screenshot

1. Save the screenshot from your VS Code window showing the live log streaming feature
2. Save it as: `resources/screenshots/screenshot-live-logs.png`
3. The screenshot should show:
   - The "Live streaming" indicator with pulsing animation
   - The "in_progress" status badge
   - Real-time logs scrolling
   - The job name in the title (e.g., "📋 deploy-dev")

## 🔨 Step 2: Build the Extension

```bash
# Make sure all dependencies are installed
npm install

# Compile TypeScript
npm run compile

# Package the extension
npx vsce package --no-dependencies
```

This will create a `.vsix` file named something like `gitea-vscode-pullrequest-0.5.0.vsix`

## 🏷️ Step 3: Create a GitHub Release

### Option A: Using GitHub Web Interface

1. Go to: https://github.com/dj0024javia/gitea-vscode-extension/releases/new
2. **Tag version**: `v0.5.0`
3. **Release title**: `v0.5.0 - Live CI/Actions with Real-time Log Streaming`
4. **Description**: Copy from CHANGELOG.md (the 0.5.0 section)
5. **Attach the .vsix file**: Drag and drop the generated `.vsix` file
6. Click **Publish release**

### Option B: Using GitHub CLI

```bash
# Create tag
git tag -a v0.5.0 -m "Release v0.5.0 - Live CI/Actions with Real-time Log Streaming"
git push origin v0.5.0

# Create release with gh cli
gh release create v0.5.0 \
  ./gitea-vscode-pullrequest-0.5.0.vsix \
  --title "v0.5.0 - Live CI/Actions with Real-time Log Streaming" \
  --notes-file <(sed -n '/## \[0.5.0\]/,/## \[0.4.0\]/p' CHANGELOG.md | head -n -2)
```

## 🚀 Step 4: Publish to VS Code Marketplace (Optional)

If you want to publish to the official VS Code Marketplace:

### Prerequisites
1. Create a publisher account at: https://marketplace.visualstudio.com/manage
2. Generate a Personal Access Token (PAT) from Azure DevOps
3. Install vsce globally: `npm install -g @vscode/vsce`

### Publish

```bash
# Login with your publisher
vsce login dj0024javia

# Publish the extension
vsce publish -p YOUR_PERSONAL_ACCESS_TOKEN

# Or publish from the .vsix file
vsce publish --packagePath gitea-vscode-pullrequest-0.5.0.vsix
```

## 📋 Post-Release Checklist

- [ ] Screenshot saved to `resources/screenshots/screenshot-live-logs.png`
- [ ] Extension compiled successfully (`npm run compile`)
- [ ] `.vsix` package created (`npx vsce package`)
- [ ] Git tag created and pushed (`v0.5.0`)
- [ ] GitHub release created with changelog
- [ ] `.vsix` file attached to GitHub release
- [ ] (Optional) Published to VS Code Marketplace
- [ ] Announcement/notification sent to users

## 🎯 Quick Commands Summary

```bash
# Complete release workflow
npm install
npm run compile
npx vsce package --no-dependencies

# Tag and push
git add -A
git commit -m "Release v0.5.0 - Live CI/Actions with Real-time Log Streaming"
git tag -a v0.5.0 -m "Release v0.5.0"
git push origin master
git push origin v0.5.0

# Create GitHub release (using gh cli)
gh release create v0.5.0 \
  ./gitea-vscode-pullrequest-0.5.0.vsix \
  --title "v0.5.0 - Live CI/Actions with Real-time Log Streaming" \
  --notes "See CHANGELOG.md for full details"
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

Download: https://github.com/dj0024javia/gitea-vscode-extension/releases/tag/v0.5.0
```
