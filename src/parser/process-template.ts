import type { ParseResult } from "@astrojs/compiler";
import { AST_TOKEN_TYPES, AST_NODE_TYPES } from "@typescript-eslint/types";
import type { TSESTree } from "@typescript-eslint/types";
import {
  calcAttributeEndOffset,
  calcAttributeValueStartOffset,
  getSelfClosingTag,
  isTag,
  walkElements,
  getEndTag,
  calcContentEndOffset,
  getEndOffset,
} from "../astro";
import type { Context } from "../context";
import { ScriptContext } from "../context/script";
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

/**
 * Process the template to generate a ScriptContext.
 */
export function processTemplate(
  ctx: Context,
  resultTemplate: ParseResult
): ScriptContext {
  let uniqueIdSeq = 0;
  const usedUniqueIds = new Set<string>();

  const script = new ScriptContext(ctx);

  let fragmentOpened = false;

  /** Open astro root fragment */
  function openRootFragment(startOffset: number) {
    script.appendScript("<>");
    fragmentOpened = true;
    script.addRestoreNodeProcess((scriptNode, { result }) => {
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
    ctx.code,
    // eslint-disable-next-line complexity -- X(
    (node, [parent]) => {
      if (node.type === "frontmatter") {
        const start = node.position!.start.offset;
        if (fragmentOpened) {
          script.appendScript("</>;");
          fragmentOpened = false;
        }
        script.appendOriginal(start);
        script.skipOriginalOffset(3);
        const end = getEndOffset(node, ctx);
        const scriptStart = start + 3;
        let scriptEnd = end - 3;
        let endChar: string;
        while (
          scriptStart < scriptEnd - 1 &&
          (endChar = script.originalCode[scriptEnd - 1]) &&
          !endChar.trim()
        ) {
          scriptEnd--;
        }
        script.appendOriginal(scriptEnd);

        script.appendScript("\n;");
        script.skipOriginalOffset(end - scriptEnd);

        script.addRestoreNodeProcess((_scriptNode, { result }) => {
          for (let index = 0; index < result.ast.body.length; index++) {
            const st = result.ast.body[index] as TSESTree.Node;
            if (st.type === AST_NODE_TYPES.EmptyStatement) {
              if (st.range[0] === scriptEnd && st.range[1] <= end) {
                result.ast.body.splice(index, 1);
                break;
              }
            }
          }
          return true;
        });

        script.addToken(AST_TOKEN_TYPES.Punctuator, [
          node.position!.start.offset,
          node.position!.start.offset + 3,
        ]);
        script.addToken(AST_TOKEN_TYPES.Punctuator, [end - 3, end]);
      } else if (isTag(node)) {
        // Process for multiple tag
        if (parent.type === "expression") {
          const index = parent.children.indexOf(node);
          const before = parent.children[index - 1];
          if (!before || !isTag(before)) {
            const after = parent.children[index + 1];
            if (after && (isTag(after) || after.type === "comment")) {
              const start = node.position!.start.offset;
              script.appendOriginal(start);
              script.appendScript("<>");
              script.addRestoreNodeProcess((scriptNode) => {
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
                  if (fragmentNode.range[1] < last.range[1]) {
                    fragmentNode.range[1] = last.range[1];
                    fragmentNode.loc.end = ctx.getLocFromIndex(
                      fragmentNode.range[1]
                    );
                  }
                  return true;
                }
                return false;
              });
            }
          }
        }

        const start = node.position!.start.offset;
        script.appendOriginal(start);
        if (!fragmentOpened) {
          openRootFragment(start);
        }

        // Process for attributes
        for (const attr of node.attributes) {
          if (
            (node.type === "component" || node.type === "fragment") &&
            (attr.kind === "quoted" ||
              attr.kind === "empty" ||
              attr.kind === "expression" ||
              attr.kind === "template-literal")
          ) {
            const colonIndex = attr.name.indexOf(":");
            if (colonIndex >= 0) {
              const start = attr.position!.start.offset;
              script.appendOriginal(start + colonIndex);
              script.skipOriginalOffset(1);
              script.appendScript(`_`);

              script.addToken(AST_TOKEN_TYPES.JSXIdentifier, [
                start,
                start + colonIndex,
              ]);
              script.addToken(AST_TOKEN_TYPES.Punctuator, [
                start + colonIndex,
                start + colonIndex + 1,
              ]);
              script.addToken(AST_TOKEN_TYPES.JSXIdentifier, [
                start + colonIndex + 1,
                start + attr.name.length,
              ]);
              script.addRestoreNodeProcess((scriptNode, context) => {
                if (
                  scriptNode.type === AST_NODE_TYPES.JSXAttribute &&
                  scriptNode.range[0] === start
                ) {
                  const baseNameNode = scriptNode.name;
                  const nsn: TSESTree.JSXNamespacedName = {
                    ...baseNameNode,
                    type: AST_NODE_TYPES.JSXNamespacedName,
                    namespace: {
                      type: AST_NODE_TYPES.JSXIdentifier,
                      name: attr.name.slice(0, colonIndex),
                      ...ctx.getLocations(
                        baseNameNode.range[0],
                        baseNameNode.range[0] + colonIndex
                      ),
                    },
                    name: {
                      type: AST_NODE_TYPES.JSXIdentifier,
                      name: attr.name.slice(colonIndex + 1),
                      ...ctx.getLocations(
                        baseNameNode.range[0] + colonIndex + 1,
                        baseNameNode.range[1]
                      ),
                    },
                  };
                  scriptNode.name = nsn;
                  nsn.namespace.parent = nsn;
                  nsn.name.parent = nsn;

                  context.addRemoveToken(
                    (token) =>
                      token.range[0] === baseNameNode.range[0] &&
                      token.range[1] === baseNameNode.range[1]
                  );
                  return true;
                }
                return false;
              });
            }
          }
          if (attr.kind === "shorthand") {
            const start = attr.position!.start.offset;
            script.appendOriginal(start);
            const jsxName = /[\s"'[\]{}]/u.test(attr.name)
              ? generateUniqueId(attr.name)
              : attr.name;
            script.appendScript(`${jsxName}=`);

            script.addRestoreNodeProcess((scriptNode) => {
              if (
                scriptNode.type === AST_NODE_TYPES.JSXAttribute &&
                scriptNode.range[0] === start
              ) {
                const attrNode =
                  scriptNode as unknown as AstroShorthandAttribute;
                attrNode.type = "AstroShorthandAttribute";

                const locs = ctx.getLocations(
                  ...attrNode.value.expression.range
                );
                if (jsxName !== attr.name) {
                  attrNode.name.name = attr.name;
                }
                attrNode.name.range = locs.range;
                attrNode.name.loc = locs.loc;
                return true;
              }
              return false;
            });
          } else if (attr.kind === "template-literal") {
            const attrStart = attr.position!.start.offset;
            const start = calcAttributeValueStartOffset(attr, ctx);
            const end = calcAttributeEndOffset(attr, ctx);
            script.appendOriginal(start);
            script.appendScript("{");
            script.appendOriginal(end);
            script.appendScript("}");

            script.addRestoreNodeProcess((scriptNode) => {
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
        const closing = getSelfClosingTag(node, ctx);
        if (closing && closing.end === ">") {
          script.appendOriginal(closing.offset - 1);
          script.appendScript("/");
        }

        // Process for raw text
        if (node.name === "script" || node.name === "style") {
          const text = node.children[0];
          if (text && text.type === "text") {
            const styleNodeStart = node.position!.start.offset;
            const start = text.position!.start.offset;
            script.appendOriginal(start);
            script.skipOriginalOffset(text.value.length);

            script.addRestoreNodeProcess((scriptNode) => {
              if (
                scriptNode.type === AST_NODE_TYPES.JSXElement &&
                scriptNode.range[0] === styleNodeStart
              ) {
                const textNode: AstroRawText = {
                  type: "AstroRawText",
                  value: text.value,
                  raw: text.value,
                  parent: scriptNode as JSXElement,
                  ...ctx.getLocations(start, start + text.value.length),
                };
                scriptNode.children = [textNode as unknown as TSESTree.JSXText];
                return true;
              }
              return false;
            });
            script.addToken(AST_TOKEN_TYPES.JSXText, [
              start,
              start + text.value.length,
            ]);
          }
        }
      } else if (node.type === "comment") {
        const start = node.position!.start.offset;
        const end = getEndOffset(node, ctx);
        const length = end - start;
        script.appendOriginal(start);
        if (!fragmentOpened) {
          openRootFragment(start);
        }
        script.appendOriginal(start + 1);
        script.appendScript(`></`);
        script.skipOriginalOffset(length - 2);
        script.appendOriginal(end);

        script.addRestoreNodeProcess((scriptNode, context) => {
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
                token.value === "<" && token.range[0] === scriptNode.range[0]
            );
            context.addRemoveToken(
              (token: TSESTree.Token) =>
                token.value === ">" && token.range[1] === scriptNode.range[1]
            );
            return true;
          }
          return false;
        });
        script.addToken("HTMLComment" as AST_TOKEN_TYPES, [
          start,
          start + length,
        ]);
      } else if (node.type === "doctype") {
        const start = node.position!.start.offset;
        const end = getEndOffset(node, ctx);
        const length = end - start;
        script.appendOriginal(start);
        if (!fragmentOpened) {
          openRootFragment(start);
        }
        script.appendOriginal(start + 1);
        script.appendScript(`></`);
        script.skipOriginalOffset(length - 2);
        script.appendOriginal(end);

        script.addRestoreNodeProcess((scriptNode, context) => {
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
                token.value === "<" && token.range[0] === scriptNode.range[0]
            );
            context.addRemoveToken(
              (token: TSESTree.Token) =>
                token.value === ">" && token.range[1] === scriptNode.range[1]
            );
            return true;
          }
          return false;
        });
        script.addToken("HTMLDocType" as AST_TOKEN_TYPES, [start, end]);
      } else {
        const start = node.position!.start.offset;
        script.appendOriginal(start);
        if (!fragmentOpened) {
          openRootFragment(start);
        }
      }
    },
    (node, [parent]) => {
      if (isTag(node)) {
        const closing = getSelfClosingTag(node, ctx);
        if (!closing) {
          const end = getEndTag(node, ctx);
          if (!end) {
            const offset = calcContentEndOffset(node, ctx);
            script.appendOriginal(offset);
            script.appendScript(`</${node.name}>`);
            script.addRestoreNodeProcess((scriptNode, context) => {
              const parent = context.getParent(scriptNode)!;
              if (
                scriptNode.range[0] === offset &&
                scriptNode.type === AST_NODE_TYPES.JSXClosingElement &&
                parent.type === AST_NODE_TYPES.JSXElement
              ) {
                parent.closingElement = null;
                return true;
              }
              return false;
            });
          }
        }
      }
      // Process for multiple tag
      if (
        (isTag(node) || node.type === "comment") &&
        parent.type === "expression"
      ) {
        const index = parent.children.indexOf(node);
        const after = parent.children[index + 1];
        if (!after || (!isTag(after) && after.type !== "comment")) {
          const before = parent.children[index - 1];
          if (before && (isTag(before) || before.type === "comment")) {
            const end = getEndOffset(node, ctx);
            script.appendOriginal(end);
            script.appendScript("</>");
          }
        }
      }
    }
  );
  if (fragmentOpened) {
    const last =
      resultTemplate.ast.children[resultTemplate.ast.children.length - 1];
    const end = getEndOffset(last, ctx);
    script.appendOriginal(end);
    script.appendScript("</>");
  }

  script.appendOriginal(ctx.code.length);

  return script;

  /**
   * Generate unique id
   */
  function generateUniqueId(base: string) {
    let candidate = `$_${base.replace(/\W/g, "_")}${uniqueIdSeq++}`;
    while (usedUniqueIds.has(candidate) || ctx.code.includes(candidate)) {
      candidate = `$_${base.replace(/\W/g, "_")}${uniqueIdSeq++}`;
    }
    usedUniqueIds.add(candidate);
    return candidate;
  }
}
