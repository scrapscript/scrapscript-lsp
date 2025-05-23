# ScrapScript LSP

## Setup

1. Clone and install:

```bash
git clone https://github.com/scrapscript/tree-sitter-scrapscript.git
git clone https://github.com/scrapscript/scrapscript-lsp.git
ln -s tree-sitter-scrapscript scrapscript-lsp/tree-sitter-scrapscript
cd scrapscript-lsp
npm install
npm run compile
cd server && npm run build-wasm && cd ..
```

2. VS Code:

- Open project folder
- Press F5 to debug
- Open `.scrap` or `.ss` file

## Project Structure

- `client`: VS Code extension
- `server`: LSP implementation
- `syntaxes`: TextMate grammar

## Development

```bash
cd server
npm run compile  # Build
npm run watch    # Watch mode
npm test        # Run tests
```

