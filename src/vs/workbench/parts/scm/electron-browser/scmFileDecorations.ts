/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IResourceDecorationsService, IDecorationsProvider, IResourceDecoration } from 'vs/workbench/services/decorations/browser/decorations';
import { IDisposable, dispose, combinedDisposable } from 'vs/base/common/lifecycle';
import { ISCMService, ISCMRepository, ISCMProvider } from 'vs/workbench/services/scm/common/scm';
import URI from 'vs/base/common/uri';
import Severity from 'vs/base/common/severity';
import Event, { Emitter } from 'vs/base/common/event';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { localize } from 'vs/nls';

class SCMDecorationsProvider implements IDecorationsProvider {

	private readonly _disposable: IDisposable;
	private readonly _onDidChange = new Emitter<URI[]>();

	readonly label: string;
	readonly onDidChange: Event<URI[]> = this._onDidChange.event;

	constructor(
		private readonly _provider: ISCMProvider
	) {
		this.label = this._provider.label;
		this._disposable = this._provider.onDidChangeResources(this._updateGroups, this);
		this._updateGroups();
	}

	dispose(): void {
		this._disposable.dispose();
	}

	private _updateGroups(): void {
		const uris: URI[] = [];
		for (const group of this._provider.resources) {
			for (const resource of group.resourceCollection.resources) {
				uris.push(resource.sourceUri);
			}
		}
		this._onDidChange.fire(uris);
	}

	provideDecorations(uri: URI): IResourceDecoration {
		for (const group of this._provider.resources) {
			for (const resource of group.resourceCollection.resources) {
				if (resource.sourceUri.toString() === uri.toString()) {
					return {
						severity: Severity.Info,
						color: resource.decorations.color,
						suffix: '*',
						tooltip: localize('tooltip', "{0} - {1}", resource.decorations.tooltip, this._provider.label),
						icon: { light: resource.decorations.icon, dark: resource.decorations.iconDark }
					};
				}
			}
		}
		return undefined;
	}
}

export class FileDecorations implements IWorkbenchContribution {

	private _providers = new Map<ISCMRepository, IDisposable>();
	private _configListener: IDisposable;
	private _repoListeners: IDisposable[];

	constructor(
		@IResourceDecorationsService private _decorationsService: IResourceDecorationsService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@ISCMService private _scmService: ISCMService,
	) {
		this._configListener = this._configurationService.onDidUpdateConfiguration(this._update, this);
		this._update();
	}

	getId(): string {
		throw new Error('smc.SCMFileDecorations');
	}

	dispose(): void {
		this._providers.forEach(value => dispose(value));
		dispose(this._repoListeners);
		dispose(this._configListener, this._configListener);
	}

	private _update(): void {
		const value = this._configurationService.getConfiguration<{ fileDecorations: { enabled: boolean } }>('scm');
		if (value.fileDecorations.enabled) {
			this._scmService.repositories.forEach(this._onDidAddRepository, this);
			this._repoListeners = [
				this._scmService.onDidAddRepository(this._onDidAddRepository, this),
				this._scmService.onDidRemoveRepository(this._onDidRemoveRepository, this)
			];
		} else {
			this._providers.forEach(value => dispose(value));
			this._repoListeners = dispose(this._repoListeners);
		}
	}

	private _onDidAddRepository(repo: ISCMRepository): void {
		const provider = new SCMDecorationsProvider(repo.provider);
		const registration = this._decorationsService.registerDecortionsProvider(provider);
		this._providers.set(repo, combinedDisposable([registration, provider]));
	}

	private _onDidRemoveRepository(repo: ISCMRepository): void {
		let listener = this._providers.get(repo);
		if (listener) {
			this._providers.delete(repo);
			listener.dispose();
		}
	}
}