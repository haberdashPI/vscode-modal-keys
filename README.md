# Modal Keybindings in VS Code

[![Project Status: WIP – Initial development is in progress, but there has not yet been a stable, usable release suitable for the public.](https://img.shields.io/badge/Project%20Status-WIP-yellow)](https://www.repostatus.org/#wip)

ModalKeys is a simple extension for defining modal keybindings in VSCode. The most prominent
[modal editor](https://unix.stackexchange.com/questions/57705/modeless-vs-modal-editors) is
[Vim](https://www.vim.org/) and ModalKeys includes presets that resemble Vim. While you can
emulate existing modal editors like Vim or
[Kakoune](https://kakoune.org/why-kakoune/why-kakoune.html), the real advantage of ModalKeys is that you create custom modal keybindings.

As a little taste of what's possible, here are the basic movement commands in my configuration file:

```typescript
    "::using::cursorMove::": {
        h: { to: 'left', select: "__mode !== 'normal'", value: '__count' },
        j: { to: 'down', by: 'wrappedLine', select: "__mode !== 'normal'", value: '__count' },
        k: { to: 'up', by: 'wrappedLine', select: "__mode !== 'normal'" , value: '__count' },
        l: { to: 'right', select: "__mode !== 'normal'", value: '__count' },
        gj: { to: 'down', by: 'line', select: "__mode !== 'normal'", value: '__count' },
        gk: { to: 'up', by: 'line', select: "__mode !== 'normal'", value: '__count' },
    },
```

These essentially replicate Vim's standard motions. When these keys are pressed in normal mode the built-in VSCode command `cursorMove` will be called with the given arguments. If you don't know what normal mode is [read the tutorial](./tutorial.html).

If you don't care to create a custom set of keybindings, and prefer to replicate
vim in VSCode, consider using [VSCodeVim](https://github.com/VSCodeVim/Vim) or
[vscode-neovim](https://github.com/asvetliakov/vscode-neovim).

To start configuration ModalKeys to your liking, you have a few options:

1. Read the [Tutorial](./tutorial.html)
2. Start using ModalKeys right-away with one of the [Presets](./preset_index.html)
3. Read through the full [Documentation](./doc_index.html)
4. You can even read through the documented [source code](./src/extension.html)

## Acknowledgements

ModalKeys is a fork of [ModalEdit](https://github.com/johtela/vscode-modaledit); I am in
debt to the hard and thoughtful work put into that extension. There are some important features that
differ between the two extensions.

Features that ModalKeys has, which ModalEdit lacks.

1. Concise keymap format: I've designed a terser, simplified keymap format
2. Customized modes: You can define your own key modes, to expand the keymap more easily
3. Search term highlighting: ModalKeys highlights search terms by default (there is an open [PR](https://github.com/johtela/vscode-modaledit/pull/19))
4. Search with regex: The `search` command can optionally use regex expressions
4. Kakoune-like 'repeat-selection': ModalKeys provides a
   `repateLastUsedSelection` to make implementing kakoune noun-verb workflows repeatable (in contrast with vim's verb-noun workflows)

ModalKeys is missing a few features I did not want to maintain from ModalEdit: bookmarks and quick snippets. I find these features to be well covered by several existing extensions in VSCode.

My re-organizing of this project is also part of my plans to pave the way for
fully functional keyboard macros and

## Acknowledgements

Much of the organization, concept and documentation for this extension owes a debt to [ModalEdit](https://github.com/johtela/vscode-modaledit). Thanks to @joetela for creating such a well documented, well organized, and useful extension. Other, past extensions, to whom I am indebted include [Simple Vim](https://marketplace.visualstudio.com/items?itemName=jpotterm.simple-vim), [Vimspired](https://marketplace.visualstudio.com/items?itemName=bmalehorn.vimspired). It is slowly being reshaped to fit my own purposes and views on how the code can best grow to allow for new features.
