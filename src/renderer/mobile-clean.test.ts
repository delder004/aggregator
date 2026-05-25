// Mechanical guard for the stylist agent's mobile-clean contract.
//
// The stylist's system prompt asserts mobile compliance via CSS self-inspection
// in the PR body. That's unfalsifiable — over the agent's first ~25 PRs, 100%
// self-attested clean. This test turns the most concrete of those rules into
// a real assertion run by `npm test`. Catches regressions before the agent
// even opens the PR.
//
// V1 covers fixed-width violations only (the highest-signal, lowest-false-positive
// check). Flex-wrap / unbreakable-string checks are content-dependent and
// would generate too much noise without source-level markup; deferred.

import { describe, it, expect } from "vitest";
import { layout } from "./html";

const MOBILE_BREAKPOINT_PX = 360;

type Declaration = { prop: string; value: string };
type CssRule = {
  selector: string;
  declarations: Declaration[];
  mediaContext: string | null;
};

function extractInlineCss(html: string): string {
  const match = html.match(/<style>([\s\S]*?)<\/style>/);
  if (!match) throw new Error("layout() output contained no <style> block");
  return match[1];
}

// Tiny bracket-tracking CSS parser. Handles nested @media but skips @keyframes
// / @font-face / @supports bodies (we don't need their declarations).
function parseCss(css: string): CssRule[] {
  const rules: CssRule[] = [];
  let i = 0;

  function skipWs(): void {
    while (i < css.length) {
      if (/\s/.test(css[i])) {
        i++;
      } else if (css[i] === "/" && css[i + 1] === "*") {
        const end = css.indexOf("*/", i + 2);
        i = end === -1 ? css.length : end + 2;
      } else {
        return;
      }
    }
  }

  function readBlock(mediaContext: string | null): void {
    while (i < css.length) {
      skipWs();
      if (i >= css.length || css[i] === "}") return;

      const selectorStart = i;
      while (i < css.length && css[i] !== "{") i++;
      if (i >= css.length) return;
      const selector = css.slice(selectorStart, i).trim();
      i++; // consume '{'

      if (selector.startsWith("@media")) {
        readBlock(
          mediaContext ? `${mediaContext} AND ${selector}` : selector,
        );
        if (i < css.length && css[i] === "}") i++;
        continue;
      }

      if (selector.startsWith("@")) {
        // @keyframes, @font-face, @supports, etc. — skip the whole body.
        let depth = 1;
        while (i < css.length && depth > 0) {
          if (css[i] === "{") depth++;
          else if (css[i] === "}") depth--;
          if (depth === 0) break;
          i++;
        }
        if (i < css.length && css[i] === "}") i++;
        continue;
      }

      const declStart = i;
      let depth = 1;
      while (i < css.length && depth > 0) {
        if (css[i] === "{") depth++;
        else if (css[i] === "}") depth--;
        if (depth === 0) break;
        i++;
      }
      const declText = css.slice(declStart, i);
      if (i < css.length && css[i] === "}") i++;

      const declarations: Declaration[] = declText
        .split(";")
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => {
          const colon = d.indexOf(":");
          if (colon === -1) return null;
          return {
            prop: d.slice(0, colon).trim(),
            value: d.slice(colon + 1).trim(),
          };
        })
        .filter((d): d is Declaration => d !== null);

      rules.push({ selector, declarations, mediaContext });
    }
  }

  readBlock(null);
  return rules;
}

const ALL_RULES = parseCss(extractInlineCss(layout("")));

describe("mobile-clean guard", () => {
  it("no fixed width or min-width > 360px outside a media query", () => {
    const violations: string[] = [];
    for (const rule of ALL_RULES) {
      if (rule.mediaContext) continue;
      for (const decl of rule.declarations) {
        if (decl.prop !== "width" && decl.prop !== "min-width") continue;
        const match = decl.value.match(/^(\d+)px$/);
        if (!match) continue;
        const px = parseInt(match[1], 10);
        if (px > MOBILE_BREAKPOINT_PX) {
          violations.push(
            `${rule.selector} { ${decl.prop}: ${decl.value} }`,
          );
        }
      }
    }
    expect(
      violations,
      `Fixed widths above ${MOBILE_BREAKPOINT_PX}px at base level will cause horizontal overflow on iPhone widths. Move under a media query, switch to max-width, or shrink. Violations:\n  ${violations.join("\n  ")}`,
    ).toEqual([]);
  });

  it("preserves the defensive overflow-wrap safety net on text containers", () => {
    // PR #36 added these as the Phase 0A fix for horizontal overflow on
    // iPhone widths. Guard against silent removal in future stylist PRs.
    const required = [".article-body", ".article-summary", ".article-title"];
    const missing: string[] = [];
    for (const target of required) {
      const rule = ALL_RULES.find(
        (r) =>
          r.mediaContext === null &&
          r.selector
            .split(",")
            .map((s) => s.trim())
            .includes(target),
      );
      if (!rule) {
        missing.push(`${target} (no base-level rule found)`);
        continue;
      }
      const hasGuard = rule.declarations.some(
        (d) =>
          (d.prop === "overflow-wrap" && /(anywhere|break-word)/.test(d.value)) ||
          (d.prop === "word-break" && /break-(all|word)/.test(d.value)),
      );
      if (!hasGuard) {
        missing.push(
          `${target} (rule exists but lacks overflow-wrap/word-break)`,
        );
      }
    }
    expect(
      missing,
      `These text containers must keep their mobile safety net (overflow-wrap: anywhere or word-break: break-word). Removing it re-introduces the overflow bug fixed in PR #36. Missing:\n  ${missing.join("\n  ")}`,
    ).toEqual([]);
  });
});
