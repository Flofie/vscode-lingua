// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { workspace, languages, Disposable, window, Uri } from 'vscode';
import TranslationReportProvider from './translation/translation-report-provider';
import { TranslationSets } from './translation/translation-sets';
import { locateTranslation } from './translation/translation-locator';
import { assign } from 'lodash';
import { LinguaSettings } from './lingua-settings';
import { resolve } from 'dns';

var textEncoding = require('text-encoding');
var TextEncoder = textEncoding.TextEncoder;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
    const settings = await readSettings();

    let translationSets = new TranslationSets();

    const provider = new TranslationReportProvider(settings, translationSets);
    const providerRegistrations = Disposable.from(
        workspace.registerTextDocumentContentProvider(TranslationReportProvider.scheme, provider),
        languages.registerDocumentLinkProvider({ scheme: TranslationReportProvider.scheme }, provider)
    );
    context.subscriptions.push(provider, providerRegistrations);

    context.subscriptions.push(
        vscode.commands.registerCommand('lingua.analyse', async () => {
            updateTranslationSets(settings, translationSets).then(async () => {
                const uri = Uri.parse('lingua:report');
                const doc = await workspace.openTextDocument(uri);
                return await window.showTextDocument(doc);
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerTextEditorCommand('lingua.gotoTranslation', async editor => {
            updateTranslationSets(settings, translationSets).then(() => {
                const selection: vscode.Selection = editor.selection;
                const selectedText = editor.document.getText(selection);

                locateTranslation(translationSets.get['de'], selectedText);
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerTextEditorCommand('lingua.selectLocaleFile', async editor => {
            const localeUri = editor.document.uri;

            const locale = await window.showInputBox({
                placeHolder: "Enter the language locale if this file (e.g. 'de' or 'en')",
            });
            if (locale) {
                // TODO: fix this uri madness
                const uri = workspace.asRelativePath(localeUri.path);
                writeSettings(settings, 'translationFiles', [{ locale: locale, uri: uri }]);
            }
        })
    );
}

export function deactivate() {}

async function readSettings(): Promise<LinguaSettings> {
    if (workspace.workspaceFolders) {
        const linguaSettingsUrl = Uri.file(`${workspace.rootPath}/.lingua`);

        try {
            const doc = await workspace.openTextDocument(linguaSettingsUrl);
            const settings = assign(LinguaSettings.Default, JSON.parse(doc.getText()));

            if (!settings.hasOwnProperty['scanFiles']) {
                console.log("[Lingua] [Settings] Adding default scan files '['ts', 'html']'");
                settings.scanFiles = ['ts', 'html'];
            }
            return Promise.resolve(settings);
        } catch (e) {
            console.error(e);
        }
    }

    console.log('[Lingua] [Settings] Loading default settings...');
    return Promise.resolve(LinguaSettings.Default);
}

async function writeSettings(settings: LinguaSettings, key: string, value: any) {
    if (key in settings) {
        (settings as any)[key] = value;
    }

    if (workspace.workspaceFolders) {
        try {
            const uri = Uri.file(`${workspace.rootPath}/.lingua`);
            workspace.fs.writeFile(uri, new TextEncoder('utf-8').encode(JSON.stringify(settings, null, 2)));
            window.showInformationMessage('Lingua: Created a .lingua settings file in your workspace directory');
        } catch (e) {
            window.showErrorMessage(e);
        }
    }
}

async function updateTranslationSets(settings: LinguaSettings, translationSets: TranslationSets): Promise<void> {
    if (settings.translationFiles.length) {
        await translationSets.build(settings.translationFiles);
        return Promise.resolve();
    } else {
        window.showWarningMessage(
            'Lingua: There is no translation file *.json configured for this extension.\n' +
                'To use it, please navigate to your translation file and set it via the context menu\n' +
                " or by calling 'lingua:selectLocaleFile'"
        );
        return Promise.reject();
    }
}
