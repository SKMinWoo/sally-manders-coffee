// The coverage gate's bar: what the code must hold before a pull request can merge.
//
// The figures are percentages (0 to 100) over every module in lib/ and server/, including ones no
// test touches (server/every-module.test.ts loads them all, so they count at their true, low
// number). The UI in app/ is outside it; exhibit 9's Playwright suite covers that.
//
// GM held 80%+. Whatever this returns is what /office prints, word for word, beside that figure.

/**
 * @param {{ lines: number, branches: number, functions: number, files: number }} c
 * @returns {{ rule: string, passed: boolean } | null}
 *   `rule` in words as the page shows it (at most 120 characters), and whether `c` meets it.
 *   null means no gate yet: CI passes and the page says the bar isn't set.
 */
export function bar(c) {
  // Above GM's 80%: lines are where the shop already sits (97% on Nov 25), so the bar is set a
  // little under it to leave room for honest new code, and branches carry their own floor because
  // a line can run without its other branch ever being taken.
  const passed = c.lines >= 90 && c.branches >= 80;
  return { rule: "Lines ≥ 90% and branches ≥ 80%, over every module", passed };
}
