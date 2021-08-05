
# Configuration

## Changing Cursors

You can set the cursor shape shown in each mode by changing the following
settings. Custom modes always use the cursor style of Normal mode.

| Setting               | Default       | Description
| --------------------- | ------------- | -------------------------------------
| `insertCursorStyle`   | `line`        | Cursor shown in insert mode.
| `normalCursorStyle`   | `block`       | Cursor shown in normal mode.
| `searchCursorStyle`   | `underline`   | Cursor shown when incremental search is on.
| `selectCursorStyle`   | `line-thin`   | Cursor shown when selection is active in normal mode.

The possible values are:

- `block`
- `block-outline`
- `line`
- `line-thin`
- `underline`
- `underline-thin`

## Changing Search Highlight Colors

By default, incremental search highlights matches in the same way that the built-in search
command does. You can configure it to use a different set of colors using the following
settings. Leave these blanks to use the theme colors for built-in search commands.

| Setting                        | Default | Description
| ------------------------------ | ------- | ---------------------------------------------
| `searchMatchBackground`        | ``      | Background color for current search match.
| `searchMatchBorder`            | ``      | Border color for current search match.
| `searchOtherMatchesBackground` | ``      | Background color for other visible search matches.
| `searchOtherMatchesBorder`     | ``      | Border color for other visible search matches .

## Changing Status Bar

You can change the text shown in status bar in each mode along with the text
color. Note that you can add icons in the text by using syntax `$(icon-name)`
where `icon-name` is a valid name from the gallery of [built-in
icons](https://microsoft.github.io/vscode-codicons/dist/codicon.html).

The color of the status text is specified in HTML format, such as `#ffeeff`,
`cyan`, or `rgb(50, 50, 50)`. By default these colors are not defined, and thus
they are same as the rest of text in the status bar.

| Setting            | Default                   | Description
| ------------------ | ------------------------- | -------------------------------------
| `insertStatusText` | `-- $(edit) INSERT --`    | Status text shown in insert mode
| `normalStatusText` | `-- $(move) __MODENAME__ --`    | Status text shown in normal, or custom modes
| `searchStatusText` | `$(search) SEARCH`        | Status text shown when search is active
| `selectStatusText` | `-- $(paintcan) VISUAL --`| Status text shown when selection is active in normal mode
| `insertStatusColor`| `undefined`               | Status text color in insert mode
| `normalStatusColor`| `undefined`               | Status text color in normal mode
| `searchStatusColor`| `undefined`               | Status text color when search is active
| `selectStatusColor`| `undefined`               | Status text color when selection is active in normal mode

## Start in Normal Mode

If you want VS Code to be in insert mode when it starts, set the
`startInNormalMode` setting to `false` (it defaults to `true`).
