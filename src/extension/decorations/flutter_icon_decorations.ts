import * as vs from "vscode";
import { FlutterOutline } from "../../shared/analysis_server_types";
import { Logger } from "../../shared/interfaces";
import { fsPath } from "../../shared/utils/fs";
import { docsIconPathFormat } from "../../shared/vscode/extension_utils";
import { IconRangeComputer } from "../../shared/vscode/icon_range_computer";
import { DasAnalyzer } from "../analysis/analyzer_das";
import { isAnalyzable } from "../utils";

export class FlutterIconDecorations implements vs.Disposable {
	private readonly subscriptions: vs.Disposable[] = [];
	private readonly computer: IconRangeComputer;
	private activeEditor?: vs.TextEditor;

	private readonly decorationTypes: { [key: string]: vs.TextEditorDecorationType } = {};

	constructor(private readonly logger: Logger, private readonly analyzer: DasAnalyzer) {
		this.computer = new IconRangeComputer(logger);
		this.subscriptions.push(this.analyzer.client.registerForFlutterOutline(async (n) => {
			if (this.activeEditor && fsPath(this.activeEditor.document.uri) === n.file) {
				this.update(n.outline);
			}
		}));

		this.subscriptions.push(vs.window.onDidChangeActiveTextEditor((e) => {
			this.setTrackingFile(e);
			this.update();
		}));
		if (vs.window.activeTextEditor) {
			this.setTrackingFile(vs.window.activeTextEditor);
			this.update();
		}
	}

	private update(outline?: FlutterOutline) {
		if (!this.activeEditor)
			return;

		if (!outline)
			outline = this.analyzer.fileTracker.getFlutterOutlineFor(this.activeEditor.document.uri);

		if (!outline)
			return;

		const results = this.computer.compute(this.activeEditor.document, outline);

		// Each icon type needs to be its own decoration, so here we update our main list
		// with any new ones we hadn't previously created.
		for (const iconName of Object.keys(results)) {
			if (!this.decorationTypes[iconName])
				this.decorationTypes[iconName] = vs.window.createTextEditorDecorationType({
					gutterIconPath: vs.Uri.parse(docsIconPathFormat.replace("$1", iconName)),
					gutterIconSize: "75%",
				});
		}

		for (const iconName of Object.keys(this.decorationTypes)) {
			this.activeEditor.setDecorations(
				this.decorationTypes[iconName],
				results[iconName] || [],
			);
		}
	}

	private setTrackingFile(editor: vs.TextEditor | undefined) {
		if (editor && isAnalyzable(editor.document)) {
			this.activeEditor = editor;
		} else
			this.activeEditor = undefined;
	}

	public dispose() {
		this.activeEditor = undefined;
		this.subscriptions.forEach((s) => s.dispose());
	}
}
