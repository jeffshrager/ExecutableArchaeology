# A Hacker's Guide to Herbert Simon's IPL-V Version of Yngve's Sentence Generator (1962)

Copyright © 2026 Jeff Shrager (<jshrager@gmail.com>). All rights
reserved. (See copyright details at the end of this document.)

*For the curious visitor who wants to read a 1962 line-printer listing of the first random sentence generator: Victor Yngve's phrase-structure machine, carried from MIT's COMIT into Carnegie Tech's IPL-V by Herbert Simon and his daughter Katherine, and caught "almost debugged"*

---

## Before You Arrive: What Is Yngve's Sentence Generator?

In 1959–61 Victor Yngve, at MIT's Research Laboratory of Electronics, wrote a program that produced English sentences at random from a phrase-structure grammar. The grammar was built to generate the first ten sentences of Lois Lenski's 1940 children's book *The Little Train* — the story of Engineer Small and his steam engine — together with anything else its rules permitted. Yngve reported the work in "Random Generation of English Sentences," presented at the National Physical Laboratory, Teddington, in September 1961 (proceedings published 1962). His program was written in COMIT, his own string-processing language, on an IBM 704. The same model of sentence production gave rise to Yngve's **depth hypothesis** (1960): a speaker producing words left to right needs only a small temporary memory, about seven items, and English grammar is shaped to keep that memory from overflowing.

Yngve matters to computing as well as to linguistics. COMIT (1957–58) was the first string-processing language, built so linguists could write rules instead of machine code, and it was an important precursor of SNOBOL. He also left a trace on the most famous language program of the decade. In his interview for Pamela McCorduck's *Machines Who Think*, Joseph Weizenbaum recalled commuting to MIT with his neighbor Yngve and talking about pattern matching. The core matching routine Weizenbaum added to SLIP for ELIZA is named `YMATCH` (see the ELIZA guide in this repository). The "Y" may well stand for Yngve, although nothing in the code says so.

**A note on what you're reading.** This is *not* Yngve's COMIT program. It is an IPL-V re-implementation. The header reads `COPY OF YNGVES SENTENCE GENERATOR` and `GENERATIVE GRAMMAR - KES AND HAS`. The job was run on 25 June 1962 under the account `H A SIMON`. HAS is Herbert A. Simon; KES has been identified as his daughter, Katherine Simon. So this appears to be a father-and-daughter port of Yngve's program. The listing survives as a photographed line-printer printout in the Herbert A. Simon Papers, Box 14, folder FF964, Carnegie Mellon University Archives, where it was recently unearthed by Mia Golek and Emily Davis (both of CMU) with Jeff Shrager. A scan is available here: <https://drive.google.com/file/d/1JCnU3-8qBhRo8Hj5vZ4OfNrVWOFfNhLa/view?usp=drive_link>.

Across the first page, in pencil, is a cover note. My reading is: *"[salutation illegible] — here is an almost debugged version & some output attached. Hal."* Neither the writer nor the recipient can be identified from the document alone. The signature is a small puzzle: Simon generally went by "Herb," so a note signed "Hal" on a Simon–Simon program may be from someone else in the Carnegie IPL group, or my reading of the handwriting may be wrong.

The printout contains four things:

- the complete program, four routines C0–C3;
- the complete grammar as IPL data, lists A0–A304 and B1–B48;
- an execution trace of one full sentence and part of a second;
- a handful of pencil corrections.

That makes it three artifacts in one: a port of a landmark linguistics program into the landmark AI language, a working grammar you can read rule by rule, and a snapshot of debugging in progress. You can see the bug in the output, and the fix is written in pencil beside the code.

---

## The Map: Seven Districts

```
[The Deck]          header cards, regions, machine addresses, and a
                       stratigraphy of card numbers
[The Rulebook]      the A and B lists — Yngve's grammar as IPL data
[The Switchboard]   C1 — one dispatcher, five rule types
[The Waiting Room]  L2 — Yngve's temporary memory, and the discontinuous
                       constituent in one extra instruction
[The Dice]          C2 — J129 and the count-up-to-zero idiom
[The Press]         C3 — printing word fragments, wrapping lines
[The Front Office]  C0 — twenty sentences, one bug, one pencil fix
```

The whole program is under a hundred cards of code. The grammar is several hundred cards of data.

---

## District 1: The Deck

The first cards are IPL-V loader directives. The TYPE column is visible only on these cards:

```
GENERATIVE GRAMMAR - KES AND HAS      1
COPY OF YNGVES SENTENCE GENERATOR     2 A         400
                                      2 B         100
                                      2 C          10
                                      2 L          10
                                      2 N         100
                                      2 T          50
                                      5
```

Here is what each card type does:

- **Type 1** is a comment card (the title).
- **Type 2** is a region card. It reserves a block of consecutive cells for all the symbols that share one initial letter: 400 A's, 100 B's, 10 C's, and so on.
- **Type 5** is a header card. It announces that routines follow.

A second header, `5 1` (Q = 1), later announces data list structures, under the comment `DATA`. The deck ends with `5 C0`, which means "loading is done; start at C0."

The four-digit numbers in the leftmost column are the machine addresses the loader assigned. They let you check the region cards against the machine:

| Symbol | Address | Difference |
|--------|---------|------------|
| A0     | 5238    |            |
| B0     | 5638    | 400 (A)    |
| C0     | 5738    | 100 (B)    |
| N0     | 5758    | 20 (C + L) |

The A sub-blocks fall where they should too: A101 is at 5339 and A301 is at 5539. The regional layout matches the type-2 cards exactly. Local cells (addresses 2555–3364) are allocated from free storage in roughly card order.

> **★ DON'T MISS**
>
> The card identifiers on the right (`C0010`, `C1150`, …) record the program's history. Numbering by tens left room for insertions, and the insertions show:
>
> - The whole type-5 test, `IS IT TYPE 5 / GO TO 93`, is numbered C1152–C1158, squeezed between the type-3 test (C1150) and the type-4 test (C1160).
> - Its handler is partly interpolated (C1333, C1336).
> - The random-seed setup in C0 is interpolated (C0013, C0016).
> - Three pairs of cards have **no identifier at all**: `40H0 / J152` in C1 and `40H0 / J153` in C2. These are the cards that print the trace. They were slipped into the deck for this debugging run.
>
> Card numbers are evidence, not proof. Still, the most likely reading is that the discontinuous-constituent rule (type 5) was added to a working type 1–4 generator, and that the tracing was added for this run. (Interpretation, moderate confidence.)

---

## District 2: The Rulebook — the A and B lists

The grammar is pure data. Every rule is an IPL list whose elements are its constituents. Its **description list** (named in the list's head) carries one attribute, T0 ("rule type"), whose value is T1–T5. Here is rule A0, the start symbol:

```
DATA  A0    90
            A101
            A103     0
      90    0
            T0
            T2       0
```

Read it as: A0 is a type-2 rule with alternatives A101 and A103. The local `90` is its description list, and its only content is the pair T0 → T2.

The rule types, as the dispatcher's comments confirm:

| Type | Yngve's form | Meaning | In this listing |
|------|--------------|---------|-----------------|
| T1 | A = B | rewrite as a single constituent | A201–A221 (21 rules) |
| T2 | A = B / = C / … | choose one alternative at random | A0–A21 (22 rules) |
| T3 | A = B + C | left constituent now, right one later | A101–A123 (23 rules) |
| T5 | A = B + … + C | discontinuous: C comes after the *next* pending item | A301–A304 (4 rules) |
| T4 | — | a word: send it to the output | B1–B48 (48 entries) |

The numbering is systematic. A1xx are binary rules, A2xx unary, A3xx discontinuous, B words. Once you know that, you can navigate the data without a key.

The words themselves are lists of alphanumeric data terms (`21` = P 2, alphanumeric; Q 1, data term). No term in the listing holds more than four characters, so longer words are chopped up:

```
      B25   910
            90
            91
            92       0
      90    21DRIV
      91    21INGW
      92    21HEEL
      910   0
            T0
            T4       0
```

That is DRIVINGWHEEL, in three fragments that the printer will set side by side. The four-character limit is a fact of this listing. Whether it came from the host machine's word size or was the programmer's choice is not recorded, and the host machine is not named anywhere on the printout.

The listing has no category names, only numbers. Here is the grammar with T1 hops collapsed and words spelled out. **The category labels on the left are my own reading, not the program's:**

```
SENTENCE     A0   = A101 | A103
             A101 = A102 + CLAUSE          (A201→A102, A205→A103)
             A102 = A301 + CLAUSE          (A202→A301)
             A301 = WHEN + ... + ,         (T5)
CLAUSE       A103 = A13 + A1
SUBJECT      A13  = A14 | HE
NOUN PHRASE  A14  = A116 | SMALL | A18 | A117 | A118 | A119 | IT
             A116 = ENGINEER + SMALL       A119 = A + A10
             A117 = A7 + A18               A118 = A7 + A10
DETERMINER   A7   = THE | A19 | A304       A19  = HIS | ITS
             A304 = THE + ... + A208       (T5)
PREDICATE    A1   = A104 | A105 | A106
             A104 = IS + A2                A105 = IS + A17
             A106 = A12 + A4
VERB         A12  = A302 | A303 | KEEPS | MAKES | HAS
             A302 = HAS + ... + A208       (T5)
             A303 = A16 + ... + A2         (T5)   A16 = KEEPS | MAKES
LOCATIVE     A208 → A107 = A15 + A4        A15 = IN | UNDER
COMPLEMENT   A2   = A108 | A20 | A111      A111 = PROUD. + OF + A4
OBJECT       A4   = A113 | A6              A6   = A14 | A8
             A113 = A6 + A5                A5   = A114 | A115
             A114 = , + A113               A115 = AND + A6
PLURAL NP    A8   = A120 | A121 | A122     A9   = A121 | A122
             A120 = A7 + A9                A121 = FOUR + A122
             A122 = A10 + S
NOUN GROUP   A10  = A123 | A21             A123 = A11 + A21
ADJECTIVES   A11  = A108 | A20             A108 = A20 + A3
             A3   = A109 | A110            A109 = , + A108
             A110 = AND + A20
PARTICIPLE   A17  = HEATED | OILED | POLISHED
MASS NOUN    A18  = WATER | STEAM
ADJECTIVE    A20  = BLACK | SHINY | OILED | POLISHED | HEATED | BIG
                    | LITTLE | PROUD
NOUN         A21  = DRIVINGWHEEL | TRAIN | ENGINE | BELL | WHISTLE
                    | SANDDOME | HEADLIGHT | WHEEL | SMOKESTACK
                    | BOILER | FIREBOX
```

**How faithful is the copy?** Yngve's paper tabulates his grammar's 77 rules. Setting that tabulation beside this listing tests the "COPY OF" claim:

| Rule kind | Yngve 1961 | This listing |
|-----------|-----------|--------------|
| Alternatives: 2 / 3 / 5 / 7 / 8 / 11 choices | 13 / 5 / 1 / 1 / 1 / 1 | 13 / 5 / 1 / 1 / 1 / 1 |
| A = B + C | 24 | 23 |
| A = B + … + C | 5 | 4 |
| A = B | 26 | 21 |
| Total | 77 | 70 |

The alternative rules match exactly, down to the one 11-way choice of nouns (A21) and the one 8-way choice of adjectives (A20). That is strong evidence this is Yngve's grammar and not a look-alike. The shortfalls are all in the structural rules. Yngve says many of his A = B rules were placeholders for a future, larger grammar, so dropping some is plausible.

Yngve's paper lists five constructions that use discontinuous rules: a firebox *under* its boiler, *keeps* it *oiled*, the water *in* the boiler, *when* it is heated*,*, and a sand-dome. Four have clear counterparts here: A302, A303, A304, and A301. SAND-DOME appears only as the plain word `SANDDOME` (B30). What Yngve's fifth rule did, and why it is absent, I can't determine from these sources.

The recursions Yngve describes are all present:

- coordinated adjectives (A108 → A3 → A109 → A108 …);
- coordinated noun phrases (A113 → A5 → A114 → A113 …);
- the nesting locative, where A304 and A208 lead to IN/UNDER plus an object, which can contain A304 again.

---

## District 3: The Switchboard — C1

C1 takes one grammar symbol in H0 and does whatever its type demands. It is recursive, and it is the whole generator.

```
                                  C1    40H0             C1010
                                        40H0
                                        J152
                                        10T0             C1020
                                        J10              C1030
FIND TYPE                               40H0             C1040
                                        10T1             C1050
IS IT TYPE 1                            J2               C1060
GO TO 90                                70       90      C1070
   ... same test for T2 → 91, T3 → 92, T5 → 93 ...
                                        10T4             C1160
IS IT TYPE 4                            J2               C1170
TYPE 4. FIND WORD AND PUT ON L1         70J7     95      C1180
TYPE 1. OPERATE ON SUBORDINATE    90    30H0             C1190
                                        J81      C1      C1200
                                  91    30H0             C1210
TYPE 2. RANDOMLY FIND SUB. AND OP.      C2       C1      C1220
   ...
TYPE 4                            95    10L1             C1370
                                        J6       J65     C1380
```

**Step by step.** The first three cards copy the symbol twice and print one copy; J152 is "print symbol." This produces the trace in the output (District 1's unnumbered cards). Then J10 fetches the value of attribute T0, the type. There follows a chain of compare-and-branch tests.

**Branching.** `70  90` has a blank SYMB and 90 in the LINK field. In this idiom (also used throughout Stefferud's Logic Theorist) the branch goes to LINK when the test *succeeded* (H5+) and falls through to the next card when it failed. So "IS IT TYPE 1 / GO TO 90" reads exactly as the comments say.

**The handlers:**

- **Type 1** discards the type and uses J81 (first symbol on the list) to replace the rule with its only constituent. It then *transfers* to C1 by naming C1 in the LINK field: a tail call written as a jump.
- **Type 2** hands the rule to C2 (District 5), which returns one randomly chosen alternative, and tail-calls C1 on it.
- **Type 4** pushes L1, swaps, and appends the word to the end of L1 with J65. L1 is the output sentence, built strictly left to right.

> **★ DON'T MISS**
>
> Type 4 is tested *last*, and its failure branch is `70J7`: J7 is "halt, proceed on GO." Anything that is not one of the five known types stops the machine and waits for the operator. That is the entire error handling. C2 uses the same `70J7` for "the random index ran off the end of the list." In 1962 an assertion failure was a stopped computer and a human at the console.

---

## District 4: The Waiting Room — L2 and the discontinuous constituent

Yngve's mechanism, in his own terms, works like this. Rewriting A = B + C means working on B now and putting C into a **temporary memory** that runs last-in, first-out. In this program that memory is the list **L2**, and the type-3 handler is almost a word-for-word implementation:

```
                                  92    30H0             C1230
TYPE 3                                  40H0             C1240
                                        J82              C1250
PUT RT. SUBORDINATE ON L2               10L2             C1260
                                  94    J6               C1270
                                        J64              C1280
FIND LEFT SUBORDINATE AND OPERATE       J81              C1290
                                        C1               C1300
                                        10L2             C1310
FIND RT. SUBORDINATE AND OPERATE        J60              C1316
                                        12H0             C1318
                                        J6               C1320
                                        J68      C1      C1325
```

In prose:

1. J82 gets the second (right) constituent, and J64 inserts it right after L2's head, which pushes it onto the stack.
2. J81 gets the left constituent, and C1 expands it with an ordinary recursive call.
3. When that returns, J60 locates the first cell of L2 and `12H0` fetches the symbol in it.
4. J68 deletes it (pop).
5. C1 is tail-called on it.

Yngve's *third* rule type, A = B + … + C, is his device for discontinuous constituents: "called her *up*," "keeps it *oiled*." Yngve states the rule this way: C goes into temporary memory just behind the item that would come out next, so that "the last in is given second priority." Here is the type-5 handler:

```
PUT RT SUBORDINATE ON L2          93    30H0             C1330
                                        40H0             C1333
                                        J82              C1336
BEHIND LEADER                           10L2             C1340
T5. PUT RT. SUBORDINATE ON L2           J60      94      C1350
```

It is the type-3 handler with **one extra instruction**. Type 3 inserts after L2's head cell. Type 5 first does J60, "locate the first cell of L2" (the *leader*, the next item due out), then jumps into type 3's code at label 94 and inserts after *that*. Everything else is shared.

> **★ DON'T MISS**
>
> This works only because the type-3 pop is not a matched pop. Each T3 handler pushes its right constituent but, after the left side finishes, pops *whatever is on top of L2*. When a type-5 rule has been expanded inside the left side, the item on top is no longer the one this handler pushed.
>
> In the first sample sentence, rule A102 pushes a clause (A205). Then the discontinuous A301 (WHEN … ,) inside its left side slides a comma underneath that clause. When A102 finally pops, it gets the *comma*, and it has already expanded its own clause as a side effect of A301. The bookkeeping is global, not per rule. That is exactly what makes discontinuity cost nothing: one instruction, no special cases, and a stack discipline that only works because every handler trusts the stack rather than its own memory. (Mechanism: high confidence, traced in the output. The characterization is mine.)

The depth hypothesis is about the maximum size of L2. This program never measures it, which would take one J126 (count list) per push. You can reconstruct it from the trace, though. In the Day in the Life below, L2 holds four items just after the word THE.

---

## District 5: The Dice — C2

Type-2 rules need a random choice. C2 makes it:

```
                                  C2    40H0             C2010
                                        J126             C2020
                                        J129             C2040
                                        40H0
                                        J153
                                        J123             C2050
                                        J50              C2060
                                  91    J60              C2070
                                        70J7             C2080
                                        11W0             C2090
                                        40H0             C2100
                                        J117             C2200
                                        70       90      C2300
                                        J125             C2400
                                        30H0     91      C2500
                                  90    J9               C2600
                                        52H0     J30     C2700
```

The steps are:

1. J126 counts the alternatives (n).
2. J129 draws a random integer r in the range [0, n).
3. The unnumbered `40H0 / J153` prints r. These are the lone numbers in the middle column of the trace.
4. **J123 negates r**, and J50 parks −r in W0.

The loop at 91 then steps along the list with J60. At each cell it tests whether the counter is zero (J117). If it is not, it adds one with J125 (tally). When the counter reaches zero, the current cell holds the chosen alternative. `52H0` replaces the cell's name on H0 with the symbol inside it, and J30 restores W0 on the way out. J9 frees the counter cell first, which is good housekeeping for a machine counting its free cells.

> **★ DON'T MISS**
>
> Negate, then tally up to zero, is this programmer's loop idiom, and it appears twice. The main routine C0 does the same thing to run the generator twenty times: `10N20 / J123 / 30H0` negates the constant N20 **in place**, turning the cell that holds 20 into a cell holding −20. The loop then tallies and tests it with J117. The "constant" N20 is a loop counter that destroys itself after one use. Run C0 a second time without reloading and N20 starts at zero, not −20. (The J123 edge case "zero is signed" means −0; what J117 makes of it on this implementation is unknown.)

The seed is visible too. C0 opens with `10N0 / 20W10`. The IPL-V manual specifies that J129's generator lives in W10 and yields a fixed, repeatable sequence from a given start. N0 holds **53**, so this run's sentences were fixed by the number 53 and by the installation's J129 multiplier.

---

## District 6: The Press — C3

C3 prints the word list L1:

```
                                  C3    J154             C3010
                                        10N10            C3020
                                        J160             C3030
                                        1090             C3040
                                        J100             C3050
                                        J155             C3052
                                        10L1     J71     C3055
                                  90    10N1             C3060
                                        J161             C3070
                                        10910    J100    C3080
                                  910   40H0             C3090
                                        J157             C3100
                                        70       J8      C3110
                                        J155             C3120
                                        J154             C3125
                                        10N10            C3130
                                        J160     J157    C3140
```

The steps are:

1. Clear the print line (J154) and tab to column 10 (J160).
2. Run the generator J100 over L1 with subprocess 90. For each word, subprocess 90 advances one column (J161 with N1), which puts a space before every word. It then runs a *nested* J100 over that word's fragments with subprocess 910.
3. Subprocess 910 enters each fragment left-justified with J157.
4. The manual says a J157 that doesn't fit consumes its input and sets H5−, so 910 duplicates the fragment first. On success (`70 J8`) it discards the spare copy and returns. On failure it prints the line, clears it, tabs back to column 10, and tail-calls J157 on the saved copy: a word-wrapping printer in seven cards.

Because the space is added per *word* and the fit test is per *fragment*, a long word could in principle wrap in the middle, for example DRIV | INGWHEEL. (Inference from the code; not observed in the surviving output.)

Here is the one surviving printed sentence:

```
 WHEN THE STEAM MAKES FOUR WHISTLE S , SMALL HAS HIS LITTLE
AND BLACK BELL S IN PROUD , BLACK AND SHINY SMOKESTACK S , A
SMOKESTACK , FOUR DRIVINGWHEEL S AND FOUR OILED WHISTLE S
```

Every word gets a leading space, so the plural suffix S (B47) and the comma (B37) float free: `WHISTLE S ,`. Yngve's own paper admits the related trivial shortcomings of his version (no A→AN, no S→ES after FIREBOX).

> **★ DON'T MISS**
>
> Someone has already noticed the floating S and comma. Beside the entries for B37 (`,`) and B47 (`S`), a pencilled arrow points at the description list with the note **T10**, written twice. T10 is not a type C1 knows. The obvious reading is a planned sixth word type, "attach to the previous word without a space." (Interpretation, moderate confidence.)
>
> Also circled in pencil is B41, the second entry for PROUD, whose last fragment is `21D.` — a stray period. B41 is used only in the "PROUD OF" complement (A111), so every sentence that says someone is proud of something would print `PROUD. OF`.

---

## District 7: The Front Office — C0, and the bug

```
                                  C0    10N0             C0010
                                        20W10            C0013
                                        10N20            C0016
                                        J123             C0020
                                        30H0             C0030
                                  90    10A0             C0040
                                        C1               C0050
                                        10L1             C0060
                                        C3               C0070
                                        10N20            C0080
                                        J125             C0090
                                        J117             C0100
                                        7090     0       C0110
```

C0 does four things:

1. Seeds the random generator.
2. Sets up the −20 counter.
3. Loops: expand A0 (C1), push L1, print (C3).
4. Tallies the counter and branches back to 90 until it reaches zero (`7090 0`: back to 90 if the test fails, otherwise end).

It was supposed to print twenty sentences. The printout shows one sentence, then the trace of a second derivation, and then `STOP`.

The last card of C3, `10L1 J71`, is circled in pencil. J71 is "erase list (0)." It erases the list *including its head*, returning the cell named L1 to free storage. After the first sentence, the program's output list no longer exists as a list. The second sentence's words are then appended with J65 to a cell that now belongs to the free-space list. Next to it is the pencilled repair. My best reading is:

```
10L1        — C3055
J75  J71    — C3058
```

J75 is "divide list after location (0)." Applied to L1, it splits off everything after the head and returns the remainder's name. J71 then erases only the remainder. The fix keeps L1 as an empty list, ready for the next sentence. (The code logic of the fix: high confidence. My reading of the handwritten "J75": moderate; it could be read as J25, which would make no sense here.)

The second derivation in the trace is complete: A0 → A103 → HE; then A105 → IS + A17 → HEATED. It would have printed as `HE IS HEATED`, but it never appears. Its trace block is also printed twice, one copy above a pencilled rule and one below, before the run stops. A broken L1 accounts for the missing sentence. I can't reconstruct the exact failure path, including the doubled trace, from the printout. (Missing sentence explained by the J71 bug: moderate confidence. Failure details: unknown.)

Also on this page, in pencil, is a small call tree: C0 over C1 and C3, and C2 under C1. That is correct, though it omits C1's calls to itself. It looks like a reader drawing the map before touring the code.

---

## A Day in the Life: One Sentence, End to End

Here is the start of the printed sentence, followed through the trace, with L2 shown top-first. Random draws are in brackets.

1. **C0** pushes A0 and calls C1. A0 is type 2; C2 draws **[0]** and returns **A101**.
2. **A101** (T3) pushes A205 (clause) onto L2 and expands A201 → **A102**. L2: `A205`
3. **A102** (T3) pushes another A205 and expands A202 → **A301**. L2: `A205 A205`
4. **A301** (T5, WHEN … ,) locates the leader (the top A205) and slides the comma rule A204 *behind* it. It then expands A203 → **WHEN** → L1. L2: `A205 A204 A205`
5. Back in A301's borrowed type-3 code, pop the top: **A205 → A103** (T3: subject + predicate). Push A1 and expand A13. L2: `A1 A204 A205`
6. **A13 [0] → A14 [3] → A117** (T3) pushes A18 and expands A7 **[0]** → A217 → **THE**. L2: `A18 A1 A204 A205`. Four pending obligations: a noun, a predicate, a comma, and a whole second clause.
7. Pop **A18 [1] → STEAM**. Pop **A1 [2] → A106** (T3) pushes A4 and expands A12 **[3] → MAKES**.
8. Pop **A4 [1] → A6 [1] → A8 [1] → A121**: **FOUR**, then A219 → A122 → A10 **[1]** → A21 **[4] → WHISTLE**, then A220 → **S**. L2: `A204 A205`
9. Now A102's handler, which pushed a *clause* back in step 3, pops the top of L2 and gets **A204 → ,**. Last, A101's handler pops **A205**, the main clause: SMALL HAS … (via the discontinuous HAS … IN rule, A302).
10. The main clause's object of IN is a coordinated noun phrase. Yngve's paper singles this out as the grammar's worst flaw, ambiguous coordination under a preposition, and this sentence shows it: `IN PROUD , BLACK AND SHINY SMOKESTACK S , A SMOKESTACK , FOUR DRIVINGWHEEL S AND FOUR OILED WHISTLE S`.
11. C3 prints L1 with word-wrap at the line's end. Then it erases L1 — see District 7.

Every step above can be checked against the trace. Each `0 Axxx` line is C1's J152 printing the symbol about to be expanded, and each lone number is C2's J153 printing its draw.

---

## Practical Notes for the Independent Traveler

**IPL-V in one paragraph.** (See the Logic Theorist guide in this repository for the full tour.) H0 is a push-down stack for arguments and results; "(0)" and "(1)" in the manual mean its top two items. H5 holds the result of the last test, + or −. W0–W9 are working cells, pushed and popped around use. An instruction is PQ SYMB LINK:

- P gives the operation: 0 execute, 1 push onto H0, 2 pop into S, 3 restore S, 4 preserve S, 5 replace H0's top, 6 copy it, 7 branch if H5−.
- Q gives indirection: 0 the symbol itself, 1 the symbol in the named cell, 2 two levels.

So `10L2` pushes the name L2, `11W0` pushes what W0 holds, and `12H0` pushes the symbol held in the cell whose name is on top of H0. A routine or J-function name in LINK is a jump to it, so it works as a tail call. Labels 90, 91, … 910 are local symbols, private to each routine; every routine here reuses 90.

**J-functions used**, per the 1964 manual (2nd edition; this program predates it, but its behavior matches):

| J-function | Meaning |
|---|---|
| J2 | test identical |
| J6 | swap (0) and (1) |
| J7 | halt |
| J8 | pop H0 |
| J9 | erase cell |
| J10 | find attribute value |
| J30 | restore W0 |
| J50 | preserve W0 and store (0) in it |
| J60 | locate next cell |
| J64 | insert after cell |
| J65 | insert at end |
| J68 | delete symbol in cell |
| J71 | erase list |
| J81 / J82 | first / second symbol |
| J100 | generate over list |
| J117 | test zero |
| J123 | negate |
| J125 | tally 1 |
| J126 | count list |
| J129 | random number in [0, (0)) |
| J152 | print symbol |
| J153 | print data term |
| J154 | clear line |
| J155 | print line |
| J157 | enter data term left-justified |
| J160 | tab to column |
| J161 | advance column |

**Reading the scan.** Printed columns, left to right: machine address, comment, NAME, PQ+SYMB (run together, e.g. `10T1`), LINK, card ID. Data-term cards show PQ as `1` (integer) or `21` (alphanumeric). Several page images overlap their neighbours by a few lines at the fanfold, so a transcriber must remove the duplicates. The header line (`OPERATOR-007 … 12:42:26 R350.039 IPL 015 060`) and the closing `STOP / PMTM / 00:21:53 020` are job-control output whose fields I can't decode with confidence.

**Running it.** As far as I can tell the listing is complete: four routines, 70 rules, 48 words, three numeric constants, and the start card. L1, L2, and the T symbols need no data because they are used as bare symbols and empty lists. Shrager's Common Lisp IPL-V interpreter (github.com/jeffshrager/IPL-V) currently lacks J123, J129, and J153, and all three are small to add. The pencil fix at C3055/C3058 should be applied. Exact reproduction of the 1962 sentences would also require the installation's J129 multiplier, which is not in this listing. With any other generator you get different sentences from the same grammar.

---

## What Makes It Worth Visiting

Yngve's program is usually remembered as a result: random grammatical sentences in 1961, plus the depth hypothesis. The listing shows how little machinery the result needed. The grammar is inert data. The engine is one recursive dispatcher, one stack, and one random-choice routine. Yngve's discontinuous constituent, the feature he considered essential for English, costs a single J60. Because the temporary memory is an explicit IPL list, Yngve's psychological hypothesis — that memory stays small — describes a quantity you can count in this program.

It is also an unusually honest artifact. The printout shows a program *partway* through debugging:

- trace cards added without card numbers;
- a destroyed output list that ended the run after one sentence;
- a floating S and comma with a proposed fix pencilled beside them;
- a stray period in PROUD.;
- one handwritten line of code, `J75 J71`, that repairs the run.

Most surviving listings of this era are finished and cleaned up; this one was handed over mid-bug.

Then there is the question of why it exists at all. Newell, Shaw, and Simon's IPL group is known for problem solving, theorem proving, chess, and verbal learning (EPAM), not for language. This listing, together with a version of Simon's Heuristic Compiler recovered at about the same time, may be the earliest direct evidence that Simon himself, or the IPL group around him, wrote programs whose main object was generating or processing natural language. It may equally have been something fun to hack on with his daughter. The listing itself doesn't settle it. It is labelled a *copy*. It extends Yngve neither in grammar nor in mechanism, and although L2 is sitting right there, it never measures L2's depth, the quantity Yngve's hypothesis is about. That fits a learning exercise as well as a first step toward research. Either way, it is a 1962 moment in which the two founding traditions of symbolic language work — MIT's string-rewriting linguistics and Carnegie's list-processing psychology — are running on the same machine.

---

## Provenance and Sources

The source is a photographed line-printer listing plus output, in the Herbert A. Simon Papers, Box 14, FF964, Carnegie Mellon University Archives, located by Mia Golek, Emily Davis, and Jeff Shrager. The scan's filename is `Simon_Papers__Box_14__FF964__OP007__25_June_62__release_.pdf`, and a copy is linked above. Every page is watermarked with the archive's copyright notice.

**From the code, high confidence:**

- all code excerpts and card IDs;
- the rule and word data, and the rule counts;
- the region/address arithmetic;
- the C1–C3 control flow;
- the trace-to-grammar correspondences in the Day in the Life, which were checked random draw by random draw.

**From the IPL-V manual, high confidence:** J-function meanings and card types are from the 1964 IPL-V manual, 2nd edition, as OCR'd in Shrager's IPL-V repository. That edition postdates the listing, but the program's traced behavior is consistent with it (moderate-to-high confidence that 1962 meanings were the same).

**From Yngve's paper, high confidence as to what the paper says:** the historical context, rule tabulation, five discontinuous constructions, vocabulary counts, and quoted phrase are from Yngve (1961/1962), read directly.

**Interpretation, flagged as such in the text:**

- the stratigraphy of card numbers (moderate);
- the purpose of the "T10" notes (moderate);
- the reading of the pencilled "J75" (moderate);
- the J71 bug as the reason the run printed only one sentence (moderate; the exact failure path, including the doubled trace, is unknown);
- all category labels in the grammar map;
- the identification of KES as Katherine Simon is the discoverers' (moderate-to-high; it fits the initials and the Simon account, but the listing doesn't spell it out);
- who signed "Hal" (unknown);
- the Yngve–Weizenbaum connection: the commute and the pattern-matching conversations come from Weizenbaum's interview as reported by McCorduck; the "Y" in `YMATCH` standing for Yngve is speculation;
- whether this program marks a research interest in language at Carnegie or a family hobby (open; see "What Makes It Worth Visiting").

**Not established here:** the host machine is not named on the printout. Why no data term exceeds four characters is not documented.

---

## References

*Works consulted in preparing this guide; not all are cited above.*

Hutchins, J. (2012). "Victor H. Yngve (1920–2012)." *Computational Linguistics*, 38(3).

Lenski, L. (1940). *The Little Train*. Oxford University Press.

Farber, D. J., Griswold, R. E., & Polonsky, I. P. (1964). "SNOBOL, a String Manipulation Language." *Journal of the ACM*, 11(1), 21–30.

McCorduck, P. (2004). *Machines Who Think* (2nd ed.). A. K. Peters.

Newell, A. (Ed.). (1964). *Information Processing Language-V Manual* (2nd ed.). Prentice-Hall.

Shrager, J. *IPL-V repository* (interpreter and IPL-V manual scan). github.com/jeffshrager/IPL-V

Shrager, J. "A Hacker's Guide to the Logic Theorist" and "A Hacker's Guide to ELIZA." Hacker's Guides, this repository.

Simon, H. A. (1963). "Experiments with a Heuristic Compiler." *Journal of the ACM*, 10(4), 493–506.

Yngve, V. H. (1958). "A Programming Language for Mechanical Translation." *Mechanical Translation*, 5(1).

Yngve, V. H. (1960). "A Model and an Hypothesis for Language Structure." *Proceedings of the American Philosophical Society*, 104(5), 444–466.

Yngve, V. H. (1962). "Random Generation of English Sentences." In *1961 International Conference on Machine Translation of Languages and Applied Language Analysis* (National Physical Laboratory Symposium No. 13), pp. 66–80. HMSO. Available at aclanthology.org/1961.earlymt-1.4.

# Copyright

**Hacker's Guides** — guide texts, commentary, and supporting material.

Copyright © 2026 Jeff Shrager (<jshrager@gmail.com>). All rights reserved.

Permission requests, corrections, and questions: <jshrager@gmail.com>.

## Scope

This copyright covers the original text of the guides and the README — the prose, structure, commentary, and annotations written for this repository: https://github.com/jeffshrager/HackersGuides

It does **not** cover:

- **The historic source code being read.** Quoted program source (and any complete source files included in this repository) remains the property of its respective authors and rights holders, or is in the public domain, as the case may be. Excerpts appear here for purposes of commentary, criticism, and scholarship. Provenance for each program's source is stated in the corresponding guide.
- **Quoted third-party material.** Brief quotations from cited historical accounts and documentation remain the property of their respective rights holders and are used for the same purposes.

## Attribution

If you quote or reference a guide, please credit "Hacker's Guides, Jeff Shrager" and link to this repository: https://github.com/jeffshrager/HackersGuides
