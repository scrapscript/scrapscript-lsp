import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { parse, SyntaxNode, nodeToRange } from "./parser";

// Validate the ScrapScript code and return diagnostics
export function validateScrapScript(
  text: string,
  maxNumberOfProblems: number,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  try {
    // Parse the document
    const tree = parse(text);
    const rootNode = tree.rootNode;

    // Check for syntax errors
    const syntaxErrors = checkSyntaxErrors(rootNode);
    diagnostics.push(...syntaxErrors.slice(0, maxNumberOfProblems));

    // Add more validators as needed
    // const semanticErrors = checkSemanticErrors(rootNode, text);
    // diagnostics.push(...semanticErrors.slice(0, maxNumberOfProblems - diagnostics.length));
  } catch (err) {
    // If parsing fails completely, add a generic syntax error
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

// Check for syntax errors in the tree
function checkSyntaxErrors(rootNode: SyntaxNode): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Check if the parse was successful
  if (rootNode.hasError) {
    // Find all error nodes
    const errorNodes = findErrorNodes(rootNode);

    // Create diagnostics for each error node
    for (const errorNode of errorNodes) {
      const range = nodeToRange(errorNode);

      // Create a diagnostic based on the type of error
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        range,
        message: `Syntax error in ${errorNode.parent?.type || "expression"}`,
        source: "scrapscript",
      };

      // Add more specific error messages based on context
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

// Find all nodes with errors in the tree
function findErrorNodes(node: SyntaxNode): SyntaxNode[] {
  const errorNodes: SyntaxNode[] = [];

  if (node.hasError) {
    // If the node type is 'ERROR', add it to the list
    if (node.type === "ERROR") {
      errorNodes.push(node);
    }

    // Check all children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        errorNodes.push(...findErrorNodes(child));
      }
    }
  }

  return errorNodes;
}
