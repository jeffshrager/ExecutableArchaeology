# Common Lisp IPL-V interpreter

`iplv.lisp` is Jeff Shrager's Common Lisp IPL-V interpreter. This is now its only maintained copy. The earlier repository, github.com/jeffshrager/IPL-V, is archived; it still holds EPAM, the older `LTFixed.liplv`/`lt.lisp` LT, and misc tests, none of them rerun on this version. The projects here that use it are:

- `../HeuristicCoder/`: Simon's Heuristic Coder (1961) and the RM-3588 annexer (1963)
- `../LogicTheorist/`: Stefferud's 1963 Logic Theorist (dmoews deck)
- `../SimonYngve2/`: Simon's 1962 IPL-V version of Yngve's sentence generator

It reads 80-column IPL-V card decks directly, as well as the older `.liplv` S-expression format. `CHANGES_FROM_UPSTREAM.md` lists every change since IPL-V @ 792cb15. Each change is also marked in the source with `[Fixed: …]`, `[Added: …]` or `[Changed: …]`.

## The manual (`manual/`)

| File | Contents |
|---|---|
| `1964-Newell-Information_Processing_Language-V_Second_Edition_1964_OCRED.pdf` | Newell et al., *IPL-V Manual*, 2nd ed. (1964), OCRed scan |
| `IPL_manual.txt` | its text, with `===== PDF PAGE n =====` markers. PDF pp. 245-246 list all the J's. |
| `IPL_manual_flow.txt` | the same text, one paragraph per page (best for grep). The OCR confuses `l`/`1`, `O`/`0` and `S`/`5`. |
| `IPL-V_CheatSheet.pdf` | the IPL-V "cheat sheet" PDF from the old repository (116 pages) |

## Use

```lisp
(load (compile-file "iplv.lisp"))
(set-trace-mode :none)
(load-ipl "deck.card" :adv-limit 1000000)   ; loads and runs from the deck's start card
```

`:adv-limit` caps the number of interpreter steps (the default is 100). Raise it for any real program.

## Tests

**Run `python3 tests/regress.py` after any change to `iplv.lisp`.** It takes about 25 seconds and prints PASS/FAIL for each program:

```
ackermann    PASS       3.7s
jprobe       PASS       0.4s
lt           PASS       5.5s
hc           PASS       3.7s
annexer      PASS       3.4s
yngve        PASS       2.9s
yngve-clean  PASS       2.9s
7 of 7 passed
```

| Name | What runs | Passes when |
|---|---|---|
| `ackermann` | `tests/Acker.Ipl` (cards), `tests/Ackermann.liplv` | N0 = 125 (A(3,4)) and 61 (A(3,3)), and output matches `tests/golden/` |
| `jprobe` | `tests/jprobe.card` (J-function probes) | output matches `tests/golden/jprobe.out` |
| `lt` | `../LogicTheorist/run.sh` | output unchanged; 24/24 theorems as in 1963, except the documented *2.15 difference |
| `hc` | `../HeuristicCoder/run.sh` | decks and `run/t1*.txt` unchanged |
| `annexer` | `../HeuristicCoder/annexer/run.sh` | decks, `output.txt`, `memory.txt` unchanged |
| `yngve` | `../SimonYngve2/run.sh` | outputs unchanged, and `sentences.txt` still equals the IBM 1620 run's |
| `yngve-clean` | `../SimonYngve2/run.sh clean` | `ysimon-clean.card`, `clean_sentences.txt` unchanged |

- **The reference output** for a project program is its committed output in the project directory. The harness saves those files, runs the project's `run.sh`, compares, and restores them, so a test run leaves the repository unchanged. The `tests/golden/` snapshots (made 2026-10-18) record what the interpreter did then, not necessarily what is correct.
- **What is compared:** lines starting with `;` (SBCL compiler messages, with timestamps and paths) are ignored. A failure writes the new output and a diff to `$TMPDIR/iplv-regress/<name>/`, and the harness also reports any other file a run changed.
- **Options:** `regress.py lt yngve` runs only those programs. `regress.py --accept` keeps the new outputs as the reference, for a change that is *meant* to alter output; review the diffs and commit them with the change.

The harness was checked by temporarily changing J129's multiplier: `yngve` and `yngve-clean` failed, and the other five passed.

## Verified on this version (2026-10-03)

- Heuristic Coder: `../HeuristicCoder/run.sh` output is identical to the committed `run/t1.txt` and `run/t1-sdsc.txt`.
- Annexer: `../HeuristicCoder/annexer/run.sh` output is identical to the committed `output.txt` and `memory.txt`.
- Logic Theorist: `../LogicTheorist/run.sh` matches 1963 on 24/24 theorems (see its README).
- Ackermann: 125 and 61.

Not rerun on this version: EPAM, and the older `LTFixed.liplv` / `lt.lisp` LT in the IPL-V repo.
