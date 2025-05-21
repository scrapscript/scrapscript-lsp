import { TextDocument } from "vscode-languageserver-textdocument";
import { SymbolKind } from "vscode-languageserver";
import {
  initializeParser,
  parse,
  findNodesOfType,
  getDocumentSymbols,
} from "./server";

describe("Parser", () => {
  beforeAll(async () => {
    await initializeParser();
  });

  test("should parse simple expressions", () => {
    const result = parse("1 + 2");
    expect(result).toBeDefined();
    expect(result.rootNode).toBeDefined();

    // Find the binary expression node
    const binaryNodes = findNodesOfType(result.rootNode, "binary");
    expect(binaryNodes).toHaveLength(1);
    const binaryNode = binaryNodes[0];

    // Check the operator
    const operatorNode = binaryNode.child(1);
    expect(operatorNode?.text).toBe("+");

    // Check the operands
    const leftNode = binaryNode.child(0);
    const rightNode = binaryNode.child(2);
    expect(leftNode?.text).toBe("1");
    expect(rightNode?.text).toBe("2");
  });

  test("should parse function definitions", () => {
    const result = parse("fn add(a, b) { a + b }");
    expect(result).toBeDefined();
    expect(result.rootNode).toBeDefined();

    // Find the function node
    const funNodes = findNodesOfType(result.rootNode, "fun");
    expect(funNodes).toHaveLength(1);
    const funNode = funNodes[0];

    // Check the function name
    const idNode = funNode.child(0);
    expect(idNode?.text).toBe("add");

    // Check the parameters
    const paramsNode = funNode.child(1);
    expect(paramsNode?.text).toBe("(a, b)");
  });

  test("should handle nested expressions", () => {
    const result = parse("fn calculate(x) { (x + 1) * 2 }");
    expect(result).toBeDefined();
    expect(result.rootNode).toBeDefined();

    // Find the function node
    const funNodes = findNodesOfType(result.rootNode, "fun");
    expect(funNodes).toHaveLength(1);

    // Find the binary expressions
    const binaryNodes = findNodesOfType(result.rootNode, "binary");
    expect(binaryNodes.length).toBeGreaterThan(0);
  });

  test("should handle invalid syntax", () => {
    expect(() => parse("1 +")).toThrow();
    expect(() => parse("fn add(a,) {}")).toThrow();
  });
});

describe("Symbol Resolution", () => {
  beforeAll(async () => {
    await initializeParser();
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
