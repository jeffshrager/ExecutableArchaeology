IBM-1620 IPL-V Interpreter -- Modification Letters 3 & 4 applied.

Contributed by Paul Kimpel (author of the retro-1620 emulator), from work
done studying the behavior of the Ackermann function test program
(../Ackermann.ipl) in this IPL-V port.

Background
----------

The interpreter in ../IPL-V-Interpreter.sps uses the TNF instruction
(Transfer Numeric Fill, op code 72) to translate BCD digit fields into
1620 two-digit alphanumeric codes (interleaving each source digit with a 7,
or a 5 if the source's high-order digit is flagged, per the old punched-
card sign convention). The 1620 Model 2 requires that the alphanumeric
field written by a TNF be at an odd address. Many of the TNF instructions
in the transcribed interpreter use an even address as their P operand (for
example, the TNF at card sequence 25670 in the original University of
Oregon listing), which causes Punch Check errors (invalid alphanumeric
codes, printed as "?") whenever IPL-V's own trace facility writes to the
card punch.

This turned out to be a known, documented defect: two update documents
found by Rupert Lane address it directly.

  Modification Letter Number 3
      https://purl.stanford.edu/bk072pk3345
  Modification Letter Number 4
      https://purl.stanford.edu/qg281jn8061

Applying both letters to the interpreter source fixes the Punch Check
errors. Letters 1 and 2 have not been located or applied, so their effects
(if any) on this program are unknown.

Files in this directory
------------------------

IPL-V-Interpreter-Mod-3-4.sps
    SPS assembler source for the interpreter with Modification Letters 3
    and 4 applied, derived from ../IPL-V-Interpreter.sps.

IPL-V-Interpreter-Mod-3-4-Listing.lst
    Assembly listing of the updated source.

IPL-V-Interpreter-Mod-3-4-Object.card
    Compressed object deck assembled from the updated source.

IPL-V-Interpreter-Mod-3-4-Object-UNCOMPRESSED.card
    Uncompressed object deck, used to generate the listing above via
    software/retro-1620-Utilities/SPS-Object-Deck-Lister-LHCode.wsf.

IPL-V-Interpreter-Mod-3-4-Deck-1.card
IPL-V-Interpreter-Mod-3-4-Deck-2.card
    The two-part load deck (assembler/loader, then interpreter), split the
    same way as ../IPL-V-Interpreter-Deck-1.card / -Deck-2.card. Use these
    in place of the originals; ../IPL-V-Subroutines.card is unchanged and
    should still be used from its original location.

Ackermann-TEST.ipl
    A smaller regression case identical to ../Ackermann.ipl except that the
    M0/N0 region constants are set to 1 and 1 (rather than 3 and 3), used
    to study the Ackermann(1,1) failure without the "hoary recursion" of the
    full A(3,3) case.

Ackermann-TEST-Fixed.ipl
    Identical to Ackermann-TEST.ipl except its K1/M0/N0 CONSTANT/VALUE
    cards' single-digit values are right-justified in their 5-digit LINK
    field (column 60, not 56) -- see the "RESOLVED (2026-09-12)" note
    below. With this fix, A(1,1) computes correctly as 3 and halts
    cleanly.

IPL-V-Punch-Trace-Ack-1-0-20260823.txt
IPL-V-Punch-Trace-Ack-1-1-20260823.txt
    IPL-V's own trace output (not the emulator's instruction trace),
    captured via the 1620 control panel's four Program Switches all set on,
    for Ackermann(1,0) (succeeds, ends with result 2) and Ackermann(1,1)
    (fails -- terminated after it was clearly running away).

Ackermann-1-0-vs-1-1-Trace-20260823.pdf
    A side-by-side comparison of the two traces above.

Status
------

Confirmed independently (2026-09-10) using a new headless CLI harness for
the emulator (tools/cli/run1620.mjs, see the repo root): running
../IPL-V-Interpreter-Deck-1.card/-Deck-2.card (the un-patched decks) with
Ackermann(3,3) and all four Program Switches on reproduces the Punch Check
"?" garbage Paul describes above verbatim. Running the Mod-3-4 decks in
this directory with Ackermann-TEST.ipl (m=1,n=1) and all four switches on
reproduces his IPL-V-Punch-Trace-Ack-1-1-20260823.txt output exactly
(diffed byte-for-byte, aside from a header line), and the m=1,n=0 case
reproduces IPL-V-Punch-Trace-Ack-1-0-20260823.txt exactly as well. So: the
Mod-3-4 patch fixes the Punch Check errors, and does NOT fix the underlying
n>0 problem -- both confirmed exactly as Paul found.

The underlying problem itself is still open. Ackermann(m,n) fails to
complete for any n>0, eventually printing "TRAPPED ON H2" repeatedly.

Per Newell, Tonge, et al., "Information Processing Language-V, Second
Edition" (RAND/Prentice-Hall, 1964) -- a scan of which is available
alongside this repo, though not itself committed here for size/copyright
reasons -- H2 is IPL-V's available-space list: all memory cells not
currently part of any list or routine are linked together on H2, and any
process needing a new cell gets it from there; "TRAPPED ON H2" is what
happens when that request finds the list exhausted. J111/J117/J125/J152
(the primitives Ackermann.ipl calls directly) correspond to 1620-specific
routine numbers assigned in ../IPL-V-Interpreter.sps -- they are not
documented in the general RAND manual, which describes the language's
primitives independent of any particular machine's routine-numbering. Their
1620 assembly (search for JJ111/JJ117/JJ125/JJ152 in
IPL-V-Interpreter-Mod-3-4.sps) shows J125 as an increment-and-pushdown
primitive and J111 as the decrement counterpart, both built on a PSHDN
(push-down) primitive and GET1/GET3 (cell-fetch) primitives with BADIND/
BADSET error paths -- consistent with the manual's pushdown-list
description, but tracing the exact fault through PSHDN/GET1/GET3 has not
been done yet.

An earlier version of this note claimed a specific trace column showed
region K1 (which should hold constant 1) instead reading back as 10000.
That specific column-level claim was a misreading of the trace format
(that column is the raw content of whatever cell H0 currently points to,
not literally "K1's value" -- the same ~10000-ish figure shows up in the
same position in the successful Ackermann(1,0) trace too, since K1 is
legitimately what's on top of the pushdown stack at that point in BOTH
cases). But going back through it with instruction-level tracing (using
tools/cli/run1620.mjs's --trace flag, gated with the new --trace-delay/
--trace-after options to skip past the very long non-interesting load and
system-initialization phase -- a full instruction trace of that phase
alone runs tens of millions of lines) found something concrete:

Using Ackermann-TEST.ipl (m=1,n=1), the moment M0's displayed value first
goes wrong (monitor-trace "COMPUTE A(M-1,1) OR A(M-1,A(M,N-1))" step,
address 19211, on its second visit) is directly preceded, every single
time this code re-executes on each recursion level, by this exact
instruction pair (relocated runtime addresses -- these do NOT match
IPL-V-Interpreter-Mod-3-4-Listing.lst's static addresses, since Deck-2's
primitives are relocated at load time):

    <TRACE> 07538 22 07181 07169: S  22 07181 07169  P=]00000999R  Q=]000010000
    <TRACE> 07562 26 1788O 07181: TF 26 18587 07181  *P=]1000000999R  Q=]1000000999R

07169 holds K1's raw memory word (confirmed a few instructions earlier,
"TF D6,H0-5,11" at listing-matching address 06244, reading H0 -- which
points at K1 immediately after "INPUT 1" pushes it -- into scratch D6,
content "010000010000", which is K1's original assembled word verbatim).
18587 is region M0's address per Ackermann-TEST.ipl's own DEFINE REGIONS
listing. So this subtracts something (P, a value that increments by
exactly 1 on every recursion level -- ...999R, 999Q, 001999Q, 002999Q...,
tracking recursion depth) from a fixed field of K1's word that happens to
read as 10000 (Q, identical on every single one of dozens of iterations
observed), and stores the result directly into M0's cell. That's exactly
the mechanism producing the M/N corruption seen in the monitor trace
(-9999, -19998, -29998, ... draining toward eventual H2 exhaustion).

What's NOT yet certain: whether reading a 5-digit-wide field of K1's word
(getting 10000) where a 1-digit field (getting 1) was intended is itself
the bug, whether writing this particular result into M0 at all is
correct-but-misapplied logic from some OTHER primitive (not really "about"
K1 or M0, just operating on whatever's currently referenced), or whether
this is a real, if convoluted, part of the intended pushdown/GET3
mechanism and the actual bug is one step further back or forward from
this pair. Untangling that needs either the RAND manual's account of the
internal P/Q/SYMB/LINK word layout applied precisely to this instruction
pair, or Beyer's own (currently undiscovered) comments on GET1/GET3/PSHDN,
neither of which has been done yet -- but the search space is now this one
specific instruction pair, not "somewhere in recursion."

One genuine emulator bug was found and fixed in the process: enabling
processor.tracing before the very first LOAD/INSERT crashed
(Processor.enterICycle() called tracePOperand() before opThisAtts was ever
set, since insert() synthesizes the initial RN directly rather than going
through normal instruction decode). Fixed in emulator/Processor.js.

RESOLVED (2026-09-12): the "not yet certain" question two paragraphs above
-- whether reading a 5-digit-wide field of K1's word (getting 10000) where
a 1-digit field (getting 1) was intended is itself the bug -- is yes,
confirmed directly. A separate, unrelated line of investigation (building
a series of small `simple*.ipl` test programs from scratch, see
../simple/log.md and ../../seshsums/20260911b_seshsum.md) independently
discovered that IPL-V's data-card LINK field is a fixed 5-digit field
(`LINK DS 5` in IPL-V-Interpreter-Mod-3-4.sps) that must be
right-justified: a single-digit constant belongs in the field's last
column (60), not its first (56). Every hand-punched `simple*.ipl` test
written before that discovery had left-justified its constants, inflating
every value by 10000x -- exactly the "K1 reads back as 10000" signature
described above.

Ackermann-TEST.ipl's own CONSTANT/VALUE cards (K1=1, M0, N0) have this
same left-justification error (value digit at column 56 instead of 60).
Ackermann-TEST-Fixed.ipl and Ackermann-Fixed.ipl (new, alongside
Ackermann-TEST.ipl and ../Ackermann.ipl respectively in this and the
parent directory) are byte-identical to the originals except that these
three value digits are moved to column 60. Confirmed: Ackermann-TEST-Fixed.ipl
(m=1,n=1) now halts cleanly and prints the correct result, 3. Even more
significantly, Ackermann-Fixed.ipl (m=3,n=3, the original full test case)
also halts cleanly and prints 61 -- the mathematically correct value of
A(3,3). This fully resolves the "n>0 always fails" problem that motivated
this entire directory's investigation: it was never a pushdown/list-space
bug in the interpreter (H2 exhaustion, PSHDN/GET1/GET3, etc., all as
originally suspected) -- it was a hand-transcription error in
Ackermann.ipl's own source card columns, the same class of bug (and same
fix) independently found via the unrelated simple*.ipl test series. The
PSHDN/GET1/GET3 internals implicated above were never actually broken;
they were faithfully computing with a corrupted input value.

(A different, still-open interpreter bug -- a hard check-stop in the
COLSYM/RESBLK list-cell-allocation machinery, unrelated to this one -- was
found via the same simple*.ipl series; see ../simple/log.md's
simple10.ipl entry and traces/ in the repo root for that investigation.)
