import {
  DocumentSymbol,
  SymbolKind,
  DocumentSymbolParams,
  Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parse, nodeToRange, findNodesOfType, getNodeText } from "./parser";

export function getDocumentSymbols(document: TextDocument): DocumentSymbol[] {
  const text = document.getText();
  const tree = parse(text);
  const rootNode = tree.rootNode;

  // Find all declarations in the document
  const declarations = findNodesOfType(rootNode, "declaration");

  // Create document symbols
  return declarations.map((node) => {
    // Extract the pattern from the declaration
    const patternNode = node.child(0);
    if (!patternNode) {
      return createDocumentSymbol(
        node,
        document,
        "unknown",
        SymbolKind.Variable,
      );
    }

    // Get the name of the declaration if it's an identifier
    const name =
      patternNode.type === "id"
        ? getNodeText(document, patternNode)
        : getSymbolName(patternNode, document);

    // Determine the type of the symbol
    const kind = getSymbolKind(node);

    return createDocumentSymbol(node, document, name, kind);
  });
}

// Create a document symbol from a node
function createDocumentSymbol(
  node: any,
  document: TextDocument,
  name: string,
  kind: SymbolKind,
): DocumentSymbol {
  const range = nodeToRange(node);

  // Detailed information for the symbol
  let detail = "";

  // Check if this is a function
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

// Get a suitable name for a complex pattern
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

// Determine the kind of symbol based on the node
function getSymbolKind(node: any): SymbolKind {
  // Check the expression type
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
      // Check if this is a type declaration
      if (node.namedChildCount >= 2 && node.namedChild(1)?.type === "id") {
        return SymbolKind.TypeParameter;
      }
      return SymbolKind.Variable;
  }
}
