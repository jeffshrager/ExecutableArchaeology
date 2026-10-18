# Open issues

All known open issues in one place, as of 2026-10-18. Details are in the linked files. Update
this list when an issue is closed or found. The session summaries in `seshsums/` are snapshots
and are not updated.

## Lisp IPL-V interpreter (`IPL-V/iplv.lisp`)

The plan is `IPL-V/IMPROVEMENT_PLAN.md`. What has been done is in `IPL-V/CHANGES_FROM_UPSTREAM.md`.
After any change, run `python3 IPL-V/tests/regress.py` (9 tests).

**Bugs (plan step 2)**

1. **J181 (input symbol).** A blank field should give H5− with no output, but it pushes `" "`.
   It crashes when W30 = 0. Its regional characters are an LT-specific set
   (`*LT-Regional-Chars*`), so other programs' input can be misclassified. They should come from
   the deck's region cards. (Plan 2.6)
2. **J182 (input data term)** always makes an alphanumeric term. Integer and octal targets, which
   the manual specifies, are ignored. (Plan 2.7)

**Robustness (plan step 3)**

3. **Errors use `break`** (about 20 sites, including the adv-limit). Under `--non-interactive` a
   script can't tell "program halted" from "interpreter bug". Replace them with conditions
   (`ipl-halt` for J7, `ipl-limit-exceeded`, `ipl-error`), keeping an interactive option.
4. **`(debug 3)` is still needed.** J arguments no longer depend on it (2026-10-18). But built at
   `(debug 1)`, LT gets the same 24/24 results with 83 effort figures off by a constant 28 cycles
   within one theorem. The cause is unknown; one guess is `eq` on string constants. The `declaim`
   stays until this is explained. (`seshsums/20261018_1220_seshsum.md`)
5. **`ipush`/`ipop` move cell structs between names.** After a pop, an old `9-nnn` symtab entry
   can still point at the struct that is now H0, a latent aliasing hazard.

**Memory model (plan steps 4-5): where both the speed and the deepest bugs are**

6. **Symbol classes.** J130/J132 classify symbols by whether the name contains `-`, so every
   generated cell (`9-nnn`) counts as local. Regional, internal and local should be explicit.
7. **No available space.** J9/J71/J72 erase nothing and cells are never reused. "Use after
   erase" in historical code is masked, and the symbol table only grows. Symtab inserts are
   about 24% of LT's run time.
8. **J68's last-cell case scans the whole symbol table** for the predecessor, about 25% of LT's
   run time, because there are no private termination cells (manual §9.4-9.5).

**Missing or partial**

9. **Missing J's:** J16, J67, J84-J89, J94-J99, J102-J104, J112, J113, J119, J122, J134, J158,
   J159, J162. Floating point (P=1, Q=1) and Q=5/6/7 call `break`. Add them only when a program
   needs one, each with a probe.
10. **Not implemented, and undocumented:**
    - the monitor/trace system (Q=3/4, J147/J148);
    - I/O units (1W18);
    - one line buffer shared by input and output.

    Also, H3 counts a J call as one cycle, so "effort" is about 0.66× the 1963 figures.

**Housekeeping (plan step 6)**

11. **`iplv.lisp` mixes everything in one file:** the core, the J library, the loader, debugging
    tools, an ASCII banner font, an SBCL REPL-prompt hack, and quoted-out test `progn`s that point
    at the old repo's paths. Split it into core/loader/jfns/debug, a pure move, and remove the
    leftovers.
12. **Document the known deviations** (items 4, 9 and 10) in `IPL-V/README.md`.

## Other

13. **Leading zeros in symbols.** `A01` and `A1` are different symbols in the Lisp IPL-V (probe R6
    in `IPL-V/tests/symprobe.card`). It hasn't been checked whether IPL-V reads the number part as
    an integer, which would make them equal. Check the manual and Beyer's loader.
    (`seshsums/20261018_1154_seshsum.md`)
14. **The 1962 machine's J129.** With seed 53, the Simon/Yngve run's first six random draws match
    Beyer's 1620 J129 (×9013), and the seventh differs. The 1962 multiplier, word length and
    truncation are unknown. (`SimonYngve2/Yngve_guide.md`, `seshsums/20261004_seshsum.md`)
15. **The retro-1620 fork** (`~/Desktop/AIHistory/IPL-V/retro-1620-fork`). Decide whether to keep,
    slim or archive it, now that `HeadlessIBM1620IPL-V/` holds the parts needed for IPL-V. It has
    the uncommitted files `software/subroutines.ipl` and `software/subroutines_j_functions.tsv`.
    (`seshsums/20261004_1659_seshsum.md`)
16. **The KBEmacs announcement draft** (`~/Downloads/KBEmacs_announcement.md`) says the 1984
    self-tests run. The KBEmacs README shows only SQRT, so verify it before posting.
    (`seshsums/20261018_1154_seshsum.md`)

## Not issues (documented differences)

- **LT \*2.15** fails at the effort limit in both 1963 and the Lisp run, after 31 subproblems in
  1963 and 48 here; the first 31 match. Explained in `LogicTheorist/README.md`, and allowed by
  `regress.py`.
- **J63-J66 don't set H5.** The manual specifies none, and Beyer's library J65 preserves it.
  (`IPL-V/CHANGES_FROM_UPSTREAM.md`)
