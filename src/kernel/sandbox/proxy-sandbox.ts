/**
 * ProxySandbox — JavaScript sandbox using Proxy.
 *
 * Derived from qiankun's ProxySandbox (MIT-licensed).
 * Source: https://github.com/umijs/qiankun/blob/master/src/sandbox/index.ts
 *
 * Creates a fake window proxy so user code can't pollute the real global scope.
 * Simplified for Obsidian plugin use: no multi-instance accounting, no dev mode,
 * no variable whitelist.
 */

type FakeWindow = Window & Record<PropertyKey, any>;

/**
 * Properties that should be resolved from the proxy itself, not the real window.
 * Prevents escape via `window.window`, `window.self`, `window.globalThis`.
 */
const ESCAPE_KEYS = new Set(["window", "self", "globalThis"]);

/**
 * Properties that must use the native window for `this` binding
 * to avoid "Illegal invocation" errors (e.g. fetch).
 */
const NATIVE_BINDING_KEYS = new Set(["fetch"]);

/**
 * Variables that are impossible to override and should be excluded
 * from the proxy's `has` trap for performance.
 */
const UNSCOPABLES: Record<string, boolean> = {
	undefined: true,
	Array: true,
	Object: true,
	String: true,
	Boolean: true,
	Math: true,
	Number: true,
	Symbol: true,
	parseFloat: true,
	Float32Array: true,
	isNaN: true,
	Infinity: true,
	Reflect: true,
	Float64Array: true,
	Function: true,
	Map: true,
	NaN: true,
	Promise: true,
	Proxy: true,
	Set: true,
	parseInt: true,
	requestAnimationFrame: true,
};

export class ProxySandbox {
	name: string;
	proxy: WindowProxy & typeof globalThis;
	private globalContext: typeof window;
	private sandboxRunning = false;
	private updatedValueSet = new Set<PropertyKey>();

	constructor(name: string, globalContext = window) {
		this.name = name;
		this.globalContext = globalContext;

		const { updatedValueSet } = this;
		const fakeWindow: FakeWindow = {} as FakeWindow;

		// Copy non-configurable properties from real window to fakeWindow
		Object.getOwnPropertyNames(globalContext)
			.filter((p) => {
				const descriptor = Object.getOwnPropertyDescriptor(globalContext, p);
				return !descriptor?.configurable;
			})
			.forEach((p) => {
				const descriptor = Object.getOwnPropertyDescriptor(globalContext, p);
				if (descriptor) {
					// Make top/self/window configurable so proxy get trap works
					if (p === "top" || p === "parent" || p === "self" || p === "window") {
						descriptor.configurable = true;
						if (!("get" in descriptor)) {
							descriptor.writable = true;
						}
					}
					Object.defineProperty(fakeWindow, p, Object.freeze(descriptor));
				}
			});

		const hasOwnProperty = (key: PropertyKey) =>
			fakeWindow.hasOwnProperty(key) || globalContext.hasOwnProperty(key);

		const proxy = new Proxy(fakeWindow, {
			set: (_target: FakeWindow, p: PropertyKey, value: any): boolean => {
				if (this.sandboxRunning) {
					if (!_target.hasOwnProperty(p) && globalContext.hasOwnProperty(p)) {
						const descriptor = Object.getOwnPropertyDescriptor(globalContext, p);
						const { writable, configurable, enumerable } = descriptor!;
						if (writable) {
							Object.defineProperty(_target, p, {
								configurable,
								enumerable,
								writable,
								value,
							});
						}
					} else {
						_target[p] = value;
					}

					updatedValueSet.add(p);
					return true;
				}

				return true;
			},

			get: (_target: FakeWindow, p: PropertyKey): any => {
				if (p === Symbol.unscopables) return UNSCOPABLES;

				// Prevent escape via window.window / window.self / window.globalThis
				if (ESCAPE_KEYS.has(p as string)) {
					return proxy;
				}

				if (p === "top" || p === "parent") {
					if (globalContext === globalContext.parent) {
						return proxy;
					}
					return (globalContext as any)[p];
				}

				if (p === "hasOwnProperty") {
					return hasOwnProperty;
				}

				if (p === "document") {
					return document;
				}

				if (p === "eval") {
					return eval;
				}

				const value =
					p in _target ? (_target as any)[p] : (globalContext as any)[p];

				// Some DOM APIs must be bound to native window
				const boundTarget = NATIVE_BINDING_KEYS.has(p as string)
					? globalContext
					: globalContext;
				return typeof value === "function" && !value.prototype
					? value.bind(boundTarget)
					: value;
			},

			has: (_target: FakeWindow, p: string | number | symbol): boolean => {
				return p in UNSCOPABLES || p in _target || p in globalContext;
			},

			getOwnPropertyDescriptor(
				_target: FakeWindow,
				p: string | number | symbol,
			): PropertyDescriptor | undefined {
				if (_target.hasOwnProperty(p)) {
					return Object.getOwnPropertyDescriptor(_target, p);
				}

				if (globalContext.hasOwnProperty(p)) {
					const descriptor = Object.getOwnPropertyDescriptor(globalContext, p);
					if (descriptor && !descriptor.configurable) {
						descriptor.configurable = true;
					}
					return descriptor;
				}

				return undefined;
			},

			ownKeys(_target: FakeWindow): ArrayLike<string | symbol> {
				const own = Reflect.ownKeys(_target);
				const global = Reflect.ownKeys(globalContext);
				return [...new Set([...global, ...own])];
			},

			deleteProperty: (_target: FakeWindow, p: string | number | symbol): boolean => {
				if (_target.hasOwnProperty(p)) {
					delete _target[p];
					updatedValueSet.delete(p);
				}
				return true;
			},
		});

		this.proxy = proxy as typeof this.proxy;
	}

	active(): void {
		this.sandboxRunning = true;
	}

	inactive(): void {
		this.sandboxRunning = false;
	}
}
