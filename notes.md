Current issues I'm working on:

3. start implementing various commands to make more keybindings work
    - search command in modalkeys
        - figure out why the matches aren't being highlighted
        - allow `mode` to be an array of &&'ed strings (so we can exclude search from
          the ignore commands)
        - allow shift+<all-keys>
          (since, when including a modifier that can be safely resolved
           to any existing shortcut not specific to this exitension)
           (also allow the others, for sure, since that could be useful somewhere)
    - move modalkeys.selectbetween to selection-utilities

For keybinding validation: we should requir eusers to indicate what their custom modes
are named, to avoid typos.

4. figure out how to enable additional extensions (maybe we have to do this manually for debugging...)
    - for some reasons we can't seem to install the selection utilities extension in the
    debug session 

5. start implementing event recording / replay for
    repeat action
    repeat last pre-action selection
    repeat last selection/action pair
    record macro

Testing stuff:

unit tests: test out switching between files
unit tests: search movements
unit tests: command argument validation
unit tests: keybinding validation
unit tests: keybinding insertion (with weird file states)
unit tests: set key state (+validation)
unit tests: expected display of state
unit tests: macro replay
