import { parse, findNodesOfType, initialize } from "./parser";

describe("Parser", () => {
  beforeAll(async () => {
    await initialize();
  });

  test("should parse simple expressions", () => {
    const result = parse("1 + 2");
    expect(result).toBeDefined();
    expect(result.rootNode).toBeDefined();

    // Find the binary expression node
    const binaryNodes = findNodesOfType(result.rootNode, "binary");
    expect(binaryNodes).toHaveLength(1);
    const binaryNode = binaryNodes[0];

    // Check the operator
    const operatorNode = binaryNode.child(1);
    expect(operatorNode?.text).toBe("+");

    // Check the operands
    const leftNode = binaryNode.child(0);
    const rightNode = binaryNode.child(2);
    expect(leftNode?.text).toBe("1");
    expect(rightNode?.text).toBe("2");
  });

  test("should parse function definitions", () => {
    const result = parse("fn add(a, b) { a + b }");
    expect(result).toBeDefined();
    expect(result.rootNode).toBeDefined();

    // Find the function node
    const funNodes = findNodesOfType(result.rootNode, "fun");
    expect(funNodes).toHaveLength(1);
    const funNode = funNodes[0];

    // Check the function name
    const idNode = funNode.child(0);
    expect(idNode?.text).toBe("add");

    // Check the parameters
    const paramsNode = funNode.child(1);
    expect(paramsNode?.text).toBe("(a, b)");
  });

  test("should handle nested expressions", () => {
    const result = parse("fn calculate(x) { (x + 1) * 2 }");
    expect(result).toBeDefined();
    expect(result.rootNode).toBeDefined();

    // Find the function node
    const funNodes = findNodesOfType(result.rootNode, "fun");
    expect(funNodes).toHaveLength(1);

    // Find the binary expressions
    const binaryNodes = findNodesOfType(result.rootNode, "binary");
    expect(binaryNodes.length).toBeGreaterThan(0);
  });

  test("should handle invalid syntax", () => {
    expect(() => parse("1 +")).toThrow();
    expect(() => parse("fn add(a,) {}")).toThrow();
  });
});
