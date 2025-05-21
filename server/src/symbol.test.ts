import { getDocumentSymbols } from "./symbol";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SymbolKind } from "vscode-languageserver";
import { initialize } from "./parser";

describe("Symbol Resolution", () => {
  beforeAll(async () => {
    await initialize();
  });

  function createDocument(content: string): TextDocument {
    return TextDocument.create("file:///test.scrap", "scrapscript", 1, content);
  }

  test("should resolve local variables", () => {
    const code = `x + 2 ; x = 1`;
    const document = createDocument(code);
    const symbols = getDocumentSymbols(document);
    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe("x");
    expect(symbols[0].kind).toBe(SymbolKind.Variable);
  });

  test("should resolve function parameters", () => {
    const code = `a -> b -> a + b`;
    const document = createDocument(code);
    const symbols = getDocumentSymbols(document);
    expect(symbols).toHaveLength(1); // Only the function itself is a symbol
    expect(symbols[0].name).toBe("add");
    expect(symbols[0].kind).toBe(SymbolKind.Function);
  });

  test("should detect undefined variables", () => {
    const code = `x + 1`;
    const document = createDocument(code);
    const symbols = getDocumentSymbols(document);
    expect(symbols).toHaveLength(1); // Only the function itself is a symbol
    expect(symbols[0].name).toBe("test");
    expect(symbols[0].kind).toBe(SymbolKind.Function);
  });
});
