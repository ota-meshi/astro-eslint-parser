import type {
  AstroRootNode,
  AttributeNode,
  JSXElementNode,
  JSXNameNode,
  LocatedNode,
  TemplateNode,
  ParseResult,
  AstroFrontmatterNode,
  UnknownNode,
  JSXAttributeNode,
  JSXSpreadAttributeNode,
  LiteralNode,
  JSXExpressionContainerNode,
} from "./astro-parser/types";
import { AST_TOKEN_TYPES, AST_NODE_TYPES } from "@typescript-eslint/types";
import type { TSESTree } from "@typescript-eslint/types";
import type { Context } from "../context";
import { VirtualScriptContext } from "../context/script";
import type {
  AstroDoctype,
  AstroFragment,
  AstroHTMLComment,
  AstroProgram,
  AstroRawText,
  AstroShorthandAttribute,
  AstroTemplateLiteralAttribute,
  JSXElement,
} from "../ast";
import { removeAllScopeAndVariableAndReference } from "./scope";
import {
  isJSXElementOrFragment,
  isNode,
  isShorthandAttribute,
  isSyntheticFragment,
} from "./astro-parser/node";
import { getKeys } from "../traverse";

type AnalyzedAttributeData =
  | AnalyzedSpreadAttributeData
  | AnalyzedEmptyAttributeData
  | AnalyzedShorthandAttributeData
  | AnalyzedLiteralValueAttributeData
  | AnalyzedTemplateLiteralAttributeData
  | AnalyzedExpressionAttributeData;
type AnalyzedSpreadAttributeData = {
  kind: "spread";
  node: JSXSpreadAttributeNode;
};
type AnalyzedEmptyAttributeData = {
  kind: "empty";
  node: JSXAttributeNode & { value: null };
};
type AnalyzedShorthandAttributeData = {
  kind: "shorthand";
  node: JSXAttributeNode & { value: JSXExpressionContainerNode };
};
type AnalyzedLiteralValueAttributeData = {
  kind: "literal-value";
  node: JSXAttributeNode & { value: LiteralNode };
};
type AnalyzedTemplateLiteralAttributeData = {
  kind: "template-literal";
  node: JSXAttributeNode & { value: JSXExpressionContainerNode };
};
type AnalyzedExpressionAttributeData = {
  kind: "expression";
  node: JSXAttributeNode & { value: JSXExpressionContainerNode };
};

/**
 * Process the template to generate a ScriptContext.
 */
export function processTemplate(
  ctx: Context,
  resultTemplate: ParseResult,
): VirtualScriptContext {
  let uniqueIdSeq = 0;
  const usedUniqueIds = new Set<string>();

  const script = new VirtualScriptContext(ctx);
  const code = ctx.code;

  let fragmentOpened = false;

  /** Open astro root fragment */
  function openRootFragment(startOffset: number) {
    script.appendVirtualScript("<>");
    fragmentOpened = true;
    script.restoreContext.addRestoreNodeProcess((scriptNode, { result }) => {
      if (
        scriptNode.type === AST_NODE_TYPES.ExpressionStatement &&
        scriptNode.expression.type === AST_NODE_TYPES.JSXFragment &&
        scriptNode.range[0] === startOffset &&
        result.ast.body.includes(scriptNode)
      ) {
        const index = result.ast.body.indexOf(scriptNode);
        const rootFragment = ((result.ast as AstroProgram).body[index] =
          scriptNode.expression as unknown as AstroFragment);
        delete (rootFragment as any).closingFragment;
        delete (rootFragment as any).openingFragment;
        rootFragment.type = "AstroFragment";

        return true;
      }
      return false;
    });
  }

  walkElements(
    resultTemplate.ast,
    // eslint-disable-next-line complexity -- Template generation handles several Astro node forms.
    (node) => {
      if (node.type === "AstroFrontmatter") {
        if (fragmentOpened) {
          script.appendVirtualScript("</>;");
          fragmentOpened = false;
        }
        let start = node.start;

        // Skip until a front matter fence is found.
        // If there is whitespace before the fence,
        // the Node's start method will return the first whitespace, so this needs to be adjusted.
        while (code[start] !== "-") {
          start++;
        }

        script.appendOriginal(start);
        script.skipOriginalOffset(3);
        const end = node.end;
        const scriptStart = start + 3;
        let scriptEnd = end - 3;
        let endChar: string;
        while (
          scriptStart < scriptEnd - 1 &&
          (endChar = code[scriptEnd - 1]) &&
          !endChar.trim()
        ) {
          scriptEnd--;
        }
        script.appendOriginal(scriptEnd);

        script.appendVirtualScript("\n;");
        script.skipOriginalOffset(end - scriptEnd);

        script.restoreContext.addRestoreNodeProcess(
          (_scriptNode, { result }) => {
            for (let index = 0; index < result.ast.body.length; index++) {
              const st = result.ast.body[index] as TSESTree.Node;
              if (st.type === AST_NODE_TYPES.EmptyStatement) {
                if (st.range[0] === scriptEnd && st.range[1] === scriptEnd) {
                  result.ast.body.splice(index, 1);
                  break;
                }
              }
            }
            return true;
          },
        );

        script.restoreContext.addToken(AST_TOKEN_TYPES.Punctuator, [
          start,
          start + 3,
        ]);
        script.restoreContext.addToken(AST_TOKEN_TYPES.Punctuator, [
          end - 3,
          end,
        ]);
      } else if (isJSXElementOrFragment(node)) {
        const start = node.start;
        script.appendOriginal(start);
        if (!fragmentOpened) {
          openRootFragment(start);
        }

        if (node.type === "JSXFragment") {
          if (isSyntheticFragment(node)) {
            const start = node.start;
            script.appendOriginal(start);
            script.appendVirtualScript("<>");
            script.restoreContext.addRestoreNodeProcess((scriptNode) => {
              if (
                scriptNode.range[0] === start &&
                scriptNode.type === AST_NODE_TYPES.JSXFragment
              ) {
                delete (scriptNode as any).openingFragment;
                delete (scriptNode as any).closingFragment;
                const fragmentNode = scriptNode as unknown as AstroFragment;
                fragmentNode.type = "AstroFragment";
                const last =
                  fragmentNode.children[fragmentNode.children.length - 1];
                if (last && fragmentNode.range[1] < last.range[1]) {
                  fragmentNode.range[1] = last.range[1];
                  fragmentNode.loc.end = ctx.getLocFromIndex(
                    fragmentNode.range[1],
                  );
                }
                return true;
              }
              return false;
            });
          }
        } else {
          const tagType = getTagType(node);

          // Process for attributes
          for (const attr of node.openingElement.attributes) {
            const analyzed = analyzeAttribute(attr);

            if (
              analyzed.kind === "literal-value" ||
              analyzed.kind === "empty" ||
              analyzed.kind === "expression" ||
              analyzed.kind === "template-literal"
            ) {
              const attrName = getAttributeName(analyzed);
              const needPunctuatorsProcess =
                tagType === "component"
                  ? /[.:@]/u.test(attrName)
                  : /[.@]/u.test(attrName) || attrName.startsWith(":");

              if (needPunctuatorsProcess) {
                processAttributePunctuators(analyzed);
              }
            }
            if (analyzed.kind === "literal-value") {
              const raw = code.slice(
                analyzed.node.value.start,
                analyzed.node.value.end,
              );
              if (raw && !raw.startsWith('"') && !raw.startsWith("'")) {
                // If the literal value is not quoted in the source,
                // quote it in the virtual script so that it can be parsed as a valid attribute.
                const attrStart = analyzed.node.start;
                const valueStart = analyzed.node.value.start;
                const attrEnd = analyzed.node.end;
                script.appendOriginal(valueStart);
                script.appendVirtualScript('"');
                script.appendOriginal(attrEnd);
                script.appendVirtualScript('"');

                script.restoreContext.addRestoreNodeProcess(
                  (scriptNode, context) => {
                    if (
                      scriptNode.type === AST_NODE_TYPES.JSXAttribute &&
                      scriptNode.range[0] === attrStart
                    ) {
                      const attrNode = scriptNode;
                      if (
                        attrNode.value?.type === "Literal" &&
                        typeof attrNode.value.value === "string"
                      ) {
                        const raw = code.slice(valueStart, attrEnd);
                        attrNode.value.raw = raw;
                        context.findToken(valueStart)!.value = raw;
                        return true;
                      }
                    }
                    return false;
                  },
                );
              }
            } else if (analyzed.kind === "shorthand") {
              const attrName = getAttributeName(analyzed);
              const start = getShorthandAttributeOpeningBraceOffset(
                analyzed.node,
              );
              script.appendOriginal(start);
              const jsxName = /[\s"'[\]{}]/u.test(attrName)
                ? generateUniqueId(attrName)
                : attrName;
              script.appendVirtualScript(`${jsxName}=`);

              script.restoreContext.addRestoreNodeProcess((scriptNode) => {
                if (
                  scriptNode.type === AST_NODE_TYPES.JSXAttribute &&
                  scriptNode.range[0] === start
                ) {
                  const attrNode =
                    scriptNode as unknown as AstroShorthandAttribute;
                  attrNode.type = "AstroShorthandAttribute";

                  const locs = ctx.getLocations(
                    ...attrNode.value.expression.range,
                  );
                  if (jsxName !== attrName) {
                    attrNode.name.name = attrName;
                  }
                  attrNode.name.range = locs.range;
                  attrNode.name.loc = locs.loc;
                  return true;
                }
                return false;
              });
            } else if (analyzed.kind === "template-literal") {
              const attrStart = analyzed.node.start;
              const valueStart = analyzed.node.value.start;
              const attrEnd = analyzed.node.end;
              script.appendOriginal(valueStart);
              script.appendVirtualScript("{");
              script.appendOriginal(attrEnd);
              script.appendVirtualScript("}");

              script.restoreContext.addRestoreNodeProcess((scriptNode) => {
                if (
                  scriptNode.type === AST_NODE_TYPES.JSXAttribute &&
                  scriptNode.range[0] === attrStart
                ) {
                  const attrNode =
                    scriptNode as unknown as AstroTemplateLiteralAttribute;
                  attrNode.type = "AstroTemplateLiteralAttribute";
                  return true;
                }
                return false;
              });
            }
          }

          // Process for start tag close
          const closing = getSelfClosingTag(node);
          if (closing && closing.end === ">") {
            script.appendOriginal(closing.offset - 1);
            script.appendVirtualScript("/");
          }

          const tagName = getJsxName(node.openingElement.name);

          // Process for raw text
          if (
            tagName === "script" ||
            tagName === "style" ||
            node.openingElement.attributes.some((attr) => {
              const analyzed = analyzeAttribute(attr);
              if (analyzed.kind === "spread") return false;
              return getAttributeName(analyzed) === "is:raw";
            })
          ) {
            const text = getRawTextContent(node);
            if (text && text.value) {
              const styleNodeStart = node.start;
              script.appendOriginal(text.start);
              script.skipOriginalOffset(text.value.length);

              script.restoreContext.addRestoreNodeProcess((scriptNode) => {
                if (
                  scriptNode.type === AST_NODE_TYPES.JSXElement &&
                  scriptNode.range[0] === styleNodeStart
                ) {
                  const textNode: AstroRawText = {
                    type: "AstroRawText",
                    value: text.value,
                    raw: text.value,
                    parent: scriptNode as JSXElement,
                    ...ctx.getLocations(text.start, text.end),
                  };
                  scriptNode.children = [
                    textNode as unknown as TSESTree.JSXText,
                  ];
                  return true;
                }
                return false;
              });
              script.restoreContext.addToken(AST_TOKEN_TYPES.JSXText, [
                text.start,
                text.end,
              ]);
            }
          }
        }
      } else if (node.type === "AstroComment") {
        const start = node.start;
        const end = node.end;
        const length = end - start;
        script.appendOriginal(start);
        if (!fragmentOpened) {
          openRootFragment(start);
        }
        script.appendOriginal(start + 1);
        script.appendVirtualScript(`></`);
        script.skipOriginalOffset(length - 2);
        script.appendOriginal(end);

        script.restoreContext.addRestoreNodeProcess((scriptNode, context) => {
          if (
            scriptNode.range[0] === start &&
            scriptNode.type === AST_NODE_TYPES.JSXFragment
          ) {
            delete (scriptNode as any).children;
            delete (scriptNode as any).openingFragment;
            delete (scriptNode as any).closingFragment;
            delete (scriptNode as any).expression;
            const commentNode = scriptNode as unknown as AstroHTMLComment;
            commentNode.type = "AstroHTMLComment";
            commentNode.value = node.value;

            context.addRemoveToken(
              (token: TSESTree.Token) =>
                token.value === "<" && token.range[0] === scriptNode.range[0],
            );
            context.addRemoveToken(
              (token: TSESTree.Token) =>
                token.value === ">" && token.range[1] === scriptNode.range[1],
            );
            return true;
          }
          return false;
        });
        script.restoreContext.addToken("HTMLComment" as AST_TOKEN_TYPES, [
          start,
          start + length,
        ]);
      } else if (node.type === "AstroDoctype") {
        const start = node.start;
        const end = node.end;
        const length = end - start;
        script.appendOriginal(start);
        if (!fragmentOpened) {
          openRootFragment(start);
        }
        script.appendOriginal(start + 1);
        script.appendVirtualScript(`></`);
        script.skipOriginalOffset(length - 2);
        script.appendOriginal(end);

        script.restoreContext.addRestoreNodeProcess((scriptNode, context) => {
          if (
            scriptNode.range[0] === start &&
            scriptNode.type === AST_NODE_TYPES.JSXFragment
          ) {
            delete (scriptNode as any).children;
            delete (scriptNode as any).openingFragment;
            delete (scriptNode as any).closingFragment;
            delete (scriptNode as any).expression;
            const doctypeNode = scriptNode as unknown as AstroDoctype;
            doctypeNode.type = "AstroDoctype";

            context.addRemoveToken(
              (token: TSESTree.Token) =>
                token.value === "<" && token.range[0] === scriptNode.range[0],
            );
            context.addRemoveToken(
              (token: TSESTree.Token) =>
                token.value === ">" && token.range[1] === scriptNode.range[1],
            );
            return true;
          }
          return false;
        });
        script.restoreContext.addToken("HTMLDocType" as AST_TOKEN_TYPES, [
          start,
          end,
        ]);
      } else {
        const start = node.start;
        script.appendOriginal(start);
        if (!fragmentOpened) {
          openRootFragment(start);
        }
      }
    },
    (node) => {
      if (node.type === "JSXElement") {
        const closing = getSelfClosingTag(node);
        if (!closing && node.closingElement == null) {
          const offset = calcContentEndOffset(node);
          script.appendOriginal(offset);
          script.appendVirtualScript(
            `</${getJsxName(node.openingElement.name)}>`,
          );
          script.restoreContext.addRestoreNodeProcess((scriptNode, context) => {
            const parent = context.getParent(scriptNode)!;
            if (
              scriptNode.range[0] === offset &&
              scriptNode.type === AST_NODE_TYPES.JSXClosingElement &&
              parent.type === AST_NODE_TYPES.JSXElement
            ) {
              removeAllScopeAndVariableAndReference(scriptNode, {
                visitorKeys: context.result.visitorKeys,
                scopeManager: context.result.scopeManager!,
              });
              parent.closingElement = null;
              return true;
            }
            return false;
          });
        }
      }

      if (node.type === "JSXFragment" && isSyntheticFragment(node)) {
        script.appendOriginal(node.end);
        script.appendVirtualScript("</>");
      }
    },
  );
  if (fragmentOpened) {
    const last = findLastJSXNode(resultTemplate.ast);
    if (last) {
      script.appendOriginal(last.end);
    }
    script.appendVirtualScript("</>;");
  }

  script.appendOriginal(code.length);

  return script;

  /**
   * Walk template nodes in source order from the compiler AST.
   *
   * The traversal starts with `AstroRoot`. Root-only source ranges such as
   * frontmatter fences are handled in the root branch so they do not become
   * node-shaped intermediate children.
   */
  function walkElements(
    parent: AstroRootNode,
    enter: (node: AstroFrontmatterNode | TemplateNode) => void,
    leave: (node: AstroFrontmatterNode | TemplateNode) => void,
  ): void {
    const nodes: (TemplateNode | AstroFrontmatterNode)[] = [...parent.body];

    const frontmatter = parent.frontmatter;
    if (frontmatter && !isEmptyFrontmatter(frontmatter)) {
      // Walk children in source order, inserting the frontmatter node when we reach its position.
      let insertIndex = nodes.findIndex(
        (child) => frontmatter.start <= child.start,
      );

      if (insertIndex < 0) {
        insertIndex = nodes.length;
      }
      // Remove whitespace-only text nodes before the frontmatter node.
      while (insertIndex > 0 && isWhitespaceJSXText(nodes[insertIndex - 1])) {
        nodes.splice(insertIndex - 1, 1);
        insertIndex--;
      }
      // Remove whitespace-only text nodes after the frontmatter node.
      while (
        insertIndex < nodes.length &&
        isWhitespaceJSXText(nodes[insertIndex])
      ) {
        nodes.splice(insertIndex, 1);
      }
      nodes.splice(insertIndex, 0, frontmatter);
    }

    // Remove whitespace-only text nodes at the start of the root.
    while (nodes.length > 0 && isWhitespaceJSXText(nodes[0])) {
      nodes.shift();
    }
    // Remove whitespace-only text nodes at the end of the root.
    while (nodes.length > 0 && isWhitespaceJSXText(nodes[nodes.length - 1])) {
      nodes.pop();
    }

    for (const child of nodes) {
      walkChild(child, enter, leave);
    }
  }

  /** Get raw text content for script, style, and raw nodes. */
  function getRawTextContent(
    node: JSXElementNode,
  ): { start: number; end: number; value: string } | null {
    if (node.closingElement == null) {
      return null;
    }
    const start = node.openingElement.end;
    const end = node.closingElement.start;
    if (start >= end) {
      return null;
    }
    return {
      start,
      end,
      value: code.slice(start, end),
    };
  }

  /** Get self-closing tag metadata. */
  function getSelfClosingTag(node: JSXElementNode): null | {
    offset: number;
    end: "/>" | ">";
  } {
    if (!node.openingElement?.selfClosing || node.closingElement) {
      return null;
    }
    const offset = node.openingElement.end;
    return {
      offset,
      end: code.startsWith("/>", offset - 2) ? "/>" : ">",
    };
  }

  /** Get the Astro attribute kind represented by a compiler node. */
  function analyzeAttribute(attr: AttributeNode): AnalyzedAttributeData {
    if (attr.type === "JSXSpreadAttribute") {
      return {
        kind: "spread",
        node: attr,
      };
    }
    if (!attr.value) {
      return {
        kind: "empty",
        node: attr as JSXAttributeNode & { value: null },
      };
    }
    if (isShorthandAttribute(attr)) {
      return {
        kind: "shorthand",
        node: attr,
      };
    }
    if (attr.value.type === "Literal") {
      return {
        kind: "literal-value",
        node: attr as JSXAttributeNode & { value: LiteralNode },
      };
    }
    if (
      attr.value.type === "JSXExpressionContainer" &&
      code[attr.value.start] === "`"
    ) {
      return {
        kind: "template-literal",
        node: attr as JSXAttributeNode & { value: JSXExpressionContainerNode },
      };
    }
    return {
      kind: "expression",
      node: attr as JSXAttributeNode & { value: JSXExpressionContainerNode },
    };
  }

  /**
   * Get the source offset of the opening `{` for an Astro shorthand attribute.
   *
   * The compiler represents `<img {src}>` as a JSXAttribute that starts at
   * `src`, while the end offset still includes `}`. The virtual JSX needs to
   * insert `src=` before the original `{src}`, so shorthand processing must use
   * the brace offset instead of `attr.start`.
   */
  function getShorthandAttributeOpeningBraceOffset(
    attr: JSXAttributeNode,
  ): number {
    return code[attr.start - 1] === "{" ? attr.start - 1 : attr.start;
  }

  /** Check whether a node is whitespace-only text. */
  function isWhitespaceJSXText(
    node: TemplateNode | AstroFrontmatterNode,
  ): boolean {
    return (
      node.type === "JSXText" && code.slice(node.start, node.end).trim() === ""
    );
  }

  /**
   * Process for attribute punctuators
   */
  function processAttributePunctuators(
    attr:
      | AnalyzedEmptyAttributeData
      | AnalyzedLiteralValueAttributeData
      | AnalyzedTemplateLiteralAttributeData
      | AnalyzedExpressionAttributeData,
  ) {
    const name = getAttributeName(attr);
    const start = attr.node.name.start;
    let targetIndex = start;
    let colonOffset: number | undefined;
    for (let index = 0; index < name.length; index++) {
      const char = name[index];
      if (char !== ":" && char !== "." && char !== "@") {
        continue;
      }
      if (index === 0) {
        targetIndex++;
      }
      const punctuatorIndex = start + index;
      script.appendOriginal(punctuatorIndex);
      script.skipOriginalOffset(1);
      script.appendVirtualScript(`_`);

      if (char === ":" && index !== 0 && colonOffset == null) {
        colonOffset = index;
      }
    }
    if (colonOffset != null) {
      const punctuatorIndex = start + colonOffset;
      script.restoreContext.addToken(AST_TOKEN_TYPES.JSXIdentifier, [
        start,
        punctuatorIndex,
      ]);
      script.restoreContext.addToken(AST_TOKEN_TYPES.Punctuator, [
        punctuatorIndex,
        punctuatorIndex + 1,
      ]);
      script.restoreContext.addToken(AST_TOKEN_TYPES.JSXIdentifier, [
        punctuatorIndex + 1,
        start + name.length,
      ]);
    } else {
      script.restoreContext.addToken(AST_TOKEN_TYPES.JSXIdentifier, [
        start,
        start + name.length,
      ]);
    }
    script.restoreContext.addRestoreNodeProcess((scriptNode, context) => {
      if (
        scriptNode.type === AST_NODE_TYPES.JSXAttribute &&
        scriptNode.range[0] === targetIndex
      ) {
        const baseNameNode = scriptNode.name;
        if (colonOffset != null) {
          const nameNode = baseNameNode as TSESTree.JSXNamespacedName;
          nameNode.type = AST_NODE_TYPES.JSXNamespacedName;
          nameNode.namespace = {
            type: AST_NODE_TYPES.JSXIdentifier,
            name: name.slice(0, colonOffset),
            ...ctx.getLocations(
              baseNameNode.range[0],
              baseNameNode.range[0] + colonOffset,
            ),
            parent: undefined as never,
          };
          nameNode.name = {
            type: AST_NODE_TYPES.JSXIdentifier,
            name: name.slice(colonOffset + 1),
            ...ctx.getLocations(
              baseNameNode.range[0] + colonOffset + 1,
              baseNameNode.range[1],
            ),
            parent: undefined as never,
          };
          scriptNode.name = nameNode;
          nameNode.namespace.parent = nameNode;
          nameNode.name.parent = nameNode;
        } else {
          if (baseNameNode.type === AST_NODE_TYPES.JSXIdentifier) {
            const nameNode = baseNameNode;
            nameNode.name = name;
            scriptNode.name = nameNode;
          } else {
            const nameNode = baseNameNode;
            nameNode.namespace.name = name.slice(
              baseNameNode.namespace.range[0] - start,
              baseNameNode.namespace.range[1] - start,
            );
            nameNode.name.name = name.slice(
              baseNameNode.name.range[0] - start,
              baseNameNode.name.range[1] - start,
            );
            scriptNode.name = nameNode;
            nameNode.namespace.parent = nameNode;
            nameNode.name.parent = nameNode;
          }
        }
        context.addRemoveToken(
          (token) =>
            token.range[0] === baseNameNode.range[0] &&
            token.range[1] === baseNameNode.range[1],
        );
        return true;
      }
      return false;
    });
  }

  /**
   * Generate unique id
   */
  function generateUniqueId(base: string) {
    let candidate = `$_${base.replace(/\W/g, "_")}${uniqueIdSeq++}`;
    while (usedUniqueIds.has(candidate) || code.includes(candidate)) {
      candidate = `$_${base.replace(/\W/g, "_")}${uniqueIdSeq++}`;
    }
    usedUniqueIds.add(candidate);
    return candidate;
  }

  /**
   * Find the last JSXNode.
   * Basically, it returns the last element of AstroRootNode.body.
   * However, if the last element is a JSXTextNode, and its text is whitespace,
   * and all preceding elements are AstroCommentNode, it returns the last AstroCommentNode.
   */
  function findLastJSXNode(ast: AstroRootNode): LocatedNode | null {
    const body = ast.body;
    if (body.length === 0) {
      return null;
    }
    const lastNode = body[body.length - 1];
    if (
      isWhitespaceJSXText(lastNode) &&
      body.length >= 2 &&
      body.slice(0, -1).every((node) => node.type === "AstroComment")
    ) {
      return body[body.length - 2];
    }
    return lastNode;
  }
}

/** Walk one compiler child node. */
function walkChild(
  node: AstroFrontmatterNode | TemplateNode,
  enter: (node: AstroFrontmatterNode | TemplateNode) => void,
  leave: (node: AstroFrontmatterNode | TemplateNode) => void,
) {
  enter(node);
  if (isJSXElementOrFragment(node)) {
    for (const child of node.children) {
      walkChild(child, enter, leave);
    }
  } else if (node.type === "JSXExpressionContainer") {
    // The compiler AST keeps template nodes that appear inside `{...}` under
    // the ESTree expression subtree, so pass only template-shaped descendants
    // through the same enter/leave hooks.
    walkExpression(node.expression, enter, leave);
  }
  leave(node);
}

/** Walk one compiler expression node. */
function walkExpression(
  node: UnknownNode,
  enter: (node: AstroFrontmatterNode | TemplateNode) => void,
  leave: (node: AstroFrontmatterNode | TemplateNode) => void,
) {
  const walked = new Set<UnknownNode>();
  const buffer: UnknownNode[] = [node];
  while (buffer.length > 0) {
    const current = buffer.pop()!;
    if (walked.has(current)) {
      continue;
    }
    walked.add(current);

    if (isWalkableNode(current)) {
      // If the node is a walkable template node,
      // walk it with the same walker as the main traversal
      // so that all template-shaped nodes inside it are also passed through the enter/leave hooks.
      walkChild(current, enter, leave);
    } else {
      const keys = getKeys(current);
      const children: UnknownNode[] = [];
      for (const key of keys) {
        const value: unknown = (current as any)[key];
        if (Array.isArray(value)) {
          for (const element of value) {
            if (isNode(element)) {
              children.push(element);
            }
          }
        } else if (isNode(value)) {
          children.push(value);
        }
      }

      // Add child nodes to the buffer.
      // A stack (LIFO) is used because child nodes need to be processed before the next sibling nodes.
      buffer.push(...children.sort((a, b) => b.start - a.start));
    }
  }
}

/**
 * Check whether the given node is a walkable template node that should be passed through the enter/leave hooks.
 */
function isWalkableNode(
  node: UnknownNode,
): node is AstroFrontmatterNode | TemplateNode {
  return (
    isJSXElementOrFragment(node) ||
    node.type === "AstroComment" ||
    node.type === "AstroDoctype" ||
    node.type === "JSXExpressionContainer" ||
    node.type === "JSXText"
  );
}

/**
 * Check whether the frontmatter is empty (i.e. contains no characters).
 * In this case, the frontmatter node is still generated by the compiler,
 * but it has no source range. We can identify such empty frontmatter by checking if the start and end offsets are the same.
 */
function isEmptyFrontmatter(node: AstroFrontmatterNode): boolean {
  return node.start === node.end;
}

/** Convert a compiler JSX name node to source text. */
function getJsxName(nameNode: JSXNameNode): string {
  if (nameNode.type === "JSXIdentifier") {
    return nameNode.name;
  }
  if (nameNode.type === "JSXMemberExpression") {
    return `${getJsxName(nameNode.object)}.${getJsxName(nameNode.property)}`;
  }
  if (nameNode.type === "JSXNamespacedName") {
    return `${getJsxName(nameNode.namespace)}:${getJsxName(nameNode.name)}`;
  }
  return "";
}

/** Get the Astro tag category for a traversal node. */
function getTagType(
  node: JSXElementNode,
): "element" | "component" | "custom-element" {
  const name = getJsxName(node.openingElement.name);
  if (/^[A-Z]/u.test(name) || name.includes(".")) {
    return "component";
  }
  if (name.includes("-")) {
    return "custom-element";
  }
  return "element";
}

/** Calculate where an element without a closing tag should end. */
function calcContentEndOffset(node: JSXElementNode): number {
  const children = node.children;
  const lastChild = children[children.length - 1];
  if (lastChild) {
    return lastChild.end;
  }
  return node.openingElement.end;
}

/** Get an Astro attribute name. */
function getAttributeName(
  attr:
    | AnalyzedEmptyAttributeData
    | AnalyzedShorthandAttributeData
    | AnalyzedLiteralValueAttributeData
    | AnalyzedTemplateLiteralAttributeData
    | AnalyzedExpressionAttributeData,
): string {
  if (attr.kind === "shorthand") {
    return getJsxName(attr.node.name).replace(/\}$/u, "");
  }
  return getJsxName(attr.node.name);
}
