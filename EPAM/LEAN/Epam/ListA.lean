/-
EPAM, a concrete instance: List A of P-1817 §4.1.

The six nonsense syllables of Feigenbaum's serial-anticipation experiment,
KAG LUK RIL PEM ROM TIL (§4.1.1.1.1), coded letter by letter. A's code is
the one in the listing (Q1, p. 149). The other letters' codes are
reconstructed from EPAM II's own letter net U1 by `../IPL/letter_codes.py`:
each bit U1 tests on a letter's path is fixed by U1, untested bits are 0.
(This file is generated from `../IPL/letter_codes.txt`; see `gen_lista.py`.)

A syllable is its three letter codes in a row: features 0-13 are the first
letter, 14-27 the second, 28-41 the third. The noticing order is the one of
§4.1.1.1.2 and the listing's P0 = N1 N3 N2: first letter, then third, then
second, bits in order.

The theorems are computed by the Lean kernel (`decide`): they are facts about
this model with these codes, not general laws.
-/

import Epam.Discrimination

namespace Epam.ListA

open Epam Net

/-- The code for A (historical, Q1). -/
def A : Item := [true, false, false, false, true, true, false, false, false, true, false, true, true, true]
/-- The code for E (reconstructed from U1). -/
def E : Item := [true, false, false, true, false, false, false, true, false, false, false, false, false, false]
/-- The code for G (reconstructed from U1). -/
def G : Item := [false, true, true, false, true, true, false, false, false, false, false, false, false, false]
/-- The code for I (reconstructed from U1). -/
def I : Item := [true, false, false, false, false, false, true, false, false, false, false, false, false, false]
/-- The code for K (reconstructed from U1). -/
def K : Item := [true, false, false, true, false, false, false, false, false, false, false, false, false, false]
/-- The code for L (reconstructed from U1). -/
def L : Item := [true, false, false, true, true, true, false, false, false, false, false, false, false, false]
/-- The code for M (reconstructed from U1). -/
def M : Item := [true, false, false, false, true, false, true, false, false, false, false, false, false, false]
/-- The code for O (reconstructed from U1). -/
def O : Item := [false, true, false, false, false, false, false, false, false, false, false, false, false, false]
/-- The code for P (reconstructed from U1). -/
def P : Item := [false, false, false, false, true, false, false, true, false, false, false, false, false, false]
/-- The code for R (reconstructed from U1). -/
def R : Item := [false, false, false, false, true, false, false, false, false, false, false, false, false, false]
/-- The code for T (reconstructed from U1). -/
def T : Item := [true, false, false, false, true, false, false, true, false, false, false, false, false, false]
/-- The code for U (reconstructed from U1). -/
def U : Item := [false, false, true, false, false, false, false, false, false, false, false, false, false, false]

/-- A syllable: three letter codes in a row. -/
def syl (a b c : Item) : Item := a ++ b ++ c

def KAG : Item := syl K A G
def LUK : Item := syl L U K
def RIL : Item := syl R I L
def PEM : Item := syl P E M
def ROM : Item := syl R O M
def TIL : Item := syl T I L

/-- Noticing order: first letter, third letter, second letter (§4.1.1.1.2). -/
def order : NoticingOrder := List.range 14 ++ (List.range 14).map (· + 28) ++ (List.range 14).map (· + 14)

/-- The net at trial 4 of Fig. 4.1: KAG, LUK, RIL, ROM and TIL have been
through F1 (trials 1-3), PEM has not, starting from the null net U2. -/
def netTrial4 : Net := learnAll order (leaf none) [KAG, LUK, RIL, ROM, TIL]

/-- Every syllable learned so far is recognized. -/
theorem trial4_learned_recognized :
    Recognizes netTrial4 KAG ∧ Recognizes netTrial4 LUK ∧ Recognizes netTrial4 RIL ∧
      Recognizes netTrial4 ROM ∧ Recognizes netTrial4 TIL := by decide

/-- **Fig. 4.1, trial 4: "PEM is confused with ROM."** The not-yet-learned
PEM is recognized as ROM (stimulus generalization). -/
theorem trial4_PEM_confused_with_ROM : netTrial4.select PEM = some ROM := by decide

/-- Why: PEM and ROM agree on every feature the net examines along ROM's
path. -/
theorem PEM_agrees_with_ROM_on_ROMs_path :
    ∀ f ∈ netTrial4.path ROM, ROM.feat f = PEM.feat f := by decide

/-- The only difference the scan can find in the first letter is bit 8 (P vs
R); the third letters are identical (M). -/
theorem PEM_ROM_first_noticed_difference : firstDiff order PEM ROM = some 7 := by decide

/-- PEM and ROM are the most similar pair in noticing order: telling them
apart costs 8 scanning steps; KAG vs LUK, 5. -/
theorem scan_costs : scanCost order PEM ROM = 8 ∧ scanCost order KAG LUK = 5 := by decide

/-- After PEM is learned (F0(PEM, ROM), trial 5), it is recognized, and
nothing learned before is lost. -/
def netTrial5 : Net := netTrial4.learn order PEM

theorem trial5_all_recognized :
    Recognizes netTrial5 KAG ∧ Recognizes netTrial5 LUK ∧ Recognizes netTrial5 RIL ∧
      Recognizes netTrial5 PEM ∧ Recognizes netTrial5 ROM ∧ Recognizes netTrial5 TIL := by decide

end Epam.ListA
