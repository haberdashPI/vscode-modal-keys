# Modal Keybindings in VS Code

[![Project Status: Active – The project has reached a stable, usable state and is being actively developed.](https://img.shields.io/badge/Project%20Status-Active-green)](https://www.repostatus.org/#active)
[![Project Documentation](https://img.shields.io/badge/docs-stable-blue)](https://haberdashpi.github.io/vscode-modal-keys/stable/doc_index.html)
[![Project Documentation](https://img.shields.io/badge/docs-dev-blue)](https://haberdashpi.github.io/vscode-modal-keys/dev/doc_index.html)

ModalKeys is an extension for defining modal keybindings in VSCode. The most
prominent [modal
editor](https://unix.stackexchange.com/questions/57705/modeless-vs-modal-editors)
is [Vim](https://www.vim.org/) and ModalKeys includes
[presets](https://haberdashpi.github.io/vscode-modal-keys/stable/preset_index.html)
that resemble Vim. While you can emulate existing modal editors like Vim or
[Kakoune](https://kakoune.org/why-kakoune/why-kakoune.html), the real advantage
of ModalKeys is that you can create custom modal keybindings defined in terms of
VSCode commands. You can define modular, operator-like (noun/verb) keybindings
built from any of the existing extensions available in VSCode, or, if you want
to author your own extension, any behavior you can imagine.

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

When these key sequences are pressed in normal mode, the built-in VSCode command `cursorMove` will be called with the given arguments. If you don't know what normal mode is [read the tutorial](https://haberdashpi.github.io/vscode-modal-keys/stable/tutorial.html).

To start creating a custom set of keybindings for ModalKeys, you have a few options:

1. Read the [Tutorial](https://haberdashpi.github.io/vscode-modal-keys/stable/tutorial.html)
2. Start with an example from [presets](https://haberdashpi.github.io/vscode-modal-keys/stable/preset_index.html), modifying it to your taste as needed.
3. Read through the [Documentation](https://haberdashpi.github.io/vscode-modal-keys/stable/doc_index.html)

If you don't care to create a custom set of keybindings, and prefer to replicate
vim in VSCode, consider using [VSCodeVim](https://github.com/VSCodeVim/Vim) or
[vscode-neovim](https://github.com/asvetliakov/vscode-neovim).

## Acknowledgements

ModalKeys is a fork of [ModalEdit](https://github.com/johtela/vscode-modaledit);
I am in debt to the hard and thoughtful work from that extension along with its
meticulous documentation. There are some important features that differ between
the two extensions.

Features that ModalKeys has, which ModalEdit lacks.

1. Concise keymap format: I've created a terser, simplified keymap format
2. Customized modes: You can define your own key modes, to expand the keymap more easily
3. Search term highlighting: ModalKeys highlights search terms by default (there is an open [PR](https://github.com/johtela/vscode-modaledit/pull/19) in ModalEdit)
4. Search with regex: The [`search` command](https://haberdashpi.github.io/vscode-modal-keys/stable/commands.html#incremental-search) can optionally use regex expressions
5. Kakoune-like 'repeat-selection': ModalKeys provides a [`repateLastUsedSelection`](https://haberdashpi.github.io/vscode-modal-keys/stable/commands.html#repeat-last-used-selection) to make implementing kakoune noun-verb workflows repeatable (in contrast with vim's verb-noun workflows)
6. [Keyboard macros](https://haberdashpi.github.io/vscode-modal-keys/stable/commands.html#macros)

ModalKeys is missing a few features I did not want to maintain from ModalEdit: bookmarks and quick snippets. I find these features to be well covered by several existing extensions in VSCode.