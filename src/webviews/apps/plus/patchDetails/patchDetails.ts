/*global*/
import { ViewFilesLayout } from '../../../../config';
import type { State } from '../../../../plus/webviews/patchDetails/protocol';
import {
	DidChangeNotificationType,
	DidExplainCommandType,
	ExplainCommandType,
	FileActionsCommandType,
	OpenFileCommandType,
	OpenFileComparePreviousCommandType,
	OpenFileCompareWorkingCommandType,
	OpenFileOnRemoteCommandType,
	SelectPatchBaseCommandType,
	SelectPatchRepoCommandType,
	UpdatePreferencesCommandType,
} from '../../../../plus/webviews/patchDetails/protocol';
import type { Serialized } from '../../../../system/serialize';
import type { IpcMessage } from '../../../protocol';
import { ExecuteCommandType, onIpc } from '../../../protocol';
import { App } from '../../shared/appBase';
import type { FileChangeListItem, FileChangeListItemDetail } from '../../shared/components/list/file-change-list-item';
import { DOM } from '../../shared/dom';
import type {
	ApplyPatchDetail,
	ChangePatchBaseDetail,
	GlPatchDetailsApp,
	SelectPatchRepoDetail,
	ShowPatchInGraphDetail,
} from './components/patch-details-app';
import './patchDetails.scss';
import '../../shared/components/actions/action-item';
import '../../shared/components/actions/action-nav';
import '../../shared/components/button';
import '../../shared/components/code-icon';
import '../../shared/components/commit/commit-identity';
import '../../shared/components/formatted-date';
import '../../shared/components/rich/issue-pull-request';
import '../../shared/components/skeleton-loader';
import '../../shared/components/commit/commit-stats';
import '../../shared/components/webview-pane';
import '../../shared/components/progress';
import '../../shared/components/list/list-container';
import '../../shared/components/list/list-item';
import '../../shared/components/list/file-change-list-item';
import './components/patch-details-app';

export const uncommittedSha = '0000000000000000000000000000000000000000';

export class PatchDetailsApp extends App<Serialized<State>> {
	constructor() {
		super('PatchDetailsApp');
	}

	override onInitialize() {
		this.attachState();
	}

	override onBind() {
		const disposables = [
			DOM.on<FileChangeListItem, FileChangeListItemDetail>('file-change-list-item', 'file-open-on-remote', e =>
				this.onOpenFileOnRemote(e.detail),
			),
			DOM.on<FileChangeListItem, FileChangeListItemDetail>('file-change-list-item', 'file-open', e =>
				this.onOpenFile(e.detail),
			),
			DOM.on<FileChangeListItem, FileChangeListItemDetail>('file-change-list-item', 'file-compare-working', e =>
				this.onCompareFileWithWorking(e.detail),
			),
			DOM.on<FileChangeListItem, FileChangeListItemDetail>('file-change-list-item', 'file-compare-previous', e =>
				this.onCompareFileWithPrevious(e.detail),
			),
			DOM.on<FileChangeListItem, FileChangeListItemDetail>('file-change-list-item', 'file-more-actions', e =>
				this.onFileMoreActions(e.detail),
			),
			DOM.on('[data-switch-value]', 'click', e => this.onToggleFilesLayout(e)),
			DOM.on('[data-action="ai-explain"]', 'click', e => this.onAIExplain(e)),
			DOM.on('[data-action="switch-ai"]', 'click', e => this.onSwitchAIModel(e)),
			DOM.on<GlPatchDetailsApp, ApplyPatchDetail>('gl-patch-details-app', 'apply-patch', e =>
				this.onApplyPatch(e.detail),
			),
			DOM.on<GlPatchDetailsApp, ChangePatchBaseDetail>('gl-patch-details-app', 'change-patch-base', e =>
				this.onChangePatchBase(e.detail),
			),
			DOM.on<GlPatchDetailsApp, SelectPatchRepoDetail>('gl-patch-details-app', 'select-patch-repo', e =>
				this.onSelectPatchRepo(e.detail),
			),
			DOM.on<GlPatchDetailsApp, ShowPatchInGraphDetail>('gl-patch-details-app', 'graph-show-patch', e =>
				this.onSelectPatchRepo(e.detail),
			),
		];

		return disposables;
	}

	protected override onMessageReceived(e: MessageEvent) {
		const msg = e.data as IpcMessage;
		this.log(`onMessageReceived(${msg.id}): name=${msg.method}`);

		switch (msg.method) {
			// case DidChangeRichStateNotificationType.method:
			// 	onIpc(DidChangeRichStateNotificationType, msg, params => {
			// 		if (this.state.selected == null) return;

			// 		assertsSerialized<typeof params>(params);

			// 		const newState = { ...this.state };
			// 		if (params.formattedMessage != null) {
			// 			newState.selected!.message = params.formattedMessage;
			// 		}
			// 		// if (params.pullRequest != null) {
			// 		newState.pullRequest = params.pullRequest;
			// 		// }
			// 		// if (params.formattedMessage != null) {
			// 		newState.autolinkedIssues = params.autolinkedIssues;
			// 		// }

			// 		this.state = newState;
			// 		this.setState(this.state);

			// 		this.renderRichContent();
			// 	});
			// 	break;
			case DidChangeNotificationType.method:
				onIpc(DidChangeNotificationType, msg, params => {
					assertsSerialized<State>(params.state);

					this.state = params.state;
					this.setState(this.state);
					this.attachState();
				});
				break;

			default:
				super.onMessageReceived?.(e);
		}
	}

	private onApplyPatch(e: ApplyPatchDetail) {
		console.log('onApplyPatch', e);
	}

	private onChangePatchBase(e: ChangePatchBaseDetail) {
		console.log('onChangePatchBase', e);
		this.sendCommand(SelectPatchBaseCommandType, undefined);
	}

	private onSelectPatchRepo(e: SelectPatchRepoDetail) {
		console.log('onSelectPatchRepo', e);
		this.sendCommand(SelectPatchRepoCommandType, undefined);
	}

	private onCommandClickedCore(action?: string) {
		const command = action?.startsWith('command:') ? action.slice(8) : action;
		if (command == null) return;

		this.sendCommand(ExecuteCommandType, { command: command });
	}

	private onSwitchAIModel(_e: MouseEvent) {
		this.onCommandClickedCore('gitlens.switchAIModel');
	}

	async onAIExplain(_e: MouseEvent) {
		try {
			const result = await this.sendCommandWithCompletion(ExplainCommandType, undefined, DidExplainCommandType);

			if (result.error) {
				this.component.explain = { error: { message: result.error.message ?? 'Error retrieving content' } };
			} else if (result.summary) {
				this.component.explain = { summary: result.summary };
			} else {
				this.component.explain = undefined;
				this.component.explainBusy = false;
			}
		} catch (ex) {
			this.component.explain = { error: { message: 'Error retrieving content' } };
		}
	}

	private onToggleFilesLayout(e: MouseEvent) {
		const layout = ((e.target as HTMLElement)?.dataset.switchList as ViewFilesLayout) ?? undefined;
		if (layout === this.state.preferences?.files?.layout) return;

		const files = {
			...this.state.preferences?.files,
			layout: layout ?? ViewFilesLayout.Auto,
			compact: this.state.preferences?.files?.compact ?? true,
			threshold: this.state.preferences?.files?.threshold ?? 5,
			icon: this.state.preferences?.files?.icon ?? 'type',
		};

		this.state.preferences = {
			...this.state.preferences,
			files: files,
		};

		this.attachState();

		this.sendCommand(UpdatePreferencesCommandType, { files: files });
	}

	private onOpenFileOnRemote(e: FileChangeListItemDetail) {
		this.sendCommand(OpenFileOnRemoteCommandType, e);
	}

	private onOpenFile(e: FileChangeListItemDetail) {
		this.sendCommand(OpenFileCommandType, e);
	}

	private onCompareFileWithWorking(e: FileChangeListItemDetail) {
		this.sendCommand(OpenFileCompareWorkingCommandType, e);
	}

	private onCompareFileWithPrevious(e: FileChangeListItemDetail) {
		this.sendCommand(OpenFileComparePreviousCommandType, e);
	}

	private onFileMoreActions(e: FileChangeListItemDetail) {
		this.sendCommand(FileActionsCommandType, e);
	}

	private _component?: GlPatchDetailsApp;
	private get component() {
		if (this._component == null) {
			this._component = (document.getElementById('app') as GlPatchDetailsApp)!;
		}
		return this._component;
	}

	attachState() {
		this.component.state = this.state!;
	}
}

function assertsSerialized<T>(obj: unknown): asserts obj is Serialized<T> {}

new PatchDetailsApp();
