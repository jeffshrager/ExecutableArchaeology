# A Hacker's Guide to Herbert Simon's Heuristic Compiler (1961)

Copyright © 2026 Jeff Shrager (<jshrager@gmail.com>). All rights
reserved. (See copyright details at the end of this document.)

*For the curious visitor who wants to see GPS-style means-end analysis
 turned on the job of programming itself: a 1961 IPL-V program that
 writes IPL-V programs, and runs again after 65 years*

---

*Warning*: Large parts of this document were created using AI
assistance. *Doveryai, No Proveryai!*

---

## Before You Arrive: What Is the Heuristic Compiler?

In 1961 Herbert Simon, working at Carnegie Tech and the RAND
Corporation, asked whether writing a program could be treated as a
*problem* in the sense of the General Problem Solver (GPS). GPS works
by **means-end analysis**: compare the present object with the desired
one, find a difference, find an operator relevant to that difference,
apply it, and repeat. If a programming task can be stated as a
difference between a "present" and a "desired" object, the same
machinery ought to be able to write the program.

The **Heuristic Compiler** was Simon's experiment. He described it in a
RAND report (P-2349, 30 June 1961), which included "a listing of the
program as of June 1961," and then in "Experiments with a Heuristic
Compiler," *Journal of the ACM* 10(4), 1963. The paper describes three
parts:

1. **The State Description Compiler.** You describe a routine by what it
   does to the computer: which cells it affects, and what each holds
   before and after. The compiler finds an IPL-V routine that makes
   that change.
2. **The Functional Description Compiler.** You describe a routine by an
   imperative phrase, such as "INSERT (1) AT END OF VALUE LIST OF
   ATTRIBUTE (0) OF (2)". The compiler finds an already-compiled routine
   whose description is close and transforms it into the new one.
3. **The General Compiler.** An executive that looks at what is known
   about a routine and chooses which compiler to apply.

The target language is IPL-V itself, so it is an IPL-V program that
writes IPL-V programs. Its "objects" are routines represented as IPL
description lists, which is why so much of the program is about
building, comparing, and rewriting list structures.

**It runs again.** For the first time in about 65 years, Simon's
Heuristic Compiler is running. The 1961 deck was transcribed card by
card from the archival listing and loaded into a modern IPL-V
interpreter. Its compilers now do what the 1963 paper says they did.
Given a functional description of INSERT AT END OF VALUE LIST
(supplied, as in Simon's own runs, as a hand-coded list structure, not
as typed text), the program writes `J13 J52 11W2 11W0 J10 11W1 J65 J32
0`, the code printed in the paper, character for character. Given a before-and-after description of the
machine, it writes the paper's `10J3 20H5 0` for SET SIGNAL MINUS. It
reassembles the paper's routine J77 from its flow diagram. Nothing here
was rewritten in a modern language. This is Simon's own IPL-V,
executing. (One print routine missing from the 1961 listing, U126, was
taken from the 1963 listing in Simon's RAND memorandum, and the
English-language front end has not yet been run. See "Running It
Today".)

**A note on what you're reading.** The listing is headed `HEURISTIC
CODER 7/16/61`. It is a line-printer listing of the complete card deck,
about 4,470 cards, preserved in the Herbert A. Simon Papers, Box 14,
folder FF965, Carnegie Mellon University Archives. It was found at
about the same time as the Simon–Yngve sentence generator (see the
companion guide in this repository). The date is two weeks after the
RAND report, so this is very nearly the program the report describes.
The listing carries a fair amount of pencil: check marks, stack-depth
counts beside a few routines, a handful of proposed corrections, and a
pencilled card total ("4464") on the first page.

The deck is three things at once:

- an executive and two compilers that really run;
- a natural-language front end (a scanner, a dictionary, and a parser)
  intended to let the compiler accept English definitions;
- a small "world" of IPL-V knowledge, encoded as data, that the
  compilers reason about.

The scan and a card-for-card transcription are in the Executable
Archaeology repository:
<https://github.com/jeffshrager/ExecutableArchaeology/tree/main/HeuristicCoder>.

---

## The Map: Eight Districts

```
[The Deck]            regions, three sections, card IDs, pencil
[The Vocabulary]      routines, IPL words, and symbols as description lists
[The Executive]       U135-U138 — the General Compiler, Fig. 1 of the paper
[The Translator]      U134, U130 — compiling from a functional description
[The Engineer]        U140-U156, X5-X7 — compiling from a state description
[The Draftsman]       U139, U133 — flow diagrams and segments
[The Press]           U125, U127, U128, E-routines — printing routines
[The Front Office]    T1 — the demonstration that runs today
```

A ninth district, **the Front End** (the scanner, dictionary, and parser,
routines T50-T300, U23-U99, R0-R1), is described briefly near the end.
It is in the deck but has not yet been run.

---

## District 1: The Deck

The deck opens with a title card and region cards:

```
HEURISTIC CODER 7/16/61               1
                                      2 A        200
                                      2 B        150
                                      ...
                                      2 T        301
                                      2 U0      0300
                                      2 X0      0300
                                      2 +         10
                                      2 (         10
                                      ...
RESERVE PRINT LINE L101               3     1L101  5
                                      3     1T100 82
```

Type-2 cards reserve regional symbols. Every letter in use gets a
region, and so do the punctuation characters `+ - . , ( ) * $ / =`,
because the scanner turns characters into regional symbols (`(` becomes
`(0`). Type-3 cards with Q=1 reserve *lines*: L101 (5 columns) and
T100 (82 columns), the buffers for the line-reading processes J180-J186.
Further type-3 cards reserve whole regions as empty symbols.

The deck then falls into three sections, which the card IDs make
visible:

| Section | Header | IDs | Contents |
|---------|--------|-----|----------|
| routines | `5 30` "MACHINE LANGUAGE", then `5` | `E004 000` … `X007 840` | E, R, T, U, X routines (about 165 routines) |
| tables | `5  5` | `T010 010 C` … `T049 090 C` | scanner state tables, data with Q=5 |
| data | `5  1` "DATA" | `A000 010 D` … `X199 110 D` | the dictionary, constants, and the problem world |

The routine families are easy to tell apart:

- **E** — print utilities (E4-E55)
- **R** — top-level drivers for the language path (R0, R1)
- **T** — the text scanner, dictionary, and definition handling (T1, T50-T300)
- **U23-U99** — the parser
- **U100-U169** — the compilers
- **U199** — converting a parse into a descriptive name
- **X5-X7** — difference detection

The data section is mostly **X**, the compiler's knowledge.

> **★ DON'T MISS**
>
> Two styles of local symbol live side by side: the older `90`, `910`
> and the newer `9-10`. U199 uses both for the *same* labels (`9-10` /
> `910`, `9-12` / `912`). It looks like the program was written in one
> convention and patched in the other.

---

## District 2: The Vocabulary — everything is a description list

The central idea of the program is that a *routine* is an object with
attributes. Each attribute is one possible definition of the routine:

| Attribute | Name in the listing | Value |
|-----------|---------------------|-------|
| X20 | DSCN (descriptive name) | a functional description: a process plus a list of arguments |
| X21 | LDEF (L-definition) | (not used by the code that runs) |
| X22 | JDEF (J-definition) | the IPL-V code: a list of IPL words |
| X24 | SDSC | a state description |
| X25 | IPLN | the routine's IPL name, e.g. J3 |
| X26 | flow chart | a list of segments |

**An IPL word is itself a description list**, with attributes X40-X46
(type, name, sign, P, Q, symbol, link). **A symbol is a description
list too**, with a region (X33) and a location (X34), each naming a data
term: region L10 is the letter "J" and location N3 is the integer 3, so
X33 L10, X34 N3 is the symbol `J3`. The program never handles IPL code
as text. It builds code out of these structures and prints it at the
end.

Here is X105, Simon's running example J3, "SET SIGNAL MINUS":

```
X105    90       0     J3. REPLACE TOP OF H5 WITH J3.
90      0
        X20            DSCN       -> 920
        920
        X25            IPLN       -> 91  (= region L10 "J", location N3)
        91
        X24            SDSC       -> 92
        92       0
...
921     0              DSCN
        X30
        X113     0     PROCESS IS X113   ("SET H5 MINUS")
...
98      0              the one affected cell:
        X41            name      X175  (the symbol H5)
        X175
        X75            input     S1, R0
        99
        X76            output    J3, R0
        910      0
```

The **state description** lists the affected cells (X71). Each cell has
a name, an input state (X75), and an output state (X76), and each state
is a list of symbols. `S1` is a variable (X2), "some symbol", and `R0`
(X1) is "the rest of the pushdown list". So H5 goes from *some symbol on
top of whatever* to *J3 on top of the same whatever*. This is the
paper's "Input SYMB1, PUSHDOWN1 / Output MINUS, PUSHDOWN1", written as
data.

The **functional description** is a process name plus arguments. A
process name such as X110 is a list of 5-character BCD fragments with
X31 marking each argument slot:

```
X110    0
        911            INSER
        912            T
        X31            ( )
        914            AT EN
        915            D OF
        X31     0      ( )
```

That reads "INSERT ( ) AT END OF ( )". The arguments X120-X126 are
themselves described objects: "(1), a location in the H0 list", "S2, a
variable", or, most interestingly, X121, a **determiner**. X121 is an
argument that is itself a routine with its own DSCN ("THE VALUE OF THE
ATTRIBUTE (0) OF (2)") and JDEF (`J10`). That is how a phrase like "the
value of attribute 0 of 2" becomes code.

---

## District 3: The Executive — U135 to U138

The General Compiler is the paper's Figure 1, almost card for card:

```
U135    J41           COMPILE JDEF OF ROUTINE (0).
      60W0            OUT.(0) IS JDEF, IF EXISTS. SET H5.
90    10X22           TEST IF IT EXISTS
        J10
      70       J31    IF SO, EXIT WITH H5+
      11W0
        U136          FIND CLOSEST DEFCINITION
      70J31           IF NONE, EXIT WITH H5-
      40H0
      11W0            FIND AND APPLY
        U137          RELEVANT PROCESS
      11W0
        U136          FIND CLOSEST DEFINITION
        U138          TEST PROGRESS
      70J31           EXIT OR REPEAT.
      11W0     90
```

- **U136** ("find closest definition") checks the routine's attributes
  in a fixed order: DSCN (X20) first, then SDSC (X24). It returns the
  first one present. This matches the paper's remark that "it is
  assumed that it is easier to compile from a functional description
  than from a state description."
- **U137** ("find and apply relevant process") is a *table of
  connections* in data. X198 is a description list that maps X20 to
  U134 and X24 to U140. U137 looks up the closest definition there and
  executes whatever it finds with J1.
- **U138** ("test progress") uses X197, the ordered list (X20, X24). It
  locates the new closest definition on that list, then searches *onward
  from there* for the old one. If the old one is found further along,
  the routine has moved to a better kind of definition, so the loop goes
  round again. If not, there has been no progress, and U135 exits with
  H5−.

So the executive is not a fixed pipeline. It is a small means-end loop
whose *differences* are kinds of definition, and whose *operators* are
whole compilers.

---

## District 4: The Translator — compiling from a functional description

**U134** handles a DSCN. It searches X196, the list of routines that are
already compiled and described (X101 INSERT, X102 FIND V, X104 TESTN),
for one whose *process* is the same as the target's. If it finds one,
**U130** compiles the target from that source:

1. **U108** copies the target and all its arguments, recursing into
   determiners.
2. **U117** replaces each argument that lives in the H0 pushdown list
   (`H0`, `H1`, …) with a working cell (`W0`, `W1`, …). U119 makes
   each change, and U117 counts them. This is the paper's trick: "the compiler facilitates
   matters by incorporating in the compiled routine an algorithm that
   moves the inputs … into known working storage locations."
3. **U131** walks the source's arguments. For each H-argument it finds
   the corresponding argument of the target (U113) and compiles the code
   that fetches it (U132). A plain argument becomes `11Wn`. A determiner
   becomes its own JDEF with its own arguments fetched first: for "the
   value of attribute 0 of 2", that is `11W2 11W0 J10`. Each fetch
   sequence is put at the front of the growing JDEF.
4. **U118** wraps the result in `J5n … J3n` (preserve n working cells,
   then restore them), building the J-numbers by arithmetic on the
   integer terms N49 and N29.

> **★ DON'T MISS**
>
> U113 prints the JDEF of its routine every time it is called
> (`40H0 / U125` at U113 050-060), so a run shows the code growing one
> argument at a time. It looks like a debugging print that stayed in
> the deck, and it happens to produce exactly the sequence of stages the
> 1963 paper walks through.

---

## District 5: The Engineer — compiling from a state description

This is the most GPS-like part of the program, and the longest: U140-U169
plus X5-X7.

**Finding differences (X7, X5, X6).** X7 compares the input and output
states of each affected cell and classifies the change:

| Difference | Symbol | Test |
|------------|--------|------|
| none | X80 | — |
| copy | X84 | first symbols identical |
| replacement | X83 | same list lengths, different first symbol |
| addition | X82 | output longer |
| deletion | X81 | output shorter |

X7 looks at cells other than H0 first, then at H0. X5 and X6 compare
descriptive names: process, argument types, names, and locations.

**The table of connections (X90).** X90 is an index of relevant
operators, keyed first by type of difference and then by the kind of
affected cell:

```
X90     90       0     INDEX TO RELEVANT ROUTINES
90      0
        X82            LIST OF ADD ROUTINES
        91                -> H0 is the affected cell:      X107  P1(S), "LOAD S"
        X83            LIST OF REPLACE ROUTINES
        92       0        -> a named cell is affected:     X106  P2(C), "REPLACE (C)"
```

The two operators are tiny compiled routines with state descriptions of
their own. X107, `10 S`, adds S to the top of H0. X106, `20 C`, replaces
the top of named cell C with the top of H0. These are the paper's LOAD
and REPLACE.

**The recursion (U140).** U140 is means-end analysis:

1. Find the biggest difference (X7). If there is none, return a null
   routine.
2. **U141** produces an operator routine that removes it. U150 looks up
   the relevant routine in X90. U152-U154 match its variables against
   the actual cells and substitute names: the variable cell C becomes
   H5. U155 and U156 carry the substitutions into a copy of its JDEF.
3. **U144** builds the state description of the *prefix* problem: from
   the original input state to the operator's input state. **U140**
   compiles it recursively, and **U145** joins the result in front.
4. **U146** builds the *suffix* problem: from the operator's output to
   the desired output. It is compiled the same way and joined after it
   by **U147**.
5. U140 then names the first instruction from the IPLN (910) and
   terminates the code with U122 (920).

U142, U143, U148 and U149 do the bookkeeping on state descriptions:
erasing halves, reversing inputs and outputs, and merging two lists of
affected cells pair by pair, with U169 to delete a symbol carefully.

For J3 the run goes like this:

- The difference is a **replacement** in H5, a named cell.
- REPLACE (C) is relevant, with C set to H5. That gives `20H5`.
- The prefix problem is "get J3 on top of H0", an **addition** to H0.
- LOAD S is relevant, with S set to J3. That gives `10J3`.
- There is no suffix problem.
- Result: `J3  10J3 / 20H5  0`, as in the paper.

---

## District 6: The Draftsman — flow diagrams

The paper's last section handles routines with branches and loops by
breaking them into **segments**:

- a new segment starts at every instruction with a local name;
- a segment ends at every branch (P=7).

A segment is described just like an IPL word (name, P, symbol, link),
plus its own JDEF. The list of segments *is* the flow diagram.

- **U139** composes a flow diagram from a JDEF.
- **U133** goes the other way. Given a list of segments and a flow
  diagram, it attaches each segment's code to its node, resolves branch
  targets and links, assembles the code, and terminates it.

The data for J77, "TEST WHETHER THERE IS A SYMBOL EQUAL TO 0ACCUMULATOR
ON LIST 1ACCUMULATOR", is X180 (the segments) and X181 (the flow
diagram). T1 assembles J77 from them with U133, then decomposes the
result again with U139. The output is the paper's flow diagram:

```
J77   0       90
90    7 91    92
92    7 90    91
91    0       00
```

The paper prints the last link as `0`. This run prints the symbol 0 as
`00`, a region and a location, both zero. The J77 code that U133
assembles also matches the paper's listing of J77.

---

## District 7: The Press — printing a routine

Because code exists only as description lists, printing it is real
work:

- **U125** prints a JDEF in fixed columns:

  | Column(s) | Field |
  |-----------|-------|
  | 28 | type |
  | 30-34 | name |
  | 35 | sign |
  | 36 | P |
  | 37 | Q |
  | 38-42 | symbol |
  | 44-48 | link |

  It finds each field's value on the word's description list, and it
  prints a symbol by entering its region letter and then its location
  number.
- **U127** prints a state description as `cell. inputs, . outputs, .`.
- **U128** prints everything known about a routine: its IPL name, its
  DSCN (through U126), its JDEF, and its SDSC.
- The **E** routines are the line-printer utilities: print and clear,
  space, period, comma.

---

## District 8: The Front Office — T1

T1 is the demonstration. It works through the paper's examples in order:

```
T1     3J0              (Q=3: trace this routine)
      10A99
        J154            clear the print line
      13A0
      10930
        J100            mark routines on A0 to trace
      10X102
        U128            print FIND V((0),(1)), already compiled
      10X105
      40H0
        U135            compile J3 ...
      30H0
        U128            ... and print it
      10X100
      40H0
        U135            compile INSERT AT END OF VALUE LIST ...
      30H0
        U128            ... and print it
      10X182 ...
        U133            assemble J77 from segments X180 and flow diagram X181
        ...
        U128            print it
        U139            decompose it into a flow diagram again
        ...
        U125   0        print the flow diagram
```

---

## A Day in the Life: INSERT AT END OF VALUE LIST

The target, X100, has only a descriptive name: process X110, "INSERT
( ) AT END OF ( )", with arguments X120 = "(1)" and X121 = the
determiner "THE VALUE OF THE ATTRIBUTE (0) OF (2)". Its IPLN is J13.

1. **U135** finds no JDEF. **U136** returns DSCN. **U137** looks up DSCN
   in X198 and runs **U134**.
2. U134 scans X196 and finds **X101**, INSERT (0) AT END OF (1): same
   process X110, different arguments. Its JDEF is `J65 0`.
3. **U130** copies X100, and U117 renames its H-arguments to working
   cells.
4. **U131** goes through X101's arguments one at a time. U113 locates
   each one and prints the JDEF built so far:

   ```
                                          J65   0

                                        11W1
                                          J65   0

                                        11W2
                                        11W0
                                          J10
                                        11W1
                                          J65   0
   ```

   X101's (1) corresponds to X100's (1), which is now W1, so `11W1` is
   added. X101's (0) corresponds to the determiner, so its JDEF (`J10`)
   is added together with its own arguments, (0) and (2): `11W2 11W0
   J10`.
5. **U118** adds `J52` and `J32` (three working cells), and the routine
   gets its name:

   ```
    J13
    INSERT( )AT END OF( )

                                  J13     J52
                                        11W2
                                        11W0
                                          J10
                                        11W1
                                          J65
                                          J32   0
   ```

That is, character for character, the code in the 1963 paper:
`J13 J52 11W2 11W0 J10 11W1 J65 J32 0`.

---

## Practical Notes for the Independent Traveler

- **Read the comments.** Simon's card comments are good, and most
  routines open with a one-line specification of their inputs and
  outputs, such as `ROUT. FIND V((0),(1))`. The comments on data lists
  name each part (`DSCN`, `IPLN OF J3`, `AFFECTED CELL IS 97`).
- **Follow the X numbers.** X20-X46 are attributes, X1-X4 variables,
  X80-X84 differences, X90 the table of connections, X100-X107 the test
  routines, X110-X115 process names, X120-X126 arguments, X150-X151
  phrase fragments, X170-X176 symbol descriptions, X180-X182 J77, and
  X196-X199 lists the executive uses.
- **Local names run deep.** Data structures nest locals several levels
  deep (90 → 921 → 922 …), each with its own description list. When
  reading one, draw it.
- **Expect means-end analysis everywhere.** Most of the U140s are
  "find a difference, find a relevant operator, make a subproblem,"
  applied at different levels.

---

## Running It Today

The program runs on Jeff Shrager's Common Lisp IPL-V interpreter. This
repository keeps its current version in `../IPL-V/iplv.lisp`, which
reads IPL-V card decks directly and also runs Stefferud's 1963 Logic
Theorist (`../LogicTheorist/`). To run it:

```
./run.sh
```

`run.sh` rebuilds the deck from the transcription and runs it. The
output goes to `run/t1.txt` and `run/t1-sdsc.txt`.

- `heuristic.card` is the faithful transcription. `adapt.py` makes the
  runnable `heuristic-run.card` from it with two additions: a start card
  for T1, which the listing lacks (the 1963 listing ends with exactly
  this card, `KICKOFF 5 T1`), and **U126** (the routine that prints a
  descriptive name), which is missing from the 1961 listing and is
  taken from the 1963 listing in RAND RM-3588-PR, Appendix A.
- In the deck as listed, **J3 does not compile**. U136 prefers J3's DSCN,
  no compiled routine shares its process, and the executive stops
  without trying the state description. `heuristic-run-sdsc.card` erases
  J3's DSCN first, and then the state description compiler produces the
  paper's `10J3 20H5 0`. The 1963 listing explains why: its executive is
  identical, but there X105's DSCN cards are numbered as insertions
  (`X105 015/016`). The paper's J3 most likely came from a version in
  which X105 had only its state description, which is the state the
  experiment deck recreates. (The 1963 state description compiler also
  differs: its state descriptions hold bare symbols, `X2 X1`, where the
  1961 ones hold described symbols.)
- The same memorandum's Appendix B, an "information-annexing" program
  that stores definite-description statements ("X114 is the X33 of the
  X25 of X105") into description lists, also runs: see `annexer/`.
- Getting this far took some interpreter work: missing J-functions were
  added, and a few existing ones were corrected to match the 1964 manual.
  The details are in `seshsums/` and `../IPL-V/CHANGES_FROM_UPSTREAM.md`.

---

## Work Yet to Be Done

- **The front end.** The scanner tables (T30-T49), the sentence
  breaker (T80), dictionary lookup (T106-T108), the parser (U23-U99),
  the DEFINE handling (T102, T185-T189, T300), and U199 (which turns a
  parse into a DSCN) have not been run. They need input sentences, which
  are not in the listing, and a fuller implementation of line input.
  This is the path that would let the compiler take English
  definitions. The paper credits H. S. Kelly with linguistic components
  it leaves out, and these routines may be them.
- **The faithful run.** Explain, or reconcile, why the listed deck does
  not compile J3 while the paper shows it compiled.
- **The pencil.** Evaluate the handwritten corrections (U135, U153/U154,
  X176, and others).
- **Proofreading.** Check the transcription against the scan, especially
  the routines the demonstration never reaches.

---

## What Makes It Worth Visiting

The Heuristic Compiler is one of the first programs to treat *writing
code* as a problem to be solved instead of a translation to be
performed. FORTRAN and LISP compilers translate. This program searches.
It finds a difference, looks up a relevant operator in a table, and sets
up subproblems for what remains, exactly as GPS does for logic or the
Tower of Hanoi.

It is also a showcase for the idea that made IPL-V distinctive:
**description lists as a knowledge representation.** Routines, IPL
words, symbols, state descriptions, arguments, and phrases are all
objects with attributes. Simon wrote in the paper that this gave IPL-V
"expressive capabilities not readily available in more usual computer
command languages." Reading the X data is like reading an early frame
system written for the programmer's own domain.

And it is honest about its limits. The state description compiler knows
two operators. The functional description compiler needs a routine with
the same process already compiled. The executive gives up when its
ordering of definitions fails. The paper says plainly that no claims
are made "as practical approaches to the construction of compilers."
The interest, as Simon put it, "lies in what they teach us about the
nature of the programming task."

---

## Provenance and Sources

The source is the line-printer listing "HEURISTIC CODER 7/16/61" in the
Herbert A. Simon Papers, Box 14, FF965, Carnegie Mellon University
Archives, where it was located by Mia Golec and Emily Davis (both of
CMU) with Jeff Shrager. The scan, the per-page transcription, and the card deck are
in this directory. The listing copyright is held by CMU's Archives.

**From the code, high confidence:**

- all code excerpts and card IDs;
- the data structures;
- the control flow of T1, U135-U138, U134/U130, U140 and the routines
  it calls, U133/U139, and U125-U128.

**From running it, high confidence:**

- the outputs shown;
- the stage-by-stage printing by U113;
- the failure of the listed deck to compile J3, and the success of the
  SDSC experiment.

**From Simon (1963), high confidence as to what the paper says:**

- the three compilers;
- the J3, INSERT, and J77 examples;
- the GPS framing;
- the quotations.

**Interpretation, flagged in the text:**

- that U113's print is a leftover debugging aid (moderate);
- that the two local-symbol styles reflect patching (moderate);
- that the front end corresponds to Kelly's omitted linguistic
  components (speculative);
- that this listing is essentially the program of RAND P-2349 (moderate
  to high: same title, dates two weeks apart, and the examples match).

**Not established:** which machine the 1961 runs used, and whether
Simon's own runs printed exactly as these do.

---

## References

Newell, A. (Ed.). (1964). *Information Processing Language-V Manual* (2nd ed.). Prentice-Hall.

Newell, A., Shaw, J. C., & Simon, H. A. (1960). "Report on a General Problem-Solving Program." *Information Processing: Proceedings of the International Conference on Information Processing*, pp. 256–264. UNESCO.

Shrager, J. *IPL-V repository* (Common Lisp IPL-V interpreter and manual scan). github.com/jeffshrager/IPL-V

Shrager, J. "A Hacker's Guide to Herbert Simon's IPL-V Version of Yngve's Sentence Generator" and other Hacker's Guides.

Simon, H. A. (1961). *Experiments with a Heuristic Compiler.* The RAND Corporation, Report P-2349, June 30, 1961.

Simon, H. A. (1963). "Experiments with a Heuristic Compiler." *Journal of the ACM*, 10(4), 493–506.

Simon, H. A. (1963). *The Heuristic Compiler.* The RAND Corporation, Memorandum RM-3588-PR, May 1963. (Appendix A: program listing of the compiler; Appendix B: an information-annexing program.) Available from bitsavers.

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
