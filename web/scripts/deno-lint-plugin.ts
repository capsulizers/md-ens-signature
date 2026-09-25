/// <reference lib="deno.unstable" />

import importCheckPlugin from "@cunarist/deno-import-check/lint";
import absencePlugin from "@cunarist/deno-lint-plugin-explicit-types/absence";
import concretePlugin from "@cunarist/deno-lint-plugin-explicit-types/concrete";
import namingPlugin from "@cunarist/deno-lint-plugin-explicit-types/naming";
import litCorePlugin from "@cunarist/deno-lint-plugin-lit/core";
import litDomRefPlugin from "@cunarist/deno-lint-plugin-lit/dom-ref";
import litNamingPlugin from "@cunarist/deno-lint-plugin-lit/naming";
import litReactiveControllerPlugin from "@cunarist/deno-lint-plugin-lit/reactive-controller";
import litStrictPlugin from "@cunarist/deno-lint-plugin-lit/strict";
import { setup as setupHugoalhPlugin } from "@hugoalh/deno-lint-rules/setup";

/** What every re-export is told to become, whatever it re-exports today. */
const WILDCARD_EXPORT_MESSAGE =
  "Re-export a module with export * so the entry point stays in step with what the module exports.";

/**
 * A `title` attribute, property, or boolean binding at the start of a template
 * chunk or after whitespace, which is where an attribute sits in markup.
 */
const TITLE_ATTRIBUTE_PATTERN = /(?:^|\s)[.?]?title\s*=/;

/**
 * Native tags that Web Awesome ships a component for. Derived from
 * `@awesome.me/webawesome/dist/components`; tags with no counterpart there
 * (`a`, `img`, `label`, `form`, `table`, ...) stay allowed.
 */
const NATIVE_TAG_REPLACEMENTS = new Map<string, string>([
  ["button", "wa-button"],
  ["details", "wa-details"],
  ["summary", "wa-details"],
  ["dialog", "wa-dialog"],
  ["hr", "wa-divider"],
  ["input", "wa-input"],
  ["option", "wa-option"],
  ["progress", "wa-progress-bar"],
  ["select", "wa-select"],
  ["textarea", "wa-textarea"],
]);

/** An opening tag for one of the replaced native elements. */
const NATIVE_TAG_PATTERN = new RegExp(
  `<(${[...NATIVE_TAG_REPLACEMENTS.keys()].join("|")})(?![\\w-])`,
  "g",
);

interface RangedNode {
  range: Deno.lint.Range;
}

type ClassNode = Deno.lint.ClassDeclaration | Deno.lint.ClassExpression;

const hugoalhPlugin = setupHugoalhPlugin({
  tags: [],
  rules: {
    "max-complexity": { maximum: 16 },
    "max-file-lines": true,
    "max-file-size": true,
    "max-identifier-length": true,
    "max-nest-ternaries": true,
    "max-params": true,
    "no-class-constructor-parameter-property": true,
    "no-modifier-private": true,
  },
});

const plugin: Deno.lint.Plugin = {
  name: "custom",
  rules: {
    ...hugoalhPlugin.rules,
    ...importCheckPlugin.rules,
    ...concretePlugin.rules,
    ...namingPlugin.rules,
    ...absencePlugin.rules,
    ...litCorePlugin.rules,
    ...litStrictPlugin.rules,
    ...litDomRefPlugin.rules,
    ...litReactiveControllerPlugin.rules,
    ...litNamingPlugin.rules,
    "always-wildcard-export": createAlwaysWildcardExportRule(),
    "no-line-lint-ignore": createNoLineLintIgnoreRule(),
    "no-class-extends": createNoClassExtendsRule(),
    "no-lit-nothing": createNoLitNothingRule(),
    "no-title-attribute": createNoTitleAttributeRule(),
    "prefer-wa-components": createPreferWaComponentsRule(),
    "no-satisfies": createNoSatisfiesRule(),
    "no-unknown": createNoUnknownRule(),
    "restricted-types": createRestrictedTypesRule(),
  },
};

export default plugin;

function createAlwaysWildcardExportRule(): Deno.lint.Rule {
  return {
    create(context: Deno.lint.RuleContext): Deno.lint.LintVisitor {
      return {
        ExportNamedDeclaration(node): void {
          if (node.source === null) {
            return;
          }
          report(context, node, WILDCARD_EXPORT_MESSAGE);
        },
        ExportAllDeclaration(node): void {
          if (node.exportKind === "type") {
            report(context, node, WILDCARD_EXPORT_MESSAGE);
          }
        },
      };
    },
  };
}

function createNoLineLintIgnoreRule(): Deno.lint.Rule {
  return {
    create(context: Deno.lint.RuleContext): Deno.lint.LintVisitor {
      return {
        Program(): void {
          for (const comment of context.sourceCode.getAllComments()) {
            if (
              comment.type === "Line" &&
              /^deno-lint-ignore(?:\s|$)/.test(comment.value.trimStart())
            ) {
              report(
                context,
                comment,
                "Fix the lint violation instead of using deno-lint-ignore. Use deno-lint-ignore-file only when a file-level exception is unavoidable.",
              );
            }
          }
        },
      };
    },
  };
}

function createNoClassExtendsRule(): Deno.lint.Rule {
  return {
    create(context: Deno.lint.RuleContext): Deno.lint.LintVisitor {
      const check = (node: ClassNode): void => {
        if (node.superClass === null) {
          return;
        }
        if (getSuperClassName(node) === "LitElement") {
          return;
        }
        report(
          context,
          node.superClass,
          "Prefer composition over inheritance. Only LitElement may be extended.",
        );
      };
      return {
        ClassDeclaration: check,
        ClassExpression: check,
      };
    },
  };
}

function createNoLitNothingRule(): Deno.lint.Rule {
  return {
    create(context: Deno.lint.RuleContext): Deno.lint.LintVisitor {
      return {
        ImportSpecifier(node): void {
          const source = node.parent.type === "ImportDeclaration"
            ? node.parent.source.value
            : null;
          if (
            getImportSpecifierName(node.imported) !== "nothing" ||
            source !== "lit" && source !== "lit-html"
          ) {
            return;
          }
          report(
            context,
            node,
            "Do not use Lit nothing. Use html`` for empty templates.",
          );
        },
      };
    },
  };
}

function createNoTitleAttributeRule(): Deno.lint.Rule {
  return {
    create(context: Deno.lint.RuleContext): Deno.lint.LintVisitor {
      return {
        TemplateElement(node): void {
          if (!TITLE_ATTRIBUTE_PATTERN.test(node.raw)) {
            return;
          }
          report(
            context,
            node,
            "Do not set the title attribute. Give the element an id and render a wa-tooltip for it.",
          );
        },
      };
    },
  };
}

function createPreferWaComponentsRule(): Deno.lint.Rule {
  return {
    create(context: Deno.lint.RuleContext): Deno.lint.LintVisitor {
      return {
        TemplateElement(node): void {
          for (const match of node.raw.matchAll(NATIVE_TAG_PATTERN)) {
            const tag = match[1] ?? "";
            report(
              context,
              node,
              `Do not render native <${tag}>. Use <${
                NATIVE_TAG_REPLACEMENTS.get(tag)
              }> instead; native tags are only for elements Web Awesome has no component for.`,
            );
          }
        },
      };
    },
  };
}

function createNoSatisfiesRule(): Deno.lint.Rule {
  return {
    create(context: Deno.lint.RuleContext): Deno.lint.LintVisitor {
      return {
        TSSatisfiesExpression(node): void {
          report(
            context,
            node,
            "Do not use satisfies. Add an explicit type annotation to the declaration.",
          );
        },
      };
    },
  };
}

function createNoUnknownRule(): Deno.lint.Rule {
  return {
    create(context: Deno.lint.RuleContext): Deno.lint.LintVisitor {
      return {
        TSUnknownKeyword(node): void {
          report(
            context,
            node,
            "Do not use unknown. Define a concrete type instead.",
          );
        },
      };
    },
  };
}

function createRestrictedTypesRule(): Deno.lint.Rule {
  return {
    create(context: Deno.lint.RuleContext): Deno.lint.LintVisitor {
      return {
        PropertyDefinition(node): void {
          if (node.readonly) {
            reportReadonly(context, node);
          }
        },
        TSIndexSignature(node): void {
          if (node.readonly) {
            reportReadonly(context, node);
          }
        },
        TSParameterProperty(node): void {
          if (node.readonly) {
            reportReadonly(context, node);
          }
        },
        TSPropertySignature(node): void {
          if (node.readonly) {
            reportReadonly(context, node);
          }
        },
        TSTypeOperator(node): void {
          if (node.operator === "readonly") {
            reportReadonly(context, node);
          }
        },
      };
    },
  };
}

function getSuperClassName(
  node: Deno.lint.ClassDeclaration | Deno.lint.ClassExpression,
): string | null {
  const superClass = node.superClass;
  return superClass?.type === "Identifier" ? superClass.name : null;
}

function reportReadonly(
  context: Deno.lint.RuleContext,
  node: RangedNode,
): void {
  report(context, node, "Do not use the readonly keyword.");
}

function report(
  context: Deno.lint.RuleContext,
  node: RangedNode,
  message: string,
): void {
  context.report({ range: node.range, message });
}

function getLiteralString(
  node:
    | Deno.lint.Literal
    | Deno.lint.TemplateLiteral
    | Deno.lint.UnaryExpression
    | Deno.lint.UpdateExpression,
): string | null {
  return node.type === "Literal" && typeof node.value === "string"
    ? node.value
    : null;
}

function getImportSpecifierName(
  node: Deno.lint.Identifier | Deno.lint.StringLiteral,
): string | null {
  return node.type === "Identifier" ? node.name : getLiteralString(node);
}
