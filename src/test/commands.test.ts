import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import * as sinon from 'sinon';
import { clearSection, addLinks, createFileLink, updateIndexFile } from '../commands';

suite('Commands Test Suite', () => {
    vscode.window.showInformationMessage('Start commands tests.');

    // Setup and teardown
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    // Tests for clearSection function
    suite('clearSection', () => {
        test('should add section if it does not exist', () => {
            const indexContent = '# Index\n\n';
            const result = clearSection(indexContent, '##', 'Links');
            assert.strictEqual(result, '# Index\n\n## Links\n\n');
        });

        test('should clear existing section content', () => {
            const indexContent = '# Index\n\n## Links\n- [File1](file1.md)\n- [File2](file2.md)\n\n## Other Section\nSome content';
            const result = clearSection(indexContent, '##', 'Links');
            assert.strictEqual(result, '# Index\n\n## Links\n\n## Other Section\nSome content');
        });
    });

    // Tests for addLinks function
    suite('addLinks', () => {
        test('should add links to the specified section', async () => {
            const indexContent = '# Index\n\n## Links\n\n';
            const markdownFiles = ['file1.md', 'file2.md'];
            const workspacePath = '/fake/path';

            // Mock file reading
            const readFileStub = sandbox.stub(fsPromises, 'readFile');
            readFileStub.withArgs(path.join(workspacePath, 'file1.md'), 'utf8')
                .resolves('# File 1 Title\nContent');
            readFileStub.withArgs(path.join(workspacePath, 'file2.md'), 'utf8')
                .resolves('# File 2 Title\nContent');

            const [result, count] = await addLinks(indexContent, markdownFiles, workspacePath, '## Links');

            assert.strictEqual(count, 2);
            assert.strictEqual(result.includes('- [File 1 Title](file1.md)'), true);
            assert.strictEqual(result.includes('- [File 2 Title](file2.md)'), true);
        });

        test('should use filename if title not found', async () => {
            const indexContent = '# Index\n\n## Links\n\n';
            const markdownFiles = ['file1.md'];
            const workspacePath = '/fake/path';

            // Mock file reading to throw an error
            sandbox.stub(fsPromises, 'readFile').rejects(new Error('File not found'));

            const [result, count] = await addLinks(indexContent, markdownFiles, workspacePath, '## Links');

            assert.strictEqual(count, 1);
            assert.strictEqual(result.includes('- [file1](file1.md)'), true);
        });

        test('should handle index.md files specially', async () => {
            const indexContent = '# Index\n\n## Indexes\n\n';
            const markdownFiles = ['subdir/index.md'];
            const workspacePath = '/fake/path';

            const [result, count] = await addLinks(indexContent, markdownFiles, workspacePath, '## Indexes');

            assert.strictEqual(count, 1);
            assert.strictEqual(result.includes('- [subdir](subdir/index.md)'), true);
        });
    });

    // Tests for createFileLink function
    suite('createFileLink', () => {
        test('should show error if no workspace folder is open', async () => {
            // Mock workspace.workspaceFolders to return null
            sandbox.stub(vscode.workspace, 'workspaceFolders').value(null);

            // Mock window.showErrorMessage
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');

            await createFileLink();

            assert.strictEqual(showErrorMessageStub.calledWith('No workspace folder is open'), true);
        });

        test('should show error if no active text editor', async () => {
            // Mock workspace.workspaceFolders to return a value
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([{ uri: { fsPath: '/fake/path' } }]);

            // Mock window.activeTextEditor to return null
            sandbox.stub(vscode.window, 'activeTextEditor').value(null);

            // Mock window.showErrorMessage
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');

            await createFileLink();

            assert.strictEqual(showErrorMessageStub.calledWith('No active text editor'), true);
        });

        test('should show error if no word is selected or at cursor', async () => {
            // Mock workspace.workspaceFolders
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([{ uri: { fsPath: '/fake/path' } }]);

            // Mock window.activeTextEditor with empty selection and no word at cursor
            const editor = {
                selection: { isEmpty: true, active: {} },
                document: { 
                    getWordRangeAtPosition: () => null,
                    getText: () => ''
                }
            };
            sandbox.stub(vscode.window, 'activeTextEditor').value(editor);

            // Mock window.showErrorMessage
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');

            await createFileLink();

            assert.strictEqual(showErrorMessageStub.calledWith('No word selected or cursor not positioned on a word'), true);
        });

        test('should create file and replace selection with link when text is selected', async () => {
            // Mock workspace.workspaceFolders
            const workspacePath = '/fake/path';
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([{ uri: { fsPath: workspacePath } }]);

            // Mock window.activeTextEditor with selection
            const selection = { isEmpty: false };
            const document = { 
                fileName: '/fake/path/document.md',
                getText: sandbox.stub().returns('TestWord'),
                uri: { fsPath: '/fake/path/document.md' }
            };
            const editor = {
                selection,
                document
            };
            sandbox.stub(vscode.window, 'activeTextEditor').value(editor);

            // Mock fs functions
            sandbox.stub(fsPromises, 'access').rejects(); // File doesn't exist
            const writeFileStub = sandbox.stub(fsPromises, 'writeFile').resolves();

            // Mock vscode functions
            sandbox.stub(vscode.window, 'showInformationMessage').resolves();
            const workspaceEditStub = sandbox.stub();
            const applyEditStub = sandbox.stub(vscode.workspace, 'applyEdit').resolves();
            sandbox.stub(vscode, 'WorkspaceEdit').returns({ replace: workspaceEditStub });
            // @ts-ignore
            sandbox.stub(vscode.workspace, 'openTextDocument').resolves({});
            sandbox.stub(vscode.window, 'showTextDocument').resolves();

            await createFileLink();

            // Verify file was created with correct content
            assert.strictEqual(writeFileStub.calledWith(
                path.join(workspacePath, 'testword.md'), 
                '# TestWord'
            ), true);

            // Verify link was created
            assert.strictEqual(workspaceEditStub.calledWith(
                document.uri, 
                selection, 
                '[TestWord](testword.md)'
            ), true);

            // Verify edit was applied
            assert.strictEqual(applyEditStub.called, true);
        });
    });

    // Tests for updateIndexFile function
    suite('updateIndexFile', () => {
        test('should show error if no workspace folder is open', async () => {
            // Mock workspace.workspaceFolders to return null
            sandbox.stub(vscode.workspace, 'workspaceFolders').value(null);

            // Mock window.showErrorMessage
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');

            await updateIndexFile();

            assert.strictEqual(showErrorMessageStub.calledWith('No workspace folder is open'), true);
        });

        test('should update index file in workspace root when no editor is active', async () => {
            // Mock workspace.workspaceFolders
            const workspacePath = '/fake/path';
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([{ uri: { fsPath: workspacePath } }]);

            // Mock window.activeTextEditor to return null
            sandbox.stub(vscode.window, 'activeTextEditor').value(null);

            // Mock glob to return markdown files
            const globStub = sandbox.stub();
            // First call for markdown files in root
            globStub.withArgs('*.md', { cwd: workspacePath, ignore: ['**/node_modules/**', '**/out/**'] })
                .resolves(['file1.md', 'file2.md']);
            // Second call for index files in subdirectories
            globStub.withArgs('**/index.md', { cwd: workspacePath, ignore: ['**/node_modules/**', '**/out/**'] })
                .resolves(['subdir/index.md']);
            // Third call for markdown files in subdir
            globStub.withArgs('*.md', { cwd: path.join(workspacePath, 'subdir'), ignore: ['**/node_modules/**', '**/out/**'] })
                .resolves(['subfile.md']);
            // Fourth call for index files in subdir
            globStub.withArgs('**/index.md', { cwd: path.join(workspacePath, 'subdir'), ignore: ['**/node_modules/**', '**/out/**'] })
                .resolves([]);
            sandbox.stub(require('glob'), 'glob').value(globStub);

            // Mock fs functions
            const readFileStub = sandbox.stub(fsPromises, 'readFile');
            readFileStub.withArgs(path.join(workspacePath, 'index.md'), 'utf8')
                .resolves('# Index\n\n');
            readFileStub.withArgs(path.join(workspacePath, 'subdir/index.md'), 'utf8')
                .resolves('# Subdir Index\n\n');

            const writeFileStub = sandbox.stub(fsPromises, 'writeFile').resolves();

            // Mock access to check if files exist
            const accessStub = sandbox.stub(fsPromises, 'access');
            accessStub.withArgs(path.join(workspacePath, 'index.md'), fs.constants.F_OK).resolves();
            accessStub.withArgs(path.join(workspacePath, 'subdir/index.md'), fs.constants.F_OK).resolves();

            // Mock vscode functions
            sandbox.stub(vscode.window, 'showInformationMessage').resolves();
            // @ts-ignore
            sandbox.stub(vscode.workspace, 'openTextDocument').resolves({});
            sandbox.stub(vscode.window, 'showTextDocument').resolves();

            await updateIndexFile();

            // Verify index files were updated
            assert.strictEqual(writeFileStub.calledWith(
                path.join(workspacePath, 'index.md'),
                sinon.match.string
            ), true);

            assert.strictEqual(writeFileStub.calledWith(
                path.join(workspacePath, 'subdir/index.md'),
                sinon.match.string
            ), true);
        });

        test('should update specific index file when editing an index.md file', async () => {
            // Mock workspace.workspaceFolders
            const workspacePath = '/fake/path';
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([{ uri: { fsPath: workspacePath } }]);

            // Mock window.activeTextEditor with an index.md file
            const indexPath = path.join(workspacePath, 'subdir/index.md');
            const editor = {
                document: { 
                    fileName: indexPath
                }
            };
            sandbox.stub(vscode.window, 'activeTextEditor').value(editor);

            // Mock glob to return markdown files
            const globStub = sandbox.stub();
            // First call for markdown files in subdir
            globStub.withArgs('*.md', { cwd: path.dirname(indexPath), ignore: ['**/node_modules/**', '**/out/**'] })
                .resolves(['file1.md', 'file2.md']);
            // Second call for index files in subdir
            globStub.withArgs('**/index.md', { cwd: path.dirname(indexPath), ignore: ['**/node_modules/**', '**/out/**'] })
                .resolves([]);
            sandbox.stub(require('glob'), 'glob').value(globStub);

            // Mock fs functions
            const readFileStub = sandbox.stub(fsPromises, 'readFile');
            readFileStub.withArgs(indexPath, 'utf8')
                .resolves('# Subdir Index\n\n');

            const writeFileStub = sandbox.stub(fsPromises, 'writeFile').resolves();

            // Mock access to check if files exist
            sandbox.stub(fsPromises, 'access').withArgs(indexPath, fs.constants.F_OK).resolves();

            // Mock vscode functions
            sandbox.stub(vscode.window, 'showInformationMessage').resolves();
            // @ts-ignore
            sandbox.stub(vscode.workspace, 'openTextDocument').resolves({});
            sandbox.stub(vscode.window, 'showTextDocument').resolves();

            await updateIndexFile();

            // Verify index file was updated
            assert.strictEqual(writeFileStub.calledWith(
                indexPath,
                sinon.match.string
            ), true);
        });

        test('should handle errors gracefully', async () => {
            // Mock workspace.workspaceFolders
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([{ uri: { fsPath: '/fake/path' } }]);

            // Mock window.activeTextEditor to return null
            sandbox.stub(vscode.window, 'activeTextEditor').value(null);

            // Mock glob to throw an error
            sandbox.stub(require('glob'), 'glob').rejects(new Error('Glob error'));

            // Mock window.showErrorMessage
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');

            await updateIndexFile();

            // Verify error message was shown
            assert.strictEqual(showErrorMessageStub.calledWith(
                sinon.match('Error updating index links: Glob error')
            ), true);
        });
    });
});
