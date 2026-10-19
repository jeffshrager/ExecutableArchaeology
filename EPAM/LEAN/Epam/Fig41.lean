/-
P-1817 Fig. 4.1 (pp. 90-96): serial anticipation of List A, checked.

Feigenbaum's hand simulation gives, for each of 7 trials, the response EPAM
made to each syllable, and alongside it the internal processing: which F0
cycle ran, and when each of its F1 and F2 steps took place. Here:

* the *learning schedule* (when each F1, F2 and the D8 of note 10 happens) is
  transcribed from the figure. That is macroprocess and timing, which the
  postulates leave to the experimenter;
* the *responses* are computed from the postulates (`Experiment.lean`) with
  List A's codes (`ListA.lean`), P2 = 3 and the 1-3-2 noticing order;
* the kernel checks (`decide`) each of the figure's 34 recorded responses
  against the set of responses the model makes possible at that point.

Result: 33 of 34 agree, including the trial-4 confusion of PEM with ROM
(forced), the trial-4 failure of the LUK-RIL link through an insufficient cue
(possible), and the criterion on trial 7 (forced). The one disagreement, KAG
on trial 6, depends on the letter codes (see `fig41_disagreement`).

Event timing convention: an event printed beside the row for syllable `r` of
trial `t` takes effect for that row's response (F2(ROM, TIL) is printed on
PEM's row of trial 4, and PEM's response, TIL, uses it). Rows are 0-5 for
KAG ... TIL; row 6 means "after the trial".
-/

import Epam.Experiment
import Epam.ListA

namespace Epam.Fig41

open Epam

def k : Nat := 3

/-- List A's six syllables, under some letter codes. -/
structure SylSet where
  KAG : Item
  LUK : Item
  RIL : Item
  PEM : Item
  ROM : Item
  TIL : Item

namespace SylSet

/-- The list, in presentation order. -/
def syl (S : SylSet) : List Item := [S.KAG, S.LUK, S.RIL, S.PEM, S.ROM, S.TIL]

/-- The learning schedule of Fig. 4.1: (trial, row, event). -/
def schedule (S : SylSet) : List (Nat × Nat × Event) :=
  [ (1, 1, .f1 S.KAG), (1, 2, .f1 S.LUK), (1, 5, .f2 S.KAG S.LUK)     -- F0(KAG, LUK), p. 90
  , (2, 2, .f1 S.LUK), (2, 5, .f1 S.RIL), (2, 6, .f2 S.LUK S.RIL)     -- F0(LUK, RIL), p. 91
  , (3, 6, .f1 S.ROM), (4, 1, .f1 S.TIL), (4, 3, .f2 S.ROM S.TIL)     -- F0(ROM, TIL), p. 92
  , (4, 5, .f1 S.PEM), (5, 0, .f2 S.LUK S.RIL)                        -- F0(PEM, ROM); D8 (note 10)
  , (5, 2, .f1 S.ROM), (5, 5, .f2 S.PEM S.ROM)                        -- p. 94
  , (6, 5, .f1 S.RIL), (7, 0, .f1 S.PEM), (7, 1, .f2 S.RIL S.PEM) ]   -- F0(RIL, PEM), p. 95

/-- The learner as it is when syllable `r` of trial `t` is presented. -/
def stateAt (S : SylSet) (t r : Nat) : Learner :=
  (S.schedule.filter (fun e => e.1 < t || (e.1 == t && e.2.1 ≤ r))).foldl
    (fun L e => L.apply ListA.order k e.2.2) ⟨Net.leaf none, []⟩

/-- Every response the model can make to syllable `r` on trial `t`. -/
def responsesAt (S : SylSet) (t r : Nat) : List (Option Item) :=
  (S.stateAt t r).responses (S.syl.getD r [])

/-- Fig. 4.1's recorded responses: (trial, row, response), `none` = "none*".
TIL (row 5) is never responded to. Trial 5's LUK row is missing from the
printed table (p. 94). -/
def fig (S : SylSet) : List (Nat × Nat × Option Item) :=
  [ (1, 0, none), (1, 1, none), (1, 2, none), (1, 3, none), (1, 4, none)
  , (2, 0, some S.LUK), (2, 1, none), (2, 2, none), (2, 3, none), (2, 4, none)
  , (3, 0, some S.LUK), (3, 1, some S.RIL), (3, 2, none), (3, 3, none), (3, 4, none)
  , (4, 0, some S.LUK), (4, 1, none), (4, 2, none), (4, 3, some S.TIL), (4, 4, some S.TIL)
  , (5, 0, some S.LUK), (5, 2, none), (5, 3, none), (5, 4, some S.TIL)
  , (6, 0, none), (6, 1, some S.RIL), (6, 2, none), (6, 3, some S.ROM), (6, 4, some S.TIL)
  , (7, 0, some S.LUK), (7, 1, some S.RIL), (7, 2, some S.PEM), (7, 3, some S.ROM),
    (7, 4, some S.TIL) ]

/-- Is the figure's response possible under the model? -/
def agrees (S : SylSet) (e : Nat × Nat × Option Item) : Bool :=
  (S.responsesAt e.1 e.2.1).contains e.2.2

end SylSet

/-- List A under the letter codes reconstructed from U1 (untested bits 0). -/
def recon : SylSet := ⟨ListA.KAG, ListA.LUK, ListA.RIL, ListA.PEM, ListA.ROM, ListA.TIL⟩

open SylSet

/-- **33 of the figure's 34 responses are possible under the postulates.** -/
theorem fig41_agreement : ((fig recon).filter (agrees recon)).length = 33 ∧
    (fig recon).length = 34 := by decide

/-- The one disagreement: trial 6, KAG. The figure has "none*" (note 12: the
KAG-LUK cue was "precarious"); here KAG can only give LUK. Feigenbaum's
idealized codes put TIL under LUK's terminal, which made KAG's cue for LUK
insufficient. With the codes reconstructed from U1, TIL is discriminated
under RIL instead, so KAG's cue stays sufficient. (Other codes consistent with
U1 do reproduce it: see `Fig41Alt.lean`.) -/
theorem fig41_disagreement :
    (fig recon).filter (fun e => !agrees recon e) = [(6, 0, none)] ∧
      responsesAt recon 6 0 = [some recon.LUK] := by decide

/-- **Note 7, trial 4: "PEM is confused with ROM and response to ROM is
made."** The only possible response to PEM is TIL, ROM's response. -/
theorem trial4_PEM_gives_ROMs_response : responsesAt recon 4 3 = [some recon.TIL] := by decide

/-- **Note 6, trial 4: an insufficient cue.** The net has grown under RIL
since the LUK-RIL link was formed, so LUK's cue can now reach RIL, ROM or a
null image: the response oscillates. -/
theorem trial4_LUK_cue_insufficient :
    (responsesAt recon 4 1).contains (some recon.RIL) ∧ (responsesAt recon 4 1).contains none ∧
      (responsesAt recon 4 1).contains (some recon.ROM) := by decide

/-- **Note 10: the link is re-established** (D8), and LUK gives RIL from then
on. -/
theorem LUK_restored : responsesAt recon 5 1 = [some recon.RIL] ∧
    responsesAt recon 6 1 = [some recon.RIL] ∧ responsesAt recon 7 1 = [some recon.RIL] := by decide

/-- **Criterion on trial 7: one perfect run-through.** Every response is
correct, and no other response is possible. -/
theorem trial7_criterion :
    responsesAt recon 7 0 = [some recon.LUK] ∧ responsesAt recon 7 1 = [some recon.RIL] ∧
      responsesAt recon 7 2 = [some recon.PEM] ∧ responsesAt recon 7 3 = [some recon.ROM] ∧
      responsesAt recon 7 4 = [some recon.TIL] := by decide

/-- ...and not before: on trial 6, RIL (which has no link yet) can only be
answered "none". -/
theorem trial6_not_criterion : responsesAt recon 6 2 = [none] := by decide

end Epam.Fig41
