Current issues I'm working on:

4. figure out how to enable additional extensions (maybe we have to do this manually for debugging...)
    - for some reasons we can't seem to install the selection utilities extension in the
    debug session 
    - if we move over to working in the web extension that might solve the problem
      because I think we have a separate environment anyways (and
      we want to do this at some point in any case)

- move modalkeys.selectbetween to selection-utilities 

5. start implementing event recording / replay for

    repeat action
    repeat last pre-action selection
    repeat last selection/action pair
    record macro

6. expand to the full keybindings and start dogfooding the current setup

Testing stuff:

unit tests: test out switching between files
unit tests: search movements
unit tests: command argument validation
unit tests: keybinding validation
unit tests: keybinding insertion (with weird file states)
unit tests: set key state (+validation)
unit tests: expected display of state
unit tests: macro replay

NOTE: ages from now I want to make config import work for both global and workspace settings
