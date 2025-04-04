import { ExtensionContext } from "vscode";

export enum StorageKey {
    WorkspaceHistory = 'workspaceHistory',
    Secrets = 'secrets',
    SecretFiles = 'secretFiles',
    Variables = 'variables',
    VariableFiles = 'variableFiles',
    Inputs = 'inputs',
    InputFiles = 'inputFiles',
    Runners = 'runners',
    PayloadFiles = 'PayloadFiles',
    Options = 'options'
}

export class StorageManager {
    private context: ExtensionContext;
    private extensionKey: string = 'githubLocalActions';

    constructor(context: ExtensionContext) {
        this.context = context;
    }

    keys(): readonly string[] {
        return this.context.globalState.keys();
    }

    get<T>(storageKey: StorageKey): T | undefined {
        return this.context.globalState.get<T>(`${this.extensionKey}.${storageKey}`);
    }

    async update(storageKey: StorageKey, value: any): Promise<void> {
        await this.context.globalState.update(`${this.extensionKey}.${storageKey}`, value);
    }
}