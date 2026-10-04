# Simon/Yngve sentence generator on the Lisp IPL-V

This is a copy of `../SimonYngveSentenceGenerator/` that runs the program on
the Common Lisp IPL-V interpreter, `../IPL-V/iplv.lisp`, instead of Beyer's
1963 IBM 1620 interpreter under the retro-1620 emulator.

**The deck is the faithful transcription, `ysimon.card`, unmodified.** None of
the 1620 workarounds are needed (see `../SimonYngveSentenceGenerator/retro1620/README.md`):
the Lisp IPL-V has J82, accepts the undefined lists L1 and L2, and has the
print-line routines (J154-J161), so Simon's own printer C3 runs as written and
prints whole sentences on 80-column lines.

```sh
./run.sh                      # 20 sentences, seed 53, as in 1962 (about 3 s)
./run.sh --count 5 --seed 7   # N20 = number of sentences, N0 = random seed
```

| File | What it is |
|---|---|
| `ysimon.card` | The faithful deck (identical to `../SimonYngveSentenceGenerator/ysimon.card`) |
| `run.sh` | Copies the deck to `ysimon-run.card`, setting N20/N0 if asked, runs it, decodes the output |
| `run-yngve.lisp` | Loads `../IPL-V/iplv.lisp` and runs `ysimon-run.card` |
| `decode.py` | Turns the raw output into `sentences.txt` (same format as the 1620 decoder) |
| `yngve-lisp.out` | Raw output of a default run: C1's trace (J152, boxed), C2's draws (J153) and C3's print lines (`::::` prefix) |
| `printout.txt` | Just the lines C3 printed, as they would appear on the line printer |
| `sentences.txt` | Decoded sentences, each with its derivation |
| `Yngve_guide.md` | The Hacker's Guide, with its "Running It Today" section rewritten for the Lisp IPL-V |

## Interpreter changes

The deck needed four additions to `../IPL-V/iplv.lisp`; they are listed in
`../IPL-V/CHANGES_FROM_UPSTREAM.md`. None of them changes LT, the Heuristic
Coder, the annexer or the Ackermann tests (all rerun, same output).

- **J123** (negate) and **negative numbers**: C0 and C2 count with J123 then
  J125 up to zero; `numget` used to `break` on any negative number.
- **J129** (random number), implemented as Beyer's 1620 JJ129:
  s := s × 9013 mod 10^10 in the cell W10 names, and the result is
  ⌊s × n / 10^10⌋.
- **J153** (print data term without name), used by C2's trace.

## Cross-check with the 1620

With seed 53, the Lisp run's `sentences.txt` is **identical** to
`../SimonYngveSentenceGenerator/retro1620/sentences.txt`: the same 20
sentences, and the same derivations, symbol by symbol and random draw by random
draw. Two independent interpreters, one from 1963 and one written from the
manual, agree on every step. That supports the transcription, both
interpreters' J-functions on this program, and the reading of Beyer's J129.

The layout of `printout.txt` is Simon's: C3 enters a space before each word
(`10N1 J161`) but not after a line overflows, so a sentence's first line starts
one column right of its continuation lines, and a word may break between its
fragments (`OILE` / `D`).
