export abstract class Template {
    abstract initialize(): Promise<void>;
    abstract destroy(): void;
}

export abstract class TemplateWithoutId extends Template {
    destroy(): void {}
}
