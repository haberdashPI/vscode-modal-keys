- step 1: allow for an aribtrary number of modes, and commands to switch
between them
- step 2: maintain mode across buffers or track it per buffer
- step 4: simplify the state machine - just use have some variables
    (add a command to edit the variable, e.g. modify some register)
    that can be accessed