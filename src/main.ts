import { MarkdownView, Modal, Notice, Plugin } from "obsidian";
import type { Client } from "@atcute/client";
import { type PluginSettings, DEFAULT_SETTINGS, MystSettingTab } from "src/settings";
import { registerReadingMode } from "src/reading";
import { registerEditorExtensions } from "src/editor";
import { HtmlExporter } from "src/export/html-exporter";
import type { IAtpAuthManager } from "src/auth";
import { publishNoteToPds } from "src/export/publish";
import { importOxaToMarkdown, parseAtUri } from "src/export/import";

const ATP_OAUTH_CLIENT_ID = "https://codegod100.github.io/obsidian-callback/clients/myst.json";
const ATP_OAUTH_REDIRECT_URI = "https://codegod100.github.io/obsidian-callback/callback-myst.html";
const ATP_OAUTH_SCOPE = "atproto transition:generic";
const ATP_PROTOCOL_SCHEME = "myst-oauth";

class LazyAtpAuthManager implements IAtpAuthManager {
	private plugin: MystPlugin;
	private inner: IAtpAuthManager | null = null;
	private initialized = false;

	constructor(plugin: MystPlugin) {
		this.plugin = plugin;
	}

	private async load(): Promise<IAtpAuthManager> {
		if (!this.inner) {
			const { AtpAuthManager } = await import("src/auth");
			this.inner = new AtpAuthManager({
				plugin: this.plugin,
				protocolScheme: ATP_PROTOCOL_SCHEME,
				clientId: ATP_OAUTH_CLIENT_ID,
				redirectUri: ATP_OAUTH_REDIRECT_URI,
				scope: ATP_OAUTH_SCOPE,
			});
		}
		if (!this.initialized) {
			await this.inner.initialize();
			this.initialized = true;
		}
		return this.inner;
	}

	get client(): Client {
		if (!this.inner) {
			throw new Error("ATProto auth manager has not been initialized yet");
		}
		return this.inner.client;
	}

	get actor() {
		return this.inner?.actor;
	}

	get isLoggedIn() {
		return this.inner?.isLoggedIn ?? false;
	}

	get did() {
		return this.inner?.did;
	}

	get handle() {
		return this.inner?.handle;
	}

	async login(identifier: string): Promise<void> {
		const inner = await this.load();
		await inner.login(identifier);
	}

	async logout(): Promise<void> {
		const inner = await this.load();
		await inner.logout();
	}

	async checkAuth(): Promise<boolean> {
		const inner = await this.load();
		return inner.checkAuth();
	}
}

export default class MystPlugin extends Plugin {
	settings: PluginSettings;
	authManager: IAtpAuthManager;

	override async onload() {
		// Pyodide detects Electron as Node.js (process.release.name === "node")
		// and tries to import("node:url"), import("fs/promises"), etc.
		// Setting process.browser = true forces the browser code path.
		// Must be set before any Pyodide <script> tag loads.
		if (typeof process !== "undefined" && !(process as any).browser) {
			(process as any).browser = true;
		}

		await this.loadSettings();
		this.addSettingTab(new MystSettingTab(this.app, this));

		registerReadingMode(this);
		registerEditorExtensions(this);

		// ATProto auth
		this.authManager = new LazyAtpAuthManager(this);

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

		// ATProto import command
		this.addCommand({
			id: "import-atproto-oxa",
			name: "Import from ATProto OXA record",
			callback: () => {
				new ImportUriModal(this.app, async (uri, filename) => {
					await this.importFromAtproto(uri, filename);
				}).open();
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
			const client = this.authManager.client;
			const result = await publishNoteToPds(data, client, did);
			new Notice(`Published: ${result.uri}`);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(`Publish failed: ${msg}`);
			console.error("ATProto publish error:", err);
		}
	}

	private async importFromAtproto(uri: string, filename: string): Promise<void> {
		try {
			parseAtUri(uri);
		} catch (err) {
			new Notice(err instanceof Error ? err.message : String(err));
			return;
		}

		try {
			new Notice("Fetching record from ATProto...");
			const client = this.authManager.client;
			const markdown = await importOxaToMarkdown(client, uri);

			const name = filename.endsWith(".md") ? filename : `${filename}.md`;
			const file = await this.app.vault.create(name, markdown);
			await this.app.workspace.getLeaf(false).openFile(file);
			new Notice(`Imported: ${name}`);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(`Import failed: ${msg}`);
			console.error("ATProto import error:", err);
		}
	}
}

// ---------------------------------------------------------------------------
// Import URI modal
// ---------------------------------------------------------------------------

class ImportUriModal extends Modal {
	private onSubmit: (uri: string, filename: string) => void;

	constructor(app: any, onSubmit: (uri: string, filename: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	override onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Import from ATProto" });

		const form = contentEl.createEl("form");

		const uriLabel = form.createEl("label", { text: "AT URI" });
		uriLabel.style.display = "block";
		uriLabel.style.marginBottom = "4px";
		uriLabel.style.fontWeight = "bold";
		const uriInput = form.createEl("input", {
			type: "text",
			placeholder: "at://did:plc:.../pub.oxa.document/rkey",
			cls: "myst-import-uri-input",
		});
		uriInput.style.width = "100%";
		uriInput.style.marginBottom = "12px";

		const nameLabel = form.createEl("label", { text: "Note name" });
		nameLabel.style.display = "block";
		nameLabel.style.marginBottom = "4px";
		nameLabel.style.fontWeight = "bold";
		const nameInput = form.createEl("input", {
			type: "text",
			placeholder: "imported-note",
			cls: "myst-import-name-input",
		});
		nameInput.style.width = "100%";
		nameInput.style.marginBottom = "12px";

		// Pre-fill note name from rkey when URI changes
		uriInput.addEventListener("input", () => {
			const uri = uriInput.value.trim();
			try {
				const { rkey } = parseAtUri(uri);
				if (rkey && !nameInput.value) {
					nameInput.value = rkey;
				}
			} catch {
				// not a valid URI yet, ignore
			}
		});

		form.createEl("button", { text: "Import", cls: "mod-cta" });

		form.addEventListener("submit", (e) => {
			e.preventDefault();
			const uri = uriInput.value.trim();
			if (!uri) {
				new Notice("Please enter an AT URI");
				return;
			}
			const name = nameInput.value.trim() || (() => {
				try { return parseAtUri(uri).rkey; } catch { return "imported-note"; }
			})();
			this.close();
			this.onSubmit(uri, name);
		});

		uriInput.focus();
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}
