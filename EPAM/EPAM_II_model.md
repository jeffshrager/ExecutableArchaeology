# What EPAM II is supposed to do

*A working description, updated as the reanimation proceeds. Last updated 2026-10-18 ("first light").*

All page and section numbers refer to E. A. Feigenbaum, *An Information Processing Theory of Verbal Learning*, RAND P-1817, 9 October 1959. A copy is in `~/Desktop/AIHistory/Documents/P-1817_Feigenbaum_EPAM_Oct59_OCRed.pdf`. Printed page numbers are given; the PDF page is 8 more. The program is the listing in its Appendix (pp. 133ff), transcribed in `epamfixed.card`.

## 1. In one paragraph

EPAM ("Elementary Perceiver and Memorizer") is a theory of how people memorize lists of nonsense syllables, stated as an IPL-V program (Summary, p. v). It learns to tell syllables apart by growing a **discrimination net**: a tree of tests on the bits of a syllable's code. A syllable sorted through the net arrives at a **terminal**, where an **image** of it is stored. It learns that one syllable calls for another by storing, with the stimulus's image, a **cue code**: just enough of the response's code to sort to the response's image. It learns only what it must. When two syllables land on the same terminal, it adds tests on the bits where they differ. When a cue no longer finds the right response, it adds information to the cue. The errors people make while memorizing (confusing similar syllables, a correct answer coming and then going) are supposed to fall out of this frugal growth.

## 2. The task it models (§2.2, pp. 41-43)

The standard rote-learning experiments, quoted by Feigenbaum from Hilgard:

- **Serial anticipation.** Items appear one at a time on a memory drum. Each item is the cue for the one that follows, and the subject says what is coming next before it appears.
- **Paired associates.** The subject learns pairs, so that the first member (the stimulus) calls up the second (the response). The order of the pairs varies.

The materials are nonsense syllables: consonant, vowel, consonant (KAG, LUK, ...).

## 3. The theory: thirteen postulates (§2.3-2.4, pp. 43-67)

Feigenbaum splits the model in two (§2.3.1, p. 44):

**Macroprocesses** organize the whole task and direct attention. They come from Feigenbaum and Simon's model of the serial position effect (§2.3.2), later published as *Brit. J. Psychol.* 53 (1962), in `Documents/1962-FEIGENBAUM-EPAM.pdf`.

| | Postulate (summary, §2.4) |
|---|---|
| M0 | Serial mechanism: does one thing at a time, so it must time-share. |
| M1 | Unit processing time: learning an item takes substantial time. |
| M2 | Immediate memory: small and fast; all access to items goes through it. |
| M3 | Anchor points: distinctive items are learned first, then their neighbors. |

**Microprocesses** work on the item that attention has selected. **These are what the EPAM II program is.**

| | Postulate (§2.4) | Routine in the listing (§3.5) |
|---|---|---|
| D2 | Selection: codes select images in a discrimination net. | D2, with D0 (net interpreter) and the tests Z0/Z1 |
| F1 | Discrimination learning: find or create a unique terminal for an item, growing the net at a point of confusion. | F1 (using D5 differences, D9 build tests, D10 insert, D17 create image) |
| F1a | Redundant tests are added so the net need not grow for every new item. | inside F1/D9 |
| F1b | Noticing order: which lines and bits are scanned for differences, updated by experience. | P0 (lines), P1 (bits), P2 (how many differences), D18 |
| F2 | Association: store with the image of the stimulus X a *cue code* for the response Y, with as much information as needed, found by trial and error. | F2 (D7 find cue code, D8 add to it) |
| D8 | Restoring an S-R link that failed, by adding information to the cue code. | D8 |
| F0 | Control: for a pair X, Y given for learning, do F1(X), F1(Y), F2(X, Y). | F0 |
| R | Responder: sort X with D2, take the cue code from its image, sort the cue code with D2 to get the image of Y. | apparently D21 ("RESPONSE ITEM SELECTED. CAN BE NO RESPONSE, K10"), by its comments |
| D1 | Response generation: turn a response image into physical responses by sorting it through a net of learned physical responses. | D1, the *writer*, with net U1 |

**This is why the listing has no "main program".** The macroprocesses (which item to attend to, when, and the trial-by-trial loop of the experiment) are not part of EPAM II's code. In 1959 there was no machine to run it on: "the program has been simulated by hand, in rote learning tasks... At the time of this writing, the IPL-V computer is not yet fully completed" (§4.0, p. 85). Feigenbaum himself played the macroprocesses. In our reanimation, a small driver deck (`drivers/`, marked as not part of EPAM II) plays that role.

## 4. Representations (§3.3-3.4, pp. 70-77)

- **Codes** (§3.3.2, p. 71). A code is a list of bits: J3 for 1, J4 for 0. The listing gives one example, the capital A, `10001100010111` (card Q1). "No specific data inputs are shown, with the exception of an example of a capital letter code" (Appendix header, p. 133).
- **Items** (§3.3.2; the ITEM cards in the listing). An item is a list of *lines*, each line a list of a general-information list and a code. A syllable is an item of three letter lines.
- **Selection nets** (§3.4.1, pp. 72-75). A *testing point* is a list (test, minus branch, plus branch). Its description list gives A0 = J4 ("I am a testing point"), A4 = the line to examine and A5 = the bit. A *terminal* is an empty list whose description gives A0 = J3 and A1 = a dictionary entry. The test Z0 examines that bit and branches **minus on J3 (1), plus on J4 (0)** (§3.5.1.2). If the information is missing, it picks a branch at random.
- **Images** (§3.4.2): "for the model as now coded, images are exact stored copies of the input stimuli."
- **Dictionary** (§3.4.4). Terminals point to dictionary entries, and Y3 names the current dictionary. X0 is the letter dictionary (X1 → L1 = "A", ..., X26 → L26 = "Z"); X30 is the learner's.
- **Responses** (§3.4.3). Net **U1** sorts letter codes to the 26 physical responses L1-L26, the capital letters. U1 is in the listing: 26 terminals, every test on line 1, bits 1-14.
- **Noticing order** (§3.4.5). P0 is the order in which lines are scanned and P1 the order of bits. The listing defines P0 twice (p. 149): N1 N3 N2 ("for lines", the 1st-3rd-2nd letter order of §4.1) and just N1.

## 5. What it should do: the experiments of §4.1 (pp. 85-119)

Feigenbaum's hand simulations, against which a running EPAM II can be compared:

- **Materials** (§4.1.1.1.1): List A, `KAG LUK RIL PEM ROM TIL`. Serial anticipation to a criterion of one perfect run-through. Paired associates KAG-LUK, RIL-PEM, ROM-TIL.
- **Initial state** (§4.1.1.1.2): an empty net U2; noticing order first letter, third letter, second letter; at most three differences noticed (tests added) each time the net grows. The hand simulation "act[s] as though we were using codes", i.e. it did not use real bit codes.
- **Fig. 4.1, serial anticipation** (pp. 90-96). One F0 learning cycle per trial, e.g. trial 1: F0(KAG, LUK) = F1(KAG), F1(LUK), F2(KAG, LUK). The net grows with first-letter tests, then third-letter tests, and the noticing order is updated. Responses are "none" (error) until learned. Trial 4: "PEM is confused with ROM and response to ROM is made." The figure runs through trial 7, ending with the final net U2 (p. 96). Whether trial 7 is the perfect run-through is still to be read off the page images.
- **Fig. 4.2, paired associates** (pp. 97ff). For example, trial 3: RIL → LUK, a stimulus generalization error.
- **Phenomena claimed** (§4.1.1.3): stimulus generalization (four examples, p. 102: serial anticipation trial 4 PEM → TIL; paired associates trial 3 RIL → LUK and ROM → LUK; trial 5 RIL → TIL), oscillation (a response learned, then lost, then regained), effects of intralist similarity, types and distribution of errors, and serial anticipation vs paired-associates learning time.

Because the hand simulation idealized the codes, a real run should be compared *qualitatively*: the order in which the net grows, the kinds of errors and confusions, and roughly how many trials it takes.

## 6. What runs so far

**First light, 2026-10-18** (`IPL/drivers/write-a.card`, tag `epam-first-light`). The writer D1 is given a one-letter image containing Q1, the code for A. D1 sorts it through U1 with D2 and D0. At each testing point D0 executes the A0 marker, then the test Z0, which executes the bit it finds. A's code takes this path:

```
U1    bit 1 = 1  -> minus      9-20  bit 8 = 0 -> plus
9-1   bit 4 = 0  -> plus       9-88  bit 3 = 0 -> plus
9-4   bit 5 = 1  -> minus      9-100 terminal: A1 = X1
9-9   bit 7 = 0  -> plus       X1 in dictionary X0 -> L1
```

E4 then prints the list of responses:

```
A
RUN ENDED at cycle 789
```

To our knowledge this is the first time EPAM II code has run.

**A bug the hand simulation could not find.** D0 always ends by assigning the tracking list to the response as attribute A2 (cards D00 34-36). In the letter dictionary the responses are alphanumeric data terms (L1 = "A"), which have no description list. On a real IPL-V the assignment would have written into whatever address the packed letter happened to spell. So every letter the writer D1 printed would have hit it. Our run deck patches D0 to skip the assignment for data terms (`make_run.py`).

## 7. What is reconstructed, not historical

- Every driver in `IPL/drivers/` (they stand in for the macroprocesses and the experimenter).
- Letter codes other than A (next step): to be reconstructed from U1's paths, which fix each letter's tested bits, with untested bits set to 0. Each code is checked to sort to its own letter.
- The run-deck changes listed in `IPL/make_run.py`: spelling, section headers, `*0`, the D0 patch.

## 8. Sources and later versions

See `HISTORY.md` for every source and EPAM's later versions: EPAM III (1964), EPAM IV (Richman & Simon 1988, on a PC IPL-V), EPAM-V (Richman 1987, with an IPL-V listing), and the Stanford listing.

## 9. Next

1. Letter codes for the letters of List A (K, A, G, L, U, R, I, P, E, M, O, T).
2. The six syllables as items, an empty net U2, and a serial-anticipation driver around F0 (one F0 cycle per trial, as in Fig. 4.1).
3. Compare our trials, errors and net growth with Fig. 4.1; then paired associates and Fig. 4.2.
4. Later: the Stanford listing (`EPAM_sc0340_1986-052_b56_f2.pdf`), a later EPAM that did run, with its own experiment routines (F13 "record new response", F14 "recite serial list", T4/T5).
