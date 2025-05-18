import * as vscode from 'vscode';
import { createFileLink, updateIndexFile } from './commands';

export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "rhyolite" is now active!');

	let createFileCommand: vscode.Disposable | undefined;
	let updateIndexLinksCommand: vscode.Disposable | undefined;

	// Function to register commands
	function registerCommands() {
		// Get the configuration
		const config = vscode.workspace.getConfiguration('rhyolite');
		const isEnabled = config.get<boolean>('enabled', true);

		// Dispose existing commands if they exist
		if (createFileCommand) {
			createFileCommand.dispose();
			createFileCommand = undefined;
		}
		if (updateIndexLinksCommand) {
			updateIndexLinksCommand.dispose();
			updateIndexLinksCommand = undefined;
		}

		// Only register commands if the extension is enabled
		if (isEnabled) {
			// Register the createFile command
			createFileCommand = vscode.commands.registerCommand('rhyolite.rhyCreateFile', createFileLink);

			// Register the updateIndexLinks command
			updateIndexLinksCommand = vscode.commands.registerCommand('rhyolite.updateIndexLinks', updateIndexFile);

			// Add commands to subscriptions
			if (createFileCommand) context.subscriptions.push(createFileCommand);
			if (updateIndexLinksCommand) context.subscriptions.push(updateIndexLinksCommand);

			console.log('Rhyolite commands registered - extension is enabled');
		} else {
			console.log('Rhyolite commands not registered - extension is disabled');
		}
	}

	// Register commands initially
	registerCommands();

	// Listen for configuration changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('rhyolite.enabled')) {
				registerCommands();
			}
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
