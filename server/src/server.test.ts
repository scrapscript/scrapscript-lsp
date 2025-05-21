import { TextDocument } from "vscode-languageserver-textdocument";
import {
  initializeParser,
  parse,
  validateScrapScript,
  getCompletionItems,
  getHoverInfo,
  getDocumentSymbols,
} from "./server";
import {
  CompletionItem,
  Hover,
  MarkupContent,
} from "vscode-languageserver/node";

describe("ScrapScript Language Server", () => {
  const exampleCode = `
()

; xyz = x + y * z 
; x = 10 
; y = 20 
; z = 30

; double = x -> x * 2

; is-zero = 
    | 0 -> #true ()
    | _ -> #false ()

; person =
    { name = "John"
    , age = 30
    , address =
      { street = "123 Main St"
      , city = "Anytown"
      , country = "USA"
      }
    }

; numbers = 
    [1, 2, 3, 4, 5]
    |> list/map (x -> x * 2)
    |> list/map (x -> x + 1)

; sum = list/fold 0 (+) numbers 

; factorial =
    | n ? n < 0 -> #error "negative input"
    | 0 -> #ok 1
    | n -> #ok (n * compute (n - 1))

; compose = f -> g -> x -> f (g x)
`;

  let document: TextDocument;

  beforeAll(async () => {
    await initializeParser();
    document = TextDocument.create(
      "file:///example.ss",
      "scrapscript",
      1,
      exampleCode
    );
  });

  describe("Parser", () => {
    it("should initialize parser successfully", async () => {
      await expect(initializeParser()).resolves.not.toThrow();
    });

    it("should parse valid ScrapScript code", () => {
      const tree = parse(exampleCode);
      expect(tree.rootNode).toBeDefined();
      expect(tree.rootNode.hasError).toBe(false);
    });
  });

  describe("Validation", () => {
    it("should validate valid ScrapScript code", () => {
      const diagnostics = validateScrapScript(exampleCode, 1000);
      expect(diagnostics).toHaveLength(0);
    });

    it("should detect syntax errors", () => {
      const invalidCode = "; x = 10 + ;";
      const diagnostics = validateScrapScript(invalidCode, 1000);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].severity).toBe(1); // Error severity
    });
  });

  describe("Completion", () => {
    it("should provide operator completions", () => {
      const position = { line: 1, character: 8 }; // After "xyz = x + y"
      const completions = getCompletionItems(document, position);
      expect(completions.some((c: CompletionItem) => c.label === "*")).toBe(
        true
      );
      expect(completions.some((c: CompletionItem) => c.label === "/")).toBe(
        true
      );
    });

    it("should provide tag completions", () => {
      const position = { line: 10, character: 12 }; // After "| 0 -> #"
      const completions = getCompletionItems(document, position);
      expect(completions.some((c: CompletionItem) => c.label === "true")).toBe(
        true
      );
      expect(completions.some((c: CompletionItem) => c.label === "false")).toBe(
        true
      );
    });
  });

  describe("Hover", () => {
    it("should provide hover info for operators", () => {
      const position = { line: 1, character: 8 }; // After "xyz = x + y"
      const hover = getHoverInfo(document, position);
      expect(hover).toBeDefined();
      if (
        hover &&
        typeof hover.contents === "object" &&
        "value" in hover.contents
      ) {
        expect(hover.contents.value).toContain("Operator");
      }
    });

    it("should provide hover info for tags", () => {
      const position = { line: 10, character: 12 }; // After "| 0 -> #"
      const hover = getHoverInfo(document, position);
      expect(hover).toBeDefined();
      if (
        hover &&
        typeof hover.contents === "object" &&
        "value" in hover.contents
      ) {
        expect(hover.contents.value).toContain("Tag");
      }
    });
  });

  describe("Document Symbols", () => {
    it("should find all declarations", () => {
      const symbols = getDocumentSymbols(document);
      expect(symbols.length).toBeGreaterThan(0);

      // Check for specific declarations
      const symbolNames = symbols.map((s) => s.name);
      expect(symbolNames).toContain("double");
      expect(symbolNames).toContain("is-zero");
      expect(symbolNames).toContain("person");
      expect(symbolNames).toContain("numbers");
      expect(symbolNames).toContain("sum");
      expect(symbolNames).toContain("factorial");
      expect(symbolNames).toContain("compose");
    });

    it("should correctly identify symbol kinds", () => {
      const symbols = getDocumentSymbols(document);

      const doubleSymbol = symbols.find((s) => s.name === "double");
      expect(doubleSymbol?.kind).toBe(2); // Function kind

      const personSymbol = symbols.find((s) => s.name === "person");
      expect(personSymbol?.kind).toBe(5); // Object kind

      const numbersSymbol = symbols.find((s) => s.name === "numbers");
      expect(numbersSymbol?.kind).toBe(3); // Array kind
    });
  });
});
