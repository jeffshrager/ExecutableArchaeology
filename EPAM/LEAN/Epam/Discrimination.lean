/-
EPAM, the discrimination-learning postulates (F1, F1b).

P-1817 §2.4: "F1: Discrimination Learning Process. Learning an item in the
discrimination net consists of finding a unique terminal in the net at which
to store the image, or creating such a terminal by growing the net at a point
of confusion; i.e., adding discriminatory tests at that point."

"F1b: Noticing Order. The scanning of codes for differences is controlled by
a noticing order."

Modelled here, in its simplest form (one test added per confusion, as with the
listing's P2 = 1):
* An empty terminal (the null image) simply receives the new image.
* A terminal holding a *different* image is a point of confusion. The codes
  are scanned in noticing order for the first feature where they differ, and
  that test is put in place of the terminal, with the old image on one side
  and the new image on the other.
* Nothing else in the net changes.

Results:
* `learn_recognizes`: after learning a stimulus, the net recognizes it.
* `learn_preserves`: learning one stimulus never disturbs the recognition of
  another (discrimination learning is local and non-interfering).
* `learn_all_recognized`: so a list of mutually noticeable stimuli is
  completely learned in one discrimination cycle each.
* `learned_test_is_first_noticed_difference` and `scan_cost_grows_with_similarity`:
  the test added is the first difference in the noticing order, so the more
  alike two stimuli are in the features noticed first, the further down the
  noticing order the scan must go.
-/

import Epam.Selection

namespace Epam

/-- A noticing order: the order in which features are scanned for
differences (F1b; the listing's P0 and P1). -/
abbrev NoticingOrder := List Feature

/-- The first feature, in noticing order, on which `x` and `z` differ. -/
def firstDiff (order : NoticingOrder) (x z : Item) : Option Feature :=
  order.find? (fun f => x.feat f != z.feat f)

/-- Two stimuli are *noticeably different* under a noticing order when the
scan finds a difference. -/
def Noticeable (order : NoticingOrder) (x z : Item) : Prop :=
  ∃ f, firstDiff order x z = some f

theorem firstDiff_differs {order : NoticingOrder} {x z : Item} {f : Feature}
    (h : firstDiff order x z = some f) : x.feat f ≠ z.feat f := by
  have := List.find?_some h
  simpa [bne_iff_ne] using this

namespace Net

/-- F1: discriminate a new stimulus into the net. -/
def learn (order : NoticingOrder) : Net → Item → Net
  | leaf none, x => leaf (some x)
  | leaf (some z), x =>
    if z = x then leaf (some z) else
      match firstDiff order x z with
      | some f =>
        if x.feat f then test f (leaf (some z)) (leaf (some x))
        else test f (leaf (some x)) (leaf (some z))
      | none => leaf (some z)
  | test f n0 n1, x =>
    if x.feat f then test f n0 (n1.learn order x) else test f (n0.learn order x) n1

/-- The images stored in a net. -/
def images : Net → List Item
  | leaf none => []
  | leaf (some z) => [z]
  | test _ n0 n1 => n0.images ++ n1.images

/-- **F1 succeeds.** If the new stimulus is noticeably different from every
image already stored, after learning it the net recognizes it. -/
theorem learn_recognizes (order : NoticingOrder) (N : Net) (x : Item)
    (hn : ∀ z ∈ N.images, z ≠ x → Noticeable order x z) :
    Recognizes (N.learn order x) x := by
  induction N with
  | leaf img =>
    cases img with
    | none => simp [learn, Recognizes, select]
    | some z =>
      by_cases hzx : z = x
      · subst hzx; simp [learn, Recognizes, select]
      · obtain ⟨f, hf⟩ := hn z (by simp [images]) hzx
        simp only [learn, hzx, ite_false, hf]
        cases hx : x.feat f <;> simp [Recognizes, select, hx]
  | test f n0 n1 ih0 ih1 =>
    cases hx : x.feat f with
    | true =>
      have := ih1 (fun z hz => hn z (by simp [images, hz]))
      simpa [learn, Recognizes, select, hx] using this
    | false =>
      have := ih0 (fun z hz => hn z (by simp [images, hz]))
      simpa [learn, Recognizes, select, hx] using this

/-- **F1 does not interfere.** Learning `x` leaves every other recognized
stimulus recognized. -/
theorem learn_preserves (order : NoticingOrder) (N : Net) (x y : Item)
    (hy : Recognizes N y) (hyx : y ≠ x) : Recognizes (N.learn order x) y := by
  induction N with
  | leaf img =>
    cases img with
    | none => simp [Recognizes, select] at hy
    | some z =>
      have hzy : z = y := by simpa [Recognizes, select] using hy
      subst hzy
      simp only [learn, hyx, ite_false]
      cases hf : firstDiff order x z with
      | none => simp [Recognizes, select]
      | some f =>
        have hd := firstDiff_differs hf
        cases hx : x.feat f <;> cases hz : z.feat f <;>
          simp_all [Recognizes, select]
  | test f n0 n1 ih0 ih1 =>
    unfold Recognizes at ih0 ih1 hy ⊢
    cases hyf : y.feat f <;> cases hxf : x.feat f <;>
      simp_all [learn, select]

theorem images_learn_subset (order : NoticingOrder) (N : Net) (x : Item) :
    ∀ z ∈ (N.learn order x).images, z = x ∨ z ∈ N.images := by
  induction N with
  | leaf img =>
    cases img with
    | none => simp [learn, images]
    | some w =>
      by_cases hw : w = x
      · subst hw; simp [learn, images]
      · simp only [learn, hw, ite_false]
        cases hf : firstDiff order x w with
        | none => simp [images]
        | some f =>
          intro z hz
          cases hxf : x.feat f <;> simp [hxf, images] at hz <;> rcases hz with h | h <;> simp [h, images]
  | test f n0 n1 ih0 ih1 =>
    intro z hz
    cases hx : x.feat f <;> simp only [learn, hx, ite_true, ite_false, Bool.false_eq_true, images,
      List.mem_append] at hz ⊢
    · rcases hz with hz | hz
      · rcases ih0 z hz with h | h <;> simp_all
      · simp_all
    · rcases hz with hz | hz
      · simp_all
      · rcases ih1 z hz with h | h <;> simp_all

/-- Learn a list of stimuli, one F1 cycle each, in order. -/
def learnAll (order : NoticingOrder) (N : Net) (xs : List Item) : Net :=
  xs.foldl (fun n x => n.learn order x) N

theorem learnAll_preserves (order : NoticingOrder) (xs : List Item) :
    ∀ (N : Net) (y : Item), Recognizes N y → y ∉ xs →
      Recognizes (learnAll order N xs) y := by
  induction xs with
  | nil => intro N y h _; simpa [learnAll] using h
  | cons a rest ih =>
    intro N y hy hnot
    simp only [List.mem_cons, not_or] at hnot
    have h1 := learn_preserves order N a y hy hnot.1
    simpa [learnAll] using ih (N.learn order a) y h1 hnot.2

/-- **A list is learned in one discrimination cycle per stimulus**, provided
any two different stimuli involved (already stored, or on the list) are
noticeably different. -/
theorem learnAll_recognizes (order : NoticingOrder) (xs : List Item) :
    ∀ (N : Net),
      (∀ x ∈ xs, ∀ z, (z ∈ N.images ∨ z ∈ xs) → z ≠ x → Noticeable order x z) →
      ∀ x ∈ xs, Recognizes (learnAll order N xs) x := by
  induction xs with
  | nil => intro N _ x hx; simp at hx
  | cons a rest ih =>
    intro N H x hx
    have H' : ∀ x ∈ rest, ∀ z, (z ∈ (N.learn order a).images ∨ z ∈ rest) → z ≠ x →
        Noticeable order x z := by
      intro x hx z hz hzx
      apply H x (List.mem_cons_of_mem a hx) z _ hzx
      rcases hz with hz | hz
      · rcases images_learn_subset order N a z hz with h | h
        · subst h; exact Or.inr (List.mem_cons_self ..)
        · exact Or.inl h
      · exact Or.inr (List.mem_cons_of_mem a hz)
    by_cases hr : x ∈ rest
    · simpa [learnAll] using ih (N.learn order a) H' x hr
    · have hxa : x = a := by
        rcases List.mem_cons.mp hx with h | h
        · exact h
        · exact absurd h hr
      subst hxa
      have h1 : Recognizes (N.learn order x) x :=
        learn_recognizes order N x (fun z hz hzx => H x hx z (Or.inl hz) hzx)
      simpa [learnAll] using learnAll_preserves order rest (N.learn order x) x h1 hr

/-- **F1b: the test grown at a point of confusion is the first difference in
the noticing order.** -/
theorem learned_test_is_first_noticed_difference (order : NoticingOrder)
    (x z : Item) (f : Feature) (hzx : z ≠ x) (hf : firstDiff order x z = some f) :
    ∃ n0 n1, (leaf (some z)).learn order x = test f n0 n1 := by
  simp only [learn, hzx, ite_false, hf]
  cases x.feat f <;> exact ⟨_, _, rfl⟩

end Net

/-- How many features are scanned, in noticing order, before a difference
between `x` and `z` is found (all of them if none is). -/
def scanCost : NoticingOrder → Item → Item → Nat
  | [], _, _ => 0
  | f :: fs, x, z => if x.feat f != z.feat f then 1 else 1 + scanCost fs x z

/-- **Similarity costs scanning.** If two stimuli agree on the first `k`
features of the noticing order, finding their difference costs at least `k`
steps: the more alike they are in what is noticed first, the longer the
search (cf. intralist similarity, §4.1.1.3.3). -/
theorem scanCost_ge_of_agree (order : NoticingOrder) (x z : Item) :
    ∀ k, k ≤ order.length → (∀ f ∈ order.take k, x.feat f = z.feat f) →
      k ≤ scanCost order x z := by
  induction order with
  | nil => intro k hk _; simp at hk; omega
  | cons f fs ih =>
    intro k hk hagree
    cases k with
    | zero => exact Nat.zero_le _
    | succ k =>
      have hf : x.feat f = z.feat f := hagree f (by simp)
      have hrest : ∀ g ∈ fs.take k, x.feat g = z.feat g :=
        fun g hg => hagree g (by simp [hg])
      have := ih k (by simp at hk; omega) hrest
      simp [scanCost, hf]
      omega

end Epam
