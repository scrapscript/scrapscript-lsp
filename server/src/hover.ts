import {
  Hover,
  MarkupContent,
  MarkupKind,
  Position,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parse, getNodeAtPosition, getNodeText } from "./parser";

export function getHoverInfo(
  document: TextDocument,
  position: Position,
): Hover | null {
  const text = document.getText();
  const tree = parse(text);
  const node = getNodeAtPosition(tree, position);

  if (!node) {
    return null;
  }

  // Get hover info based on the node type
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
  // Get the node text
  const nodeText = getNodeText(document, node);

  // Handle different node types
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
      // If we don't have specific hover info for this node type, try the parent
      if (node.parent) {
        return getHoverForNode(node.parent, document);
      }
      return null;
  }
}

function getIdentifierHover(id: string): string {
  // Check if this is a built-in identifier
  const builtInInfo = getBuiltInIdentifierInfo(id);
  if (builtInInfo) {
    return builtInInfo;
  }

  // Default identifier info
  return `\`${id}\` (Identifier)`;
}

function getBuiltInIdentifierInfo(id: string): string | null {
  // Map of built-in identifiers to their info
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
  // Map of operators to their documentation
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
  // Get the tag name (the id node)
  const idNode = node.namedChild(0);
  const tagName = idNode ? getNodeText(document, idNode) : "";

  // Common tags info
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
  // Simple function hover for now
  return "`Function` - Anonymous function expression";
}

function getMatchFunctionHover(node: any, document: TextDocument): string {
  // Simple match function hover for now
  return "`Match Function` - Pattern matching function expression";
}
