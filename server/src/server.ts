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

// Get the syntax node at a specific position in the document
function getNodeAtPosition(tree: Tree, position: Position): SyntaxNode | null {
  const point = { row: position.line, column: position.character };
  return tree.rootNode.descendantForPosition(point);
}

// Convert a tree-sitter node to a Range
function nodeToRange(node: SyntaxNode): Range {
  return Range.create(
    node.startPosition.row,
    node.startPosition.column,
    node.endPosition.row,
    node.endPosition.column
  );
}

// Get the parent node of a specific type
function getParentOfType(node: SyntaxNode, type: string): SyntaxNode | null {
  let current: SyntaxNode | null = node;
  while (current && current.type !== type) {
    current = current.parent as SyntaxNode | null;
  }
  return current;
}

// Get the text of a node from the document
function getNodeText(document: TextDocument, node: SyntaxNode): string {
  const range = nodeToRange(node);
  return document.getText({
    start: { line: range.start.line, character: range.start.character },
    end: { line: range.end.line, character: range.end.character },
  });
}

// Check if a node is of a specific type
function isNodeOfType(node: SyntaxNode, type: string): boolean {
  return node.type === type;
}

// Find all nodes of a specific type in the tree
export function findNodesOfType(
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
}

// Check if position is within a node's range
function isPositionInNode(position: Position, node: SyntaxNode): boolean {
  const range = nodeToRange(node);

  if (position.line < range.start.line || position.line > range.end.line) {
    return false;
  }

  if (
    position.line === range.start.line &&
    position.character < range.start.character
  ) {
    return false;
  }

  if (
    position.line === range.end.line &&
    position.character > range.end.character
  ) {
    return false;
  }

  return true;
}

// ===== Validator Functions =====
function validateScrapScript(
  text: string,
  maxNumberOfProblems: number
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  try {
    const tree = parse(text);
    const rootNode = tree.rootNode;

    const syntaxErrors = checkSyntaxErrors(rootNode);
    diagnostics.push(...syntaxErrors.slice(0, maxNumberOfProblems));
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

  return diagnostics;
}

function checkSyntaxErrors(rootNode: SyntaxNode): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (rootNode.hasError) {
    const errorNodes = findErrorNodes(rootNode);

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

  return diagnostics;
}

function findErrorNodes(node: SyntaxNode): SyntaxNode[] {
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
}

// ===== Completion Functions =====
const KEYWORDS: string[] = [];
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

function getCompletionItems(
  document: TextDocument,
  position: Position
): CompletionItem[] {
  const text = document.getText();
  const tree = parse(text);
  const node = getNodeAtPosition(tree, position);

  if (!node) {
    return getGlobalCompletions();
  }

  const parent = node.parent;

  if (parent) {
    if (parent.type === "declaration" || getParentOfType(node, "declaration")) {
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
      return getRecordFieldCompletions(parent);
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
      return getTagCompletions();
    }
  }

  return getGlobalCompletions();
}

function getGlobalCompletions(): CompletionItem[] {
  const completions: CompletionItem[] = [];

  KEYWORDS.forEach((keyword) => {
    completions.push({
      label: keyword,
      kind: CompletionItemKind.Keyword,
      detail: "Keyword",
      documentation: getKeywordDocumentation(keyword),
    });
  });

  OPERATORS.forEach((op) => {
    completions.push({
      label: op,
      kind: CompletionItemKind.Operator,
      detail: "Operator",
      documentation: getOperatorDocumentation(op),
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

function getRecordFieldCompletions(parent: any): CompletionItem[] {
  return [
    {
      label: "field",
      kind: CompletionItemKind.Field,
      detail: "Record field",
      documentation: "Access a field of the record",
    },
  ];
}

function getTagCompletions(): CompletionItem[] {
  const commonTags = [
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
  ];

  return commonTags.map((tag) => ({
    label: tag,
    kind: CompletionItemKind.EnumMember,
    detail: "Tag",
    documentation: `Common tag: #${tag}`,
  }));
}

function getKeywordDocumentation(keyword: string): string {
  switch (keyword) {
    default:
      return `Keyword: ${keyword}`;
  }
}

function getOperatorDocumentation(op: string): string {
  switch (op) {
    case "|>":
      return "Pipeline operator: passes the left value to the function on the right";
    case "==":
      return "Equality operator";
    case "/=":
      return "Inequality operator";
    case "+":
      return "Addition operator";
    case "-":
      return "Subtraction operator";
    case "*":
      return "Multiplication operator";
    case "/":
      return "Division operator";
    case "&&":
      return "Logical AND operator";
    case "||":
      return "Logical OR operator";
    case "->":
      return "Function arrow";
    case ".":
      return "Record field access";
    default:
      return `Operator: ${op}`;
  }
}

// ===== Hover Functions =====
function getHoverInfo(
  document: TextDocument,
  position: Position
): Hover | null {
  const text = document.getText();
  const tree = parse(text);
  const node = getNodeAtPosition(tree, position);

  if (!node) {
    return null;
  }

  const hoverInfo = getHoverForNode(node, document);

  if (!hoverInfo) {
    return null;
  }

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: hoverInfo,
    },
  };
}

function getHoverForNode(node: any, document: TextDocument): string | null {
  const nodeText = getNodeText(document, node);

  switch (node.type) {
    case "id":
      return getIdentifierHover(nodeText);
    case "op":
      return getOperatorHover(nodeText);
    case "tag":
      return getTagHover(node, document);
    case "number":
      return `\`${nodeText}\` (Number)`;
    case "text":
      return `\`${nodeText}\` (Text)`;
    case "bytes":
      return `\`${nodeText}\` (Bytes)`;
    case "fun":
      return getFunctionHover(node, document);
    case "match_fun":
      return getMatchFunctionHover(node, document);
    case "where":
      return `\`where\` declaration - Binds expressions to names in the current scope`;
    default:
      if (node.parent) {
        return getHoverForNode(node.parent, document);
      }
      return null;
  }
}

function getIdentifierHover(id: string): string {
  const builtInInfo = getBuiltInIdentifierInfo(id);
  if (builtInInfo) {
    return builtInInfo;
  }
  return `\`${id}\` (Identifier)`;
}

function getBuiltInIdentifierInfo(id: string): string | null {
  const builtInMap: Record<string, string> = {
    true: "`true` - Boolean constant representing true",
    false: "`false` - Boolean constant representing false",
    map: "`map` - Function to transform each element of a collection",
    filter: "`filter` - Function to filter elements of a collection",
    fold: "`fold` - Function to reduce a collection to a single value",
  };

  return builtInMap[id] || null;
}

function getOperatorHover(op: string): string {
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
}

function getTagHover(node: any, document: TextDocument): string {
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

function getFunctionHover(node: any, document: TextDocument): string {
  return "`Function` - Anonymous function expression";
}

function getMatchFunctionHover(node: any, document: TextDocument): string {
  return "`Match Function` - Pattern matching function expression";
}

// ===== Symbol Functions =====
export function getDocumentSymbols(document: TextDocument): DocumentSymbol[] {
  const text = document.getText();
  const tree = parse(text);
  const rootNode = tree.rootNode;

  const declarations = findNodesOfType(rootNode, "declaration");

  return declarations.map((node) => {
    const patternNode = node.child(0);
    if (!patternNode) {
      return createDocumentSymbol(
        node,
        document,
        "unknown",
        SymbolKind.Variable
      );
    }

    const name =
      patternNode.type === "id"
        ? getNodeText(document, patternNode)
        : getSymbolName(patternNode, document);

    const kind = getSymbolKind(node);

    return createDocumentSymbol(node, document, name, kind);
  });
}

function createDocumentSymbol(
  node: any,
  document: TextDocument,
  name: string,
  kind: SymbolKind
): DocumentSymbol {
  const range = nodeToRange(node);

  let detail = "";

  if (node.parent?.type === "where" && node.child(2)?.type === "fun") {
    detail = "Function";
  } else if (
    node.parent?.type === "where" &&
    node.child(2)?.type === "match_fun"
  ) {
    detail = "Pattern matching function";
  }

  return {
    name,
    kind,
    range,
    selectionRange: range,
    detail,
    children: [],
  };
}

function getSymbolName(node: any, document: TextDocument): string {
  switch (node.type) {
    case "id":
      return getNodeText(document, node);
    case "tag":
      const tagId = node.namedChild(0);
      return tagId ? `#${getNodeText(document, tagId)}` : "#unknown";
    case "record":
      return "{...}";
    case "list":
      return "[...]";
    case "parens":
      const subExpr = node.namedChild(0);
      return subExpr ? `(${getSymbolName(subExpr, document)})` : "(...)";
    default:
      return node.type || "unknown";
  }
}

function getSymbolKind(node: any): SymbolKind {
  const exprNode = node.namedChild(node.namedChildCount - 1);

  if (!exprNode) {
    return SymbolKind.Variable;
  }

  switch (exprNode.type) {
    case "fun":
      return SymbolKind.Function;
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
      if (node.namedChildCount >= 2 && node.namedChild(1)?.type === "id") {
        return SymbolKind.TypeParameter;
      }
      return SymbolKind.Variable;
  }
}

// ===== Server Setup =====
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

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

const documentSettings: Map<string, Thenable<ScrapScriptSettings>> = new Map();

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

function getDocumentSettings(resource: string): Thenable<ScrapScriptSettings> {
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

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
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
    if (!document) {
      return [];
    }

    return getCompletionItems(document, textDocumentPosition.position);
  }
);

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});

connection.onHover(async (params: HoverParams): Promise<Hover | null> => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  return getHoverInfo(document, params.position);
});

documents.listen(connection);
connection.listen();
