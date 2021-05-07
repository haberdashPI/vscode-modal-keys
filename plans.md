- fix bookmark expansion upon edit (should stick to one line)
- fix some weirdness with creating and delete bookmakrs
    related to the fact that __count == 1 is default,
    maybe I should default to __count == undefined, and have
    some cases that handle that as 1 where needed

- revise tutorials and vim presents
- display visual layout of keyboard
- add folder to list presets
- add macro recording
    - non-insert only
    - manage insert mode too (using document modified events)