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
  SemanticTokensParams,
  SemanticTokens,
  SemanticTokensBuilder,
  ReferenceParams,
  Location,
  PrepareRenameParams,
  RenameParams,
  WorkspaceEdit,
  CodeActionParams,
  CodeAction,
  CodeActionKind,
  TextEdit,
  InsertTextFormat,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import Parser from "tree-sitter";
import * as Language from "tree-sitter-scrapscript/bindings/node";

// ===== Enhanced Types and Constants =====
export type SyntaxNode = Parser.SyntaxNode;
export type Tree = Parser.Tree;

let parser: Parser;

// Enhanced operators from ScrapScript guide
const OPERATORS = [
  // Arithmetic
  "+",
  "-",
  "*",
  "/",
  "//",
  "%",
  "^",
  // Comparison
  "==",
  "/=",
  "<",
  ">",
  "<=",
  ">=",
  // Logical
  "&&",
  "||",
  // List operations
  "::",
  "++",
  ">+",
  "+<",
  // Function composition
  ">>",
  "<<",
  "|>",
  // Record/access
  ".",
  // Pattern matching
  "->",
  "|",
  // Type annotation
  ":",
  // Other
  "?",
  "!",
  "'",
  "..",
];

const BUILT_IN_FUNCTIONS = [
  // List functions
  "list/map",
  "list/filter",
  "list/fold",
  "list/first",
  "list/last",
  "list/head",
  "list/tail",
  "list/length",
  "list/reverse",
  "list/sort",
  "list/sum",
  "list/product",
  "list/concat",
  "list/flatten",

  // Maybe functions
  "maybe/default",
  "maybe/map",
  "maybe/bind",
  "maybe/with-default",

  // Result functions
  "result/map",
  "result/bind",
  "result/default",
  "result/map-error",

  // Text functions
  "text/length",
  "text/to-upper",
  "text/to-lower",
  "text/split",
  "text/join",
  "text/trim",
  "text/starts-with",
  "text/ends-with",
  "text/contains",

  // Bytes functions
  "bytes/to-utf8-text",
  "bytes/from-utf8-text",
  "bytes/length",

  // Type conversion
  "to-float",
  "to-int",
  "round",
  "ceil",
  "floor",

  // Dictionary functions
  "dict/get",
  "dict/set",
  "dict/has",
  "dict/keys",
  "dict/values",
  "dict/map",
  "dict/filter",
  "dict/fold",

  // IO functions (platform-dependent)
  "io/print",
  "io/read",
  "io/write",

  // Remote functions
  "remote/fetch",
  "remote/post",
  "remote/get",
];

const COMMON_TAGS = [
  "true",
  "false",
  "some",
  "none",
  "ok",
  "error",
  "success",
  "failure",
  "left",
  "right",
  "just",
  "nothing",
  "add",
  "sub",
  "mul",
  "div",
  "mod",
  "vanilla",
  "chocolate",
  "strawberry", // Example from guide
  "circle",
  "rectangle",
  "triangle", // Shape examples
];

const COMMON_TYPES = [
  "int",
  "float",
  "text",
  "bytes",
  "bool",
  "list",
  "record",
  "fun",
  "maybe",
  "result",
  "remote",
  "platform",
  "dict",
  "array",
];

const KEYWORDS: string[] = [];

// ===== Parser Functions =====
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
    node.endPosition.column,
  );
}

function getNodeText(document: TextDocument, node: SyntaxNode): string {
  const range = nodeToRange(node);
  return document.getText({
    start: { line: range.start.line, character: range.start.character },
    end: { line: range.end.line, character: range.end.character },
  });
}

function getNodeAtPosition(tree: Tree, position: Position): SyntaxNode | null {
  const point = { row: position.line, column: position.character };
  return tree.rootNode.descendantForPosition(point);
}

function findParentOfType(node: SyntaxNode, type: string): SyntaxNode | null {
  let current: SyntaxNode | null = node;
  while (current && current.type !== type) {
    current = current.parent as SyntaxNode | null;
  }
  return current;
}

function walkTree(
  node: SyntaxNode,
  callback: (node: SyntaxNode) => void,
): void {
  callback(node);
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child) {
      walkTree(child, callback);
    }
  }
}

// ===== Enhanced Validation =====
export function validateScrapScript(
  text: string,
  maxNumberOfProblems: number,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  try {
    const tree = parse(text);
    const rootNode = tree.rootNode;

    // Enhanced error detection
    if (rootNode.hasError) {
      const errorNodes = findErrorNodes(rootNode);

      for (const errorNode of errorNodes) {
        const range = nodeToRange(errorNode);
        const diagnostic = createDiagnosticForError(errorNode, range);
        diagnostics.push(diagnostic);
      }
    }

    // Additional validations
    validatePatternMatching(rootNode, diagnostics);
    validateTypeConsistency(rootNode, diagnostics, text);
    validateWhereClauseStructure(rootNode, diagnostics);
    validateRecordSyntax(rootNode, diagnostics);
    validateListSyntax(rootNode, diagnostics);
    validateFunctionSyntax(rootNode, diagnostics);
  } catch (err) {
    console.error("Error parsing ScrapScript:", err);
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: Range.create(0, 0, 0, 0),
      message: `Failed to parse ScrapScript: ${err}`,
      source: "scrapscript",
    });
  }

  return diagnostics.slice(0, maxNumberOfProblems);
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

function createDiagnosticForError(
  errorNode: SyntaxNode,
  range: Range,
): Diagnostic {
  const parent = errorNode.parent;
  let message = `Syntax error in ${parent?.type || "expression"}`;

  if (parent) {
    switch (parent.type) {
      case "where":
        message =
          'Invalid where clause. Expected pattern "; identifier = expression"';
        break;
      case "declaration":
        message = 'Invalid declaration. Expected "identifier = expression"';
        break;
      case "pattern_match":
        message = 'Invalid pattern match. Expected "| pattern -> expression"';
        break;
      case "function":
        message = 'Invalid function. Expected "parameter -> expression"';
        break;
      case "record":
        message = 'Invalid record. Expected "{ field = value, ... }"';
        break;
      case "list":
        message = 'Invalid list. Expected "[element1, element2, ...]"';
        break;
      case "tag":
        message = 'Invalid tag. Expected "#identifier"';
        break;
      case "infix":
        message = "Invalid infix expression. Expected left operator right";
        break;
      case "apply":
        message = "Invalid function application";
        break;
      default:
        message = `Syntax error in ${parent.type}`;
    }
  }

  return {
    severity: DiagnosticSeverity.Error,
    range,
    message,
    source: "scrapscript",
  };
}

function validatePatternMatching(
  node: SyntaxNode,
  diagnostics: Diagnostic[],
): void {
  walkTree(node, (currentNode) => {
    if (
      currentNode.type === "match_fun" ||
      currentNode.type === "pattern_match"
    ) {
      const patterns = [];
      for (let i = 0; i < currentNode.namedChildCount; i++) {
        const child = currentNode.namedChild(i);
        if (child?.type === "pattern_case") {
          patterns.push(child);
        }
      }

      // Check if there's a catch-all pattern
      const hasCatchAll = patterns.some((pattern) => {
        const patternNode = pattern.namedChild(0);
        if (!patternNode) return false;

        // Check for various catch-all patterns
        return (
          (patternNode.type === "id" &&
            (patternNode.text === "_" || /^[a-z]/.test(patternNode.text))) ||
          patternNode.type === "hole"
        );
      });

      if (patterns.length > 0 && !hasCatchAll) {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: nodeToRange(currentNode),
          message:
            "Pattern match may not be exhaustive. Consider adding a catch-all case like '| _ -> ()'.",
          source: "scrapscript",
        });
      }
    }
  });
}

function validateTypeConsistency(
  node: SyntaxNode,
  diagnostics: Diagnostic[],
  text: string,
): void {
  walkTree(node, (currentNode) => {
    if (currentNode.type === "list") {
      const elementTypes = new Set<string>();

      for (let i = 0; i < currentNode.namedChildCount; i++) {
        const element = currentNode.namedChild(i);
        if (element) {
          const elementType = inferBasicType(element);
          if (elementType) {
            elementTypes.add(elementType);
          }
        }
      }

      if (elementTypes.size > 1) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: nodeToRange(currentNode),
          message: `List elements must have the same type. Found: ${Array.from(elementTypes).join(", ")}`,
          source: "scrapscript",
        });
      }
    }
  });
}

function inferBasicType(node: SyntaxNode): string | null {
  switch (node.type) {
    case "number":
      return node.text.includes(".") ? "float" : "int";
    case "text":
      return "text";
    case "bytes":
      return "bytes";
    case "tag":
      return "tag";
    case "list":
      return "list";
    case "record":
      return "record";
    case "fun":
    case "match_fun":
      return "function";
    case "hole":
      return "hole";
    default:
      return null;
  }
}

function validateWhereClauseStructure(
  node: SyntaxNode,
  diagnostics: Diagnostic[],
): void {
  walkTree(node, (currentNode) => {
    if (currentNode.type === "where") {
      // Check for proper "; identifier = expression" structure
      let hasProperStructure = false;

      for (let i = 0; i < currentNode.childCount; i++) {
        const child = currentNode.child(i);
        if (child?.type === ";" && i + 2 < currentNode.childCount) {
          const nextChild = currentNode.child(i + 1);
          const followingChild = currentNode.child(i + 2);

          if (nextChild?.type === "id" && followingChild?.type === "=") {
            hasProperStructure = true;
            break;
          }
        }
      }

      if (!hasProperStructure) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: nodeToRange(currentNode),
          message: 'Invalid where clause. Expected "; identifier = expression"',
          source: "scrapscript",
        });
      }
    }
  });
}

function validateRecordSyntax(
  node: SyntaxNode,
  diagnostics: Diagnostic[],
): void {
  walkTree(node, (currentNode) => {
    if (currentNode.type === "record") {
      // Validate record field syntax
      for (let i = 0; i < currentNode.namedChildCount; i++) {
        const field = currentNode.namedChild(i);
        if (field?.type === "record_field") {
          // Check field structure: "key = value"
          const hasValidStructure = field.namedChildCount >= 2;
          if (!hasValidStructure) {
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: nodeToRange(field),
              message: 'Invalid record field. Expected "field = value"',
              source: "scrapscript",
            });
          }
        }
      }
    }
  });
}

function validateListSyntax(node: SyntaxNode, diagnostics: Diagnostic[]): void {
  walkTree(node, (currentNode) => {
    if (currentNode.type === "list") {
      // Check for trailing commas and proper separators
      const text = currentNode.text;
      if (text.includes(",,") || text.includes("[,") || text.includes(",]")) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: nodeToRange(currentNode),
          message:
            "Invalid list syntax. Check for extra commas or missing elements.",
          source: "scrapscript",
        });
      }
    }
  });
}

function validateFunctionSyntax(
  node: SyntaxNode,
  diagnostics: Diagnostic[],
): void {
  walkTree(node, (currentNode) => {
    if (currentNode.type === "fun") {
      // Check for proper arrow function syntax
      const hasArrow = currentNode.text.includes("->");
      if (!hasArrow) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: nodeToRange(currentNode),
          message:
            'Invalid function syntax. Expected "parameter -> expression"',
          source: "scrapscript",
        });
      }
    }
  });
}

// ===== Enhanced Completion =====
export function getCompletionItems(
  document: TextDocument,
  position: Position,
): CompletionItem[] {
  const text = document.getText();
  const tree = parse(text);
  const node = getNodeAtPosition(tree, position);

  if (!node) return getGlobalCompletions();

  const context = analyzeCompletionContext(document, position, node);

  switch (context.type) {
    case "tag":
      return getTagCompletions();
    case "where_clause":
      return getWhereClauseCompletions();
    case "pattern_match":
      return getPatternMatchCompletions();
    case "record_field":
      return getRecordFieldCompletions(context.recordType);
    case "function_call":
      return getFunctionCompletions();
    case "operator":
      return getOperatorCompletions();
    case "type_annotation":
      return getTypeCompletions();
    case "pipeline":
      return getPipelineCompletions();
    case "import":
      return getImportCompletions();
    default:
      return getGlobalCompletions();
  }
}

interface CompletionContext {
  type:
    | "tag"
    | "where_clause"
    | "pattern_match"
    | "record_field"
    | "function_call"
    | "operator"
    | "type_annotation"
    | "pipeline"
    | "import"
    | "global";
  recordType?: string;
  pipelineType?: string;
}

function analyzeCompletionContext(
  document: TextDocument,
  position: Position,
  node: SyntaxNode,
): CompletionContext {
  const parent = node.parent;
  const lineText = document.getText({
    start: { line: position.line, character: 0 },
    end: { line: position.line, character: position.character },
  });

  // Check for tag context
  if (lineText.includes("#") || parent?.type === "tag") {
    return { type: "tag" };
  }

  // Check for where clause context
  if (lineText.trim().startsWith(";") || findParentOfType(node, "where")) {
    return { type: "where_clause" };
  }

  // Check for pattern match context
  if (
    lineText.trim().startsWith("|") ||
    findParentOfType(node, "pattern_match")
  ) {
    return { type: "pattern_match" };
  }

  // Check for record field access
  if (lineText.includes(".") || parent?.type === "record_access") {
    return { type: "record_field" };
  }

  // Check for type annotation
  if (lineText.includes(" : ") || parent?.type === "type_annotation") {
    return { type: "type_annotation" };
  }

  // Check for pipeline context
  if (lineText.includes("|>") || findParentOfType(node, "pipeline")) {
    return { type: "pipeline", pipelineType: inferPipelineType(node) };
  }

  // Check for import context
  if (lineText.includes("import") || lineText.includes("use")) {
    return { type: "import" };
  }

  return { type: "global" };
}

function inferPipelineType(node: SyntaxNode): string {
  // Simple type inference for pipeline context
  const parent = findParentOfType(node, "pipeline");
  if (parent) {
    // Check if we're in a list pipeline
    const text = parent.text;
    if (text.includes("[") || text.includes("list/")) {
      return "list";
    }
    if (
      text.includes("maybe/") ||
      text.includes("#some") ||
      text.includes("#none")
    ) {
      return "maybe";
    }
    if (
      text.includes("result/") ||
      text.includes("#ok") ||
      text.includes("#error")
    ) {
      return "result";
    }
  }
  return "unknown";
}

function getTagCompletions(): CompletionItem[] {
  return COMMON_TAGS.map((tag) => ({
    label: tag,
    kind: CompletionItemKind.EnumMember,
    detail: "Tag",
    documentation: `Built-in tag: #${tag}`,
    insertText: tag,
  }));
}

function getWhereClauseCompletions(): CompletionItem[] {
  const completions: CompletionItem[] = [];

  completions.push({
    label: ". identifier = expression",
    kind: CompletionItemKind.Snippet,
    detail: "Where clause",
    documentation: "Define a variable in a where clause",
    insertText: ". ${1:identifier} = ${2:expression}",
    insertTextFormat: InsertTextFormat.Snippet,
  });

  return [...completions, ...getGlobalCompletions()];
}

function getPatternMatchCompletions(): CompletionItem[] {
  const completions: CompletionItem[] = [];

  const patterns = [
    { label: "basic pattern", insertText: "| ${1:pattern} -> ${2:expression}" },
    { label: "catch-all", insertText: "| _ -> ${1:default}" },
    { label: "empty list", insertText: "| [] -> ${1:empty_case}" },
    {
      label: "list head+tail",
      insertText: "| ${1:head} >+ ${2:tail} -> ${3:expression}",
    },
    {
      label: "list elements",
      insertText: "| [ ${1:elements} ] -> ${2:expression}",
    },
    {
      label: "record pattern",
      insertText: "| { ${1:fields} } -> ${2:expression}",
    },
    {
      label: "tag pattern",
      insertText: "| #${1:tag} ${2:value} -> ${3:expression}",
    },
    {
      label: "guard pattern",
      insertText: "| ${1:pattern} ? ${2:condition} -> ${3:expression}",
    },
    { label: "number pattern", insertText: "| ${1:0} -> ${2:expression}" },
    { label: "text pattern", insertText: '| "${1:text}" -> ${2:expression}' },
  ];

  patterns.forEach((pattern, index) => {
    completions.push({
      label: pattern.label,
      kind: CompletionItemKind.Snippet,
      detail: "Pattern match case",
      documentation: `Pattern matching case: ${pattern.label}`,
      insertText: pattern.insertText,
      insertTextFormat: InsertTextFormat.Snippet,
      sortText: `0${index.toString().padStart(2, "0")}`,
    });
  });

  return completions;
}

function getRecordFieldCompletions(recordType?: string): CompletionItem[] {
  // In a real implementation, this would analyze the record type
  const commonFields = [
    "name",
    "id",
    "value",
    "type",
    "data",
    "result",
    "status",
    "message",
  ];

  return commonFields.map((field) => ({
    label: field,
    kind: CompletionItemKind.Field,
    detail: "Record field",
    documentation: `Access field: ${field}`,
  }));
}

function getFunctionCompletions(): CompletionItem[] {
  return BUILT_IN_FUNCTIONS.map((func) => {
    const [module, name] = func.split("/");
    return {
      label: func,
      kind: CompletionItemKind.Function,
      detail: `${module} function`,
      documentation: getFunctionDocumentation(func),
    };
  });
}

function getFunctionDocumentation(func: string): string {
  const docs: Record<string, string> = {
    "list/map":
      "Transform each element of a list: `list/map : (a -> b) -> list a -> list b`",
    "list/filter":
      "Filter elements of a list: `list/filter : (a -> bool) -> list a -> list a`",
    "list/fold":
      "Reduce a list to a single value: `list/fold : b -> (b -> a -> b) -> list a -> b`",
    "list/head":
      "Get the first element of a list: `list/head : list a -> maybe a`",
    "list/tail":
      "Get all but the first element: `list/tail : list a -> maybe (list a)`",
    "maybe/default":
      "Provide a default for maybe values: `maybe/default : a -> maybe a -> a`",
    "result/map":
      "Transform successful results: `result/map : (a -> b) -> result a e -> result b e`",
    "text/split":
      "Split text by delimiter: `text/split : text -> text -> list text`",
    "to-float": "Convert integer to float: `to-float : int -> float`",
  };
  return docs[func] || `Built-in function: ${func}`;
}

function getOperatorCompletions(): CompletionItem[] {
  return OPERATORS.map((op) => ({
    label: op,
    kind: CompletionItemKind.Operator,
    detail: "Operator",
    documentation: getOperatorDocumentation(op),
  }));
}

function getTypeCompletions(): CompletionItem[] {
  return COMMON_TYPES.map((type) => ({
    label: type,
    kind: CompletionItemKind.TypeParameter,
    detail: "Type",
    documentation: `Built-in type: ${type}`,
  }));
}

function getPipelineCompletions(): CompletionItem[] {
  const completions: CompletionItem[] = [];

  // Add common pipeline operators
  completions.push(
    {
      label: "|>",
      kind: CompletionItemKind.Operator,
      detail: "Pipeline operator",
      documentation: "Pass value to next function in pipeline",
      insertText: "|> ${1:function}",
      insertTextFormat: InsertTextFormat.Snippet,
    },
    {
      label: ">>",
      kind: CompletionItemKind.Operator,
      detail: "Function composition",
      documentation: "Compose functions (right to left)",
    },
    {
      label: "<<",
      kind: CompletionItemKind.Operator,
      detail: "Function composition",
      documentation: "Compose functions (left to right)",
    },
  );

  return [...completions, ...getFunctionCompletions()];
}

function getImportCompletions(): CompletionItem[] {
  // Common module names and scrapyard references
  const modules = [
    "list",
    "maybe",
    "result",
    "text",
    "dict",
    "io",
    "remote",
    "math",
    "date",
    "json",
    "http",
    "file",
  ];

  return modules.map((module) => ({
    label: module,
    kind: CompletionItemKind.Module,
    detail: "Module",
    documentation: `Import ${module} module functions`,
  }));
}

function getGlobalCompletions(): CompletionItem[] {
  return [
    ...getFunctionCompletions(),
    ...getOperatorCompletions(),
    ...getTypeCompletions(),
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
    },
    {
      label: "()",
      kind: CompletionItemKind.Value,
      detail: "Hole",
      documentation: "Empty value (hole)",
    },
  ];
}

function getOperatorDocumentation(op: string): string {
  const operatorInfo: Record<string, string> = {
    "|>": "**Pipeline operator**: passes the left value to the function on the right\n\nExample: `[1,2,3] |> list/map (x -> x * 2)`",
    "==": "**Equality operator**: checks if two values are equal",
    "/=": "**Inequality operator**: checks if two values are not equal",
    "<": "**Less than operator**: numeric comparison",
    ">": "**Greater than operator**: numeric comparison",
    "<=": "**Less than or equal operator**: numeric comparison",
    ">=": "**Greater than or equal operator**: numeric comparison",
    "*": "**Multiplication operator**: multiply two numbers",
    "/": "**Division operator**: divide two numbers",
    "//": "**Integer division operator**: divide and truncate to integer",
    "%": "**Modulo operator**: remainder after division",
    "+": "**Addition operator**: add two numbers or concatenate",
    "-": "**Subtraction operator**: subtract two numbers",
    "&&": "**Logical AND operator**: boolean AND",
    "||": "**Logical OR operator**: boolean OR",
    "::": "**Cons operator**: add element to front of list\n\nExample: `1 :: [2,3,4]` → `[1,2,3,4]`",
    "++": "**Concatenation operator**: join lists or text\n\nExample: `[1,2] ++ [3,4]` → `[1,2,3,4]`",
    ">+": "**Cons pattern operator**: destructure list in patterns\n\nExample: `| head >+ tail -> ...`",
    "+<": "**Append operator**: add element to end of list\n\nExample: `[1,2,3] +< 4` → `[1,2,3,4]`",
    "..": "**Range operator**: create ranges",
    ".": "**Record field extraction**: extract field from record\n\nExample: `person~name`",
    ">>": "**Function composition (right to left)**: compose functions\n\nExample: `f >> g` means `x -> f(g(x))`",
    "<<": "**Function composition (left to right)**: compose functions\n\nExample: `f << g` means `x -> g(f(x))`",
    "^": "**Exponentiation operator**: raise to power",
    "'": "**Apply operator**: function application",
    ":": "**Type annotation operator**: specify types\n\nExample: `value : int`",
    "?": '**Guard operator**: conditional in patterns\n\nExample: `| n ? n > 0 -> "positive"`',
    "!": "**Force unwrap operator**: extract from maybe/result",
    ";": "**Where clause or field access**: define variables or access fields",
    "->": "**Function arrow**: create functions or pattern cases\n\nExample: `x -> x + 1`",
    "|": "**Pattern case separator**: separate pattern matching cases",
  };
  return operatorInfo[op] || `Operator: ${op}`;
}

// ===== Enhanced Hover =====
export function getHoverInfo(
  document: TextDocument,
  position: Position,
): Hover | null {
  const text = document.getText();
  const tree = parse(text);
  const node = getNodeAtPosition(tree, position);

  if (!node) return null;

  const hoverInfo = getEnhancedHoverForNode(node, document);
  if (!hoverInfo) return null;

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: hoverInfo,
    },
  };
}

function getEnhancedHoverForNode(
  node: SyntaxNode,
  document: TextDocument,
): string | null {
  const nodeText = getNodeText(document, node);

  switch (node.type) {
    case "id":
      return getIdentifierHover(nodeText);
    case "op":
      return getOperatorDocumentation(nodeText);
    case "tag":
      return getTagHover(node, document);
    case "number":
      return getNumberHover(nodeText);
    case "text":
      return `**\`${nodeText}\`** (Text)\n\nText literal with ${nodeText.length - 2} characters.`;
    case "bytes":
      return `**\`${nodeText}\`** (Bytes)\n\nBase64-encoded bytes literal.`;
    case "fun":
      return "**Function** - Anonymous function expression\n\nSyntax: `parameter -> expression`\n\nExample: `x -> x * 2`";
    case "match_fun":
      return "**Pattern Matching Function** - Function with pattern matching\n\nSyntax:\n```scrapscript\n| pattern1 -> expression1\n| pattern2 -> expression2\n| _ -> default\n```";
    case "where":
      return "**Where Clause** - Local variable definition\n\nSyntax: `; identifier = expression`\n\nExample:\n```scrapscript\nresult\n; result = x + y\n; x = 10\n; y = 20\n```";
    case "record":
      return '**Record** - Structured data type\n\nSyntax: `{ field1 = value1, field2 = value2 }`\n\nExample:\n```scrapscript\nperson = { name = "John", age = 30 }\n```';
    case "list":
      return "**List** - Ordered collection of same-type elements\n\nSyntax: `[element1, element2, ...]`\n\nExample:\n```scrapscript\nnumbers = [1, 2, 3, 4, 5]\n```";
    case "hole":
      return "**Hole** - Empty value `()`\n\nRepresents emptiness or absence of value. Used as placeholder or unit type.";
    case "pipeline":
      return "**Pipeline** - Chain of function applications\n\nSyntax: `value |> function1 |> function2`\n\nExample:\n```scrapscript\n[1,2,3] |> list/map (x -> x * 2) |> list/sum\n```";
    case "infix":
      return "**Infix Expression** - Binary operation\n\nSyntax: `left operator right`";
    case "apply":
      return "**Function Application** - Calling a function\n\nSyntax: `function argument`";
    default:
      return node.parent
        ? getEnhancedHoverForNode(node.parent, document)
        : null;
  }
}

function getIdentifierHover(identifier: string): string {
  const builtInInfo: Record<string, string> = {
    // Boolean values
    true: "**`true`** - Boolean constant representing true",
    false: "**`false`** - Boolean constant representing false",

    // List functions
    "list/map":
      "**`list/map`** - Transform each element of a collection\n\n`list/map : (a -> b) -> list a -> list b`\n\nExample: `list/map (x -> x * 2) [1,2,3]` → `[2,4,6]`",
    "list/filter":
      "**`list/filter`** - Filter elements of a collection\n\n`list/filter : (a -> bool) -> list a -> list a`\n\nExample: `list/filter (x -> x > 2) [1,2,3,4]` → `[3,4]`",
    "list/fold":
      "**`list/fold`** - Reduce a collection to a single value\n\n`list/fold : b -> (b -> a -> b) -> list a -> b`\n\nExample: `list/fold 0 (+) [1,2,3]` → `6`",
    "list/head":
      "**`list/head`** - Get the first element\n\n`list/head : list a -> maybe a`",
    "list/tail":
      "**`list/tail`** - Get all but the first element\n\n`list/tail : list a -> maybe (list a)`",
    "list/length":
      "**`list/length`** - Get the number of elements\n\n`list/length : list a -> int`",

    // Maybe functions
    "maybe/default":
      "**`maybe/default`** - Provide a default for maybe values\n\n`maybe/default : a -> maybe a -> a`\n\nExample: `maybe/default 0 (#some 5)` → `5`",
    "maybe/map":
      "**`maybe/map`** - Transform maybe values\n\n`maybe/map : (a -> b) -> maybe a -> maybe b`",
    "maybe/bind":
      "**`maybe/bind`** - Chain maybe computations\n\n`maybe/bind : (a -> maybe b) -> maybe a -> maybe b`",

    // Result functions
    "result/map":
      "**`result/map`** - Transform successful results\n\n`result/map : (a -> b) -> result a e -> result b e`",
    "result/bind":
      "**`result/bind`** - Chain result computations\n\n`result/bind : (a -> result b e) -> result a e -> result b e`",

    // Text functions
    "text/length":
      "**`text/length`** - Get text length\n\n`text/length : text -> int`",
    "text/split":
      "**`text/split`** - Split text by delimiter\n\n`text/split : text -> text -> list text`",
    "text/join":
      "**`text/join`** - Join text with separator\n\n`text/join : text -> list text -> text`",

    // Type conversion
    "to-float":
      "**`to-float`** - Convert integer to float\n\n`to-float : int -> float`\n\nExample: `to-float 42` → `42.0`",
    "to-int":
      "**`to-int`** - Convert float to integer (truncate)\n\n`to-int : float -> int`",
    round:
      "**`round`** - Round float to nearest integer\n\n`round : float -> int`",
    ceil: "**`ceil`** - Round float up to integer\n\n`ceil : float -> int`",
    floor:
      "**`floor`** - Round float down to integer\n\n`floor : float -> int`",

    // Bytes functions
    "bytes/to-utf8-text":
      "**`bytes/to-utf8-text`** - Convert bytes to UTF-8 text\n\n`bytes/to-utf8-text : bytes -> text`",
    "bytes/from-utf8-text":
      "**`bytes/from-utf8-text`** - Convert UTF-8 text to bytes\n\n`bytes/from-utf8-text : text -> bytes`",
  };

  return builtInInfo[identifier] || `**\`${identifier}\`** (Identifier)`;
}

function getTagHover(node: SyntaxNode, document: TextDocument): string {
  const idNode = node.namedChild(0);
  const tagName = idNode ? getNodeText(document, idNode) : "";

  const tagInfo: Record<string, string> = {
    true: "**`#true`** - Boolean true tag\n\nUsed in pattern matching for boolean values.",
    false:
      "**`#false`** - Boolean false tag\n\nUsed in pattern matching for boolean values.",
    some: "**`#some`** - Option type tag for existing values\n\nExample: `#some 42` represents a value that exists.",
    none: "**`#none`** - Option type tag for missing values\n\nExample: `#none ()` represents no value.",
    ok: "**`#ok`** - Result type tag for successful operations\n\nExample: `#ok result` represents a successful computation.",
    error:
      '**`#error`** - Result type tag for failed operations\n\nExample: `#error "message"` represents a failed computation.',
    just: "**`#just`** - Maybe type tag for existing values\n\nSimilar to `#some`, represents a value that exists.",
    nothing:
      "**`#nothing`** - Maybe type tag for missing values\n\nSimilar to `#none`, represents no value.",
    left: "**`#left`** - Either type tag for left value\n\nConvention: used for error cases in Either types.",
    right:
      "**`#right`** - Either type tag for right value\n\nConvention: used for success cases in Either types.",
    success: "**`#success`** - Success tag\n\nGeneric success indicator.",
    failure: "**`#failure`** - Failure tag\n\nGeneric failure indicator.",
    add: "**`#add`** - Addition operation tag\n\nUsed in arithmetic operation types.",
    sub: "**`#sub`** - Subtraction operation tag\n\nUsed in arithmetic operation types.",
    mul: "**`#mul`** - Multiplication operation tag\n\nUsed in arithmetic operation types.",
    div: "**`#div`** - Division operation tag\n\nUsed in arithmetic operation types.",
  };

  return (
    tagInfo[tagName] || `**\`#${tagName}\`** (Tag)\n\nCustom tag identifier.`
  );
}

function getNumberHover(numberText: string): string {
  if (numberText.includes(".")) {
    const num = parseFloat(numberText);
    return `**\`${numberText}\`** (Float)\n\nFloating-point number: ${num}`;
  } else {
    const num = parseInt(numberText);
    let extra = "";
    if (num >= 0 && num <= 1000000) {
      // Reasonable range for conversions
      extra = `\n\n**Conversions:**\n- Binary: \`${num.toString(2)}\`\n- Hex: \`0x${num.toString(16).toUpperCase()}\``;
      if (num <= 255) {
        extra += `\n- Byte: \`;${num.toString(16).toUpperCase().padStart(2, "0")}\``;
      }
    }
    return `**\`${numberText}\`** (Integer)${extra}`;
  }
}

// ===== Enhanced Document Symbols =====
export function getDocumentSymbols(document: TextDocument): DocumentSymbol[] {
  const text = document.getText();
  const tree = parse(text);
  const rootNode = tree.rootNode;

  const declarations = findNodesOfType(rootNode, "declaration");
  const whereClausesDeclarations = findWhereClauseDeclarations(rootNode);
  const typeDeclarations = findNodesOfType(rootNode, "type_declaration");

  return [
    ...declarations,
    ...whereClausesDeclarations,
    ...typeDeclarations,
  ].map((node) => createDocumentSymbol(node, document));
}

function findNodesOfType(rootNode: SyntaxNode, type: string): SyntaxNode[] {
  const nodes: SyntaxNode[] = [];
  walkTree(rootNode, (node) => {
    if (node.type === type) {
      nodes.push(node);
    }
  });
  return nodes;
}

function findWhereClauseDeclarations(rootNode: SyntaxNode): SyntaxNode[] {
  const declarations: SyntaxNode[] = [];
  walkTree(rootNode, (node) => {
    if (node.type === "where") {
      // Find declarations within where clauses
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child?.type === ";" && i + 2 < node.childCount) {
          const idNode = node.child(i + 1);
          if (idNode?.type === "id") {
            declarations.push(node); // Add the where clause as a declaration context
            break;
          }
        }
      }
    }
  });
  return declarations;
}

function createDocumentSymbol(
  node: SyntaxNode,
  document: TextDocument,
): DocumentSymbol {
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

  const name = getSymbolName(patternNode, document);
  const exprNode = node.namedChild(node.namedChildCount - 1);
  const kind = getSymbolKind(exprNode);
  const detail = getSymbolDetail(node, exprNode);

  return {
    name,
    kind,
    range: nodeToRange(node),
    selectionRange: nodeToRange(patternNode),
    detail,
    children: [],
  };
}

function getSymbolName(node: SyntaxNode, document: TextDocument): string {
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
    case "hole":
      return "()";
    default:
      return node.type || "unknown";
  }
}

function getSymbolKind(exprNode: SyntaxNode | null): SymbolKind {
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
    case "bytes":
      return SymbolKind.String;
    case "hole":
      return SymbolKind.Null;
    case "type_declaration":
      return SymbolKind.Class;
    default:
      return SymbolKind.Variable;
  }
}

function getSymbolDetail(
  node: SyntaxNode,
  exprNode: SyntaxNode | null,
): string {
  if (!exprNode) return "";

  switch (exprNode.type) {
    case "fun":
      return "Function";
    case "match_fun":
      return "Pattern matching function";
    case "record":
      return "Record";
    case "list":
      return "List";
    case "tag":
      return "Tagged value";
    case "number":
      return exprNode.text.includes(".") ? "Float" : "Integer";
    case "text":
      return "Text";
    case "bytes":
      return "Bytes";
    case "hole":
      return "Hole";
    case "type_declaration":
      return "Type definition";
    default:
      return "";
  }
}

// ===== References and Rename =====
export function findReferences(
  document: TextDocument,
  position: Position,
): Location[] {
  const text = document.getText();
  const tree = parse(text);
  const node = getNodeAtPosition(tree, position);

  if (!node || node.type !== "id") return [];

  const identifier = getNodeText(document, node);
  const references: Location[] = [];

  // Find all occurrences of this identifier
  walkTree(tree.rootNode, (currentNode) => {
    if (
      currentNode.type === "id" &&
      getNodeText(document, currentNode) === identifier
    ) {
      references.push({
        uri: document.uri,
        range: nodeToRange(currentNode),
      });
    }
  });

  return references;
}

export function prepareRename(
  document: TextDocument,
  position: Position,
): { range: Range; placeholder: string } | null {
  const text = document.getText();
  const tree = parse(text);
  const node = getNodeAtPosition(tree, position);

  if (!node || node.type !== "id") {
    return null;
  }

  const identifier = getNodeText(document, node);

  // Don't allow renaming of built-in functions
  if (
    BUILT_IN_FUNCTIONS.includes(identifier) ||
    KEYWORDS.includes(identifier)
  ) {
    return null;
  }

  return {
    range: nodeToRange(node),
    placeholder: identifier,
  };
}

export function executeRename(
  document: TextDocument,
  position: Position,
  newName: string,
): WorkspaceEdit | null {
  const references = findReferences(document, position);

  if (references.length === 0) return null;

  return {
    changes: {
      [document.uri]: references.map((ref) => ({
        range: ref.range,
        newText: newName,
      })),
    },
  };
}

// ===== Code Actions =====
export function getCodeActions(
  document: TextDocument,
  range: Range,
): CodeAction[] {
  const actions: CodeAction[] = [];
  const text = document.getText();
  const tree = parse(text);

  // Find missing patterns in pattern matches
  const node = getNodeAtPosition(tree, range.start);
  if (
    node &&
    (node.type === "match_fun" || findParentOfType(node, "match_fun"))
  ) {
    actions.push({
      title: "Add catch-all pattern",
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            {
              range: range,
              newText: "| _ -> ()\n",
            },
          ],
        },
      },
    });
  }

  // Suggest where clause completion
  const lineText = document.getText({
    start: { line: range.start.line, character: 0 },
    end: { line: range.start.line + 1, character: 0 },
  });

  if (lineText.trim() === ";") {
    actions.push({
      title: "Complete where clause",
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            {
              range: range,
              newText: " identifier = expression",
            },
          ],
        },
      },
    });
  }

  // Suggest pattern completion
  if (lineText.trim() === "|") {
    actions.push({
      title: "Complete pattern match",
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            {
              range: range,
              newText: " pattern -> expression",
            },
          ],
        },
      },
    });
  }

  // Suggest type annotation
  const currentLine = document.getText({
    start: { line: range.start.line, character: 0 },
    end: { line: range.start.line, character: 1000 },
  });

  if (currentLine.includes("=") && !currentLine.includes(":")) {
    actions.push({
      title: "Add type annotation",
      kind: CodeActionKind.Refactor,
      edit: {
        changes: {
          [document.uri]: [
            {
              range: { start: range.start, end: range.start },
              newText: "value : type\n",
            },
          ],
        },
      },
    });
  }

  return actions;
}

// ===== Semantic Tokens =====
export function getSemanticTokens(document: TextDocument): SemanticTokens {
  const text = document.getText();
  const tree = parse(text);
  const builder = new SemanticTokensBuilder();

  analyzeSemanticTokens(tree.rootNode, builder, document);

  return builder.build();
}

function analyzeSemanticTokens(
  node: SyntaxNode,
  builder: SemanticTokensBuilder,
  document: TextDocument,
): void {
  walkTree(node, (currentNode) => {
    // Map ScrapScript syntax to semantic token types
    switch (currentNode.type) {
      case "id":
        const text = getNodeText(document, currentNode);
        let tokenType = 6; // variable
        if (BUILT_IN_FUNCTIONS.includes(text)) {
          tokenType = 0; // function
        } else if (KEYWORDS.includes(text)) {
          tokenType = 5; // keyword
        }
        builder.push(
          currentNode.startPosition.row,
          currentNode.startPosition.column,
          currentNode.endPosition.column - currentNode.startPosition.column,
          tokenType,
          0,
        );
        break;
      case "op":
        builder.push(
          currentNode.startPosition.row,
          currentNode.startPosition.column,
          currentNode.endPosition.column - currentNode.startPosition.column,
          1, // operator
          0,
        );
        break;
      case "tag":
        builder.push(
          currentNode.startPosition.row,
          currentNode.startPosition.column,
          currentNode.endPosition.column - currentNode.startPosition.column,
          2, // enum
          0,
        );
        break;
      case "number":
        builder.push(
          currentNode.startPosition.row,
          currentNode.startPosition.column,
          currentNode.endPosition.column - currentNode.startPosition.column,
          3, // number
          0,
        );
        break;
      case "text":
        builder.push(
          currentNode.startPosition.row,
          currentNode.startPosition.column,
          currentNode.endPosition.column - currentNode.startPosition.column,
          4, // string
          0,
        );
        break;
    }
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
          triggerCharacters: [".", "#", ":", "|", " ", ">"],
        },
        hoverProvider: true,
        documentSymbolProvider: true,
        referencesProvider: true,
        renameProvider: {
          prepareProvider: true,
        },
        codeActionProvider: true,
        semanticTokensProvider: {
          legend: {
            tokenTypes: [
              "function",
              "operator",
              "enum",
              "number",
              "string",
              "keyword",
              "variable",
            ],
            tokenModifiers: ["declaration", "definition", "readonly"],
          },
          full: true,
        },
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
        undefined,
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
    enableEnhancedFeatures: boolean;
    enableTypeChecking: boolean;
    enablePatternExhaustiveness: boolean;
    enableSemanticTokens: boolean;
  }

  const defaultSettings: ScrapScriptSettings = {
    maxNumberOfProblems: 1000,
    enableEnhancedFeatures: true,
    enableTypeChecking: true,
    enablePatternExhaustiveness: true,
    enableSemanticTokens: true,
  };
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
    resource: string,
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
    textDocument: TextDocument,
  ): Promise<void> {
    const settings = await getDocumentSettings(textDocument.uri);
    const text = textDocument.getText();
    const diagnostics = validateScrapScript(text, settings.maxNumberOfProblems);
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
  }

  // Enhanced event handlers
  connection.onCompletion(
    async (
      textDocumentPosition: TextDocumentPositionParams,
    ): Promise<CompletionItem[]> => {
      const document = documents.get(textDocumentPosition.textDocument.uri);
      if (!document) return [];
      return getCompletionItems(document, textDocumentPosition.position);
    },
  );

  connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => item,
  );

  connection.onHover(async (params: HoverParams): Promise<Hover | null> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;
    return getHoverInfo(document, params.position);
  });

  connection.onDocumentSymbol(
    async (params: DocumentSymbolParams): Promise<DocumentSymbol[]> => {
      const document = documents.get(params.textDocument.uri);
      if (!document) return [];
      return getDocumentSymbols(document);
    },
  );

  connection.onReferences(
    async (params: ReferenceParams): Promise<Location[]> => {
      const document = documents.get(params.textDocument.uri);
      if (!document) return [];
      return findReferences(document, params.position);
    },
  );

  connection.onPrepareRename(async (params: PrepareRenameParams) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;
    return prepareRename(document, params.position);
  });

  connection.onRenameRequest(
    async (params: RenameParams): Promise<WorkspaceEdit | null> => {
      const document = documents.get(params.textDocument.uri);
      if (!document) return null;
      return executeRename(document, params.position, params.newName);
    },
  );

  connection.onCodeAction(
    async (params: CodeActionParams): Promise<CodeAction[]> => {
      const document = documents.get(params.textDocument.uri);
      if (!document) return [];
      return getCodeActions(document, params.range);
    },
  );

  connection.onRequest(
    "textDocument/semanticTokens/full",
    async (params: SemanticTokensParams): Promise<SemanticTokens | null> => {
      const document = documents.get(params.textDocument.uri);
      if (!document) return null;
      return getSemanticTokens(document);
    },
  );

  documents.listen(connection);
  connection.listen();
}

// Only set up the server if this file is being run directly
if (require.main === module) setupServer();
