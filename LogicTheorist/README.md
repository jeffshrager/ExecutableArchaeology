# Stefferud's Logic Theorist (1963) on the Lisp IPL-V

The Logic Theorist (LT) of Newell, Shaw and Simon, in Einar Stefferud's 1963 IPL-V version (RAND RM-3731), running unmodified on the Common Lisp IPL-V interpreter in `../IPL-V/iplv.lisp`. The same interpreter runs the Heuristic Coder (`../HeuristicCoder/`).

The deck, the input formulae and the transcribed 1963 output are David Moews's, from <https://github.com/dmoews/ipl-v-logic-theorist> (commit `89c6d79`). His README is kept as `README-dmoews.md`. His 7094 patches (`7094/`) and Python interpreter (`interpreter/`) are not copied here; see his repository.

| File | Role |
|---|---|
| `1963_Stefferud_LT_RM-3731_OCRed.pdf` | Stefferud, *The Logic Theory Machine: A Model Heuristic Program*, RAND RM-3731 (1963), OCRed scan: the listing and the 1963 output |
| `logic-theorist-1963-stefferud.iplv` | the LT deck (dmoews), unmodified |
| `logic-theorist-1963-stefferud-input.txt` | the input formulae: the 24 theorems of *Principia* chapter 2-4 used in 1963 |
| `logic-theorist-1963-stefferud-output.txt` | Stefferud's printed 1963 output, transcribed by dmoews |
| `logic-theorist-chapter-2-input.txt`, `logic-theorist-remember-all-theorems-patch.txt` | dmoews's other inputs and patch (not used by `run.sh`) |
| `run.sh` | appends the input cards to the deck (they follow the start card on the same stream), runs it, and prints the comparison table |
| `run-lt.lisp` | loads `../IPL-V/iplv.lisp` and runs the combined deck |
| `compare.py` | per-theorem comparison of result, subproblems, substitutions and effort with the 1963 output |
| `lt-stefferud-lisp.out` | output of the last run |

Run with `./run.sh` (about 6 seconds). **`LT_guide.md`, a Hacker's Guide to the program, is the place to start reading.**

## Result (2026-10-03)

All 24 theorems get the same result as in 1963. For 23 of them the subproblem and substitution counts are identical, and the printed search traces and proofs match line for line. The rest of the output differs only as follows:

- **Effort** is about 0.66 × the 1963 figure for every theorem, because the interpreter counts cycles differently. dmoews's Python interpreter has the same kind of difference.
- ***2.15*** fails in both runs because it hits the 200000 effort limit. Our effort grows more slowly, so we get further first: 48 subproblems vs 31. The first 31 match the 1963 list.
- **Rejected-problem lines** start with an internal symbol, which is a core address in 1963 (`5088`). We print our internal cell number (`118882`). It is two columns wider, so `REJECTED PROBLEM` is cut at column 80. 1963 truncates its own long lines the same way.
- **Transcription noise in the 1963 file:** `DFF.` for `DEF.` (*1.01 in the *2.14 proof), and two missing commas in the *3.13/*3.14 subproblem lines.

**Spacing is not held to exactly.** It is not clear that dmoews's transcription reproduces the 1963 printout's spacing exactly. So off-by-one differences in column position, and differences in blank lines, count as matches, not as errors. `compare.py` compares content only.

The interpreter fixes this required are in `../IPL-V/CHANGES_FROM_UPSTREAM.md`, section "Stefferud LT (dmoews deck)".
