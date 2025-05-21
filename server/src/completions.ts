import {
  CompletionItem,
  CompletionItemKind,
  Position,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parse, getNodeAtPosition, getParentOfType } from "./parser";

// ScrapScript keywords and built-in operators
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

// Common ScrapScript types
const COMMON_TYPES = ["int", "bool", "string", "list", "record"];

// Get completion items based on context
export function getCompletionItems(
  document: TextDocument,
  position: Position,
): CompletionItem[] {
  const text = document.getText();
  const tree = parse(text);
  const node = getNodeAtPosition(tree, position);

  if (!node) {
    return getGlobalCompletions();
  }

  // Get parent of the current node
  const parent = node.parent;

  // Different completions based on context
  if (parent) {
    // If we're inside a declaration
    if (parent.type === "declaration" || getParentOfType(node, "declaration")) {
      return getDeclarationCompletions();
    }

    // If we're after a dot (record access)
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

    // If we're after a # (tag)
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

  // Default to global completions
  return getGlobalCompletions();
}

// Global completions (available everywhere)
function getGlobalCompletions(): CompletionItem[] {
  const completions: CompletionItem[] = [];

  // Add keywords
  KEYWORDS.forEach((keyword) => {
    completions.push({
      label: keyword,
      kind: CompletionItemKind.Keyword,
      detail: "Keyword",
      documentation: getKeywordDocumentation(keyword),
    });
  });

  // Add operators
  OPERATORS.forEach((op) => {
    completions.push({
      label: op,
      kind: CompletionItemKind.Operator,
      detail: "Operator",
      documentation: getOperatorDocumentation(op),
    });
  });

  // Add common functions and values
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
    },
  );

  return completions;
}

// Completions specific to declarations
function getDeclarationCompletions(): CompletionItem[] {
  const completions = getGlobalCompletions();

  // Add type completions
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

// Completions for record fields (after a dot)
function getRecordFieldCompletions(parent: any): CompletionItem[] {
  // Ideally, this would analyze the code to determine the actual fields available
  // For now, we'll just provide a placeholder
  return [
    {
      label: "field",
      kind: CompletionItemKind.Field,
      detail: "Record field",
      documentation: "Access a field of the record",
    },
  ];
}

// Completions for tags (after a #)
function getTagCompletions(): CompletionItem[] {
  // Common tags used in ScrapScript
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

// Get documentation for keywords
function getKeywordDocumentation(keyword: string): string {
  switch (keyword) {
    default:
      return `Keyword: ${keyword}`;
  }
}

// Get documentation for operators
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
