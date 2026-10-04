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
./run.sh                      # faithful deck: 20 sentences, seed 53, as in 1962 (about 3 s)
./run.sh --count 5 --seed 7   # N20 = number of sentences, N0 = random seed
./run.sh clean                # the clean version: just the sentences, readable
./run.sh clean --count 50 --seed 1962
```

## The clean version

`ysimon-clean.card` is made from `ysimon.card` by `make_clean_deck.py`. It
does not trace, and it prints finished sentences, with no decoding needed:

```
WHEN THE STEAM MAKES SMALL AND THE FIREBOXS IN THE FOUR HEATED AND BIG SANDDOMES
PROUD OF THE BELL IN THE LITTLE, POLISHED, BLACK AND BIG WHEELS AND SMALL AND
POLISHED AND SHINY SMOKESTACKS, ITS STEAM KEEPS HIS SHINY BOILERS AND FOUR
BOILERS.

WHEN HE IS PROUD OF BLACK WHISTLES, STEAM, SMALL AND BIG AND OILED WHEELS, HE IS
HEATED.
```

The grammar, C0 (control), C1 (expansion) and C2 (random choice) are Simon's.
The changes, all in IPL:

- The four unnumbered trace cards (J152 in C1, J153 in C2) are removed.
- **C3, the printer, is replaced by C3-C9** (about 70 cards):
  - C4 groups the words of the sentence into *units* on L3. A unit is a new
    list of fragments that prints without internal spaces: a word, plus a
    following comma (B37) or plural S (B47). Simon's grammar generates these
    as separate words, so the faithful run prints `BOILER S` and `WATER ,`.
    C3 appends the period (new data term N2) to the last unit.
  - C5 prints a unit by entering its fragments with J157. J157 enters nothing
    and sets H5- when a fragment does not fit. On a misfit, C5 clears the line,
    rebuilds it from L4 (the units already on it, via C7/C8), prints it, and
    starts the next line with the unit. So lines wrap between words, never
    inside one (the faithful printer breaks `OILE` / `D`).
  - Each sentence starts in column 1 and is followed by a blank line.
- The stray period in B41 `PROUD.` (fragment `D.`) is removed.
- New data: N2 (`.`), and L3 and L4 defined as empty lists.

The random draws are untouched, so `run.sh clean` prints the same sentences as
`run.sh` for the same seed. With seed 53, the 20 sentences match the faithful
run's, apart from the intended spacing and the `PROUD.` period.

What it does not fix, because it is in Yngve's grammar rather than the
printer: the plural is just S (`FIREBOXS`), and the article is not matched to
the next word (`A OILED`).

`J155` in the Lisp IPL-V prints each line after a row of colons, which
`run.sh` strips.

| File | What it is |
|---|---|
| `ysimon.card` | The faithful deck (identical to `../SimonYngveSentenceGenerator/ysimon.card`) |
| `ysimon-clean.card` | The clean version (no trace, readable printer), made by `make_clean_deck.py` |
| `make_clean_deck.py` | Builds `ysimon-clean.card` from `ysimon.card`; also sets N20/N0 for `run.sh` |
| `run.sh` | Builds `ysimon-run.card` from the chosen deck, runs it, writes the outputs |
| `run-yngve.lisp` | Loads `../IPL-V/iplv.lisp` and runs `ysimon-run.card` |
| `clean_sentences.txt` | Output of `run.sh clean` (20 sentences, seed 53) |
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
