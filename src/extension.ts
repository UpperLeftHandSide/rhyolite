import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { createFileLink, updateIndexFile } from './commands';

export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "rhyolite" is now active!');

	let createFileCommand: vscode.Disposable | undefined;
	let updateIndexLinksCommand: vscode.Disposable | undefined;

	// Helper function to expand tilde in paths
	function expandTildePath(filePath: string): string {
		if (filePath.startsWith('~')) {
			return path.join(os.homedir(), filePath.slice(1));
		}
		return filePath;
	}

	// Function to check if the current directory is in the allowlist
	function isDirectoryAllowed(): boolean {
		const config = vscode.workspace.getConfiguration('rhyolite');
		const allowedDirectories = config.get<string[]>('allowedDirectories', []);

		// If the allowlist is empty, allow all directories
		if (!allowedDirectories || allowedDirectories.length === 0) {
			return true;
		}

		// Get the current active editor
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return false;
		}

		// Get the directory of the current file
		const currentFilePath = editor.document.uri.fsPath;
		const currentDir = path.dirname(currentFilePath);

		// Check if the current directory or any parent directory is in the allowlist
		return allowedDirectories.some(allowedDir => {
			// Expand tilde if present
			const expandedAllowedDir = expandTildePath(allowedDir);

			// Normalize paths for comparison
			const normalizedAllowedDir = path.normalize(expandedAllowedDir);
			// const normalizedCurrentDir = path.normalize(currentDir);

			// Check if current directory starts with the allowed directory path
			return normalizedAllowedDir.startsWith(currentDir);
		});
	}

	// Function to register commands
	function registerCommands() {
		// Get the configuration
		const config = vscode.workspace.getConfiguration('rhyolite');
		const isEnabled = config.get<boolean>('enabled', true);
		const isAllowed = isDirectoryAllowed();

		// Dispose existing commands if they exist
		if (createFileCommand) {
			createFileCommand.dispose();
			createFileCommand = undefined;
		}
		if (updateIndexLinksCommand) {
			updateIndexLinksCommand.dispose();
			updateIndexLinksCommand = undefined;
		}

		// Only register commands if the extension is enabled and the directory is allowed
		if (isEnabled && isAllowed) {
			// Register the createFile command
			createFileCommand = vscode.commands.registerCommand('rhyolite.rhyCreateFile', createFileLink);

			// Register the updateIndexLinks command
			updateIndexLinksCommand = vscode.commands.registerCommand('rhyolite.updateIndexLinks', updateIndexFile);

			// Add commands to subscriptions
			if (createFileCommand) context.subscriptions.push(createFileCommand);
			if (updateIndexLinksCommand) context.subscriptions.push(updateIndexLinksCommand);

			console.log('Rhyolite commands registered - extension is enabled and directory is allowed');
		} else {
			if (!isEnabled) {
				console.log('Rhyolite commands not registered - extension is disabled');
			} else {
				console.log('Rhyolite commands not registered - current directory is not in the allowlist');
			}
		}
	}

	// Register commands initially
	registerCommands();

	// Listen for configuration changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('rhyolite.enabled') || e.affectsConfiguration('rhyolite.allowedDirectories')) {
				registerCommands();
			}
		})
	);

	// Listen for active editor changes
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(() => {
			registerCommands();
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
