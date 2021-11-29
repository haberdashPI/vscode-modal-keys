# Modal Keybindings in VS Code

[![Project Status: Active – The project has reached a stable, usable state and is being actively developed.](https://img.shields.io/badge/Project%20Status-Active-green)](https://www.repostatus.org/#active)
[![Project Documentation](https://img.shields.io/badge/docs-stable-blue)](https://haberdashpi.github.io/vscode-modal-keys/stable/doc_index.html)
[![Project Documentation](https://img.shields.io/badge/docs-dev-blue)](https://haberdashpi.github.io/vscode-modal-keys/dev/doc_index.html)

ModalKeys is an extension for defining modal keybindings in VSCode. [Vim](https://www.vim.org/) is probably the most well known [modal
editor](https://unix.stackexchange.com/questions/57705/modeless-vs-modal-editors)
and ModalKeys includes
[presets](https://haberdashpi.github.io/vscode-modal-keys/stable/preset_index.html)
that resemble Vim. 

![visual display of vim keybindings](https://github.com/haberdashPI/vscode-modal-keys/blob/feat-doc-display/doc_binding_example.png?raw=true)

The above is a screen shot of the visual documentation feature of this plugin; you can access this feature using the command `ModalKeys: Toggle keymap documentation`.

The advantages of modal bindings are the rapid, speed-of-thought manipulations you can perform on text with a well-designed keymap and sufficient practice. The advantages of using ModalKeys specifically include:

1. Visual documentation of all keybindings
2. Seamless integration with the existing features and
extensions of VSCode
3. Complete customization. While you can
emulate many of the features of other modal editors like Vim or
[Kakoune](https://kakoune.org/why-kakoune/why-kakoune.html), you will get the
most out of ModalKeys by creating your own keymap or modifying an existing one (e.g. starting with one of the
[presets](https://haberdashpi.github.io/vscode-modal-keys/stable/preset_index.html))

To start creating a custom set of keybindings for ModalKeys, you have a few options:

1. Read the [Tutorial](https://haberdashpi.github.io/vscode-modal-keys/stable/tutorial.html)
2. Start with an example from [presets](https://haberdashpi.github.io/vscode-modal-keys/stable/preset_index.html), using the export and import commands to create and then use your own version of the presets.
3. Read through the [Documentation](https://haberdashpi.github.io/vscode-modal-keys/stable/doc_index.html)

The general phillosphy of ModalKeys is to leverage existing functionality and behavior already available from VSCode and its extensions, and make it easy to define modal key bindings for these behaviors. If you don't care to integrate behavior from other extensions into your modal keybindings, you probably just want to replicate an existing modal editor in VSCode; in this case you may want to consider using [VSCodeVim](https://github.com/VSCodeVim/Vim),
[vscode-neovim](https://github.com/asvetliakov/vscode-neovim), or [Dance](https://github.com/71/dance).

## Acknowledgements

ModalKeys is a fork of [ModalEdit](https://github.com/johtela/vscode-modaledit);
I am in debt to the hard and thoughtful work from that extension along with its
meticulous documentation. There are many important features that differ between
the two extensions.

What follows are are just *some* of the features ModalKeys has which ModalEdit lacks.

1. Concise keymap format: I've created a terser, simplified keymap format
2. Visual documentation: you can fill out `::doc::` entries and these will populate a visual keymap documenting your keybindings
3. Customized modes: You can define your own key modes, to expand the keymap more easily
4. Search term highlighting: ModalKeys highlights search terms by default (there is an open [PR](https://github.com/johtela/vscode-modaledit/pull/19) in ModalEdit)
5. Search with regex: The [`search` command](https://haberdashpi.github.io/vscode-modal-keys/stable/commands.html#incremental-search) can optionally use regex expressions
6. Kakoune-like 'repeat-selection': ModalKeys provides a [`repateLastUsedSelection`](https://haberdashpi.github.io/vscode-modal-keys/stable/commands.html#repeat-last-used-selection) to make kakoune noun-verb workflows repeatable (in contrast with vim's verb-noun workflows)
7. [Keyboard macros](https://haberdashpi.github.io/vscode-modal-keys/stable/commands.html#macros)

ModalKeys is missing a few features I did not want to maintain from ModalEdit: bookmarks and quick snippets. I find these features to be well covered by several existing extensions in VSCode.
