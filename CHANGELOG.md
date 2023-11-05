# Change Log

All notable changes to the ModalKeys extension will be documented in this file.

# Version 0.11.0
- **Feature**: Suport for keybinding tips (shown in activity bar) via
`docTips` configuration key. See documetnation for details.
- **Bugfix**: fix bug that lead to rare merging of documentation entries 
(when key was the same but mode was different)

# Version 0.10.4
- **Bugfix**: fix bug in 'd' command in `larkin.js` caused by recent fixes to
`modalkeys.enterNormal`.

# Version 0.10.3
- **Bugfix**: gracefully handle missing keybinding folder

# Version 0.10.2
- **Bugfix**: `enterNormal` clears the visual selection

# Version 0.10.1
- **Bugfix**: vim search handles selection properly
- **Bugfix**: `selectTillMatch` edgecase

# Version 0.10.0
- **Feature**: support vscode.dev
- **Bugfix**: coloring in detailed visual docs description was illegible for
  some color themes
- **Cleanup**: improved some error messages

# Version 0.9.0

- **Feature**: Support for color-blind friendly visual documentation; on by default. You can switch back to the old color scheme by changing `colorBlindDocs` to false.

# Version 0.8.3
- **Fix**: corrected clipboard extension for Larkin keybindings

# Version 0.8.2
- **Fix**: A few small improvements to the Larkin keybindings (missing extension, bug in one of the command sequences)

# Version 0.8.1
- **Fix**: Some issues with readme/changelog, 0.8.0 was published early.

# Version 0.8.0
- **Feature**: New commands `toggleKeymap` and `showKeymap` which can be used to display a  visual documentation of the current modal keybindings in the panel. 
- **Feature**: Your own keybindings can support the visual docummentation using `::doc::` entries (see extension documentation).
- **Feature**: A new keybinding preset called [Larkin](https://haberdashpi.github.io/vscode-modal-keys/stable/presets/larkin.html), that uses a Kakoune-style format.

# Version 0.7.0
- **Feature**: Preset files can identify a list of required extensions. If the extension is not present, an error message with an option to install the required extension is displayed.
- **Feature**: The vim presets now list required extensions.

## Version 0.6.1
- **Bugfix**: typing lag in insert mode
- **Bugfix**: search failed to catpure keys

## Version 0.6.0
- **Feature**: commands can use `__wordstr` to get the current word under the cursor or the current selection
- **Feature**: search registers; different search commands can use different registers to maintain separate state
- **Feature**: Vim preset's `;` and `N` now perform distinct actions, using the new search registers feature.
- **Feature**: Vim preset uses `__wordstr` to implement `*` and `#`.

## Version 0.5.4
- **Minor improvement**: Add doc link to keybinding errors.
- **Bugfix**: properly handle undefined keybinding preference.

## Version 0.5.3
- **Bugfix**: vim-presets: word motions accept counts

## Veresion 0.5.2
- **Bugfix**: Improve vim presents; search-based operations now work (e.g. `df[c]`).
- **Feature**: Added `{` and `}` motions to vim preset.
- **Bugfix**: Search edge case near newlines.

## Version 0.5.1
- **Bugfix**: properly redirect preset output
- **Bugfix**: `executeAfter` behavior for search command

## Version 0.5.0
- **Feature**: Export presets 
- **Bugfix**: Improved keybinding import error message
- **Bugfix**: Edge case for infinite loop in `selectBetween` / `search`

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