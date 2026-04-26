import { MarkdownView, Plugin } from "obsidian";
import { type PluginSettings, DEFAULT_SETTINGS, MystSettingTab } from "src/settings";
import { registerReadingMode } from "src/reading";
import { registerEditorExtensions } from "src/editor";
import { HtmlExporter } from "src/export/html-exporter";

export default class MystPlugin extends Plugin {
	settings: PluginSettings;

	override async onload() {
		await this.loadSettings();
		this.addSettingTab(new MystSettingTab(this.app, this));

		registerReadingMode(this);
		registerEditorExtensions(this);

		this.addCommand({
			id: "export-html-clipboard",
			name: "Copy to clipboard as HTML",
			checkCallback: (checking: boolean) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view) return false;
				if (!checking) {
					const exporter = new HtmlExporter(this.app, this);
					exporter.copyToClipboard();
				}
				return true;
			},
		});

		this.addCommand({
			id: "export-html-download",
			name: "Download as HTML",
			checkCallback: (checking: boolean) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view) return false;
				if (!checking) {
					const exporter = new HtmlExporter(this.app, this);
					exporter.downloadAsFile();
				}
				return true;
			},
		});

		console.log("MyST plugin loaded");
	}

	override onunload() {
		console.log("MyST plugin unloaded");
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
