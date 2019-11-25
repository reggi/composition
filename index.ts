    export namespace Use {
        type ThenArg<T> = T extends Promise<infer U> ? U : T
        type RelatedThen<A, B> = A extends Promise<infer U> ? Promise<B> : B
        export type Func = (...args: any[]) => any
        export type Return<A extends Func, B> = RelatedThen<ReturnType<A>, B>
        export type CallbackValue<A extends Func> = ThenArg<ReturnType<A>>
    }
    
    
    export namespace Flow {
        export type Func = (args: any) => any
        export type Funcs = readonly Func[]
        type FuncPass<A, B> = (x: A) => B
        type Tail<T extends readonly FuncPass<any, any>[]> = FuncPass<T, void> extends ((h: any, ...r: infer R) => void) ? R : never;
        export type Check<T extends readonly FuncPass<any, any>[]> = { [K in keyof T]:
            K extends keyof Tail<T> ? (
                [T[K], Tail<T>[K]] extends [FuncPass<infer A, infer R>, FuncPass<infer S, any>] ? (
                    [R] extends [S] ? T[K] : FuncPass<A, S>
                ) : never
            ) : T[K]
        }
        type FirstFnParam<Fns extends Funcs> = Parameters<Fns[0]>[0]
        export type Params<T extends Funcs> = FirstFnParam<T>
        type LengthOfTuple<T extends Funcs> = T extends { length: infer L } ? L : never;
        type DropFirstInTuple<T extends Funcs> = ((...args: T) => any) extends (arg: any, ...rest: infer U) => any ? U : T;
        type LastInTuple<T extends Funcs> = T[LengthOfTuple<DropFirstInTuple<T>>];
        type LastFnReturns<Fns extends Funcs> = ReturnType<LastInTuple<Fns>>
        export type Return<T extends Funcs> = LastFnReturns<T>
    }
    
    function nest<T>(value: T): () => T {
        return () => {
            return value
        }
    }
    
    function flow<T extends Flow.Funcs>(...funcs: Flow.Check<T>) {
        return (input: Flow.Params<T>) => {
            return funcs.reduce((acq: Flow.Func, fn: Flow.Func) => {
                return use(acq, (acqError, acqValue) => {
                    if (acqError) throw acqError
                    return use(fn, (fnError, fnValue) => {
                        if (fnError) throw fnError
                        return fnValue
                    })(acqValue)
                })
            }, nest(input))(input) as Flow.Return<T>
        }
    }
    
    function isPromise(obj: any) {
        return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function'
    }
    
    function use<A extends Use.Func, G>(fn: A, callback: (e: Error | null, a: Use.CallbackValue<A>) => G) {
        return (...args: Parameters<A>): Use.Return<A, G> => {
            try {
                const v = fn(...args as any[])
                if (isPromise(v)) {
                    return v.then((v: any) => callback(null, v)).catch((e: any) => callback(e, undefined as Use.CallbackValue<A>))
                }
                return callback(null, v) as Use.Return<A, G>
            } catch (e) {
                return callback(e, undefined as Use.CallbackValue<A>) as unknown as Use.Return<A, G>
            }
        }
    }
    
    type FlowClassNest<T extends (...args: any) => any> = (...a: Parameters<T>) => () => ReturnType<T>
    type FlowCallbackArg<T> = { [K in keyof T]: T[K] extends ((...args: any) => any) ? FlowClassNest<T[K]> : never }
    type FlowCallback<T> = (t: FlowCallbackArg<T>) => any[]
    
    class Composition<T>{
        blacklist = [
            'constructor',
            '__defineGetter__',
            '__defineSetter__',
            'hasOwnProperty',
            '__lookupGetter__',
            '__lookupSetter__',
            'isPrototypeOf',
            'propertyIsEnumerable',
            'toString',
            'valueOf',
            '__proto__',
            'toLocaleString'
        ]
    
        constructor(private readonly parent: any) { }
    
        get methodNames() {
            let methods = new Set();
            let parent = this.parent
            while (parent = Reflect.getPrototypeOf(parent)) {
                let keys = Reflect.ownKeys(parent)
                keys.forEach((k) => methods.add(k));
            }
            return methods
        }
        get methodNamesArray() {
            return Array.from(this.methodNames)
        }
        get methodNamesArrayClean() {
            const arr1 = this.methodNamesArray
            const arr2 = this.blacklist
            return arr1.filter((x: string) => !arr2.includes(x));
        }
        get methods(): FlowCallbackArg<T> {
            const _methods = this.methodNamesArrayClean.map((key: string) => ({
                [key]: (...args) => {
                    return () => {
                        return this.parent[key](...args)
                    }
                }
            }))
            return Object.assign({}, ..._methods)
        }
        build(callback: FlowCallback<T>) {
            return flow(...callback(this.methods))(this.parent)
        }
    }
    
    
    class Meow2 {
        say: string
        setSay(value) {
            this.say = value
            return this
        }
        async setSayAsync(value) {
            this.say = value
            return this
        }
        logSay() {
            console.log(this.say)
            return this
        }
        compose(callback: FlowCallback<Meow2>) {
            return new Composition(this).build(callback)
        }
    }
    
    const m = new Meow2()
        .compose((m) => [
            m.setSay('A'),
            m.logSay(),
            m.setSayAsync('B'),
            m.logSay(),
            m.setSay('C'),
            m.logSay(),
        ])
    
    m.then(console.log)
