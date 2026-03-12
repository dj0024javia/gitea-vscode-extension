# Changelog

All notable changes to the Gitea VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-03-12

### Added

#### 🎉 Live CI/Actions Updates
- **Live status polling**: Tree view automatically refreshes every 5 seconds when workflows are running
- **Live indicators**: Running jobs show 🔴 indicator in descriptions and tooltips
- **Smart polling**: Only refreshes repositories with active/running workflows to minimize API calls

#### 📊 Live Log Streaming
- **New live log viewer**: Dedicated webview panel that streams job logs in real-time
- **Auto-scroll to bottom**: Automatically scrolls to end as new logs arrive
- **Smart scroll behavior**: Pauses auto-scroll if user scrolls up manually, resumes when scrolling to bottom
- **Live status updates**: Job status changes reflected in real-time with emoji indicators (⏳ → ✅/❌)
- **Streaming indicator**: Shows pulsing green "Live streaming" badge while logs are active
- **2-second refresh**: Polls for new log content every 2 seconds while job is running

#### ⏱️ Duration & Timing Information
- **Run duration**: Shows total elapsed time for workflow runs
- **Job duration**: Each job displays execution time in ⏱️ format
- **Step duration**: Individual steps show their execution time
- **Live updates**: Duration updates automatically for running jobs

#### 🔄 Enhanced CI Detail Panel
- **Auto-refresh**: Detail panel polls every 3 seconds while workflows are running
- **Live status badge**: Shows pulsing "Live" indicator when workflow is in progress
- **Better log access**: Click "📋 Logs" on any job to open live log viewer
- **Duration tracking**: Displays elapsed time at all levels (run, job, step)

### Changed
- Tree view items now start **collapsed by default** instead of expanded
- All tree items have unique IDs to **persist expand/collapse state** across sessions
- Tree state is remembered when switching between extensions
- Improved resource efficiency with smart polling that stops when all jobs complete

### Fixed
- Tree view state now persists correctly when navigating to other extensions
- Proper cleanup of polling timers and resources on disposal
- Better error handling during live streaming

## [0.4.0] - 2026-03-10

### Added
- Initial release with Pull Requests, Issues, and CI/Actions support
- Multi-repository detection with submodules
- Inline code review with GitHub-style diff viewer
- Merge, approve, and comment on pull requests
- View and manage workflow runs and jobs
- Status bar integration

### Features
- Pull Request management
- Issue tracking
- CI/Actions workflow viewing
- Repository context detection
- Authentication via Gitea API tokens

[0.5.0]: https://github.com/dj0024javia/gitea-vscode-extension/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/dj0024javia/gitea-vscode-extension/releases/tag/v0.4.0
