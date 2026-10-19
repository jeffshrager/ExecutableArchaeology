/-
EPAM, the association postulates (F2, R, D8).

P-1817 §2.4:
"F2: Stimulus-Response Association Learning Process. Two items, X (the
Stimulus) and Y (the Response), are linked together in a stimulus-response
relationship by storing with the image of X a cue code for Y; i.e., enough of
the code for Y, so that D2 can use this cue code to select the image of Y. The
quantity of information in the cue code is determined by trial and error."

"R: Responder. If stimulus item X is presented, and the response to X is to be
selected, apply D2 to X, obtain cue code from image of X, apply D2 to cue
code, obtaining image of response Y."

"D8: Restoration of S-R Link. When a link was previously successfully formed,
and a response failure occurs, the D8 process will add information to the
cue code, sufficient to re-establish the link."

And §3.5.1.2: when a test cannot find the information it needs, it "set[s]
H5 randomly". So sorting a cue, which knows only some features, is
nondeterministic where the cue is silent.

Results:
* `cue_from_path_selects`: a cue holding exactly the features on the
  response's path selects the response, and nothing else (F2 is sufficient).
* `oscillation`: a cue that was enough when it was formed can stop being
  enough after the net grows. The same stimulus can then call up a wrong
  response, or still the right one: the response oscillates.
* `restoration`: adding the features of the response's new path to the cue
  (D8) re-establishes the link.
* `retroactive_inhibition`: learning new material (which grows the net) can
  undo correct responses to old material, by the same mechanism.
-/

import Epam.Discrimination

namespace Epam

/-- A cue code: partial information about a stimulus. `none` = unknown. -/
abbrev Cue := Feature → Option Bool

/-- F2: the cue for `y` that records only the features in `fs`. -/
def cueOf (y : Item) (fs : List Feature) : Cue :=
  fun f => if f ∈ fs then some (y.feat f) else none

namespace Net

/-- D2 applied to a cue code. Where the cue is silent, either branch may be
taken. -/
inductive CueSelects : Net → Cue → Option Item → Prop
  | leaf (img : Option Item) (c : Cue) : CueSelects (leaf img) c img
  | known {f : Feature} {n0 n1 : Net} {c : Cue} {r : Option Item} (b : Bool)
      (hb : c f = some b) (h : CueSelects (if b then n1 else n0) c r) :
      CueSelects (test f n0 n1) c r
  | guess0 {f : Feature} {n0 n1 : Net} {c : Cue} {r : Option Item}
      (hb : c f = none) (h : CueSelects n0 c r) : CueSelects (test f n0 n1) c r
  | guess1 {f : Feature} {n0 n1 : Net} {c : Cue} {r : Option Item}
      (hb : c f = none) (h : CueSelects n1 c r) : CueSelects (test f n0 n1) c r

/-- A cue that agrees with `y` on every feature of `y`'s path selects `y`'s
terminal, and only that one. -/
theorem cue_agreeing_on_path (N : Net) (y : Item) (c : Cue)
    (hc : ∀ f ∈ N.path y, c f = some (y.feat f)) :
    CueSelects N c (N.select y) ∧ ∀ r, CueSelects N c r → r = N.select y := by
  induction N with
  | leaf img =>
    refine ⟨CueSelects.leaf img c, ?_⟩
    intro r hr
    cases hr; rfl
  | test f n0 n1 ih0 ih1 =>
    have hf : c f = some (y.feat f) := hc f (by simp [path])
    cases hy : y.feat f with
    | true =>
      have hc1 : ∀ g ∈ n1.path y, c g = some (y.feat g) :=
        fun g hg => hc g (by simp [path, hy, hg])
      obtain ⟨hs, hu⟩ := ih1 hc1
      refine ⟨?_, ?_⟩
      · have : (test f n0 n1).select y = n1.select y := by simp [select, hy]
        rw [this]
        exact CueSelects.known true (by rw [hf, hy]) (by simpa using hs)
      · intro r hr
        have : (test f n0 n1).select y = n1.select y := by simp [select, hy]
        rw [this]
        cases hr with
        | known b hb h =>
          rw [hf, hy] at hb
          cases hb
          exact hu r (by simpa using h)
        | guess0 hb _ => rw [hf] at hb; cases hb
        | guess1 hb _ => rw [hf] at hb; cases hb
    | false =>
      have hc0 : ∀ g ∈ n0.path y, c g = some (y.feat g) :=
        fun g hg => hc g (by simp [path, hy, hg])
      obtain ⟨hs, hu⟩ := ih0 hc0
      refine ⟨?_, ?_⟩
      · have : (test f n0 n1).select y = n0.select y := by simp [select, hy]
        rw [this]
        exact CueSelects.known false (by rw [hf, hy]) (by simpa using hs)
      · intro r hr
        have : (test f n0 n1).select y = n0.select y := by simp [select, hy]
        rw [this]
        cases hr with
        | known b hb h =>
          rw [hf, hy] at hb
          cases hb
          exact hu r (by simpa using h)
        | guess0 hb _ => rw [hf] at hb; cases hb
        | guess1 hb _ => rw [hf] at hb; cases hb

/-- **F2 is sufficient.** The cue made of exactly the features on the
response's path selects the response's image, and nothing else. -/
theorem cue_from_path_selects (N : Net) (y : Item) :
    CueSelects N (cueOf y (N.path y)) (N.select y) ∧
      ∀ r, CueSelects N (cueOf y (N.path y)) r → r = N.select y :=
  cue_agreeing_on_path N y _ (fun f hf => by simp [cueOf, hf])

/-- **Oscillation.** Suppose `y` is the only image stored (net = one
terminal), so the link to `y` needs no information at all: the empty cue
selects `y`. Now another stimulus `w`, noticeably different, is learned. The
net grows a test, and the very same cue can now select `w`, a wrong
response, or still `y`. -/
theorem oscillation (order : NoticingOrder) (y w : Item) (f : Feature)
    (hyw : y ≠ w) (hf : firstDiff order w y = some f) :
    let before := leaf (some y)
    let after := before.learn order w
    let cue := cueOf y []
    CueSelects before cue (some y) ∧
      CueSelects after cue (some w) ∧ CueSelects after cue (some y) := by
  intro before after cue
  have hnone : ∀ g, cue g = none := fun g => by simp [cue, cueOf]
  refine ⟨CueSelects.leaf _ _, ?_, ?_⟩
  all_goals
    simp only [after, before, learn, hyw, ite_false, hf]
    cases hw : w.feat f
  · exact CueSelects.guess0 (hnone f) (CueSelects.leaf _ _)
  · exact CueSelects.guess1 (hnone f) (CueSelects.leaf _ _)
  · exact CueSelects.guess1 (hnone f) (CueSelects.leaf _ _)
  · exact CueSelects.guess0 (hnone f) (CueSelects.leaf _ _)

/-- **D8, restoration.** After the net has grown, rebuilding the cue from the
response's new path re-establishes the link: the cue selects the response,
and nothing else. -/
theorem restoration (N : Net) (y : Item) (hy : Recognizes N y) :
    CueSelects N (cueOf y (N.path y)) (some y) ∧
      ∀ r, CueSelects N (cueOf y (N.path y)) r → r = some y := by
  have h := cue_from_path_selects N y
  unfold Recognizes at hy
  rw [hy] at h
  exact h

/-- **Retroactive inhibition.** A response that was correct for old material
(cue for `y` selects `y`) can be lost when new material `w` is learned
afterwards, because learning `w` grows the net under the old cue. -/
theorem retroactive_inhibition (order : NoticingOrder) (y w : Item) (f : Feature)
    (hyw : y ≠ w) (hf : firstDiff order w y = some f) :
    ∃ N c, CueSelects N c (some y) ∧ CueSelects (N.learn order w) c (some w) := by
  obtain ⟨h1, h2, _⟩ := oscillation order y w f hyw hf
  exact ⟨_, _, h1, h2⟩

end Net
end Epam
