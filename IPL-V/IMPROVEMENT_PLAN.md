# Critical analysis of the Lisp IPL-V interpreter, and a plan to improve it

Target: `~/Desktop/AIHistory/ExecutableArchaeology/repo/IPL-V/iplv.lisp` (3293 lines, 131 `defj`s), the only maintained copy. Nothing is changed until Jeff authorizes it.

## Context

The interpreter now runs four historical programs: Stefferud's LT (24/24 theorems match 1963), the Heuristic Coder T1, the RM-3588 annexer, and Simon/Yngve. Each new program has so far exposed 3-10 interpreter bugs (this session: 10 for LT). That pattern is the main finding. The interpreter's correctness has come from **debugging against particular programs, not from the manual**, so latent bugs remain in paths no program has exercised yet. The aim is to make it trustworthy as an *archaeological instrument*: when a historical program misbehaves, we should be able to rule out the interpreter quickly.

## What is good (keep it)

- The executor (`ipl-eval`, l.2936) follows the manual's interpretation cycle (§3.15, Fig. 3: INTERPRET-Q/P, ADVANCE, ASCEND, DESCEND, BRANCH) closely and readably. Tail calls via LINK are handled correctly.
- The CLOS hooks (`ipl-eval`, `ipl-descend`, `ipl-ascend`) give clean instrumentation, which LT proof graphs used.
- Debugging support is excellent: `*trace-exprs*` keyed by card id or cycle, breaks, `pl`/`pll`/`fsym`, and per-J traces.
- The source documents itself well: manual text is inline in the `defj`s, and fixes carry `[Fixed: …]` tags.
- The card reader handles real 80-column decks from three different sources.

## Findings, by severity

### A. Correctness bugs (confirmed or near-certain)

1. **Symbol equality ignores trailing zeros. This is the most serious finding.** `ipl-string-equal` (l.2437) strips trailing `0` and blanks, so `Q1`=`Q10`, `K2`=`K20`, `N1`=`N10`, `1`=`100`, and generated names `9-123`=`9-1230` (all *verified* in SBCL). It is used by J2 (the identity test), J10/J11 (attribute search), J62, J69, J77 and J181. LT uses both `Q1` and `Q10`-`Q19` as attributes, and `K2`/`K20`; it works by luck of ordering. Since `A`→`A0` canonicalization is now done in the loader, symbols should compare exactly. Trailing-blank trimming belongs only to alphanumeric data-term *contents* (J114 already does that).
2. **J66** (l.1475) starts its search at the head cell (comparing the description-list name with the target), uses case-insensitive `string-equal` rather than the IPL comparison, and never sets H5. **J63/J65** also never set H5. This breaks the file's own rule that every J sets H5 explicitly.
3. **J17** (l.1154) parses Wn with `(subseq wn-symb 1 2)`, so `W10`-`W42` silently become `W1`-`W4`.
4. **J166** (l.2154) never pops its input (unit). LT's X9 leaks one H0 entry.
5. **J183/J184 scanner** (l.2625) stops at `(= w25p 80)`, so column 80 is never examined.
6. **J181** (l.2177): a blank field should give H5− with *no* input, but it pushes `" "`. It also crashes when W30 = 0, because `(aref s 0)` is taken on an empty string. Regionality comes from `*LT-Regional-Chars*`, an LT-specific set that lacks H, J, W, R and `$`, so other programs' input is misclassified.
7. **J182** (l.2209) always writes an alphanumeric term (its own `WWW` comment says so). Integer and octal targets, which the manual specifies, are ignored.
8. **Wrong PQ on created data terms.** J126's count cell and `w25-init` are made with `:p 1 :q 2`, not 0/1. They print wrongly until `numset` happens to repair them.
9. **J137 is defined twice** (l.1997, l.2013), and the second definition wins silently.
10. **Generated internal names count as local.** J130/J132 classify symbols by whether they contain `-`, so every J90/newsym cell (`9-nnn`) counts as local and every absolute number counts as regional. This conflates the manual's three symbol classes (regional, internal, local) with the Q=2 cell mark.

### B. Semantic gaps (documented but unimplemented)

- No erasure or available space: J9/J71/J72 are no-ops, and cells are never reclaimed or reused. "Use after erase" bugs in historical code are therefore invisible, and J68's last-cell case needs an O(n) scan of the symbol table.
- No private termination cells (manual §9.4-9.5), which is why J68/J64 need heuristics.
- Missing J's: J16, J67, J84-J89, J94-J99, J102-J104, J112, J113, J119, J122, J134, J158, J159, J162. Q=5/6/7 and floating point (P=1, Q=1) `break`.
- The monitor/trace system (Q=3/4, J147/J148) is a no-op; that is acceptable, but should be stated.
- One global I/O line buffer is shared by input and output; units (1W18) are ignored; and input must follow the deck on the same stream.
- J155 hard-codes the `::::…` prefix (already an open item in EA seshsums).

### C. Architecture and robustness

- **J arguments come from `function-lambda-expression`** (l.2953). This only works under `(debug 3)`, which is why "leave these at high debug or things break". It ties correctness to compiler settings.
- **Every J call walks the whole H0 stack** (`getstack "H0"`, l.2957) to collect at most 3 arguments, so cost grows with H0 depth.
- **Unbounded per-cycle state:** `maybe-break?` pushes a cons every cycle onto `*card-cycles.ids-executed*`, which is never reset between runs. `trace-cells` scans `*trace-exprs*` with `search` on every cycle.
- **`ipush`/`ipop` move cell structs between names** (l.283-337). After a pop, the old `9-nnn` symtab entry still points at the struct that is now `H0`, a latent aliasing hazard.
- **Errors use `break`** (≈20 sites, including the adv-limit). Under `--non-interactive` this aborts with no structured report, and scripts can't tell "program halted" from "interpreter bug".
- **`load-ipl` defaults to `:adv-limit 100`**, a trap: every real program must override it.
- **One file mixes everything:** the core, the J library, the loader, debugging utilities, an ASCII banner font, SBCL REPL-prompt hacking, and quoted-out test `progn`s that point at paths in the old repo. It is SBCL-only (`sb-int`, `sb-impl`).
- **H3 counts a J call as one cycle,** so "effort" is about 0.66× the 1963 figures. That is fine, but it should be documented as a known deviation.

### D. Tests

- Only the Ackermann decks and `jprobe.card` live with the interpreter. The real regression suite (LT, Heuristic Coder, annexer, Yngve) is spread across project `run.sh` scripts, and nothing runs them together. That is why each change needed manual cross-checking this session.

## Proposed steps (in order; each one is a separate commit, with the regression suite run before and after)

**Step 1. Regression harness (do first, change no behavior).** *Done 2026-10-18 as `IPL-V/tests/regress.py`; see `README.md`, "Tests". All 7 programs pass on the unchanged interpreter.* Add `IPL-V/tests/regress.sh`, which runs:
- Ackermann (125, 61) and `jprobe.card`;
- `../LogicTheorist/run.sh`, checking for 24/24 and no "differs" except *2.15;
- `../HeuristicCoder/run.sh`, diffed against `run/t1*.txt`;
- `../HeuristicCoder/annexer/run.sh`, diffed against `output.txt`/`memory.txt`;
- `../SimonYngve2/run.sh`, diffed against its committed output.

It prints PASS/FAIL per program. The scripts already exist and only need to be invoked; the diffs reuse `LogicTheorist/compare.py`.

**Step 2. Fix the A-list bugs, one per commit:** *(2026-10-18: 2.1-2.5, 2.8 and 2.9 done; in 2.2 the H5 part was dropped as unfaithful, see CHANGES_FROM_UPSTREAM.md; 2.6 (J181) and 2.7 (J182) remain.)*
1. *(Done 2026-10-18: no program output changed; probes in `tests/symprobe.card`.)* Exact symbol equality in `ipl-string-equal`, keeping blank-trimming only for alphanumeric data-term contents. This is the riskiest fix, so run the suite immediately after it.
2. J66 (start after the head, use the IPL comparison, set H5), and H5 in J63/J65.
3. J17 multi-digit Wn.
4. Pop in J166.
5. Scanner column 80.
6. J181 blank and empty fields; derive regional characters from the deck's type-2 region cards instead of the LT constant.
7. J182 integer targets.
8. PQ of J126 and `w25-init`.
9. Delete the dead J137.

**Step 3. Robustness (no change to program semantics):** *(2026-10-18: explicit J arglists done, but `(debug 3)` is still needed for another reason; history bounded; default adv-limit raised. The `break`-to-conditions change remains.)*
- Give `defj` an explicit arity stored in `*jfn-plists*`, and fetch exactly that many H0 entries. This removes `function-lambda-expression` and makes the `(debug 3)` requirement unnecessary; test that by building at default optimization.
- Replace `break` with conditions (`ipl-halt` for J7, `ipl-limit-exceeded` for the adv-limit, and an `ipl-error` class). Keep an interactive-debugger option.
- Raise the default `:adv-limit` to something like 10^7.
- Make `*card-cycles.ids-executed*` a bounded ring buffer, reset per run. Only scan `*trace-exprs*` when it is non-nil.

**Step 4. Symbol classes (design, then implement):** represent regional, internal and local explicitly. One option is to name internal cells by a counter with a distinct prefix rather than `9-`; another is to keep a class table. Then J130/J132/J136/J138 follow the manual. Check LT, the Heuristic Coder and Yngve after each change, since J74's copying depends on this.

**Step 5. Available space (optional, larger):** make J9/J71/J72 actually return cells to a free list (and poison them), and add a debug mode that flags any reference to an erased cell. This lets "use after erase" in historical code be detected rather than masked. It would also let J68 and private termination cells follow §9.4-9.5 without the symbol-table scan.

**Step 6. Housekeeping:**
- Split the file into `core.lisp` (cells, stacks, executor), `loader.lisp`, `jfns.lisp`, `debug.lisp`, plus a small `iplv.lisp` that loads them. This is a pure move with no edits.
- Remove the banner font, the REPL-prompt hack (or move it to `debug.lisp`), and the stale quoted test `progn`s.
- Make the J155 prefix optional.
- Add the missing J's only when a program needs them, each with a probe in `jprobe.card`.
- Document the known deviations (effort accounting, monitor system, units) in `IPL-V/README.md`.

## Verification

- After every step, run `tests/regress.py`; all programs must stay at PASS with output byte-identical, except where a step is *meant* to change output, in which case the diff is reviewed and explained in the commit.
- For Step 2.1, also add `jprobe` cases: J2 on `Q1` vs `Q10`, J10 with both `Q1` and `Q10` on one description list, and J2 on `9-12` vs `9-120`.
- For Step 3's arity change, build once with `(declaim (optimize (debug 1) (speed 1)))` and run the suite. Agreement shows the debug-3 dependency is gone.

## Rework or keep? Recommendation: keep it, and refactor in place

**Keep the overall approach.** It is a sound design:
- The executor is a direct, readable transcription of the manual's interpretation cycle, and that cycle is the part that is hardest to get right.
- The J library carries hard-won, program-validated knowledge (LT, Heuristic Coder, annexer, Yngve). A rewrite would discard that and re-find the same bugs.
- The tooling (traces keyed by card id or cycle, CLOS hooks, list printers) is better than most emulators have.

**One part is structurally wrong: the memory model.** Cells are Lisp structs in a hash table keyed by *name strings*, and "symbol" means "string". Most of the class-A bugs come from that one choice:
- the zero-trimming equality;
- `-` deciding local vs. regional;
- `ipush`/`ipop` renaming structs;
- no available space;
- the J68 symbol-table scan;
- PQ marks living on the shared cell, not on the word.

Real IPL-V has words at addresses, and a symbol is an address. Regional symbols are fixed addresses from the region cards; local and internal symbols are addresses from available space; and Q in a *word* says how to read its SYMB.

**So the recommended path is a staged refactor, not a rewrite:**
1. Build the regression harness first (Step 1). It is what makes any deeper change safe.
2. Fix the bugs (Steps 2-3) within the current model.
3. Then, if wanted, replace only the **memory layer** behind a small API: `word-at`, `new-word`, `free-word`, `symbol-class`, `push-down`, `pop-up`. Use integer addresses internally, keep external names only for printing and the loader, and use a real available-space list. Port the J library and executor onto that API one family at a time, checking the regression suite after each. The executor's structure and the J semantics stay; their plumbing changes.

A full rewrite is only worth it if the goal changes, for example to a cycle-faithful IBM 704/7090 IPL-V (word-level timing, real effort figures) or a fast interpreter for large runs. Neither is needed for the current executable-archaeology goal, which is semantic fidelity good enough to clear historical programs of interpreter blame.

## Decision for Jeff

Steps 1-3 are low-risk and mechanical. Steps 4-5 change the memory model and need agreement first. I would recommend authorizing Steps 1 and 2.1 first: the harness, then the symbol-equality fix, which is the bug most likely to be silently corrupting results.
