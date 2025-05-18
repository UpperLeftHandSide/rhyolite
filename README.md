# rhyolite

Rhyolite is a vscode extension to add a couple features for note-taking.

## Features

 There should be
one index file per directory. Each index file will contain links to files in the current directory, and links to
indexes in subdirectories.

There is also a function to create a link in the current file, and then create the linked file.

## Extension Settings

This extension contributes the following settings:

* `rhyolite.enabled`: Enable/disable this extension. When disabled, the commands will not be available.
* `rhyolite.allowedDirectories`: An array of directory paths where the extension should be active. If empty, the extension will be active in all directories (when enabled). Example: `["/home/user/notes", "/home/user/projects/documentation"]`

## Building the Extension

To build and package the extension locally:

1. **Prerequisites**
   - Node.js (latest LTS version recommended)
   - npm (comes with Node.js)
   - Visual Studio Code

2. **Setup**
   ```bash
   # Clone the repository
   git clone https://github.com/UpperLeftHandSide/rhyolite.git
   cd rhyolite

   # Install dependencies
   npm install
   ```

3. **Build**
   ```bash
   # Compile the TypeScript code
   npm run compile

   # Or to watch for changes during development
   npm run watch
   ```

4. **Test**
   ```bash
   # Run tests
   npm test
   ```

5. **Package**
   ```bash
   # Create a VSIX package
   npm run vscode:publish
   ```
   This will generate a `.vsix` file that can be installed in VS Code.

6. **Install the VSIX**
   - In VS Code, go to Extensions view
   - Click on the "..." menu (top-right)
   - Select "Install from VSIX..."
   - Choose the generated `.vsix` file

## Known Issues

## Release Notes

### 0.0.1

Initial release of rhyolite
