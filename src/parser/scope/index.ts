import type { TSESTree } from "@typescript-eslint/types";
import type { Reference } from "@typescript-eslint/scope-manager";
import {
  Reference as ReferenceClass,
  Variable as VariableClass,
} from "eslint-scope";
import type {
  ScopeManager,
  Scope,
  Variable,
} from "@typescript-eslint/scope-manager";
import type { VisitorKeys } from "@typescript-eslint/visitor-keys";
import { traverseNodes } from "../../traverse";
import { addElementsToSortedArray, addElementToSortedArray } from "../../util";
/**
 * Gets the scope for the Program node
 */
export function getProgramScope(scopeManager: ScopeManager): Scope {
  const globalScope = scopeManager.globalScope!;
  return (
    globalScope.childScopes.find((s) => s.type === "module") || globalScope
  );
}
/** Remove all scope, variable, and reference */
export function removeAllScopeAndVariableAndReference(
  target: TSESTree.Node,
  info: {
    visitorKeys?: VisitorKeys;
    scopeManager: ScopeManager;
  }
): void {
  const targetScopes = new Set<Scope>();
  traverseNodes(target, {
    visitorKeys: info.visitorKeys,
    enterNode(node) {
      const scope = info.scopeManager.acquire(node);
      if (scope) {
        targetScopes.add(scope);
        return;
      }
      if (node.type === "Identifier") {
        let scope = getInnermostScopeFromNode(info.scopeManager, node);
        while (
          scope &&
          scope.block.type !== "Program" &&
          target.range[0] <= scope.block.range[0] &&
          scope.block.range[1] <= target.range[1]
        ) {
          scope = scope.upper!;
        }
        if (targetScopes.has(scope)) {
          return;
        }

        removeIdentifierVariable(node, scope);
        removeIdentifierReference(node, scope);
      }
    },
    leaveNode() {
      // noop
    },
  });

  for (const scope of targetScopes) {
    removeScope(info.scopeManager, scope);
  }
}

/**
 * Add the virtual reference.
 */
export function addVirtualReference(
  node: TSESTree.Identifier,
  variable: Variable,
  scope: Scope,
  readWrite: { read?: boolean; write?: boolean }
): Reference {
  const reference = new ReferenceClass() as Reference;
  (reference as any).astroVirtualReference = true;
  (reference as ReferenceClass).from = scope as never;
  (reference as ReferenceClass).identifier = node;
  reference.isWrite = () => Boolean(readWrite.write);
  reference.isWriteOnly = () => Boolean(readWrite.write) && !readWrite.read;
  reference.isRead = () => Boolean(readWrite.read);
  reference.isReadOnly = () => Boolean(readWrite.read) && !readWrite.write;
  reference.isReadWrite = () => Boolean(readWrite.read && readWrite.write);

  addReference(variable.references, reference);
  reference.resolved = variable;

  return reference;
}

/**
 * Add global variable
 */
export function addGlobalVariable(
  reference: Reference,
  scopeManager: ScopeManager
): Variable {
  const globalScope = scopeManager.globalScope!;
  const name = reference.identifier.name;
  let variable = globalScope.set.get(name);
  if (!variable) {
    variable = new VariableClass() as Variable;
    (variable as VariableClass).name = name;
    (variable as VariableClass).scope = globalScope as never;
    globalScope.variables.push(variable);
    globalScope.set.set(name, variable);
  }
  // Links the variable and the reference.
  reference.resolved = variable;
  variable.references.push(reference);

  return variable;
}

/** Remove reference from through */
export function removeReferenceFromThrough(
  reference: Reference,
  baseScope: Scope
): void {
  const variable = reference.resolved!;
  const name = reference.identifier.name;
  let scope: Scope | null = baseScope;
  while (scope) {
    for (const ref of [...scope.through]) {
      if (reference === ref) {
        scope.through.splice(scope.through.indexOf(ref), 1);
      } else if (ref.identifier.name === name) {
        ref.resolved = variable;
        if (!variable.references.includes(ref)) {
          addReference(variable.references, ref);
        }
        scope.through.splice(scope.through.indexOf(ref), 1);
      }
    }
    scope = scope.upper;
  }
}

/** Remove scope */
function removeScope(scopeManager: ScopeManager, scope: Scope): void {
  for (const childScope of scope.childScopes) {
    removeScope(scopeManager, childScope);
  }

  while (scope.references[0]) {
    removeReference(scope.references[0], scope);
  }
  const upper = scope.upper;
  if (upper) {
    const index = upper.childScopes.indexOf(scope);
    if (index >= 0) {
      upper.childScopes.splice(index, 1);
    }
  }
  const index = scopeManager.scopes.indexOf(scope);
  if (index >= 0) {
    scopeManager.scopes.splice(index, 1);
  }
}

/** Remove reference */
function removeReference(reference: Reference, baseScope: Scope): void {
  if (reference.resolved) {
    if (reference.resolved.defs.some((d) => d.name === reference.identifier)) {
      // remove var
      const varIndex = baseScope.variables.indexOf(reference.resolved);
      if (varIndex >= 0) {
        baseScope.variables.splice(varIndex, 1);
      }
      const name = reference.identifier.name;
      if (reference.resolved === baseScope.set.get(name)) {
        baseScope.set.delete(name);
      }
    } else {
      const refIndex = reference.resolved.references.indexOf(reference);
      if (refIndex >= 0) {
        reference.resolved.references.splice(refIndex, 1);
      }
    }
  }

  let scope: Scope | null = baseScope;
  while (scope) {
    const refIndex = scope.references.indexOf(reference);
    if (refIndex >= 0) {
      scope.references.splice(refIndex, 1);
    }
    const throughIndex = scope.through.indexOf(reference);
    if (throughIndex >= 0) {
      scope.through.splice(throughIndex, 1);
    }
    scope = scope.upper;
  }
}

/** Remove variable */
function removeIdentifierVariable(
  node: TSESTree.Identifier,
  scope: Scope
): void {
  for (let varIndex = 0; varIndex < scope.variables.length; varIndex++) {
    const variable = scope.variables[varIndex];
    const defIndex = variable.defs.findIndex((def) => def.name === node);
    if (defIndex < 0) {
      continue;
    }
    variable.defs.splice(defIndex, 1);
    if (variable.defs.length === 0) {
      // Remove variable
      referencesToThrough(variable.references, scope);
      variable.references.forEach((r) => {
        if (r.init) (r as any).init = false;
        r.resolved = null;
      });
      scope.variables.splice(varIndex, 1);
      const name = node.name;
      if (variable === scope.set.get(name)) {
        scope.set.delete(name);
      }
    } else {
      const idIndex = variable.identifiers.indexOf(node);
      if (idIndex >= 0) {
        variable.identifiers.splice(idIndex, 1);
      }
    }
    return;
  }
}

/** Remove reference */
function removeIdentifierReference(
  node: TSESTree.Identifier,
  scope: Scope
): boolean {
  const reference = scope.references.find((ref) => ref.identifier === node);
  if (reference) {
    removeReference(reference, scope);
    return true;
  }
  const location = node.range[0];

  const pendingScopes = [];
  for (const childScope of scope.childScopes) {
    const range = childScope.block.range;

    if (range[0] <= location && location < range[1]) {
      if (removeIdentifierReference(node, childScope)) {
        return true;
      }
    } else {
      pendingScopes.push(childScope);
    }
  }
  for (const childScope of pendingScopes) {
    if (removeIdentifierReference(node, childScope)) {
      return true;
    }
  }
  return false;
}

/**
 * Get the innermost scope which contains a given node.
 * @returns The innermost scope.
 */
function getInnermostScopeFromNode(
  scopeManager: ScopeManager,
  currentNode: TSESTree.Node
): Scope {
  return getInnermostScope(
    getScopeFromNode(scopeManager, currentNode),
    currentNode
  );
}

/**
 * Gets the scope for the current node
 */
function getScopeFromNode(
  scopeManager: ScopeManager,
  currentNode: TSESTree.Node
): Scope {
  let node: TSESTree.Node | null = currentNode;
  for (; node; node = node.parent || null) {
    const scope = scopeManager.acquire(node, false);
    if (scope) {
      if (scope.type === "function-expression-name") {
        return scope.childScopes[0];
      }
      if (
        scope.type === "global" &&
        node.type === "Program" &&
        node.sourceType === "module"
      ) {
        return scope.childScopes.find((s) => s.type === "module") || scope;
      }
      return scope;
    }
  }
  const global = scopeManager.globalScope!;
  return global;
}

/**
 * Get the innermost scope which contains a given location.
 * @param initialScope The initial scope to search.
 * @param node The location to search.
 * @returns The innermost scope.
 */
function getInnermostScope(initialScope: Scope, node: TSESTree.Node): Scope {
  for (const childScope of initialScope.childScopes) {
    const range = childScope.block.range;

    if (range[0] <= node.range[0] && node.range[1] <= range[1]) {
      return getInnermostScope(childScope, node);
    }
  }

  return initialScope;
}

/** Move reference to through */
function referencesToThrough(references: Reference[], baseScope: Scope) {
  let scope: Scope | null = baseScope;
  while (scope) {
    addAllReferences(scope.through, references);
    scope = scope.upper;
  }
}

/**
 * Add all references to array
 */
function addAllReferences(list: Reference[], elements: Reference[]): void {
  addElementsToSortedArray(
    list,
    elements,
    (a, b) => a.identifier.range[0] - b.identifier.range[0]
  );
}

/**
 * Add reference to array
 */
function addReference(list: Reference[], reference: Reference): void {
  addElementToSortedArray(
    list,
    reference,
    (a, b) => a.identifier.range[0] - b.identifier.range[0]
  );
}
