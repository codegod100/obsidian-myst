import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type MystPlugin from "src/main";

export interface PluginSettings {
	enableDirectives: boolean;
	enableRoles: boolean;
	enableDollarMath: boolean;
	enableCalloutBridge: boolean;
	enableEditorHighlighting: boolean;
	concealDirectiveFences: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	enableDirectives: true,
	enableRoles: true,
	enableDollarMath: true,
	enableCalloutBridge: true,
	enableEditorHighlighting: true,
	concealDirectiveFences: false,
};

export class MystSettingTab extends PluginSettingTab {
	plugin: MystPlugin;

	constructor(app: App, plugin: MystPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ATProto auth section
		containerEl.createEl("h2", { text: "ATProto" });

		if (this.plugin.authManager.isLoggedIn) {
			const handle = this.plugin.authManager.handle ?? "";
			const did = this.plugin.authManager.did ?? "";
			new Setting(containerEl)
				.setName("Logged in")
				.setDesc(`@${handle} (${did})`)
				.addButton((btn) =>
					btn.setButtonText("Logout").onClick(async () => {
						await this.plugin.authManager.logout();
						new Notice("Logged out");
						this.display();
					}),
				);
		} else {
			let identifier = "";
			new Setting(containerEl)
				.setName("ATProto login")
				.setDesc("Enter your handle or DID to authenticate")
				.addText((text) =>
					text
						.setPlaceholder("e.g. alice.bsky.social")
						.onChange((value) => {
							identifier = value;
						}),
				)
				.addButton((btn) =>
					btn.setButtonText("Login").onClick(async () => {
						if (!identifier) {
							new Notice("Enter a handle or DID");
							return;
						}
						try {
							await this.plugin.authManager.login(identifier);
							this.display();
						} catch (err) {
							const msg = err instanceof Error ? err.message : String(err);
							new Notice(`Login failed: ${msg}`);
						}
					}),
				);
		}

		// MyST settings section
		containerEl.createEl("h2", { text: "MyST" });

		new Setting(containerEl)
			.setName("Directives")
			.setDesc("Parse and render MyST directives (:::{name} ... :::)")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableDirectives)
					.onChange(async (value) => {
						this.plugin.settings.enableDirectives = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Roles")
			.setDesc("Parse and render MyST inline roles ({name}`content`)")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableRoles)
					.onChange(async (value) => {
						this.plugin.settings.enableRoles = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Dollar math")
			.setDesc("Render $...$ and $$...$$ math expressions")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableDollarMath)
					.onChange(async (value) => {
						this.plugin.settings.enableDollarMath = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Callout bridge")
			.setDesc("Map Obsidian callouts (> [!type]) to MyST admonitions")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableCalloutBridge)
					.onChange(async (value) => {
						this.plugin.settings.enableCalloutBridge = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Editor highlighting")
			.setDesc("Highlight MyST syntax in the editor (roles, directives, math)")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableEditorHighlighting)
					.onChange(async (value) => {
						this.plugin.settings.enableEditorHighlighting = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Conceal directive fences")
			.setDesc("Hide ::: fences in live preview mode")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.concealDirectiveFences)
					.onChange(async (value) => {
						this.plugin.settings.concealDirectiveFences = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
