// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "rhyolite" is now active!');

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
		const fileName = `${word.replaceAll(' ', '-').toLowerCase()}.md`;
		const fileTitle = `# ${word}`;
		// Ask for the file content

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
			await fsPromises.writeFile(filePath, fileTitle);

			// Show success message
			vscode.window.showInformationMessage(`File ${fileName} created successfully!`);

			// Replace the original text with a link to the markdown file
			const markdownLink = `[${word}](${fileName})`;
			const edit = new vscode.WorkspaceEdit();
			if (!selection.isEmpty) {
				edit.replace(editor.document.uri, selection, markdownLink);
			} else {
				const position = editor.selection.active;
				const range = editor.document.getWordRangeAtPosition(position);
				if (range) {
					edit.replace(editor.document.uri, range, markdownLink);
				}
			}
			await vscode.workspace.applyEdit(edit);

			// Open the file in the editor
			const document = await vscode.workspace.openTextDocument(filePath);
			await vscode.window.showTextDocument(document);
		} catch (error) {
			vscode.window.showErrorMessage(`Error creating file: ${error instanceof Error ? error.message : String(error)}`);
		}
	});

	// Register the updateIndexLinks command
	const updateIndexLinksCommand = vscode.commands.registerCommand('rhyolite.updateIndexLinks', async () => {
		// Get the workspace folder
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showErrorMessage('No workspace folder is open');
			return;
		}

		try {
			const workspacePath = workspaceFolders[0].uri.fsPath;
			const indexPath = path.join(workspacePath, 'index.md');

			// Find all markdown files in the workspace
			const markdownFiles = await glob('**/*.md', { 
				cwd: workspacePath,
				ignore: ['**/node_modules/**', '**/out/**'] 
			});

			// Filter out index.md itself
			const otherMarkdownFiles = markdownFiles.filter(file => file !== 'index.md');

			if (otherMarkdownFiles.length === 0) {
				vscode.window.showInformationMessage('No markdown files found to link to.');
				return;
			}

			// Check if index.md exists, create it if not
			let indexContent = '';
			let indexExists = false;

			try {
				await fsPromises.access(indexPath, fs.constants.F_OK);
				indexContent = await fsPromises.readFile(indexPath, 'utf8');
				indexExists = true;
			} catch {
				// Index doesn't exist, create it with a title
				indexContent = '# Index\n\n';
			}

			// Create a section for links if it doesn't exist
			if (!indexContent.includes('## Links')) {
				indexContent += '\n## Links\n\n';
			} else {
				// Find the Links section and clear existing links
				const sections = indexContent.split(/^## /m);
				for (let i = 0; i < sections.length; i++) {
					if (sections[i].startsWith('Links')) {
						// Keep the "Links" header and clear the content
						sections[i] = 'Links\n\n';
						indexContent = sections.slice(0, 1).join('') + 
							sections.slice(1).map(s => '## ' + s).join('');
						break;
					}
				}
			}

			// Add links to all markdown files
			let linksAdded = 0;
			for (const file of otherMarkdownFiles) {
				// Get the file title (first # heading) if possible
				let fileTitle = path.basename(file, '.md');
				try {
					const filePath = path.join(workspacePath, file);
					const fileContent = await fsPromises.readFile(filePath, 'utf8');
					const titleMatch = fileContent.match(/^# (.+)$/m);
					if (titleMatch && titleMatch[1]) {
						fileTitle = titleMatch[1];
					}
				} catch {
					// If we can't read the file, just use the filename
				}

				// Create the link and add it to index.md
				const link = `- [${fileTitle}](${file})\n`;

				// Find the Links section and add the link
				const linksHeaderPos = indexContent.indexOf('## Links');
				if (linksHeaderPos !== -1) {
					const insertPos = indexContent.indexOf('\n', linksHeaderPos) + 1;
					indexContent = indexContent.slice(0, insertPos) + link + indexContent.slice(insertPos);
					linksAdded++;
				} else {
					// Fallback: just append to the end
					indexContent += link;
					linksAdded++;
				}
			}

			// Write the updated index.md
			await fsPromises.writeFile(indexPath, indexContent);

			// Show success message
			const message = indexExists 
				? `Updated index.md with ${linksAdded} links.` 
				: `Created index.md with ${linksAdded} links.`;
			vscode.window.showInformationMessage(message);

			// Open the index.md file
			const document = await vscode.workspace.openTextDocument(indexPath);
			await vscode.window.showTextDocument(document);

		} catch (error) {
			vscode.window.showErrorMessage(`Error updating index links: ${error instanceof Error ? error.message : String(error)}`);
		}
	});

	context.subscriptions.push(createFileCommand, updateIndexLinksCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
