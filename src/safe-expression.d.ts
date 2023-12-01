declare module 'safe-expression' {
    export default SafeExpression;

    export type EvalFun = (scope: {[k: string]: any}) => any
    class SafeExpression{
        constructor();
    }
    interface SafeExpression{
        (exp: string): EvalFun;
    }
}
