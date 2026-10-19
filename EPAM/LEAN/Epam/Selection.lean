/-
EPAM, the selection postulate (D2).

P-1817 §2.4: "D2: Selection Process. There exists an elementary selection
process ... which uses codes (coded representations of external objects) to
select images in a discrimination net."

The cognitive content modelled here:
* A stimulus reaches the mind as a code: a set of binary features (§3.3.1-2).
* Memory is a discrimination net: testing points that look at one feature,
  and terminals that hold an image, or nothing (the null image, K10) (§3.4.1).
* Recognition (selection) sorts the code down the net to a terminal and
  yields the image stored there.

The main result of this file, `select_depends_only_on_noticed_features`,
says that what a stimulus is recognized as depends only on the features the
net actually examined on its way down. Everything EPAM explains about
confusions rests on that.
-/

namespace Epam

/-- A feature of a stimulus code: which bit (§3.3.2). -/
abbrev Feature := Nat

/-- A stimulus code: a list of bits. Features beyond its length read as 0. -/
abbrev Item := List Bool

/-- The value of feature `f` of stimulus `x`. -/
def Item.feat (x : Item) (f : Feature) : Bool := x.getD f false

/-- A discrimination net (§3.4.1). A terminal holds an image (a stored copy
of a stimulus, §3.4.2) or `none`, the null image. A testing point examines
one feature and branches. -/
inductive Net where
  | leaf : Option Item → Net
  | test : Feature → Net → Net → Net
  deriving Repr

namespace Net

/-- D2, selection: sort a stimulus to a terminal and return its image. -/
def select : Net → Item → Option Item
  | leaf img, _ => img
  | test f n0 n1, x => if x.feat f then n1.select x else n0.select x

/-- The features examined while sorting `x`: the path it takes. -/
def path : Net → Item → List Feature
  | leaf _, _ => []
  | test f n0 n1, x => f :: (if x.feat f then n1.path x else n0.path x)

/-- A stimulus is *recognized* by a net when it selects its own image. -/
def Recognizes (N : Net) (x : Item) : Prop := N.select x = some x

instance (N : Net) (x : Item) : Decidable (Recognizes N x) :=
  inferInstanceAs (Decidable (N.select x = some x))

/-- **Selection depends only on noticed features.** Two stimuli that agree
on every feature the net examines along one of them select the same image. -/
theorem select_depends_only_on_noticed_features (N : Net) (x y : Item)
    (h : ∀ f ∈ N.path x, x.feat f = y.feat f) : N.select y = N.select x := by
  induction N with
  | leaf img => rfl
  | test f n0 n1 ih0 ih1 =>
    have hf : x.feat f = y.feat f := h f (by simp [path])
    simp only [select]
    rw [← hf]
    cases hx : x.feat f with
    | true =>
      simp only [ite_true]
      exact ih1 (fun g hg => h g (by simp [path, hx, hg]))
    | false =>
      simp only [Bool.false_eq_true, ite_false]
      exact ih0 (fun g hg => h g (by simp [path, hx, hg]))

/-- The same fact read the other way: if a net tells two stimuli apart, it
must have examined, on the way down one of them, a feature on which they
differ. -/
theorem discrimination_needs_a_difference (N : Net) (x y : Item)
    (h : N.select x ≠ N.select y) : ∃ f ∈ N.path x, x.feat f ≠ y.feat f := by
  apply Classical.byContradiction
  intro hno
  apply h
  have hall : ∀ f ∈ N.path x, x.feat f = y.feat f := by
    intro f hf
    apply Classical.byContradiction
    intro hne
    exact hno ⟨f, hf, hne⟩
  exact (select_depends_only_on_noticed_features N x y hall).symm

end Net
end Epam
