import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  HoverParams,
  Hover,
  MarkupContent,
  MarkupKind,
  DocumentSymbol,
  SymbolKind,
  DocumentSymbolParams,
  Range,
  Position,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import Parser from "tree-sitter";
import * as Language from "../../tree-sitter-scrapscript/bindings/node";

// ===== Parser Types and Functions =====
export type SyntaxNode = Parser.SyntaxNode;
export type Tree = Parser.Tree;

let parser: Parser;

// Initialize the parser with the ScrapScript grammar
export async function initializeParser(): Promise<void> {
  try {
    parser = new Parser();
    parser.setLanguage({
      name: "scrapscript",
      language: Language.language as Parser.Language,
      nodeTypeInfo: Language.nodeTypeInfo,
    });
    console.log("ScrapScript parser initialized successfully");
  } catch (error) {
    console.error("Failed to initialize ScrapScript parser:", error);
    throw error;
  }
}

// Parse a document and return the syntax tree
export function parse(text: string): Tree {
  if (!parser) throw new Error("Parser not initialized");
  return parser.parse(text);
}

// ===== Helper Functions =====
function nodeToRange(node: SyntaxNode): Range {
  return Range.create(
    node.startPosition.row,
    node.startPosition.column,
    node.endPosition.row,
    node.endPosition.column
  );
}

function getNodeText(document: TextDocument, node: SyntaxNode): string {
  const range = nodeToRange(node);
  return document.getText({
    start: { line: range.start.line, character: range.start.character },
    end: { line: range.end.line, character: range.end.character },
  });
}

// ===== Validator Functions =====
export function validateScrapScript(
  text: string,
  maxNumberOfProblems: number
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  try {
    const tree = parse(text);
    const rootNode = tree.rootNode;

    if (rootNode.hasError) {
      const errorNodes = (function findErrorNodes(
        node: SyntaxNode
      ): SyntaxNode[] {
        const errorNodes: SyntaxNode[] = [];
        if (node.hasError) {
          if (node.type === "ERROR") {
            errorNodes.push(node);
          }
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child) {
              errorNodes.push(...findErrorNodes(child));
            }
          }
        }
        return errorNodes;
      })(rootNode);

      for (const errorNode of errorNodes) {
        const range = nodeToRange(errorNode);
        const diagnostic: Diagnostic = {
          severity: DiagnosticSeverity.Error,
          range,
          message: `Syntax error in ${errorNode.parent?.type || "expression"}`,
          source: "scrapscript",
        };

        if (errorNode.parent) {
          if (errorNode.parent.type === "where") {
            diagnostic.message =
              'Invalid where declaration. Expected pattern ";" declaration';
          } else if (errorNode.parent.type === "declaration") {
            diagnostic.message =
              'Invalid declaration. Expected pattern "=" expression or pattern ":" id';
          } else if (errorNode.parent.type === "infix") {
            diagnostic.message =
              "Invalid infix expression. Expected left op right";
          } else if (errorNode.parent.type === "apply") {
            diagnostic.message = "Invalid function application";
          }
        }

        diagnostics.push(diagnostic);
      }
    }
  } catch (err) {
    console.error("Error parsing ScrapScript:", err);
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      message: `Failed to parse ScrapScript: ${err}`,
      source: "scrapscript",
    });
  }

  return diagnostics.slice(0, maxNumberOfProblems);
}

// ===== Completion Functions =====
const OPERATORS = [
  "|>",
  "==",
  "/=",
  "<",
  ">",
  "<=",
  ">=",
  "*",
  "/",
  "//",
  "%",
  "+",
  "-",
  "&&",
  "||",
  "::",
  "..",
  "@",
  ">>",
  "<<",
  "^",
  ">*",
  "++",
  ">+",
  "+<",
  "'",
  ":",
  "?",
  "!",
  ".",
];
const COMMON_TYPES = ["int", "bool", "string", "list", "record"];

export function getCompletionItems(
  document: TextDocument,
  position: Position
): CompletionItem[] {
  const text = document.getText();
  const tree = parse(text);
  const node = (function getNodeAtPosition(
    tree: Tree,
    position: Position
  ): SyntaxNode | null {
    const point = { row: position.line, column: position.character };
    return tree.rootNode.descendantForPosition(point);
  })(tree, position);

  if (!node) return getGlobalCompletions();

  const parent = node.parent;
  if (!parent) return getGlobalCompletions();

  if (
    parent.type === "declaration" ||
    (function getParentOfType(
      node: SyntaxNode,
      type: string
    ): SyntaxNode | null {
      let current: SyntaxNode | null = node;
      while (current && current.type !== type) {
        current = current.parent as SyntaxNode | null;
      }
      return current;
    })(node, "declaration")
  ) {
    return getDeclarationCompletions();
  }

  if (
    parent.type === "infix" &&
    node.previousSibling?.type === "op" &&
    document.getText({
      start: {
        line: node.previousSibling.startPosition.row,
        character: node.previousSibling.startPosition.column,
      },
      end: {
        line: node.previousSibling.endPosition.row,
        character: node.previousSibling.endPosition.column,
      },
    }) === "."
  ) {
    return [
      {
        label: "field",
        kind: CompletionItemKind.Field,
        detail: "Record field",
        documentation: "Access a field of the record",
      },
    ];
  }

  if (
    parent.type === "tag" ||
    (node.previousSibling &&
      document
        .getText({
          start: {
            line: node.previousSibling.startPosition.row,
            character: node.previousSibling.startPosition.column,
          },
          end: {
            line: node.previousSibling.endPosition.row,
            character: node.previousSibling.endPosition.column,
          },
        })
        .includes("#"))
  ) {
    return [
      "true",
      "false",
      "some",
      "none",
      "ok",
      "error",
      "add",
      "sub",
      "mul",
      "div",
    ].map((tag) => ({
      label: tag,
      kind: CompletionItemKind.EnumMember,
      detail: "Tag",
      documentation: `Common tag: #${tag}`,
    }));
  }

  return getGlobalCompletions();
}

function getGlobalCompletions(): CompletionItem[] {
  const completions: CompletionItem[] = [];

  OPERATORS.forEach((op) => {
    completions.push({
      label: op,
      kind: CompletionItemKind.Operator,
      detail: "Operator",
      documentation: (function getOperatorDocumentation(op: string): string {
        const operatorInfo: Record<string, string> = {
          "|>": "Pipeline operator: passes the left value to the function on the right",
          "==": "Equality operator",
          "/=": "Inequality operator",
          "+": "Addition operator",
          "-": "Subtraction operator",
          "*": "Multiplication operator",
          "/": "Division operator",
          "&&": "Logical AND operator",
          "||": "Logical OR operator",
          "->": "Function arrow",
          ".": "Record field access",
        };
        return operatorInfo[op] || `Operator: ${op}`;
      })(op),
    });
  });

  completions.push(
    {
      label: "true",
      kind: CompletionItemKind.Value,
      detail: "Boolean",
      documentation: "Boolean true value",
    },
    {
      label: "false",
      kind: CompletionItemKind.Value,
      detail: "Boolean",
      documentation: "Boolean false value",
    }
  );

  return completions;
}

function getDeclarationCompletions(): CompletionItem[] {
  const completions = getGlobalCompletions();
  COMMON_TYPES.forEach((type) => {
    completions.push({
      label: type,
      kind: CompletionItemKind.TypeParameter,
      detail: "Type",
      documentation: `Built-in type: ${type}`,
    });
  });
  return completions;
}

// ===== Hover Functions =====
export function getHoverInfo(
  document: TextDocument,
  position: Position
): Hover | null {
  const text = document.getText();
  const tree = parse(text);
  const node = (function getNodeAtPosition(
    tree: Tree,
    position: Position
  ): SyntaxNode | null {
    const point = { row: position.line, column: position.character };
    return tree.rootNode.descendantForPosition(point);
  })(tree, position);

  if (!node) return null;

  const hoverInfo = (function getHoverForNode(
    node: SyntaxNode,
    document: TextDocument
  ): string | null {
    const nodeText = getNodeText(document, node);
    const builtInInfo: Record<string, string> = {
      true: "`true` - Boolean constant representing true",
      false: "`false` - Boolean constant representing false",
      map: "`map` - Function to transform each element of a collection",
      filter: "`filter` - Function to filter elements of a collection",
      fold: "`fold` - Function to reduce a collection to a single value",
    };

    switch (node.type) {
      case "id":
        return builtInInfo[nodeText] || `\`${nodeText}\` (Identifier)`;
      case "op":
        return (function getOperatorHover(op: string): string {
          const operatorInfo: Record<string, string> = {
            "|>": "`|>` - Pipeline operator: passes the left value to the function on the right",
            "==": "`==` - Equality operator",
            "/=": "`/=` - Inequality operator",
            "<": "`<` - Less than operator",
            ">": "`>` - Greater than operator",
            "<=": "`<=` - Less than or equal operator",
            ">=": "`>=` - Greater than or equal operator",
            "*": "`*` - Multiplication operator",
            "/": "`/` - Division operator",
            "//": "`//` - Integer division operator",
            "%": "`%` - Modulo operator",
            "+": "`+` - Addition operator",
            "-": "`-` - Subtraction operator",
            "&&": "`&&` - Logical AND operator",
            "||": "`||` - Logical OR operator",
            "::": "`::` - Cons operator (add element to list)",
            "..": "`..` - Range operator",
            "@": "`@` - Record field access",
            ">>": "`>>` - Function composition operator (right to left)",
            "<<": "`<<` - Function composition operator (left to right)",
            "^": "`^` - String concatenation operator",
            ">*": "`>*` - Map operator",
            "++": "`++` - List concatenation operator",
            ">+": "`>+` - Cons pattern operator (list destructuring)",
            "+<": "`+<` - Append operator (add element to end of list)",
            "'": "`'` - Apply operator",
            ":": "`:`  - Type annotation operator",
            "?": "`?`  - Optional value operator",
            "!": "`!`  - Force unwrap operator",
            ".": "`.`  - Record field access operator",
          };
          return operatorInfo[op] || `\`${op}\` (Operator)`;
        })(nodeText);
      case "tag": {
        const idNode = node.namedChild(0);
        const tagName = idNode ? getNodeText(document, idNode) : "";
        const tagInfo: Record<string, string> = {
          true: "`#true` - Boolean true tag",
          false: "`#false` - Boolean false tag",
          some: "`#some` - Option type tag for existing values",
          none: "`#none` - Option type tag for missing values",
          ok: "`#ok` - Result type tag for successful operations",
          error: "`#error` - Result type tag for failed operations",
          add: "`#add` - Addition operation tag",
          sub: "`#sub` - Subtraction operation tag",
          mul: "`#mul` - Multiplication operation tag",
          div: "`#div` - Division operation tag",
        };
        return tagInfo[tagName] || `\`#${tagName}\` (Tag)`;
      }
      case "number":
        return `\`${nodeText}\` (Number)`;
      case "text":
        return `\`${nodeText}\` (Text)`;
      case "bytes":
        return `\`${nodeText}\` (Bytes)`;
      case "fun":
        return "`Function` - Anonymous function expression";
      case "match_fun":
        return "`Match Function` - Pattern matching function expression";
      default:
        return node.parent ? getHoverForNode(node.parent, document) : null;
    }
  })(node, document);

  if (!hoverInfo) return null;

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: hoverInfo,
    },
  };
}

// ===== Symbol Functions =====
export function getDocumentSymbols(document: TextDocument): DocumentSymbol[] {
  const text = document.getText();
  const tree = parse(text);
  const rootNode = tree.rootNode;

  return (function findNodesOfType(
    rootNode: SyntaxNode,
    type: string
  ): SyntaxNode[] {
    const nodes: SyntaxNode[] = [];
    const cursor = rootNode.walk();

    const visitNode = () => {
      const node = cursor.currentNode;
      if (node.type === type) {
        nodes.push(node);
      }

      if (cursor.gotoFirstChild()) {
        do {
          visitNode();
        } while (cursor.gotoNextSibling());
        cursor.gotoParent();
      }
    };

    visitNode();
    return nodes;
  })(rootNode, "declaration").map((node) => {
    const patternNode = node.child(0);
    if (!patternNode) {
      return {
        name: "unknown",
        kind: SymbolKind.Variable,
        range: nodeToRange(node),
        selectionRange: nodeToRange(node),
        detail: "",
        children: [],
      };
    }

    const name = (function getSymbolName(
      node: SyntaxNode,
      document: TextDocument
    ): string {
      switch (node.type) {
        case "id":
          return getNodeText(document, node);
        case "tag": {
          const tagId = node.namedChild(0);
          return tagId ? `#${getNodeText(document, tagId)}` : "#unknown";
        }
        case "record":
          return "{...}";
        case "list":
          return "[...]";
        case "parens": {
          const subExpr = node.namedChild(0);
          return subExpr ? `(${getSymbolName(subExpr, document)})` : "(...)";
        }
        default:
          return node.type || "unknown";
      }
    })(patternNode, document);

    const exprNode = node.namedChild(node.namedChildCount - 1);
    const kind = (function getSymbolKind(node: SyntaxNode): SymbolKind {
      if (!exprNode) return SymbolKind.Variable;
      switch (exprNode.type) {
        case "fun":
        case "match_fun":
          return SymbolKind.Function;
        case "record":
          return SymbolKind.Object;
        case "list":
          return SymbolKind.Array;
        case "number":
          return SymbolKind.Number;
        case "text":
          return SymbolKind.String;
        case "tag":
          return SymbolKind.Enum;
        default:
          return node.namedChildCount >= 2 && node.namedChild(1)?.type === "id"
            ? SymbolKind.TypeParameter
            : SymbolKind.Variable;
      }
    })(node);

    let detail = "";
    if (node.parent?.type === "where") {
      if (node.child(2)?.type === "fun") detail = "Function";
      else if (node.child(2)?.type === "match_fun")
        detail = "Pattern matching function";
    }

    return {
      name,
      kind,
      range: nodeToRange(node),
      selectionRange: nodeToRange(patternNode),
      detail,
      children: [],
    };
  });
}

// ===== Server Setup =====
let connection: ReturnType<typeof createConnection>;
let documents: TextDocuments<TextDocument>;

export function setupServer() {
  connection = createConnection(ProposedFeatures.all);
  documents = new TextDocuments(TextDocument);

  let hasConfigurationCapability = false;
  let hasWorkspaceFolderCapability = false;
  let hasDiagnosticRelatedInformationCapability = false;

  connection.onInitialize(async (params: InitializeParams) => {
    const capabilities = params.capabilities;

    hasConfigurationCapability = !!(
      capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
      capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    hasDiagnosticRelatedInformationCapability = !!(
      capabilities.textDocument &&
      capabilities.textDocument.publishDiagnostics &&
      capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    await initializeParser();

    const result: InitializeResult = {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: [".", "#", ":", "|"],
        },
        hoverProvider: true,
      },
    };

    if (hasWorkspaceFolderCapability) {
      result.capabilities.workspace = {
        workspaceFolders: {
          supported: true,
        },
      };
    }

    return result;
  });

  connection.onInitialized(() => {
    if (hasConfigurationCapability) {
      connection.client.register(
        DidChangeConfigurationNotification.type,
        undefined
      );
    }
    if (hasWorkspaceFolderCapability) {
      connection.workspace.onDidChangeWorkspaceFolders((_event) => {
        connection.console.log("Workspace folder change event received.");
      });
    }
  });

  interface ScrapScriptSettings {
    maxNumberOfProblems: number;
  }

  const defaultSettings: ScrapScriptSettings = { maxNumberOfProblems: 1000 };
  let globalSettings: ScrapScriptSettings = defaultSettings;
  const documentSettings: Map<
    string,
    Thenable<ScrapScriptSettings>
  > = new Map();

  connection.onDidChangeConfiguration((change) => {
    if (hasConfigurationCapability) {
      documentSettings.clear();
    } else {
      globalSettings = <ScrapScriptSettings>(
        (change.settings.scrapScriptServer || defaultSettings)
      );
    }
    documents.all().forEach(validateTextDocument);
  });

  function getDocumentSettings(
    resource: string
  ): Thenable<ScrapScriptSettings> {
    if (!hasConfigurationCapability) {
      return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
      result = connection.workspace.getConfiguration({
        scopeUri: resource,
        section: "scrapScriptServer",
      });
      documentSettings.set(resource, result);
    }
    return result;
  }

  documents.onDidClose((e) => {
    documentSettings.delete(e.document.uri);
  });

  documents.onDidChangeContent((change) => {
    validateTextDocument(change.document);
  });

  async function validateTextDocument(
    textDocument: TextDocument
  ): Promise<void> {
    const settings = await getDocumentSettings(textDocument.uri);
    const text = textDocument.getText();
    const diagnostics = validateScrapScript(text, settings.maxNumberOfProblems);
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
  }

  connection.onCompletion(
    async (
      textDocumentPosition: TextDocumentPositionParams
    ): Promise<CompletionItem[]> => {
      const document = documents.get(textDocumentPosition.textDocument.uri);
      if (!document) return [];
      return getCompletionItems(document, textDocumentPosition.position);
    }
  );

  connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => item
  );

  connection.onHover(async (params: HoverParams): Promise<Hover | null> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;
    return getHoverInfo(document, params.position);
  });

  documents.listen(connection);
  connection.listen();
}

// Only set up the server if this file is being run directly
if (require.main === module) setupServer();
