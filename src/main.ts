import { MarkdownView, Notice, Plugin } from "obsidian";
import { type PluginSettings, DEFAULT_SETTINGS, MystSettingTab } from "src/settings";
import { registerReadingMode } from "src/reading";
import { registerEditorExtensions } from "src/editor";
import { HtmlExporter } from "src/export/html-exporter";
import { AtpAuthManager } from "src/auth";
import { publishNoteToPds } from "src/export/publish";

const ATP_OAUTH_CLIENT_ID = "https://codegod100.github.io/obsidian-myst/oauth-client-metadata.json";
const ATP_OAUTH_REDIRECT_URI = "https://codegod100.github.io/obsidian-callback/";
const ATP_OAUTH_SCOPE = "atproto transition:generic";
const ATP_PROTOCOL_SCHEME = "obsidian-myst-oauth";

export default class MystPlugin extends Plugin {
	settings: PluginSettings;
	authManager: AtpAuthManager;

	override async onload() {
		await this.loadSettings();
		this.addSettingTab(new MystSettingTab(this.app, this));

		registerReadingMode(this);
		registerEditorExtensions(this);

		// ATProto auth
		this.authManager = new AtpAuthManager({
			plugin: this,
			protocolScheme: ATP_PROTOCOL_SCHEME,
			clientId: ATP_OAUTH_CLIENT_ID,
			redirectUri: ATP_OAUTH_REDIRECT_URI,
			scope: ATP_OAUTH_SCOPE,
		});
		await this.authManager.initialize();

		// HTML export commands
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

		// ATProto publish command
		this.addCommand({
			id: "publish-atproto-oxa",
			name: "Publish to ATProto as OXA document",
			checkCallback: (checking: boolean) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view) return false;
				if (!checking) {
					this.publishCurrentNote();
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

	private async publishCurrentNote(): Promise<void> {
		const authed = await this.authManager.checkAuth();
		if (!authed) return;

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) {
			new Notice("No active markdown view");
			return;
		}

		const data = view.data;
		if (!data) {
			new Notice("No content to publish");
			return;
		}

		const did = this.authManager.did;
		if (!did) {
			new Notice("Not authenticated");
			return;
		}

		try {
			new Notice("Publishing to ATProto...");
			const result = await publishNoteToPds(data, this.authManager.client, did);
			new Notice(`Published: ${result.uri}`);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(`Publish failed: ${msg}`);
			console.error("ATProto publish error:", err);
		}
	}
}
