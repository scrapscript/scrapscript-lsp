import Parser from "tree-sitter";
import { Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as ScrapScript from "../../tree-sitter-scrapscript/bindings/node";

// Define types for tree-sitter nodes
export type SyntaxNode = Parser.SyntaxNode;
export type Tree = Parser.Tree;

let parser: Parser;
let language: Parser.Language;

// Initialize the parser with the ScrapScript grammar
export async function initialize(): Promise<void> {
  try {
    parser = new Parser();
    language = ScrapScript as Parser.Language;
    parser.setLanguage(language);
    console.log("ScrapScript parser initialized successfully");
  } catch (error) {
    console.error("Failed to initialize ScrapScript parser:", error);
    throw error;
  }
}

// Parse a document and return the syntax tree
export function parse(text: string): Tree {
  if (!parser) {
    throw new Error("Parser not initialized");
  }
  return parser.parse(text);
}

// Get the syntax node at a specific position in the document
export function getNodeAtPosition(
  tree: Tree,
  position: Position,
): SyntaxNode | null {
  const point = { row: position.line, column: position.character };
  return tree.rootNode.descendantForPosition(point);
}

// Convert a tree-sitter node to a Range
export function nodeToRange(node: SyntaxNode): Range {
  return Range.create(
    node.startPosition.row,
    node.startPosition.column,
    node.endPosition.row,
    node.endPosition.column,
  );
}

// Get the parent node of a specific type
export function getParentOfType(
  node: SyntaxNode,
  type: string,
): SyntaxNode | null {
  let current: SyntaxNode | null = node;
  while (current && current.type !== type) {
    current = current.parent as SyntaxNode | null;
  }
  return current;
}

// Get the text of a node from the document
export function getNodeText(document: TextDocument, node: SyntaxNode): string {
  const range = nodeToRange(node);
  return document.getText({
    start: { line: range.start.line, character: range.start.character },
    end: { line: range.end.line, character: range.end.character },
  });
}

// Check if a node is of a specific type
export function isNodeOfType(node: SyntaxNode, type: string): boolean {
  return node.type === type;
}

// Find all nodes of a specific type in the tree
export function findNodesOfType(
  rootNode: SyntaxNode,
  type: string,
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
export function isPositionInNode(
  position: Position,
  node: SyntaxNode,
): boolean {
  const range = nodeToRange(node);

  // Check if position is within the node's range
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
