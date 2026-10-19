# Is EPAM's behavior on List A robust? (Feigenbaum's footnote, P-1817 p. 87)

> "The assumptions given above about pre-experimental states are more or less arbitrary, but we have satisfied ourselves that the qualitative behavior of the system, in which we are currently interested, does not depend in any sensitive manner on the precise form of these assumptions."

The assumptions in question (§4.1.1.1.2) are three: the letter codes (the hand simulation "act[s] as though we were using codes"), the noticing order (first, third, then second letter), and at most three differences noticed per confusion (P2 = 3).

**Method.** `robustness.py` re-implements exactly the model of `../Epam/Experiment.lean` and the Fig. 4.1 schedule of `../Epam/Fig41.lean`. It reproduces the Lean result of 33/34 for the reconstructed codes. It then varies:

- **Letter codes.** The bits that EPAM II's letter net U1 does not test are drawn at random. U1's tested bits are kept (so every letter still sorts to itself), and A keeps its historical code.
- **The order of letters for noticing:** all 6 permutations.
- **P2** = 1, 2, 3.

It uses 3,000 samples per configuration (`robustness_3000.txt`; rerun with `python3 robustness.py 3000`). Columns: agreement with Fig. 4.1's 34 recorded responses (each counted if the model makes it possible), and how often each landmark occurs:

- **PEM:** trial 4, PEM is confused with ROM and gives ROM's response, TIL (note 7).
- **OSC:** trial 4, LUK's cue is insufficient, so "none" is possible (note 6).
- **CRIT:** trial 7 is forced correct, and trial 6 is not.
- **KAG6:** trial 6, KAG's precarious link can fail (note 12).

```
order  P2      mean  min-max    PEM    OSC   CRIT   KAG6
1-2-3  1       29.9    28-31     0%     0%    19%     0%
1-2-3  2       31.5    29-33     0%   100%    30%    69%
1-2-3  3       31.3    29-33     0%   100%    39%    59%
1-3-2  1       30.9    29-32   100%     0%    18%     0%
1-3-2  2       32.2    29-34    72%   100%    29%    70%
1-3-2  3       31.7    29-34    44%   100%    39%    59%    <- the figure's assumptions
2-1-3  1       27.6    27-28     0%     0%     0%     0%
2-1-3  2       29.6    29-30     0%   100%   100%     0%
2-1-3  3       29.6    29-30     0%   100%   100%     0%
2-3-1  1       27.6    27-28     0%     0%     0%     0%
2-3-1  2       29.6    29-30     0%   100%   100%     0%
2-3-1  3       29.6    29-30     0%   100%   100%     0%
3-1-2  1       31.3    30-32   100%     0%     0%     0%
3-1-2  2       33.2    32-34   100%   100%    31%    69%
3-1-2  3       33.1    32-34   100%   100%    76%    24%
3-2-1  1       31.3    30-32   100%     0%     0%     0%
3-2-1  2       33.2    32-34   100%   100%    32%    68%
3-2-1  3       33.1    31-34   100%   100%    76%    24%
```

## Findings

1. **The figure is reproducible, but not uniquely.**
   - Under the figure's own assumptions (1-3-2, P2 = 3), random U1-consistent codes make on average 31.7 of the 34 recorded responses possible.
   - About 10% of them (1,981 of 20,000) make **all 34** possible. One such set is certified in Lean: `Fig41Alt.alt_agreement`, with `alt_respects_U1`.
   - The zero-filled reconstruction gets 33.

2. **Oscillation through insufficient cues needs redundancy (F1a, P2 > 1).**
   - With P2 = 1, F1 creates no null images, so an insufficient cue can only reach a *wrong item*. "none" cannot occur (OSC 0%).
   - With P2 ≥ 2 the figure's omission error on trial 4 is possible for every code and order sampled (100%).
   - So the *kind* of oscillation Fig. 4.1 shows depends on the redundancy postulate, F1a. With it, it is robust.

3. **The PEM/ROM confusion (note 7) depends on the noticing order.**
   - It is certain (100%) whenever the third letter is noticed before the second: orders 3-x-x, and 1-3-2 with P2 = 1. That is because PEM and ROM share their last letter (M), and P and R differ in a single bit.
   - It never occurs when the vowel is noticed first (orders 2-x-x).
   - Under the figure's assumptions it occurs in 44-72% of codes: redundant tests sometimes happen to test the P/R bit.

4. **Noticing the vowel first fits the figure worst** (27.6-29.6 of 34, for every code and P2). Ends-first orders (1-3-2, 3-1-2, 3-2-1) fit best. This is consistent with the "serial position effect within the syllable" that motivated the 1-3-2 order (§4.1.1.1.2).

5. **KAG's success on trial 7 is luck, as note 12 says.**
   - In 20,000 samples, every code set that reproduces all 34 responses leaves KAG's trial-7 response *possible but not certain*.
   - The reason: whatever lets KAG's link fail on trial 6 is still there on trial 7, since nothing in the schedule repairs it.
   - Feigenbaum's note says this in words ("KAG-LUK is precarious... by chance here the correct response was given"). The postulates make it necessary. It is certified for the alternative codes in `alt_trial7_KAG_by_chance`.

## Verdict on the footnote

**Partly right.**

The *phenomena* are robust across codes once the postulates are fixed:
- stimulus-generalization errors on similar syllables;
- oscillation, given redundancy (P2 ≥ 2);
- learning in about seven trials (mean agreement 31-33 of 34 for ends-first orders).

The *particular* errors are not:
- which item fails, and on which trial, depends on the codes;
- whether the criterion is met on trial 7 depends on the codes and on chance.

And two of the "more or less arbitrary" assumptions matter qualitatively:
- the noticing order (vowel-first breaks the PEM/ROM confusion);
- P2 (with P2 = 1 the omission errors of insufficient cues vanish).
