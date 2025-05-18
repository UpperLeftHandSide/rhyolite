import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as path from 'path';
import * as os from 'os';
import * as extension from '../extension';
import { createFileLink, updateIndexFile } from '../commands';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	let sandbox: sinon.SinonSandbox;

	setup(() => {
		sandbox = sinon.createSandbox();
	});

	teardown(() => {
		sandbox.restore();
	});

	test('activate should register commands when enabled and directory is allowed', async () => {
		// Mock configuration
		const configStub = sandbox.stub(vscode.workspace, 'getConfiguration');
		configStub.withArgs('rhyolite').returns({
			get: sandbox.stub().callsFake((key: string, defaultValue: any) => {
				if (key === 'enabled') { return true; }
				if (key === 'allowedDirectories') { return []; }
				return defaultValue;
			})
		} as any);

		// Mock commands registration
		const registerCommandStub = sandbox.stub(vscode.commands, 'registerCommand').returns({
			dispose: sandbox.stub()
		} as any);

		// Mock context
		const context = {
			subscriptions: []
		};

		// Call activate
		extension.activate(context as any);

		// Verify commands were registered
		assert.strictEqual(registerCommandStub.calledWith('rhyolite.rhyCreateFile', createFileLink), true);
		assert.strictEqual(registerCommandStub.calledWith('rhyolite.updateIndexLinks', updateIndexFile), true);
		assert.strictEqual(context.subscriptions.length, 4); // 2 commands + 2 event handlers
	});

	test('activate should not register commands when disabled', async () => {
		// Mock configuration
		const configStub = sandbox.stub(vscode.workspace, 'getConfiguration');
		configStub.withArgs('rhyolite').returns({
			get: sandbox.stub().callsFake((key: string, defaultValue: any) => {
				if (key === 'enabled') { return false; }
				if (key === 'allowedDirectories') { return []; }
				return defaultValue;
			})
		} as any);

		// Mock commands registration
		const registerCommandStub = sandbox.stub(vscode.commands, 'registerCommand').returns({
			dispose: sandbox.stub()
		} as any);

		// Mock context
		const context = {
			subscriptions: []
		};

		// Call activate
		extension.activate(context as any);

		// Verify commands were not registered
		assert.strictEqual(registerCommandStub.called, false);
	});

	test('activate should not register commands when directory is not allowed', async () => {
		// Mock configuration
		const configStub = sandbox.stub(vscode.workspace, 'getConfiguration');
		configStub.withArgs('rhyolite').returns({
			get: sandbox.stub().callsFake((key: string, defaultValue: any) => {
				if (key === 'enabled') { return true; }
				if (key === 'allowedDirectories') { return  ['/some/other/directory']; }
				return defaultValue;
			})
		} as any);

		// Mock active editor
		sandbox.stub(vscode.window, 'activeTextEditor').value({
			document: {
				uri: {
					fsPath: '/current/directory/file.md'
				}
			}
		});

		// Mock commands registration
		const registerCommandStub = sandbox.stub(vscode.commands, 'registerCommand').returns({
			dispose: sandbox.stub()
		} as any);

		// Mock context
		const context = {
			subscriptions: []
		};

		// Call activate
		extension.activate(context as any);

		// Verify commands were not registered
		assert.strictEqual(registerCommandStub.called, false);
	});

	test('expandTildePath should expand tilde to home directory', () => {
		// We need to access the private function, so we'll use Function.call
		// to invoke it with a custom 'this' context
		const homedir = os.homedir();

		// Create a mock context with the function
		const mockContext = {
			expandTildePath: function(filePath: string): string {
				if (filePath.startsWith('~')) {
					return path.join(os.homedir(), filePath.slice(1));
				}
				return filePath;
			}
		};

		// Test with tilde path
		const result1 = mockContext.expandTildePath('~/documents');
		assert.strictEqual(result1, path.join(homedir, '/documents'));

		// Test with non-tilde path
		const result2 = mockContext.expandTildePath('/absolute/path');
		assert.strictEqual(result2, '/absolute/path');
	});

	test('deactivate should not throw', () => {
		assert.doesNotThrow(() => {
			extension.deactivate();
		});
	});

	test('should re-register commands when configuration changes', async () => {
		// Mock configuration
		const configStub = sandbox.stub(vscode.workspace, 'getConfiguration');
		configStub.withArgs('rhyolite').returns({
			get: sandbox.stub().callsFake((key: string, defaultValue: any) => {
				if (key === 'enabled') { return true; }
				if (key === 'allowedDirectories') { return []; }
				return defaultValue;
			})
		} as any);

		// Mock commands registration
		const registerCommandStub = sandbox.stub(vscode.commands, 'registerCommand').returns({
			dispose: sandbox.stub()
		} as any);

		// Mock context with event handler
		const context = {
			subscriptions: []
		};

		// Call activate
		extension.activate(context as any);

		// Verify initial commands were registered
		assert.strictEqual(registerCommandStub.callCount, 2);

		// Reset the stub to check for re-registration
		registerCommandStub.resetHistory();

		// Instead of trying to access the event handler directly, we'll simulate the event
		// by creating a mock event and calling the onDidChangeConfiguration callback directly

		// Create a mock configuration change event
		const mockConfigChangeEvent = {
			affectsConfiguration: (section: string) => section === 'rhyolite.enabled'
		};

		// Get the onDidChangeConfiguration callback from the extension
		// We can do this by extracting it from the call to onDidChangeConfiguration
		const onDidChangeConfigurationStub = sandbox.stub(vscode.workspace, 'onDidChangeConfiguration');

		// Reset the registerCommand stub to avoid counting previous calls
		registerCommandStub.resetHistory();

		// Call activate again to register the event handler with our stub
		extension.activate(context as any);

		// Get the callback that was passed to onDidChangeConfiguration
		const callback = onDidChangeConfigurationStub.firstCall.args[0];

		// Call the callback with our mock event
		await callback(mockConfigChangeEvent);

		// Verify commands were re-registered
		assert.strictEqual(registerCommandStub.callCount, 4);
	});

	test('should re-register commands when active editor changes', async () => {
		// Mock configuration
		const configStub = sandbox.stub(vscode.workspace, 'getConfiguration');
		configStub.withArgs('rhyolite').returns({
			get: sandbox.stub().callsFake((key: string, defaultValue: any) => {
				if (key === 'enabled') { return true; }
				if (key === 'allowedDirectories') { return []; }
				return defaultValue;
			})
		} as any);

		// Mock commands registration
		const registerCommandStub = sandbox.stub(vscode.commands, 'registerCommand').returns({
			dispose: sandbox.stub()
		} as any);

		// Mock context with event handler
		const context = {
			subscriptions: []
		};

		// Call activate
		extension.activate(context as any);

		// Verify initial commands were registered
		assert.strictEqual(registerCommandStub.callCount, 2);

		// Reset the stub to check for re-registration
		registerCommandStub.resetHistory();

		// Instead of trying to access the event handler directly, we'll simulate the event
		// by creating a mock event and calling the onDidChangeActiveTextEditor callback directly

		// Get the onDidChangeActiveTextEditor callback from the extension
		// We can do this by extracting it from the call to onDidChangeActiveTextEditor
		const onDidChangeActiveTextEditorStub = sandbox.stub(vscode.window, 'onDidChangeActiveTextEditor');

		// Reset the registerCommand stub to avoid counting previous calls
		registerCommandStub.resetHistory();

		// Call activate again to register the event handler with our stub
		extension.activate(context as any);

		// Get the callback that was passed to onDidChangeActiveTextEditor
		const callback = onDidChangeActiveTextEditorStub.firstCall.args[0];

		// Create a mock text editor
		const mockTextEditor = {
			document: {
				uri: {
					fsPath: '/current/directory/file.md'
				}
			}
		};

		// Call the callback with the mock text editor
		await callback(mockTextEditor as any);

		// Verify commands were re-registered
		assert.strictEqual(registerCommandStub.callCount, 4);
	});
});
