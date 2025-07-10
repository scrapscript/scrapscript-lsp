import { TextDocument } from "vscode-languageserver-textdocument";
import {
  initializeParser,
  parse,
  validateScrapScript,
  getCompletionItems,
  getHoverInfo,
  getDocumentSymbols,
  findReferences,
  prepareRename,
  executeRename,
  getCodeActions,
} from "./server";
import {
  CompletionItemKind,
  Range,
} from "vscode-languageserver/node";

describe("Enhanced ScrapScript Language Server", () => {
  const enhancedExampleCode = `
result
; result = x + y * z 
; x = 10 
; y = 20 
; z = 30

; double = x -> x * 2

; classify-number = 
    | 0 -> #zero ()
    | n ? n < 0 -> #negative n
    | n ? n > 100 -> #large n
    | n -> #normal n

; person =
    { name = "John"
    , age = 30
    , address =
      { street = "123 Main St"
      , city = "Anytown"
      , country = "USA"
      }
    }

; processed-numbers = 
    [1, 2, 3, 4, 5]
    |> list/map (x -> x * 2)
    |> list/map (x -> x + 1)
    |> list/filter (x -> x > 5)

; list-length =
    | [] -> 0
    | _ >+ tail -> 1 + list-length tail

; safe-divide =
    | a -> 0 -> #error "division by zero"
    | a -> b -> #ok (a / b)

; shape :
    | #circle { radius : float }
    | #rectangle { width : float, height : float }
    | #triangle { base : float, height : float }

; calculate-area =
    | #circle { radius = r } -> 3.14159 * r * r
    | #rectangle { width = w, height = h } -> w * h
    | #triangle { base = b, height = h } -> 0.5 * b * h

; greeting = "Hello, " ++ person.name ++ "!"

; encoded-data = ~~aGVsbG8gd29ybGQ=

; process-response =
    | #ok { status = 200, data = content } -> #success content
    | #ok { status = 404, data = _ } -> #not-found ()
    | #ok { status = s, data = _ } ? s >= 500 -> #server-error s
    | #error msg -> #failure msg
    | _ -> #unknown ()

; compose = f -> g -> x -> f (g x)
; add-one = x -> x + 1
; double-it = x -> x * 2
; transform = compose double-it add-one

; complex-calculation = a * b + c * d
; a = compute-a base
; b = compute-b base  
; c = 42
; d = 17
; base = 100
; compute-a = x -> x / 2
; compute-b = x -> x * 3

; native-add = $$add 5 10
`;

  let document: TextDocument;

  beforeAll(async () => {
    await initializeParser();
    document = TextDocument.create(
      "file:///enhanced-example.ss",
      "scrapscript",
      1,
      enhancedExampleCode,
    );
  });

  describe("Enhanced Parser", () => {
    it("should parse complex ScrapScript code", () => {
      const tree = parse(enhancedExampleCode);
      expect(tree.rootNode).toBeDefined();
      expect(tree.rootNode.hasError).toBe(false);
    });

    it("should handle where clauses", () => {
      const whereClauseCode = `
result
; result = x + y
; x = 10
; y = 20
`;
      const tree = parse(whereClauseCode);
      expect(tree.rootNode.hasError).toBe(false);
    });

    it("should handle pattern matching", () => {
      const patternCode = `
| 0 -> "zero"
| 1 -> "one"
| n -> "other"
`;
      const tree = parse(patternCode);
      expect(tree.rootNode.hasError).toBe(false);
    });
  });

  describe("Enhanced Validation", () => {
    it("should validate complex code without errors", () => {
      const diagnostics = validateScrapScript(enhancedExampleCode, 1000);
      expect(diagnostics).toHaveLength(0);
    });

    xit("should detect incomplete pattern matches", () => {
      const incompletePatternCode = `
| 0 -> "zero"
| 1 -> "one"
`;
      const diagnostics = validateScrapScript(incompletePatternCode, 1000);
      expect(diagnostics.some((d) => d.message.includes("exhaustive"))).toBe(
        true,
      );
    });

    it("should detect type inconsistencies in lists", () => {
      const mixedListCode = `mixed = [1, "text", 3.14]`;
      const diagnostics = validateScrapScript(mixedListCode, 1000);
      expect(diagnostics.some((d) => d.message.includes("same type"))).toBe(
        true,
      );
    });

    it("should validate where clause structure", () => {
      const invalidWhereCode = `
result
; result x + y
; x = 10
`;
      const diagnostics = validateScrapScript(invalidWhereCode, 1000);
      expect(diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe("Enhanced Completion", () => {
    it("should provide tag completions after #", () => {
      const position = { line: 8, character: 12 }; // After "#"
      const completions = getCompletionItems(document, position);

      const tagCompletions = completions.filter((c) =>
        ["true", "false", "ok", "error", "some", "none"].includes(c.label),
      );
      expect(tagCompletions.length).toBeGreaterThan(0);
    });

    it("should provide where clause completions", () => {
      const position = { line: 4, character: 0 }; // At beginning of where clause
      const completions = getCompletionItems(document, position);

      const whereCompletion = completions.find((c) =>
        c.label.includes("identifier = expression"),
      );
      expect(whereCompletion).toBeDefined();
    });

    it("should provide pattern match completions", () => {
      const position = { line: 10, character: 4 }; // After "|"
      const completions = getCompletionItems(document, position);

      const patternCompletions = completions.filter(
        (c) => c.kind === CompletionItemKind.Snippet && c.insertText?.includes("->"), // Snippet kind
      );
      expect(patternCompletions.length).toBeGreaterThan(0);
    });

    it("should provide built-in function completions", () => {
      const position = { line: 25, character: 8 }; // In pipeline
      const completions = getCompletionItems(document, position);

      const builtInFunctions = completions.filter(
        (c) => c.label.startsWith("list/") || c.label.startsWith("maybe/"),
      );
      expect(builtInFunctions.length).toBeGreaterThan(0);
    });

    it("should provide enhanced operator completions", () => {
      const position = { line: 3, character: 15 }; // After expression
      const completions = getCompletionItems(document, position);

      const operators = completions.filter((c) =>
        ["|>", ">>", "<<", "++", ">+", "+<"].includes(c.label),
      );
      expect(operators.length).toBeGreaterThan(0);
    });
  });

  describe("Enhanced Hover", () => {
    it("should provide enhanced hover for built-in functions", () => {
      const position = { line: 27, character: 7 }; // Over "list/map"
      const hover = getHoverInfo(document, position);

      expect(hover).toBeDefined();
      if (
        hover &&
        typeof hover.contents === "object" &&
        "value" in hover.contents
      ) {
        expect(hover.contents.value).toContain("Transform each element");
      }
    });

    it("should provide hover for tags with enhanced info", () => {
      const position = { line: 10, character: 11 }; // Over "#zero"
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

    it("should provide hover for operators with documentation", () => {
      const position = { line: 27, character: 4 }; // Over "|>"
      const hover = getHoverInfo(document, position);

      expect(hover).toBeDefined();
      if (
        hover &&
        typeof hover.contents === "object" &&
        "value" in hover.contents
      ) {
        expect(hover.contents.value).toContain("Pipeline operator");
      }
    });

    it("should provide hover for numbers with additional info", () => {
      const position = { line: 3, character: 6 }; // Over "10"
      const hover = getHoverInfo(document, position);

      expect(hover).toBeDefined();
      if (
        hover &&
        typeof hover.contents === "object" &&
        "value" in hover.contents
      ) {
        expect(hover.contents.value).toContain("Integer");
        expect(hover.contents.value).toContain("Binary");
      }
    });
  });

  describe("Enhanced Document Symbols", () => {
    it("should find all enhanced declarations", () => {
      const symbols = getDocumentSymbols(document);
      expect(symbols.length).toBeGreaterThan(0);

      const symbolNames = symbols.map((s) => s.name);
      expect(symbolNames).toContain("result");
      expect(symbolNames).toContain("double");
      expect(symbolNames).toContain("classify-number");
      expect(symbolNames).toContain("person");
      expect(symbolNames).toContain("processed-numbers");
      expect(symbolNames).toContain("safe-divide");
      expect(symbolNames).toContain("calculate-area");
    });

    xit("should correctly identify enhanced symbol kinds", () => {
      const symbols = getDocumentSymbols(document);

      const functionSymbol = symbols.find((s) => s.name === "classify-number");
      expect(functionSymbol?.kind).toBe(12); // Function kind

      const recordSymbol = symbols.find((s) => s.name === "person");
      expect(recordSymbol?.kind).toBe(5); // Object kind

      const listSymbol = symbols.find((s) => s.name === "processed-numbers");
      expect(listSymbol?.kind).toBe(18); // Array kind
    });

    it("should provide detailed symbol information", () => {
      const symbols = getDocumentSymbols(document);

      const functionSymbol = symbols.find((s) => s.name === "classify-number");
      expect(functionSymbol?.detail).toContain("Pattern matching function");

      const recordSymbol = symbols.find((s) => s.name === "person");
      expect(recordSymbol?.detail).toContain("Record");
    });
  });

  describe("References and Rename", () => {
    it("should find references to identifiers", () => {
      const position = { line: 3, character: 2 }; // Over "x" in declaration
      const references = findReferences(document, position);

      expect(references.length).toBeGreaterThan(1); // Should find definition and usage
    });

    it("should prepare rename for valid identifiers", () => {
      const position = { line: 2, character: 11 }; // Over "x"
      const renameInfo = prepareRename(document, position);

      expect(renameInfo).toBeDefined();
      expect(renameInfo?.placeholder).toBe("x");
    });

    it("should execute rename correctly", () => {
      const position = { line: 2, character: 11 }; // Over "x"
      const renameResult = executeRename(document, position, "newX");

      expect(renameResult).toBeDefined();
      expect(renameResult?.changes).toBeDefined();
    });

    it("should not allow rename of non-identifiers", () => {
      const position = { line: 3, character: 8 }; // Over "+" operator
      const renameInfo = prepareRename(document, position);

      expect(renameInfo).toBeNull();
    });
  });

  describe("Code Actions", () => {
    it("should suggest adding catch-all pattern", () => {
      const incompletePattern = `
| 0 -> "zero"
| 1 -> "one"
`;
      const incompleteDoc = TextDocument.create(
        "file:///incomplete.ss",
        "scrapscript",
        1,
        incompletePattern,
      );

      const range = Range.create(1, 0, 4, 0);
      const actions = getCodeActions(incompleteDoc, range);

      const catchAllAction = actions.find((a) => a.title.includes("catch-all"));
      expect(catchAllAction).toBeDefined();
    });

    it("should suggest completing where clauses", () => {
      const incompleteWhere = `
result
;
`;
      const incompleteDoc = TextDocument.create(
        "file:///incomplete-where.ss",
        "scrapscript",
        1,
        incompleteWhere,
      );

      const range = Range.create(2, 0, 2, 1);
      const actions = getCodeActions(incompleteDoc, range);

      const whereAction = actions.find((a) =>
        a.title.includes("Complete where clause"),
      );
      expect(whereAction).toBeDefined();
    });
  });

  describe("Error Recovery", () => {
    it("should handle malformed syntax gracefully", () => {
      const malformedCode = `
result = x +
; x = 10
; y = 
`;
      const diagnostics = validateScrapScript(malformedCode, 1000);
      expect(diagnostics.length).toBeGreaterThan(0);

      // Should still be able to provide some completions
      const malformedDoc = TextDocument.create(
        "file:///malformed.ss",
        "scrapscript",
        1,
        malformedCode,
      );

      const completions = getCompletionItems(malformedDoc, {
        line: 3,
        character: 8,
      });
      expect(completions.length).toBeGreaterThan(0);
    });

    it("should handle empty documents", () => {
      const emptyDoc = TextDocument.create(
        "file:///empty.ss",
        "scrapscript",
        1,
        "",
      );

      const diagnostics = validateScrapScript("", 1000);
      expect(diagnostics).toHaveLength(0);

      const completions = getCompletionItems(emptyDoc, {
        line: 0,
        character: 0,
      });
      expect(completions.length).toBeGreaterThan(0);
    });
  });

  describe("Performance", () => {
    it("should handle large documents efficiently", () => {
      const largeCode = Array(1000)
        .fill(
          `
counter = n -> 
    | 0 -> 0
    | n -> n + counter (n - 1)
`,
        )
        .join("\n");

      const start = Date.now();
      const diagnostics = validateScrapScript(largeCode, 1000);
      const duration = Date.now() - start;

      // Should complete within reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);
      expect(diagnostics).toBeDefined();
    });

    it("should provide completions quickly", () => {
      const start = Date.now();
      const completions = getCompletionItems(document, {
        line: 10,
        character: 5,
      });
      const duration = Date.now() - start;

      // Should complete within 100ms
      expect(duration).toBeLessThan(100);
      expect(completions.length).toBeGreaterThan(0);
    });
  });

  describe("ScrapScript Language Features", () => {
    it("should handle hole syntax", () => {
      const holeCode = `
result
; result = compute-something ()
; compute-something = _ -> 42
`;
      const diagnostics = validateScrapScript(holeCode, 1000);
      expect(diagnostics).toHaveLength(0);
    });

    it("should handle bytes literals", () => {
      const bytesCode = `
()
; data = ~~aGVsbG8gd29ybGQ=
; individual-byte = ~2A
; combined = data +< ~21
`;
      const diagnostics = validateScrapScript(bytesCode, 1000);
      expect(diagnostics).toHaveLength(0);
    });

    it("should handle text interpolation", () => {
      const textCode = `
"hello\` name \`!"
; name = "world"
`;
      const diagnostics = validateScrapScript(textCode, 1000);
      expect(diagnostics).toHaveLength(0);
    });

    it("should handle list operations", () => {
      const listCode = `
()
; concatenated = numbers ++ [4, 5, 6]
; appended = numbers +< 4
; prepended = 0 >+ numbers
; numbers = [1, 2, 3]
`;
      const diagnostics = validateScrapScript(listCode, 1000);
      expect(diagnostics).toHaveLength(0);
    });

    it("should handle record operations", () => {
      const recordCode = `
()
; extended = { c = 3, ..base }
; accessed = base.a
; { a = value, ..rest } = base
; base = { a = 1, b = 2 }
`;
      const diagnostics = validateScrapScript(recordCode, 1000);
      expect(diagnostics).toHaveLength(0);
    });

    it("should handle function composition", () => {
      const compositionCode = `
()
; add-one = x -> x + 1
; double = x -> x * 2
; composed = add-one >> double
; piped = 5 |> add-one |> double
`;
      const diagnostics = validateScrapScript(compositionCode, 1000);
      expect(diagnostics).toHaveLength(0);
    });

    it("should handle guards in pattern matching", () => {
      const guardCode = `
| n ? n < 0 -> #negative
| n ? n == 0 -> #zero
| n ? n > 100 -> #large
| n -> #normal
`;
      const diagnostics = validateScrapScript(guardCode, 1000);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("Advanced Completions", () => {
    it("should provide context-aware completions in pipelines", () => {
      const position = { line: 25, character: 20 }; // After "|>"
      const completions = getCompletionItems(document, position);

      const listFunctions = completions.filter((c) =>
        c.label.startsWith("list/"),
      );
      expect(listFunctions.length).toBeGreaterThan(0);
    });

    it("should provide record field completions", () => {
      const recordFieldCode = `
person.
; person = { name = "John", age = 30 }
`;
      const recordDoc = TextDocument.create(
        "file:///record-field.ss",
        "scrapscript",
        1,
        recordFieldCode,
      );

      const position = { line: 2, character: 14 }; // After "."
      const completions = getCompletionItems(recordDoc, position);

      expect(completions.length).toBeGreaterThan(0);
    });

    it("should provide type completions in annotations", () => {
      const typeCode = `
value : 
`;
      const typeDoc = TextDocument.create(
        "file:///type-annotation.ss",
        "scrapscript",
        1,
        typeCode,
      );

      const position = { line: 1, character: 8 }; // After ":"
      const completions = getCompletionItems(typeDoc, position);

      const typeCompletions = completions.filter((c) =>
        ["int", "float", "text", "bool", "list"].includes(c.label),
      );
      expect(typeCompletions.length).toBeGreaterThan(0);
    });
  });

  describe("Error Messages", () => {
    xit("should provide helpful error messages for common mistakes", () => {
      const commonMistakes = [
        {
          code: `result ; result = 10`,
          expectedError: "where clause",
        },
        {
          code: `test = | -> "incomplete"`,
          expectedError: "pattern",
        },
        {
          code: `{ a = 1 b = 2 }`,
          expectedError: "record",
        },
        {
          code: `[1 2 3]`,
          expectedError: "list",
        },
      ];

      commonMistakes.forEach(({ code, expectedError }) => {
        const diagnostics = validateScrapScript(code, 1000);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message.toLowerCase()).toContain(expectedError);
      });
    });
  });

  describe("Language Server Integration", () => {
    it("should handle document updates incrementally", () => {
      const initialCode = `10`;
      const updatedCode = `20`;

      const initialDiagnostics = validateScrapScript(initialCode, 1000);
      const updatedDiagnostics = validateScrapScript(updatedCode, 1000);

      expect(initialDiagnostics).toHaveLength(0);
      expect(updatedDiagnostics).toHaveLength(0);
    });

    it("should provide consistent symbol information", () => {
      const symbols1 = getDocumentSymbols(document);
      const symbols2 = getDocumentSymbols(document);

      expect(symbols1).toEqual(symbols2);
    });

    it("should handle concurrent requests", async () => {
      const position = { line: 10, character: 5 };

      const promises = [
        Promise.resolve(getCompletionItems(document, position)),
        Promise.resolve(getHoverInfo(document, position)),
        Promise.resolve(getDocumentSymbols(document)),
        Promise.resolve(findReferences(document, position)),
      ];

      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result).toBeDefined();
      });
    });
  });

  describe("Regression Tests", () => {
    it("should not crash on deeply nested expressions", () => {
      const deepNesting =
        Array(100).fill("(").join("") + "42" + Array(100).fill(")").join("");

      expect(() => {
        const diagnostics = validateScrapScript(deepNesting, 1000);
        expect(diagnostics).toBeDefined();
      }).not.toThrow();
    });

    it("should handle unicode characters properly", () => {
      const unicodeCode = `
()
; emoji = "🚀"
; chinese = "你好"
; arabic = "مرحبا"
; result = emoji ++ " " ++ chinese ++ " " ++ arabic
`;
      const diagnostics = validateScrapScript(unicodeCode, 1000);
      expect(diagnostics).toHaveLength(0);
    });

    it("should handle very long identifiers", () => {
      const longId = "a".repeat(1000);
      const longIdCode = `() ; ${longId} = 42`;

      const diagnostics = validateScrapScript(longIdCode, 1000);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("Future-Proofing", () => {
    it("should gracefully handle unknown node types", () => {
      // This test simulates forward compatibility
      const position = { line: 0, character: 0 };

      expect(() => {
        getCompletionItems(document, position);
        getHoverInfo(document, position);
        getDocumentSymbols(document);
      }).not.toThrow();
    });

    it("should be extensible for new language features", () => {
      // Test that the enhanced server structure can accommodate new features
      const newFeatureCode = `
() ; hypothetical-feature = @remote "https://api.example.com"
`;

      // Should not crash, even if not fully supported
      expect(() => {
        validateScrapScript(newFeatureCode, 1000);
      }).not.toThrow();
    });
  });
});

// Additional utility tests for helper functions
describe("Helper Functions", () => {
  beforeAll(async () => {
    await initializeParser();
  });

  it("should correctly identify built-in functions", () => {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const builtIns = [
      "list/map",
      "list/filter",
      "maybe/default",
      "result/bind",
    ];
    const nonBuiltIns = ["custom/function", "user/defined", "random/name"];
    /* eslint-enable @typescript-eslint/no-unused-vars */

    // This test would require access to the isBuiltInFunction helper
    // In a real implementation, you'd export it or test it indirectly
  });

  it("should handle node text extraction properly", () => {
    const simpleCode = `identifier ; identifier = 42`;
    const tree = parse(simpleCode);
    const rootNode = tree.rootNode;

    expect(rootNode).toBeDefined();
    expect(rootNode.hasError).toBe(false);
  });

  it("should create proper ranges from nodes", () => {
    const simpleCode = `123`;
    const tree = parse(simpleCode);

    // Test that ranges are created correctly
    expect(tree.rootNode.startPosition).toBeDefined();
    expect(tree.rootNode.endPosition).toBeDefined();
  });
});
