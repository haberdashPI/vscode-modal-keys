# Modal Keybindings in VS Code

[![Project Status: Active – The project has reached a stable, usable state and is being actively developed.](https://img.shields.io/badge/Project%20Status-Active-green)](https://www.repostatus.org/#active)
[![Project Documentation](https://img.shields.io/badge/docs-stable-blue)](https://haberdashpi.github.io/vscode-modal-keys/stable/doc_index.html)
[![Project Documentation](https://img.shields.io/badge/docs-dev-blue)](https://haberdashpi.github.io/vscode-modal-keys/dev/doc_index.html)

ModalKeys is an extension for defining modal keybindings in VSCode. [Vim](https://www.vim.org/) is probably the most well known [modal
editor](https://unix.stackexchange.com/questions/57705/modeless-vs-modal-editors)
and ModalKeys includes
[presets](https://haberdashpi.github.io/vscode-modal-keys/stable/preset_index.html)
that resemble Vim. 

The advantages of modal bindings are the rapid, speed-of-thought manipulations you can perform on text with a well-designed keymap and sufficient practice.

The advantages of using ModalKeys specifically, compared to other modal extensions VSCode, are that (1) it integrates seamlessly with the existing features and
extensions of VSCode, and that (2) it is highly customizable. While you can
emulate many of the features of other modal editors like Vim or
[Kakoune](https://kakoune.org/why-kakoune/why-kakoune.html), you will get the
most out of ModalKeys by creating your own keymap (usually by modifying one of
the
[presets](https://haberdashpi.github.io/vscode-modal-keys/stable/preset_index.html))

To start creating a custom set of keybindings for ModalKeys, you have a few options:

1. Read the [Tutorial](https://haberdashpi.github.io/vscode-modal-keys/stable/tutorial.html)
2. Start with an example from [presets](https://haberdashpi.github.io/vscode-modal-keys/stable/preset_index.html), modifying it to your taste as needed.
3. Read through the [Documentation](https://haberdashpi.github.io/vscode-modal-keys/stable/doc_index.html)

If you don't care to create your own custom keybindings, and prefer to replicate
an existing modal editor in VSCode, you may want to consider using [VSCodeVim](https://github.com/VSCodeVim/Vim),
[vscode-neovim](https://github.com/asvetliakov/vscode-neovim), or [Dance](https://github.com/71/dance).

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