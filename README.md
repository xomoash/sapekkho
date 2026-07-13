# Sapekkho

Sapekkho is a daily task manager for Windows, built to help you plan, organize, and stay on top of your day.

![platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue)
![version](https://img.shields.io/badge/version-1.0.0-green)

## ✨ Features

- **Task Management** — create, edit, and organize daily tasks with ease
- **Tags & Categories** — group tasks by project, priority, or custom labels
- **Calendar View** — visualize tasks and deadlines across days, weeks, and months
- **Dark Mode** — easy on the eyes, day or night
- **System Tray Icon** — quick access to Sapekkho without cluttering your taskbar
- **Auto-Updates** — Sapekkho checks for and installs new versions automatically

## 💻 Installation

1. Download `Sapekkho-Setup-1.0.0.exe` from the [Releases](../../releases) page
2. Run the installer
3. Launch Sapekkho from your Start menu or desktop shortcut

**Requirements:** Windows 10 or 11

## 🛠️ Development

Clone the repo and install dependencies:

```bash
git clone https://github.com/sapekkho/sapekkho.git
cd sapekkho
npm install
```

Run the app in development mode:

```bash
npm start
```

Build a distributable installer:

```bash
npm run build
```

## 📋  Limitations

- No cloud sync yet — data is stored locally
- No mobile companion app for now

## 📝 Changelog

### v1.0.0 — Initial Release
Full Changelog: Initial release

## v1.1.1 - 2026

### Added
* Redesigned Settings page with a professional categorized card layout
* Profile badge in the titlebar for quick Google account management
* Manual Check for Updates button in the About section
* Sync Unsynced Tasks feature to safely push offline tasks to Google Calendar
* Help and Documentation dialog explaining privacy and sync mechanics
* Disconnect confirmation prompt to prevent accidental sign outs
* Asynchronous loading animations for sign out and update checking

### Changed
* Refactored Google Calendar integration to handle disconnects asynchronously
* Moved context menus to absolute positioning for better UI layering
* Replaced native app framing with custom titlebar layout
* Fixed Bugs
