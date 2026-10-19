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

open Epam ListA

def k : Nat := 3

/-- The list, in presentation order. -/
def syl : List Item := [KAG, LUK, RIL, PEM, ROM, TIL]

/-- The learning schedule of Fig. 4.1: (trial, row, event). -/
def schedule : List (Nat × Nat × Event) :=
  [ (1, 1, .f1 KAG), (1, 2, .f1 LUK), (1, 5, .f2 KAG LUK)       -- F0(KAG, LUK), p. 90
  , (2, 2, .f1 LUK), (2, 5, .f1 RIL), (2, 6, .f2 LUK RIL)       -- F0(LUK, RIL), p. 91
  , (3, 6, .f1 ROM), (4, 1, .f1 TIL), (4, 3, .f2 ROM TIL)       -- F0(ROM, TIL), p. 92
  , (4, 5, .f1 PEM), (5, 0, .f2 LUK RIL)                        -- F0(PEM, ROM); D8 (note 10)
  , (5, 2, .f1 ROM), (5, 5, .f2 PEM ROM)                        -- p. 94
  , (6, 5, .f1 RIL), (7, 0, .f1 PEM), (7, 1, .f2 RIL PEM) ]     -- F0(RIL, PEM), p. 95

/-- The learner as it is when syllable `r` of trial `t` is presented. -/
def stateAt (t r : Nat) : Learner :=
  (schedule.filter (fun e => e.1 < t || (e.1 == t && e.2.1 ≤ r))).foldl
    (fun L e => L.apply order k e.2.2) ⟨Net.leaf none, []⟩

/-- Every response the model can make to syllable `r` on trial `t`. -/
def responsesAt (t r : Nat) : List (Option Item) :=
  (stateAt t r).responses (syl.getD r [])

/-- Fig. 4.1's recorded responses: (trial, row, response), `none` = "none*".
TIL (row 5) is never responded to. Trial 5's LUK row is missing from the
printed table (p. 94). -/
def fig : List (Nat × Nat × Option Item) :=
  [ (1, 0, none), (1, 1, none), (1, 2, none), (1, 3, none), (1, 4, none)
  , (2, 0, some LUK), (2, 1, none), (2, 2, none), (2, 3, none), (2, 4, none)
  , (3, 0, some LUK), (3, 1, some RIL), (3, 2, none), (3, 3, none), (3, 4, none)
  , (4, 0, some LUK), (4, 1, none), (4, 2, none), (4, 3, some TIL), (4, 4, some TIL)
  , (5, 0, some LUK), (5, 2, none), (5, 3, none), (5, 4, some TIL)
  , (6, 0, none), (6, 1, some RIL), (6, 2, none), (6, 3, some ROM), (6, 4, some TIL)
  , (7, 0, some LUK), (7, 1, some RIL), (7, 2, some PEM), (7, 3, some ROM), (7, 4, some TIL) ]

/-- Is the figure's response possible under the model? -/
def agrees (e : Nat × Nat × Option Item) : Bool := (responsesAt e.1 e.2.1).contains e.2.2

/-- **33 of the figure's 34 responses are possible under the postulates.** -/
theorem fig41_agreement : (fig.filter agrees).length = 33 ∧ fig.length = 34 := by decide

/-- The one disagreement: trial 6, KAG. The figure has "none*" (note 12: the
KAG-LUK cue was "precarious"); here KAG can only give LUK. Feigenbaum's
idealized codes put TIL under LUK's terminal, which made KAG's cue for LUK
insufficient. With the codes reconstructed from U1, TIL is discriminated
under RIL instead, so KAG's cue stays sufficient. -/
theorem fig41_disagreement :
    fig.filter (fun e => !agrees e) = [(6, 0, none)] ∧ responsesAt 6 0 = [some LUK] := by decide

/-- **Note 7, trial 4: "PEM is confused with ROM and response to ROM is
made."** The only possible response to PEM is TIL, ROM's response. -/
theorem trial4_PEM_gives_ROMs_response : responsesAt 4 3 = [some TIL] := by decide

/-- **Note 6, trial 4: an insufficient cue.** The net has grown under RIL
since the LUK-RIL link was formed, so LUK's cue can now reach RIL, ROM or TIL,
or a null image: the response oscillates. -/
theorem trial4_LUK_cue_insufficient :
    (responsesAt 4 1).contains (some RIL) ∧ (responsesAt 4 1).contains none ∧
      (responsesAt 4 1).contains (some ROM) := by decide

/-- **Note 10: the link is re-established** (D8), and LUK gives RIL from then
on. -/
theorem LUK_restored : responsesAt 5 1 = [some RIL] ∧ responsesAt 6 1 = [some RIL] ∧
    responsesAt 7 1 = [some RIL] := by decide

/-- **Criterion on trial 7: one perfect run-through.** Every response is
correct, and no other response is possible. -/
theorem trial7_criterion :
    responsesAt 7 0 = [some LUK] ∧ responsesAt 7 1 = [some RIL] ∧
      responsesAt 7 2 = [some PEM] ∧ responsesAt 7 3 = [some ROM] ∧
      responsesAt 7 4 = [some TIL] := by decide

/-- ...and not before: trial 6 has errors that are certain (RIL, which has no
link yet, and is answered "none"). -/
theorem trial6_not_criterion : responsesAt 6 2 = [none] := by decide

end Epam.Fig41
