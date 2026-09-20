# 🎵 CLI Music Player

A lightweight, terminal-based music player built with Node.js. Navigate your music library, play/pause songs, seek through tracks, and enjoy a visual seek bar — all from your terminal.

![Node.js](https://img.shields.io/badge/Node.js-v18+-green)
![Platform](https://img.shields.io/badge/Platform-macOS-blue)
![License](https://img.shields.io/badge/License-ISC-yellow)

## Features

- 🎶 Play `.mp3` files from the `songs/` directory
- ⏯️ Play, pause, and resume with a single key
- ⏭️ Skip to next or previous track
- ⏩ Seek forward/backward 10 seconds
- 📊 Real-time seek bar with elapsed/total time
- 🔄 Auto-advances to the next song when one finishes
- 🖥️ Clean TUI using alternate screen buffer

## Prerequisites

- **Node.js** v18 or higher
- **VLC** media player (used as the audio backend)
- **macOS** (uses `afinfo` for reading audio metadata)

### Install VLC

```bash
brew install --cask vlc
```

> `afinfo` is pre-installed on macOS — no additional setup needed.

## Setup

1. **Clone the repository**

```bash
git clone https://github.com/Utkarshh014/CLI_music_player.git
cd CLI_music_player
```

2. **Add your music**

Place `.mp3` files in the `songs/` directory:

```
CLI_music_player/
├── player.js
├── package.json
└── songs/
    ├── song1.mp3
    ├── song2.mp3
    └── ...
```

3. **Run the player**

```bash
node player.js
```

## Controls

| Key | Action |
|-----|--------|
| `↑` `↓` | Navigate song list |
| `Enter` | Play selected song / Pause-Resume if same song |
| `→` | Seek forward 10 seconds |
| `←` | Seek backward 10 seconds |
| `p` | Pause / Resume |
| `n` | Next song |
| `b` | Previous song |
| `q` / `Esc` / `Ctrl+C` | Quit player |

## How It Works

1. **Song Discovery** — Reads all `.mp3` files from the `songs/` directory on startup
2. **Audio Metadata** — Uses macOS `afinfo` to extract song duration
3. **Playback** — Spawns VLC in RC (remote control) mode, communicating via stdin pipe
4. **Seek Bar** — Tracks elapsed time and renders a visual progress bar using ANSI escape codes
5. **TUI Rendering** — Uses the terminal's alternate screen buffer for a clean, flicker-free interface

## Project Structure

```
CLI_music_player/
├── player.js        # Main application — player logic, TUI, and key handling
├── package.json     # Project config (ES module)
└── songs/           # Drop your .mp3 files here
```

## License

ISC
