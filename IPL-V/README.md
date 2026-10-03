# Common Lisp IPL-V interpreter

`iplv.lisp` is Jeff Shrager's Common Lisp IPL-V interpreter. This is now its only maintained copy. The earlier repository, github.com/jeffshrager/IPL-V, is archived; it still holds EPAM, the older `LTFixed.liplv`/`lt.lisp` LT, and misc tests, none of them rerun on this version. The projects here that use it are:

- `../HeuristicCoder/`: Simon's Heuristic Coder (1961) and the RM-3588 annexer (1963)
- `../LogicTheorist/`: Stefferud's 1963 Logic Theorist (dmoews deck)

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

| Deck | Expected |
|---|---|
| `tests/Acker.Ipl` (cards) | N0 = 125, i.e. A(3,4) |
| `tests/Ackermann.liplv` | N0 = 61, i.e. A(3,3) |
| `tests/jprobe.card` | J-function probes |

Both Ackermann decks need `:adv-limit` of about 10^6 or more.

## Verified on this version (2026-10-03)

- Heuristic Coder: `../HeuristicCoder/run.sh` output is identical to the committed `run/t1.txt` and `run/t1-sdsc.txt`.
- Annexer: `../HeuristicCoder/annexer/run.sh` output is identical to the committed `output.txt` and `memory.txt`.
- Logic Theorist: `../LogicTheorist/run.sh` matches 1963 on 24/24 theorems (see its README).
- Ackermann: 125 and 61.

Not rerun on this version: EPAM, and the older `LTFixed.liplv` / `lt.lisp` LT in the IPL-V repo.
