import * as vscode from 'vscode';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export function clearSection(indexContent: string, sectionHeaderDepth: string, sectionName: string): string {
	const section = sectionHeaderDepth + ' ' + sectionName;
	if (!indexContent.includes(section)) {
		indexContent += `\n${section}\n\n`;
	} else {
		// Find the Links section and clear existing links
		const regex = new RegExp(`^${sectionHeaderDepth} `, 'm');
		const sections = indexContent.split(regex);
		for (let i = 0; i < sections.length; i++) {
			if (sections[i].startsWith(sectionName)) {
				// Keep the "Links" header and clear the content
				sections[i] = `${sectionName}\n\n`;
				indexContent = sections.slice(0, 1).join('') +
					sections.slice(1).map(s => `${sectionHeaderDepth} ` + s).join('');
				break;
			}
		}
	}
	return indexContent;
}

export async function addLinks(indexContent: string,
						markDownFiles: string[],
						workspacePath: string,
						headerSection: string): Promise<[string, number]> {
	// Add links to all markdown files
	let linksAdded = 0;
	for (const file of markDownFiles) {
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
		const linksHeaderPos = indexContent.indexOf(headerSection);
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
	return [indexContent, linksAdded];
}

export async function createFileLink() {
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
		// Determine the directory where the file should be created
		let targetDirectory = workspaceFolders[0].uri.fsPath;

		// If the active editor is editing an index.md file, create the new file in the same directory
		if (editor.document.fileName.endsWith('index.md')) {
			targetDirectory = path.dirname(editor.document.fileName);
		}

		// Create the file path
		const filePath = path.join(targetDirectory, fileName);

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
		// If we're in an index.md file, the link should be relative to the current directory
		// If we're not in an index.md file, the link should be to the file in the workspace root
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
}

// Helper function to update a single index file
async function updateSingleIndexFile(indexPath: string, basePath: string, ignore: string[]): Promise<[boolean, number]> {
	// Find all markdown files in the same directory as the index file
	const markdownFiles = await glob('*.md', { 
		cwd: basePath,
		ignore: ignore 
	});

	const otherIndexFiles = await glob("**/index.md", {
		cwd: basePath,
		ignore: ignore
	});

	// Filter out index.md itself
	const otherMarkdownFiles = markdownFiles.filter(file => file !== 'index.md');
	const filterOutTopLevelIndex = otherIndexFiles.filter(file => file !== 'index.md');

	if (otherMarkdownFiles.length === 0 && filterOutTopLevelIndex.length === 0) {
		return [false, 0]; // No files to link to
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

	let count1 = 0;
	let count2 = 0;

	if (filterOutTopLevelIndex.length > 0) {
		indexContent = clearSection(indexContent, '##', 'Indexes');
		// for indexes we actually want the directory returned as the link name
		[indexContent, count2] = await addLinks(indexContent, filterOutTopLevelIndex, basePath, '## Indexes');
	}

	if (otherMarkdownFiles.length > 0) {
		indexContent = clearSection(indexContent, '##', 'Links');
		[indexContent, count1] = await addLinks(indexContent, otherMarkdownFiles, basePath, '## Links');
	}

	// Write the updated index.md
	await fsPromises.writeFile(indexPath, indexContent);

	return [indexExists, count1 + count2];
}

export async function updateIndexFile() {
	// Get the workspace folder
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		vscode.window.showErrorMessage('No workspace folder is open');
		return;
	}

	try {
		// Get the active text editor to determine which index file to update
		const editor = vscode.window.activeTextEditor;
		let basePath = workspaceFolders[0].uri.fsPath;
		let indexPath = path.join(basePath, 'index.md');

		// If the active editor is editing an index.md file, use that file instead
		if (editor && editor.document.fileName.endsWith('index.md')) {
			indexPath = editor.document.fileName;
			basePath = path.dirname(indexPath);
		}

		const ignore = ['**/node_modules/**', '**/out/**'];

		// Update the current index file first
		const [indexExists, linksCount] = await updateSingleIndexFile(indexPath, basePath, ignore);

		// Find all index.md files in subdirectories
		const allIndexFiles = await glob("**/index.md", {
			cwd: basePath,
			ignore: ignore
		});

		// Filter out the current index.md file
		const otherIndexFiles = allIndexFiles.filter(file => {
			const fullPath = path.join(basePath, file);
			return fullPath !== indexPath;
		});

		// Update each index file recursively
		let totalUpdated = 1; // Count the main index file
		for (const indexFile of otherIndexFiles) {
			const fullPath = path.join(basePath, indexFile);
			const dirPath = path.dirname(fullPath);
			const [exists, count] = await updateSingleIndexFile(fullPath, dirPath, ignore);
			if (count > 0) {
				totalUpdated++;
			}
		}

		// Show success message
		const message = indexExists
			? `Updated ${totalUpdated} index.md files with links.`
			: `Created and updated ${totalUpdated} index.md files with links.`;
		vscode.window.showInformationMessage(message);

		// Open the main index.md file
		const document = await vscode.workspace.openTextDocument(indexPath);
		await vscode.window.showTextDocument(document);

	} catch (error) {
		vscode.window.showErrorMessage(`Error updating index links: ${error instanceof Error ? error.message : String(error)}`);
	}
}
