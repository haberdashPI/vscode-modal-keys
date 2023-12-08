import * as vscode from 'vscode';
import z from 'zod';
import { showParseError } from './keybindingParsing';

export function validateInput<T extends z.ZodRawShape>(command: string, args_: unknown, 
    using: z.ZodObject<T>) {

    let result = using.safeParse(args_);
    if(!result.success){
        showParseError(`Unexpected arguments to '${command}':`, result.error);
        return;
    }
    return result.data;
}
