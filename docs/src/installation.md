# Installation

## From community plugins (once published)

Once the plugin is accepted into the Obsidian Community Plugin list:

1. Open **Settings → Community plugins**
2. Click **Browse**
3. Search for "MyST Markdown"
4. Click **Install**, then **Enable**

## Manual installation

1. Clone the repository:
   ```bash
   git clone https://github.com/codegod100/obsidian-myst.git
   cd obsidian-myst
   ```

2. Install dependencies and build:
   ```bash
   npm install --legacy-peer-deps
   npm run build
   ```

3. Copy the plugin files into your vault:
   ```bash
   cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/myst/
   ```

4. Enable the plugin in **Settings → Community plugins**.

## Via BRAT

If you use the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat):

1. Open **BRAT → Beta Plugin List**
2. Add `codegod100/obsidian-myst`
3. Enable the plugin after installation.

## Verify

After enabling, open the developer console (Ctrl+Shift+I). You should see:

```
MyST plugin loaded
```

The plugin settings panel should appear under **Settings → Community plugins → MyST Markdown**.
