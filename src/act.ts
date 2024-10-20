import * as child_process from 'child_process';
import * as path from "path";
import { commands, CustomExecution, env, EventEmitter, ExtensionContext, Pseudoterminal, ShellExecution, TaskDefinition, TaskGroup, TaskPanelKind, TaskRevealKind, tasks, TaskScope, TerminalDimensions, window, WorkspaceFolder } from "vscode";
import { ComponentsManager } from "./componentsManager";
import { historyTreeDataProvider } from './extension';
import { HistoryManager, HistoryStatus } from './historyManager';
import { SettingsManager } from './settingsManager';
import { StorageKey, StorageManager } from './storageManager';
import { Job, Workflow, WorkflowsManager } from "./workflowsManager";

export enum Event {
    BranchProtectionRule = 'branch_protection_rule',
    CheckRun = 'check_run',
    CheckSuite = 'check_suite',
    Create = 'create',
    Delete = 'delete',
    Deployment = 'deployment',
    DeploymentStatus = 'deployment_status',
    Discussion = 'discussion',
    DiscussionComment = 'discussion_comment',
    Fork = 'fork',
    Gollum = 'gollum',
    IssueComment = 'issue_comment',
    Issues = 'issues',
    Label = 'label',
    MergeGroup = 'merge_group',
    Milestone = 'milestone',
    PageBuild = 'page_build',
    Public = 'public',
    PullRequest = 'pull_request',
    PullRequestComment = 'pull_request_comment',
    PullRequestReview = 'pull_request_review',
    PullRequestReviewComment = 'pull_request_review_comment',
    PullRequestTarget = 'pull_request_target',
    Push = 'push',
    RegistryPackage = 'registry_package',
    Release = 'release',
    RepositoryDispatch = 'repository_dispatch',
    Schedule = 'schedule',
    Status = 'status',
    Watch = 'watch',
    WorkflowCall = 'workflow_call',
    WorkflowDispatch = 'workflow_dispatch',
    WorkflowRun = 'workflow_run'
}

export enum Option {
    ActionCachePath = '--action-cache-path',
    ActionOfflineMode = '--action-offline-mode',
    Actor = '--actor',
    ArtifactServerAddr = '--artifact-server-addr',
    ArtifactServerPath = '--artifact-server-path',
    ArtifactServerPort = '--artifact-server-port',
    Bind = '--bind',
    BugReport = '--bug-report',
    CacheServerAddr = '--cache-server-addr',
    CacheServerPath = '--cache-server-path',
    CacheServerPort = '--cache-server-port',
    ContainerArchitecture = '--container-architecture',
    ContainerCapAdd = '--container-cap-add',
    ContainerCapDrop = '--container-cap-drop',
    ContainerDaemonSocket = '--container-daemon-socket',
    ContainerOptions = '--container-options',
    DefaultBranch = '--defaultbranch',
    DetectEvent = '--detect-event',
    Directory = '--directory',
    DryRun = '--dryrun',
    Env = '--env',
    EnvFile = '--env-file',
    EventPath = '--eventpath',
    GitHubInstance = '--github-instance',
    Graph = '--graph',
    Help = '--help',
    Input = '--input',
    InputFile = '--input-file',
    InsecureSecrets = '--insecure-secrets',
    Job = '--job',
    Json = '--json',
    List = '--list',
    LocalRepository = '--local-repository',
    LogPrefixJobId = '--log-prefix-job-id',
    ManPage = '--man-page',
    Matrix = '--matrix',
    Network = '--network',
    NoCacheServer = '--no-cache-server',
    NoRecurse = '--no-recurse',
    NoSkipCheckout = '--no-skip-checkout',
    Platform = '--platform',
    Privileged = '--privileged',
    Pull = '--pull',
    Quiet = '--quiet',
    Rebuild = '--rebuild',
    RemoteName = '--remote-name',
    ReplaceGHEActionTokenWithGitHubCom = '--replace-ghe-action-token-with-github-com',
    ReplaceGHEActionWithGitHubCom = '--replace-ghe-action-with-github-com',
    Reuse = '--reuse',
    Rm = '--rm',
    Secret = '--secret',
    SecretFile = '--secret-file',
    UseGitignore = '--use-gitignore',
    UseNewActionCache = '--use-new-action-cache',
    Userns = '--userns',
    Var = '--var',
    VarFile = '--var-file',
    Verbose = '--verbose',
    Version = '--version',
    Watch = '--watch',
    Workflows = '--workflows'
}

export interface CommandArgs {
    workspaceFolder: WorkspaceFolder,
    options: string,
    name: string,
    typeText: string[]
}

export class Act {
    private static base: string = 'act';
    storageManager: StorageManager;
    componentsManager: ComponentsManager;
    workflowsManager: WorkflowsManager;
    historyManager: HistoryManager;
    settingsManager: SettingsManager;
    installationCommands: { [packageManager: string]: string };
    prebuiltExecutables: { [architecture: string]: string };

    constructor(context: ExtensionContext) {
        this.storageManager = new StorageManager(context);
        this.componentsManager = new ComponentsManager();
        this.workflowsManager = new WorkflowsManager();
        this.historyManager = new HistoryManager(this.storageManager);
        this.settingsManager = new SettingsManager(this.storageManager);

        switch (process.platform) {
            case 'win32':
                this.installationCommands = {
                    'Chocolatey': 'choco install act-cli',
                    'Winget': 'winget install nektos.act',
                    'Scoop': 'scoop install act',
                    'GitHub CLI': 'gh extension install https://github.com/nektos/gh-act'
                };

                this.prebuiltExecutables = {
                    'Windows 64-bit (arm64/aarch64)': 'https://github.com/nektos/act/releases/latest/download/act_Windows_arm64.zip',
                    'Windows 64-bit (amd64/x86_64)': 'https://github.com/nektos/act/releases/latest/download/act_Windows_x86_64.zip',
                    'Windows 32-bit (armv7)': 'https://github.com/nektos/act/releases/latest/download/act_Windows_armv7.zip',
                    'Windows 32-bit (i386/x86)': 'https://github.com/nektos/act/releases/latest/download/act_Windows_i386.zip'
                };
                break;
            case 'darwin':
                this.installationCommands = {
                    'Homebrew': 'brew install act',
                    'Nix': 'nix run nixpkgs#act',
                    'MacPorts': 'sudo port install act',
                    'GitHub CLI': 'gh extension install https://github.com/nektos/gh-act'
                };

                this.prebuiltExecutables = {
                    'macOS 64-bit (Apple Silicon)': 'https://github.com/nektos/act/releases/latest/download/act_Darwin_arm64.tar.gz',
                    'macOS 64-bit (Intel)': 'https://github.com/nektos/act/releases/latest/download/act_Darwin_x86_64.tar.gz'
                };
                break;
            case 'linux':
                this.installationCommands = {
                    'Homebrew': 'brew install act',
                    'Nix': 'nix run nixpkgs#act',
                    'AUR': 'yay -Syu act',
                    'COPR': 'dnf copr enable goncalossilva/act && dnf install act-cli',
                    'GitHub CLI': 'gh extension install https://github.com/nektos/gh-act'
                };

                this.prebuiltExecutables = {
                    'Linux 64-bit (arm64/aarch64)': 'https://github.com/nektos/act/releases/latest/download/act_Linux_arm64.tar.gz',
                    'Linux 64-bit (amd64/x86_64)': 'https://github.com/nektos/act/releases/latest/download/act_Linux_x86_64.tar.gz',
                    'Linux 32-bit (armv7)': 'https://github.com/nektos/act/releases/latest/download/act_Linux_armv7.tar.gz',
                    'Linux 32-bit (armv6)': 'https://github.com/nektos/act/releases/latest/download/act_Linux_armv6.tar.gz',
                    'Linux 32-bit (i386/x86)': 'https://github.com/nektos/act/releases/latest/download/act_Linux_i386.tar.gz',
                };
                break;
            default:
                this.installationCommands = {};
                this.prebuiltExecutables = {};
        }
    }

    async runAllWorkflows(workspaceFolder: WorkspaceFolder) {
        return await this.runCommand({
            workspaceFolder: workspaceFolder,
            options: ``,
            name: workspaceFolder.name,
            typeText: []
        });
    }

    async runWorkflow(workspaceFolder: WorkspaceFolder, workflow: Workflow) {
        return await this.runCommand({
            workspaceFolder: workspaceFolder,
            options: `${Option.Workflows} ".github/workflows/${path.parse(workflow.uri.fsPath).base}"`,
            name: workflow.name,
            typeText: [
                `Workflow:     ${workflow.name}`
            ]
        });
    }

    async runJob(workspaceFolder: WorkspaceFolder, workflow: Workflow, job: Job) {
        return await this.runCommand({
            workspaceFolder: workspaceFolder,
            options: `${Option.Workflows} ".github/workflows/${path.parse(workflow.uri.fsPath).base}" ${Option.Job} "${job.id}"`,
            name: `${workflow.name}/${job.name}`,
            typeText: [
                `Workflow:     ${workflow.name}`,
                `Job:          ${job.name}`
            ]
        });
    }

    async runEvent(workspaceFolder: WorkspaceFolder, event: Event) {
        return await this.runCommand({
            workspaceFolder: workspaceFolder,
            options: event,
            name: event,
            typeText: [
                `Event:        ${event}`
            ]
        });
    }

    async runCommand(commandArgs: CommandArgs) {
        const command = `${Act.base} ${Option.Json} ${commandArgs.options}`;

        const unreadyComponents = await this.componentsManager.getUnreadyComponents();
        if (unreadyComponents.length > 0) {
            window.showErrorMessage(`The following required components are not ready: ${unreadyComponents.map(component => component.name).join(', ')}`, 'Fix...').then(async value => {
                if (value === 'Fix...') {
                    await commands.executeCommand('components.focus');
                }
            });
            return;
        }

        if (!this.historyManager.workspaceHistory[commandArgs.workspaceFolder.uri.fsPath]) {
            this.historyManager.workspaceHistory[commandArgs.workspaceFolder.uri.fsPath] = [];
            this.storageManager.update(StorageKey.WorkspaceHistory, this.historyManager.workspaceHistory);
        }

        const historyIndex = this.historyManager.workspaceHistory[commandArgs.workspaceFolder.uri.fsPath].length;
        const taskExecution = await tasks.executeTask({
            name: commandArgs.name,
            detail: 'Run workflow',
            definition: { type: 'GitHub Local Actions' },
            source: 'GitHub Local Actions',
            scope: commandArgs.workspaceFolder || TaskScope.Workspace,
            isBackground: true,
            presentationOptions: {
                reveal: TaskRevealKind.Always,
                focus: false,
                clear: true,
                close: false,
                echo: true,
                panel: TaskPanelKind.Dedicated,
                showReuseMessage: false
            },
            problemMatchers: [],
            runOptions: {},
            group: TaskGroup.Build,
            execution: new CustomExecution(async (resolvedDefinition: TaskDefinition): Promise<Pseudoterminal> => {
                const writeEmitter = new EventEmitter<string>();
                const closeEmitter = new EventEmitter<number>();

                writeEmitter.event(data => {
                    if (!this.historyManager.workspaceHistory[commandArgs.workspaceFolder.uri.fsPath][historyIndex].output) {
                        this.historyManager.workspaceHistory[commandArgs.workspaceFolder.uri.fsPath][historyIndex].output = data;
                    } else {
                        this.historyManager.workspaceHistory[commandArgs.workspaceFolder.uri.fsPath][historyIndex].output += data;
                    }
                    this.storageManager.update(StorageKey.WorkspaceHistory, this.historyManager.workspaceHistory);
                });

                const exec = child_process.spawn(command, { cwd: commandArgs.workspaceFolder.uri.fsPath, shell: env.shell });
                const setDate = (actDate?: string) => {
                    const date = actDate ? new Date(actDate).toString() : new Date().toString();

                    if (!this.historyManager.workspaceHistory[commandArgs.workspaceFolder.uri.fsPath][historyIndex].date) {
                        this.historyManager.workspaceHistory[commandArgs.workspaceFolder.uri.fsPath][historyIndex].date = {
                            start: date,
                            end: date,
                        }
                    } else {
                        this.historyManager.workspaceHistory[commandArgs.workspaceFolder.uri.fsPath][historyIndex].date!.end = date;
                    }
                }
                const handleIO = (data: any) => {
                    if (typeof this.historyManager.workspaceHistory[commandArgs.workspaceFolder.uri.fsPath][historyIndex] === 'undefined') {
                        this.historyManager.workspaceHistory[commandArgs.workspaceFolder.uri.fsPath].push({
                            index: historyIndex,
                            name: `${commandArgs.name} #${this.historyManager.workspaceHistory[commandArgs.workspaceFolder.uri.fsPath].length + 1}`,
                            status: HistoryStatus.Running,
                            taskExecution: taskExecution,
                            commandArgs: commandArgs
                        });
                        historyTreeDataProvider.refresh();
                        this.storageManager.update(StorageKey.WorkspaceHistory, this.historyManager.workspaceHistory);
                    }

                    const lines: string[] = data.toString().split('\n').filter((line: string) => line != '');
                    for (const line of lines) {
                        let jsonLine: any;
                        try {
                            jsonLine = JSON.parse(line);
                        } catch (error) {
                            jsonLine = {
                                time: new Date().toString(),
                                msg: line
                            }
                        }
                        setDate(jsonLine.time);

                        if (jsonLine.jobResult) {
                            switch (jsonLine.jobResult) {
                                case 'success':
                                    this.historyManager.workspaceHistory[commandArgs.workspaceFolder.uri.fsPath][historyIndex].status = HistoryStatus.Success;
                                    break;
                                case 'failure':
                                    this.historyManager.workspaceHistory[commandArgs.workspaceFolder.uri.fsPath][historyIndex].status = HistoryStatus.Failed;
                                    break;
                            }
                        }

                        historyTreeDataProvider.refresh();
                        this.storageManager.update(StorageKey.WorkspaceHistory, this.historyManager.workspaceHistory);
                        writeEmitter.fire(`${jsonLine.msg.trimEnd()}\r\n`);
                    }
                }
                exec.stdout.on('data', handleIO);
                exec.stderr.on('data', handleIO);
                exec.on('close', (code) => {
                    setDate();

                    if (this.historyManager.workspaceHistory[commandArgs.workspaceFolder.uri.fsPath][historyIndex].status === HistoryStatus.Running) {
                        this.historyManager.workspaceHistory[commandArgs.workspaceFolder.uri.fsPath][historyIndex].status = HistoryStatus.Failed;
                    }

                    historyTreeDataProvider.refresh();
                    this.storageManager.update(StorageKey.WorkspaceHistory, this.historyManager.workspaceHistory);
                    closeEmitter.fire(code || 0);
                });

                return {
                    onDidWrite: writeEmitter.event,
                    onDidClose: closeEmitter.event,
                    open: async (initialDimensions: TerminalDimensions | undefined): Promise<void> => {
                        writeEmitter.fire(`Name:         ${commandArgs.name}\r\n`);
                        writeEmitter.fire(`Path:         ${commandArgs.workspaceFolder.uri.fsPath}\r\n`);
                        for (const text of commandArgs.typeText) {
                            writeEmitter.fire(`${text}\r\n`);
                        }
                        writeEmitter.fire(`Environments: OSSBUILD\r\n`);
                        writeEmitter.fire(`Variables:    VARIABLE1=ABC, VARIABLE2=DEF\r\n`);
                        writeEmitter.fire(`Secrets:      SECRET1=ABC, SECRET2=DEF\r\n`);
                        writeEmitter.fire(`Command:      ${command.replace(` ${Option.Json}`, ``)}\r\n`);
                        writeEmitter.fire(`\r\n`);
                    },

                    close: () => {
                        if (this.historyManager.workspaceHistory[commandArgs.workspaceFolder.uri.fsPath][historyIndex].status === HistoryStatus.Running) {
                            this.historyManager.workspaceHistory[commandArgs.workspaceFolder.uri.fsPath][historyIndex].status = HistoryStatus.Cancelled;
                        }

                        historyTreeDataProvider.refresh();
                        this.storageManager.update(StorageKey.WorkspaceHistory, this.historyManager.workspaceHistory);

                        exec.stdout.destroy();
                        exec.stdin.destroy();
                        exec.stderr.destroy();
                        exec.kill();
                    }
                };
            })
        });
        this.storageManager.update(StorageKey.WorkspaceHistory, this.historyManager.workspaceHistory);
    }

    async install(packageManager: string) {
        const command = this.installationCommands[packageManager];
        if (command) {
            await tasks.executeTask({
                name: 'nektos/act',
                detail: 'Install nektos/act',
                definition: { type: 'GitHub Local Actions' },
                source: 'GitHub Local Actions',
                scope: TaskScope.Workspace,
                isBackground: true,
                presentationOptions: {
                    reveal: TaskRevealKind.Always,
                    focus: false,
                    clear: true,
                    close: false,
                    echo: true,
                    panel: TaskPanelKind.Shared,
                    showReuseMessage: false
                },
                problemMatchers: [],
                runOptions: {},
                group: TaskGroup.Build,
                execution: new ShellExecution(command)
            });
        }
    }
}