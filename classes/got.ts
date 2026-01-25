import got, { type OptionsInit, RequestError, HTTPError, TimeoutError, ParseError, CancelError } from "got";

export interface GotModuleOptions extends OptionsInit {
    headers?: Record<string, string>;
    timeout?: { request?: number };
    [key: string]: unknown;
}

export interface GotModule {
    name: string;
    optionsType: "object" | "function";
    options: GotModuleOptions | ((...args: unknown[]) => GotModuleOptions);
    parent: string | null;
    description: string;
}

export interface GotRequestOptions extends OptionsInit {
    url: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    headers?: Record<string, string>;
    json?: unknown;
    [key: string]: unknown;
}

class Got {
    #children = new Map<string, GotModule>();

    static sanitize(url: string): string {
        return url
            .replaceAll(/\.\.[/\\]?/g, "")
            .replaceAll(/%2E%2E[/\\]?/g, "");
    }

    static isRequestError(error: unknown): error is RequestError {
        return error instanceof RequestError ||
               error instanceof HTTPError ||
               error instanceof TimeoutError ||
               error instanceof ParseError ||
               error instanceof CancelError;
    }

    async importData(): Promise<void> {
        const modules = await import("../gots");

        for (const mod of Object.values(modules)) {
            if (this.#isGotModule(mod)) {
                this.#add(mod);
            }
        }

        this.#validateHierarchy();
    }

    #isGotModule(mod: unknown): mod is GotModule {
        return (
            typeof mod === "object" &&
            mod !== null &&
            "name" in mod &&
            "options" in mod
        );
    }

    #add(module: GotModule): void {
        this.#children.set(module.name.toLowerCase(), module);
    }

    #validateHierarchy(): void {
        for (const module of this.#children.values()) {
            if (module.parent && !this.#children.has(module.parent.toLowerCase())) {
                throw new Error(`Invalid Got configuration: Module "${module.name}" references non-existent parent "${module.parent}"`);
            }
        }
    }

    #resolveInstance(moduleName: string, ...args: unknown[]): typeof got {
        const module = this.#children.get(moduleName.toLowerCase());
        if (!module) {
            throw new Error(`Got module not found: ${moduleName}`);
        }

        const parentInstance = module.parent
            ? this.#resolveInstance(module.parent, ...args)
            : got;

        const currentOptions = (module.optionsType === "function" && typeof module.options === "function")
            ? module.options(...args)
            : module.options as GotModuleOptions;

        return parentInstance.extend(currentOptions);
    }

    async request<T = unknown>(
        moduleName: string,
        requestOptions: GotRequestOptions,
        ...args: unknown[]
    ): Promise<T> {
        const { url, ...restRequestOptions } = requestOptions;
        const sanitizedUrl = Got.sanitize(url);

        const instance = this.#resolveInstance(moduleName, ...args);
        const response = await instance<T>(sanitizedUrl, {
            ...restRequestOptions,
            responseType: "json",
            isStream: false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        return response.body;
    }

    get modules(): Map<string, GotModule> {
        return this.#children;
    }
}

export default Got;
