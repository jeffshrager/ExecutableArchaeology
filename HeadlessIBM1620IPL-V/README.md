# Headless IBM 1620 with Beyer's IPL-V

A test bed for running IPL-V card decks on a genuine 1963 implementation:
W. T. Beyer's IPL-V interpreter for the IBM 1620 (University of Oregon), in
Paul Kimpel's retro-1620 emulator, driven from the command line with Node.js
(no browser). It is the minimal subset of the retro-1620 fork needed for
that, copied unchanged.

```sh
./run-ipl.sh my.card                    # run an IPL-V deck; output on stdout
./run-ipl.sh my.card --switches 2       # with IPL-V's own trace (to the punch)
```

Requires Node.js (tested with v24). A small program takes a few seconds,
because Beyer's startup builds the free list cell by cell; the 20-sentence
Simon/Yngve run takes about 35 s.

## Checked

- `software/IPL-V/Mod-3-4/Ackermann-TEST-Fixed.ipl` punches `N 01 3`.
- `../SimonYngveSentenceGenerator/retro1620/run.sh` (the fixed deck) and
  `run.sh fast --count 5` reproduce their committed outputs byte for byte:
  `punch_output.txt` (2,958 cards), `sentences.txt`,
  `fast_typewriter_output.txt` and `fast_sentences.txt`.

## What is here

| Path | What it is |
|---|---|
| `run-ipl.sh` | Wrapper: loads interpreter deck 1, your deck, the subroutine library and deck 2, in that order |
| `tools/cli/run1620.mjs` + `Headless*.mjs` | The headless driver and its card reader, typewriter and punch. `tools/cli/README.md` documents every option (`--trace`, `--switches`, `--timeout`, `--memory`, `--quiet`, ...) |
| `emulator/` | Kimpel's 1620 processor core (the 7 files the driver imports) |
| `webUI/CardPunch.js`, `Typewriter.js`, `PanelButton.js`, `PopupUtil.js` | Imported only for their character tables; nothing touches the DOM |
| `package.json` | Marks the `.js` files as ES modules |
| `software/IPL-V/Mod-3-4/IPL-V-Interpreter-Mod-3-4-Deck-1.card`, `-Deck-2.card` | Beyer's interpreter, Mod-3-4 (the original decks fail on printing data terms) |
| `software/IPL-V/IPL-V-Subroutines.card` | The IPL-coded J-function library |
| `software/IPL-V/Mod-3-4/IPL-V-Interpreter-Mod-3-4.sps` | SPS source of the interpreter, for reading how a J works (e.g. `JJ129`) |
| `software/IPL-V/Mod-3-4/README.txt` | The Mod-3-4 changes |
| `software/IPL-V/Mod-3-4/Ackermann-TEST-Fixed.ipl` | Smoke test |

## Writing decks for it

The 1620 system differs from the Lisp IPL-V (`../IPL-V/`). The details, with
workarounds, are in `../SimonYngveSentenceGenerator/retro1620/README.md`:

- Integer values must be right-justified in the LINK field (cols 57-61); a
  left-justified value is read ×10,000. Comments must stay left of col 41.
- J82 and J83 are broken (their table cells overlap J72-J74 in Beyer's source);
  J81 works only if the deck names J80 somewhere.
- A regional symbol used as a list must be defined (`L2    000     0`).
- There are no print-line routines (J153, J155, J157, J160, J161). Print with
  J151/J152, one item per card or typewriter line. Pointing W20 at a nonzero
  integer sends output to the typewriter instead of the punch.
- J129's seed is the integer named in W10; the generator is
  s := s × 9013 mod 10^10, result ⌊s·n / 10^10⌋ (the Lisp J129 copies it).

## Provenance

Copied on 2026-10-04 from github.com/jeffshrager/retro-1620-fork at commit
`736a00e`, a fork of github.com/pkimpel/retro-1620 (Paul Kimpel, MIT license,
`LICENSE`). The headless driver (`tools/cli/`) was written in the fork. The
interpreter decks are Beyer's 1963 IPL-V, from Rupert Lane's OCR of the
listing, with the fork's Mod-3-4 fixes. The fork has the full emulator, the
browser UI, the original (unmodified) interpreter decks and listing, and
the subroutine analysis; it is otherwise no longer developed. No file here
was changed; only `run-ipl.sh` and this README are new.
