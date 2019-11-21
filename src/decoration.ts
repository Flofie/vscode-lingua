import { TextEditor, DecorationOptions, Range, window, Position, ThemeColor, extensions, workspace } from 'vscode';
import { TranslationSet } from './translation/translation-set';
import { LinguaSettings } from './lingua-settings';

const translationDecoration = window.createTextEditorDecorationType({
    textDecoration: 'underline #494949',
});

const potentialIdentifierDecoration = window.createTextEditorDecorationType({
    light: {
        textDecoration: 'underline #b7950b wavy',
    },
    dark: {
        textDecoration: 'underline #b7950b wavy',
    },
});

/**
 * Scan editor content for possible translations paths and decorate the translation paths
 * with a hover overlay containing the translation
 */
export function updateTranslationDecorations(
    editor: TextEditor,
    settings: LinguaSettings,
    translationSet: TranslationSet
) {
    if (!editor || translationSet.isEmpty()) {
        return;
    }

    const regEx = /['|"|`]([a-zA-Z0-9\.\_\-]+)['|"|`]/gm;
    const text = editor.document.getText();
    const translationDecorations: DecorationOptions[] = [];
    const identifierDecorations: DecorationOptions[] = [];

    let match;
    while ((match = regEx.exec(text))) {
        let path = match[0].replace(/['|"|`]/g, '').trim();
        path = path
            .split('.')
            .filter(seg => seg.length > 0)
            .join('.');

        const translation = translationSet.hasTranslation(path);
        const isPartialTranslation = translationSet.isPartialMatch(path);
        const startPos = editor.document.positionAt(match.index + 1);
        const endPos = editor.document.positionAt(match.index + match[0].length - 1);
        const n = settings.decoration.maxTranslationLength;

        if (translation) {
            // Translation availble
            const shortTranslation = translation.length > n ? translation.substr(0, n - 1) + '...' : translation;
            const decoration = getDecoration(
                settings.decoration.showInlineTranslation,
                startPos,
                endPos,
                shortTranslation
            );
            translationDecorations.push(decoration);
        } else if (isPartialTranslation) {
            // Partial translation
            const shortPath = path.length > n ? path.substr(0, n - 1) + '...' : path;
            const decoration = getDecoration(false, startPos, endPos, 'Translations available: ' + shortPath + ' ...');
            translationDecorations.push(decoration);
        } else if (settings.decoration.showPotentialIdentifieres) {
            // Possible identifer without translation
            const decoration = {
                range: new Range(startPos, endPos),
            };
            identifierDecorations.push(decoration);
        }
    }

    editor.setDecorations(translationDecoration, translationDecorations);
    editor.setDecorations(potentialIdentifierDecoration, identifierDecorations);
}

function getDecoration(showInline: boolean, from: Position, to: Position, translation: string) {
    if (showInline) {
        return {
            range: new Range(from, to),
            hoverMessage: translation,
            renderOptions: {
                after: {
                    contentText: ' • ' + translation,
                    color: { id: 'lingua.lookupColor' },
                },
            },
        };
    } else {
        return {
            range: new Range(from, to),
            hoverMessage: translation,
        };
    }
}
