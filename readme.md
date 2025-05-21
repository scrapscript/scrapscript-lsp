# WIP

---

# ScrapScript Language Server Protocol (LSP)

A Language Server Protocol implementation for the ScrapScript programming language based on tree-sitter.

## Features

- Syntax highlighting
- Error checking and diagnostics
- Code completion
- Hover information
- Document symbols (outline)

## Installation

### Prerequisites

- Node.js (v16 or later)
- npm

### Building from Source

1. Clone this repository:

   ```bash
   git clone https://github.com/scrapscript/scrapscript-lsp.git
   cd scrapscript-lsp
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Compile the language server and client:

   ```bash
   npm run compile
   ```

4. Build the tree-sitter WebAssembly module (needs tree-sitter CLI installed):
   ```bash
   cd server
   npm run build-wasm
   cd ..
   ```

### Using with VS Code

1. Launch VS Code
2. Open the project folder
3. Press F5 to start debugging, which will launch a new VS Code window with the extension loaded
4. Open a `.scrap` or `.ss` file to see the LSP in action

## Development

The project is structured as follows:

- `client`: VS Code extension client
- `server`: Language server implementation
- `syntaxes`: TextMate grammar for syntax highlighting
- `tree-sitter-scrapscript`: Tree-sitter grammar for the ScrapScript language

### Building

To build the project:

```bash
npm run compile
```

To watch for changes:

```bash
npm run watch
```

### Testing

For testing:

```bash
npm test
```

## Language Server Features

### Syntax Highlighting

The language server provides syntax highlighting through a TextMate grammar for:

- Operators (`+`, `-`, `*`, `/`, etc.)
- Strings, numbers, and bytes
- Comments
- Tags
- Functions and patterns

### Code Completion

Code completion is provided for:

- Keywords
- Operators
- Record fields
- Tags
- Common functions and values

### Hover Information

Hover information is provided for:

- Identifiers
- Operators
- Tags
- Functions
- Built-in types and values

### Document Symbols

Document symbols (for the outline view) are provided for:

- Declarations
- Functions
- Records
- Lists
- Tags

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Taylor Troesh for the original ScrapScript language design and tree-sitter grammar
- The tree-sitter team for their excellent parsing library
- The Language Server Protocol community

---

# Getting Started with ScrapScript LSP

This guide will help you get started using and developing the ScrapScript Language Server Protocol (LSP) implementation.

## Initial Setup

1. Clone the repository

   ```bash
   git clone https://github.com/scrapscript/scrapscript-lsp.git
   cd scrapscript-lsp
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Compile the project

   ```bash
   npm run compile
   ```

4. Build the tree-sitter WebAssembly module
   ```bash
   cd server
   npm run build-wasm
   cd ..
   ```

## Creating Your First ScrapScript File

1. Create a file with the `.scrap` or `.ss` extension.
2. Open it in VS Code with the ScrapScript LSP extension running.
3. Start writing ScrapScript code! The language server will provide:
   - Syntax highlighting
   - Error diagnostics
   - Code completion
   - Hover information
   - Document symbols for navigation

Example ScrapScript code:

```scrapscript
()

; add = x -> y -> x + y

; factorial =
    | 0 -> 1
    | n -> n * factorial (n - 1)

; person =
    { name = "Alice",
    , age = 30
    }

; evens =
    [1, 2, 3, 4, 5]
    |> list/map (x -> x * 2)
```

## Repository Structure

The ScrapScript LSP is organized as follows:

- **Client**: The VS Code extension client that communicates with the server.
- **Server**: The language server implementation providing language intelligence.
- **Syntaxes**: TextMate grammar for syntax highlighting.
- **Tree-sitter grammar**: The ScrapScript language grammar for parsing.

## Features Overview

### Syntax Highlighting

The language server highlights:

- Keywords
- Operators
- Strings and numbers
- Comments
- Tags
- Functions and patterns

### Error Checking

The validator detects:

- Syntax errors in expressions
- Invalid declarations
- Mismatched patterns

### Code Completion

Code completion is provided for:

- Operators (`|>`, `+`, `-`, etc.)
- Tags (`#true`, `#false`, etc.)
- Record fields

### Hover Information

Hover over elements to see:

- Type information
- Documentation for operators and keywords
- Descriptions for tags and built-in functions

### Document Symbols

The outline view shows:

- Declarations
- Functions
- Records and their structure
- Lists

## Customizing the LSP

To customize the LSP for your needs:

1. **Adding More Features**: Implement additional features in the server directory by adding new provider files and connecting them in the server.ts file.

2. **Extending the Grammar**: If you need to modify the grammar, update the tree-sitter grammar file and rebuild the WASM module.

3. **Improving Completions**: Enhance the completions.ts file to provide more context-aware suggestions.

4. **Adding Semantic Analysis**: Implement more sophisticated validations in validator.ts.

## Debugging

To debug the LSP:

1. Open the project in VS Code
2. Press F5 to start debugging
3. A new VS Code window will open with the extension loaded
4. Open a ScrapScript file to test the LSP

You can set breakpoints in both the client and server code to debug specific issues.

## Contributing

Contributions to the ScrapScript LSP are welcome! Ways to contribute:

1. **Report Issues**: File issues for bugs or feature requests.
2. **Improve Documentation**: Help clarify or expand the documentation.
3. **Add Features**: Implement new features or improve existing ones.
4. **Fix Bugs**: Address open issues or bugs you encounter.

Happy coding with ScrapScript!

