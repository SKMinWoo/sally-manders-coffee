// The coverage gate's bar: what the code must hold before a pull request can merge.
//
// The figures are percentages (0 to 100) over every module in lib/ and server/, including ones no
// test touches (server/every-module.test.ts loads them all, so they count at their true, low
// number). The UI in app/ is outside it; exhibit 3's Playwright suite covers that.
//
// GM held 80%+. Whatever this returns is what /office prints, word for word, beside that figure.

/**
 * @param {{ lines: number, branches: number, functions: number, files: number }} c
 * @returns {{ rule: string, passed: boolean } | null}
 *   `rule` in words as the page shows it (at most 120 characters), and whether `c` meets it.
 *   null means no gate yet: CI passes and the page says the bar isn't set.
 */
export function bar(c) {
  // TODO(Alex): set the bar. Return { rule, passed }: for "lines ≥ 80%", that rule string and c.lines >= 80.
  void c;
  return null;
}
