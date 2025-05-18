import * as vscode from 'vscode';
import { clearSection, addLinks, createFileLink, updateIndexFile } from './commands';

export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "rhyolite" is now active!');

	// Register the createFile command
	const createFileCommand = vscode.commands.registerCommand('rhyolite.rhyCreateFile', createFileLink);

	// TODO make this recursive for index files
	// Register the updateIndexLinks command
	const updateIndexLinksCommand = vscode.commands.registerCommand('rhyolite.updateIndexLinks', updateIndexFile);

	context.subscriptions.push(createFileCommand, updateIndexLinksCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
