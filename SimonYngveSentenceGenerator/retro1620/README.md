# Running the Simon/Yngve generator on the retro-1620 IPL-V emulator

Two runnable decks are generated from the faithful transcription
`../ysimon.card` by `adapt.py`. Both run under W. T. Beyer's 1963 IBM 1620
IPL-V interpreter (Mod-3-4 decks) in the headless driver of the retro-1620
fork:

- `../ysimon-fixed.card` punches the derivation trace and the sentences, as
  the 1962 run did (20 sentences, 2,958 cards).
- `../ysimon-fast.card` types only the sentences on the console typewriter
  and punches nothing (currently 5 sentences).

```sh
./run.sh                          # build and run ysimon-fixed.card
./run.sh fast --count 5           # build and run ysimon-fast.card
./run.sh fast --count 20 --seed 7 # any adapt.py options
```

`RETRO1620` can point at a different checkout of the fork (default
`~/Desktop/AIHistory/IPL-V/retro-1620-fork`). A run takes about half a minute.

| File | What it is |
|---|---|
| `adapt.py` | Builds either deck from `../ysimon.card`: `adapt.py src dst [--fast] [--count N] [--seed N]` |
| `decode.py` | Reassembles sentences from either output (`--trace` adds each derivation) |
| `run.sh` | Build, run, decode |
| `punch_output.txt`, `sentences.txt` | Raw output and decoded sentences (with traces) of a fixed-deck run |
| `fast_typewriter_output.txt`, `fast_sentences.txt` | Exact typescript and decoded sentences of a fast-deck run |

The scripts are helpers for this repository only. The decks themselves are
plain IPL, and `../Yngve_guide.md` describes them without the scripts.

## Changes in ysimon-fixed.card, and why

1. **Card format.** Integer values are right-justified in the LINK field
   (cols 57-61); Beyer's loader reads a left-justified value 10,000 times
   too large. `adapt.py` also drops the sign in column 48 of data terms. That
   is not necessary: column 48 is the standard IPL-V sign column, and the
   run is identical with the signs left in.
2. **L1 and L2 are defined as empty lists.** On this system a regional
   symbol that is never defined as data does not work as an empty list.
   With L2 undefined, pushes did not stack: every pop found a one-item L2,
   the main clause was lost, and the run crashed at the first comma.
3. **J82 → C8 (J60 J60 J80).** This works around a bug in Beyer's
   interpreter, not in the Simon program. In the SPS source, `J81 DS 12`
   follows `J80 DS ,J0+12*80`. An explicit-address DS does not move the
   location counter, so J81/J82/J83 label the J72/J73/J74 table cells
   (16319/16331/16343, the same addresses in the OCR of the 1963 listing).
   J82's internal call to "J81" therefore goes astray, and J83's would too.
   J81 itself works only if J80 is loaded, and the loader loads only
   J routines the program names. C8 names J80.
4. **C3 (printer) rewritten.** The 1620 system has no print-line routines
   (J155, J157, J160, J161). The new C3 punches each word symbol and then
   its fragments with J152, one card each. The pencil fix (`10L1` /
   `J75 J71`) is kept.
5. **C2 trace: J153 → J152** (J153 is not in the 1620 system).

The grammar, C0, C1 and C2 are otherwise unchanged.

## Further changes in ysimon-fast.card (`adapt.py --fast`)

1. The four unnumbered trace cards (`40H0 / J152` in C1 and C2) are removed.
2. C0 opens with `10N1 / 20W20`. W20 is the print unit cell; Beyer's output
   routine punches when the integer it names is zero and types when it is
   not, so everything goes to the typewriter.
3. C3 types only the word fragments, not the word symbols. Simon's word data
   is untouched, so the reader joins `STEA` `M` into STEAM.
4. After each sentence C3 types a period: the symbol `.0` in a new one-cell
   region `.`, which J152 types as a bare `.`.

Every typed line is one item with its cell name and type code in front
(`0233203    81        STEA`). Beyer's system cannot do better from IPL:
J150/J151/J152 all go through one output routine that starts each line with
a carriage return, and nothing builds up a line.

## Run controls

- **N20** (`--count`) is the number of sentences. C0 negates it in place and
  tallies it to zero.
- **N0** (`--seed`) is the random seed (53 in 1962). C0 puts its name in W10,
  where J129 takes its seed. The same seed always gives the same sentences:
  the 1620 has no clock and Beyer's system no run-time input.

## Observations

- The first six random draws (A0 [0], A13 [0], A14 [3], A7 [0], A18 [1],
  A1 [2]) are the same as in the 1962 trace, from the same seed, 53. They
  diverge at the seventh (A12: [1] here, [3] in 1962). Six matches by chance
  are about 1 in 500, so the two J129s probably share a multiplier and
  differ in word length or truncation. (Inference, not checked.)
- The 1962 quirks reproduce: the floating `S` and `,`, `PROUD.` with its
  stray period, and `A OILED`.
