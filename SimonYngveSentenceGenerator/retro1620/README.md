# Running the Simon/Yngve generator on the retro-1620 IPL-V emulator

`../ysimon-fixed.card` is generated from `../ysimon.card` by `adapt.py`. It runs
under W. T. Beyer's 1963 IBM 1620 IPL-V interpreter (Mod-3-4 decks) in the
headless driver of the retro-1620 fork, and prints all 20 sentences.
`run.sh` rebuilds the deck, runs it and decodes the output. `sentences.txt`
has the 20 sentences of one run with the trace of each derivation
(`[n]` = random draw); `punch_output.txt` is the raw card-punch output.

## Changes from the transcription, and why

1. **Card format.** The sign in column 48 of data terms is dropped. Integer
   values are right-justified in the LINK field (cols 57-61).
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
   its fragments with J152, and `decode.py` reassembles the words. The
   pencil fix (`10L1` / `J75 J71`) is kept.
5. **C2 trace: J153 → J152** (J153 is not in the 1620 system).

The grammar, C0, C1 and C2 are otherwise unchanged.

## Observations

- The first six random draws (A0 [0], A13 [0], A14 [3], A7 [0], A18 [1],
  A1 [2]) are the same as in the 1962 trace, from the same seed, 53. They
  diverge at the seventh (A12: [1] here, [3] in 1962). Six matches by chance
  are about 1 in 500, so the two J129s probably share a multiplier and
  differ in word length or truncation. (Inference, not checked.)
- The 1962 quirks reproduce: the floating `S` and `,`, `PROUD.` with its
  stray period, and `A OILED`.
