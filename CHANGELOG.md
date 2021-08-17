# Change Log

All notable changes to the ModalKeys extension will be documented in this file.

## Version 0.5.0
- **Feature**: Export presets 
- **Bugfix**: Improved keybinding import error message
## Version 0.4.0

- **Docs**: selectBetween
- **Feature**: selectBetween supports multiple cursors
- **Bugfix**: Repeated search result in some edge cases
- **Bugfix**: "Fix: Define keymap" button

## Version 0.3.1

- **Bugfix**: Packaging issue caused Import keybindings to fail.

## Version 0.3.0

- **Feature**: Keybinding errors have buttons to solutions (e.g. define the bindings)
- **Bugfix**: Backspace behavior during search command
- **Bugfix**: Search wrapping when searching backwards
- **Bugfix**: Search text repeat in status bar

## Version 0.2.2

- **Bugfix**: Search did not reveal cursor location

## Version 0.2.1

- **Bugfix**: `repeatLastUsedSelection` failed to properly record commands
that invovled capturing keys (e.g. `search` and `captureChars`).
- **Docfix**: A few outdated commands in the tutorial. 
- **Docfix**: Revised motivation
- **Docfix**: Fixed some broken links

## Version 0.2.0

- **Feature**: Keyboard macros. These can currently record events from all modes *except* insert mode.

## Version 0.1.0

- Initial port of [ModalEdit](https://github.com/johtela/vscode-modaledit)