import { Plugin } from "obsidian";
import { type PluginSettings, DEFAULT_SETTINGS, MystSettingTab } from "src/settings";
import { registerReadingMode } from "src/reading";
import { registerEditorExtensions } from "src/editor";

export default class MystPlugin extends Plugin {
	settings: PluginSettings;

	override async onload() {
		await this.loadSettings();
		this.addSettingTab(new MystSettingTab(this.app, this));

		registerReadingMode(this);
		registerEditorExtensions(this);

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
