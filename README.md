# Executable Archaeology

**Executable archaeology** is the study of historical computational
systems by reconstructing and running their original programs.

Historical software is usually studied through papers, manuals,
source listings, recollections, and surviving output. But a program
is also an executable artifact. Reanimating it can reveal details
that are difficult or impossible to recover by reading alone:
undocumented semantics, transcription errors, bugs, implementation
assumptions, and distinctions between what a historical system was
said to do and what the surviving program actually does.

The point is not simply to rewrite an old algorithm in a modern
language. Wherever possible, executable archaeology attempts to
recover the historical computational object itself: transcribing the
original source, reconstructing or emulating the machine or language
environment it expected, documenting necessary repairs, and then
experimenting with the resulting running system.

This repository collects projects and materials developed in that
spirit.

## Simon–Yngve Sentence Generator

In 1959–61, MIT linguist **Victor Yngve** developed a program for the
random generation of English sentences from a phrase-structure
grammar. Yngve's original program was written in COMIT.

The material here concerns a remarkable 1962 **IPL-V
reimplementation** of Yngve's sentence generator. The surviving
listing is headed

> COPY OF YNGVES SENTENCE GENERATOR

and

> GENERATIVE GRAMMAR - KES AND HAS

and was run on 25 June 1962 under Herbert A. Simon's account. `HAS`
is Herbert A. Simon; `KES` has been identified as his daughter
Katherine Simon.

The surviving printout contains the program, its grammar encoded as
IPL-V data, execution traces, and handwritten corrections. It
therefore preserves not only a historical program but evidence of the
process by which that program was being adapted and debugged.

It lives in two directories:

### `SimonYngveSentenceGenerator/`: the scan, the transcription, and the 1620

* the archival scan of the surviving program listing;
* `ysimon.card`, a faithful transcription as an IPL-V card deck;
* `ysimon-fixed.card` and `ysimon-fast.card`, adapted to run on
  W. T. Beyer's 1963 IBM 1620 IPL-V interpreter under Paul Kimpel's
  retro-1620 emulator (scripts and output in `retro1620/`; the
  emulator is `HeadlessIBM1620IPL-V/`); and
* `Yngve_guide.md`, a detailed guide to the program, grammar,
  IPL-V representation, execution, and reconstruction.

### `SimonYngve2/`: the same program on the Lisp IPL-V

* `ysimon.card` runs **unmodified** on the Lisp interpreter in
  `IPL-V/`, with Simon's own trace and line printer. With the 1962
  seed it produces the same twenty sentences as the 1620, by the same
  derivations, random draw for random draw.
* `ysimon-clean.card` is a new version with no trace and a printer
  rewritten in IPL, which prints finished sentences:
  `WHEN HE IS PROUD OF BLACK WHISTLES, STEAM, SMALL AND BIG AND OILED
  WHEELS, HE IS HEATED.`
* `run.sh` runs either deck (`./run.sh`, `./run.sh clean`), with a
  choice of seed and sentence count.

The guide (either copy; the one in `SimonYngve2/` describes running
on the Lisp IPL-V) is the best place to begin.

## Also in this repository

* **`HeuristicCoder/`**: Herbert Simon's Heuristic Coder (IPL-V listing
  of 7/16/61), transcribed and running again after 65 years, plus the
  information-annexing program from RAND RM-3588-PR (1963). Start with
  `HeuristicCoder_guide.md`.
* **`LogicTheorist/`**: Einar Stefferud's 1963 IPL-V Logic Theorist
  (David Moews's deck), running unmodified and reproducing the 1963
  output for all 24 theorems. Start with `LT_guide.md`.
* **`IPL-V/`**: the Common Lisp IPL-V interpreter that runs all three
  programs (the Heuristic Coder, the Logic Theorist and the Simon–Yngve
  generator), with the 1964 IPL-V manual. `CHANGES_FROM_UPSTREAM.md`
  lists every change to the interpreter and the programs it was checked
  against.
* **`HeadlessIBM1620IPL-V/`**: W. T. Beyer's 1963 IBM 1620 IPL-V
  interpreter on Paul Kimpel's retro-1620 emulator, run headless from
  Node.js (`run-ipl.sh my.card`). It is the minimal part of the
  retro-1620 fork needed to test IPL-V decks on a genuine 1960s
  implementation, and it runs the 1620 Yngve decks.
* **`seshsums/`** (and `HeuristicCoder/seshsums/`): working session
  summaries, a running log of how the reconstructions were done.

## Other examples of executable archaeology

The projects below are closely related, but their source code and
reanimations live in separate repositories.

### Logic Theorist

The **Logic Theorist (LT)** was created by Allen Newell, J. C. Shaw,
and Herbert Simon in 1955–56 and is among the earliest artificial
intelligence programs. It co-evolved with the Information Processing
Languages (IPL), the list-processing languages developed by the same
group.

The executable-archaeology work on LT has reconstructed two
historically distinct versions:

* **LT1**, the 1956 Logic Language / IPL-I program originally executed
  by hand;
* **LT5**, Einar Stefferud's 1963 IPL-V version.

The later reconstruction work includes both modern interpreters for
the historical IPL machines and execution of the transcribed original
programs. Among other things, this work exposed undocumented machine
semantics, errors in surviving source listings, and differences
between the early and later versions of LT.

Repositories:

* **LT1 / IPL-I reconstruction and proof tools:**  
  https://github.com/dmoews/logic-theorist

* **LT5 / Python IPL-V reconstruction and IBM 7094 instructions:**  
  https://github.com/dmoews/ipl-v-logic-theorist

* **Common Lisp IPL-V interpreter and LT5 running on it:** now in this
  repository, `IPL-V/` and `LogicTheorist/`. The earlier repository,
  https://github.com/jeffshrager/IPL-V, is archived.

Background:

* Jeff Shrager, **"Executable Archaeology: Reanimating the Logic
  Theorist from its IPL-V Source"** (2026):  
  https://arxiv.org/abs/2603.13514

The subsequent work by David Moews and Jeff Shrager extends this to
the 1956 IPL-I version as well as the later IPL-V version, making it
possible to compare executable forms from opposite ends of LT's early
development.

### ELIZA

A related reconstruction restored **Joseph Weizenbaum's original
ELIZA** to operation on a reconstructed CTSS environment running on an
emulated IBM 7094. This is an especially literal form of executable
archaeology: rather than porting ELIZA to a contemporary language,
the project reconstructed the historical software stack on which the
original program ran.

See:

Rupert Lane, Anthony Hay, Arthur Schwarz, David M. Berry, and Jeff
Shrager, **"ELIZA Reanimated: Restoring the Mother of All Chatbots to
One of the World's First Time-Sharing Systems,"** *IEEE Annals of the
History of Computing* 47(2), 2025.

https://www.computer.org/csdl/magazine/an/2025/02/11030922/27sQDLuL7Uc

## Why run old code?

Reanimation changes the kinds of historical questions that can be
asked.

Running a historical program can reveal behavior that was omitted
from its documentation; force ambiguities in a specification to be
resolved; expose bugs and inconsistencies in published listings; and
make claims about historical systems experimentally checkable.

It also preserves something that a modern reimplementation does not.
A contemporary rewrite may reproduce the *algorithm*, but an
emulator or reconstructed interpreter can allow the surviving
historical source itself to execute. That makes the program, its
language, and aspects of its original computational environment
available as experimental historical objects.

In this sense executable archaeology sits somewhere between software
preservation, experimental history, and reverse engineering.

## Principles

The projects collected or referenced here generally try to:

1. start from primary source code or machine-readable historical
   artifacts whenever possible;
2. preserve the original program rather than silently modernizing it;
3. reconstruct the computational environment required to execute it;
4. document transcription decisions, repairs, and departures from the
   surviving artifact;
5. distinguish original behavior from behavior introduced by the
   reconstruction; and
6. make the resulting system available for further historical
   experiments.

The objective is not merely to make old programs run again. It is to
use running programs as evidence about the history of computing,
artificial intelligence, programming languages, and cognitive
science.