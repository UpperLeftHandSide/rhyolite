// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "rhyolite" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const helloWorldCommand = vscode.commands.registerCommand('rhyolite.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from rhyolite!');
	});

	// Register the createFile command
	const createFileCommand = vscode.commands.registerCommand('rhyolite.rhyCreateFile', async () => {
		// Get the workspace folder
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showErrorMessage('No workspace folder is open');
			return;
		}

		// Get the active text editor
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active text editor');
			return;
		}

		// Get the selected word or the word at cursor position
		let word = '';
		const selection = editor.selection;

		if (!selection.isEmpty) {
			// Use the selected text
			word = editor.document.getText(selection);
		} else {
			// Get the word at the current cursor position
			const position = editor.selection.active;
			const range = editor.document.getWordRangeAtPosition(position);

			if (range) {
				word = editor.document.getText(range);
			}
		}

		if (!word) {
			vscode.window.showErrorMessage('No word selected or cursor not positioned on a word');
			return;
		}

		// Use the word as the filename with .md extension
		const fileName = `${word}.md`;

		// Ask for the file content
		const fileContent = await vscode.window.showInputBox({
			prompt: 'Enter the file content',
			placeHolder: 'Your content here...'
		});

		if (fileContent === undefined) {
			// User cancelled the input
			return;
		}

		try {
			// Create the file path
			const filePath = path.join(workspaceFolders[0].uri.fsPath, fileName);

			// Check if file already exists
			let fileExists = false;
			try {
				await fsPromises.access(filePath, fs.constants.F_OK);
				fileExists = true;
			} catch {
				// File does not exist, which is fine
			}

			if (fileExists) {
				const overwrite = await vscode.window.showQuickPick(['Yes', 'No'], {
					placeHolder: 'File already exists. Overwrite?'
				});

				if (overwrite !== 'Yes') {
					return;
				}
			}

			// Write the file
			await fsPromises.writeFile(filePath, fileContent);

			// Show success message
			vscode.window.showInformationMessage(`File ${fileName} created successfully!`);

			// Open the file in the editor
			const document = await vscode.workspace.openTextDocument(filePath);
			await vscode.window.showTextDocument(document);
		} catch (error) {
			vscode.window.showErrorMessage(`Error creating file: ${error instanceof Error ? error.message : String(error)}`);
		}
	});

	context.subscriptions.push(helloWorldCommand, createFileCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
