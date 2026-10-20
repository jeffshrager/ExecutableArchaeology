# A multi-level theorem, narrated: learning to criterion

This note walks through one theorem of the EPAM theory in CogLean, `Phenomena.learning_to_criterion`, and the chain of lemmas it rests on. It is the deepest dependency chain in the library so far: five levels of the library's own lemmas above Lean's core. It also shows something substantive about the theory.

## The claim

> If every two items on a list are *noticeably different* (the noticing order can find some feature on which they differ), then learning the list with one discrimination cycle (F1) per item leaves **every item recognized**, starting from an empty memory.

In psychological terms, discrimination learning reaches criterion, and **learning later items never undoes the recognition of earlier ones**.

```lean
-- Epam/Phenomena.lean
theorem learning_to_criterion (order : NoticingOrder) (xs : List Item)
    (h : ∀ x ∈ xs, ∀ z ∈ xs, z ≠ x → Noticeable order x z) :
    ∀ x ∈ xs, Recognizes (learnAll order (leaf none) xs) x
```

The vocabulary, all defined in `Selection.lean` and `Discrimination.lean`:

- **`Item`:** a stimulus code, a list of bits.
- **`Net`:** a discrimination net of testing points and terminals.
- **`Recognizes N x`:** sorting `x` through `N` reaches a terminal holding `x`'s own image.
- **`learn order N x`:** one F1 cycle. It sorts `x` down the net. If `x` lands on a terminal holding a different image, the point of confusion, F1 replaces that terminal with a test on the first feature, in noticing order, where the two differ.
- **`learnAll order N xs`:** one F1 cycle per item of `xs`, in order.
- **`firstDiff order x z`:** the first feature, in noticing order, on which `x` and `z` differ, if any.
- **`Noticeable order x z`:** `firstDiff` finds such a feature.

## The dependency tree

```
learning_to_criterion                    (Phenomena)       the phenomenon
└── learnAll_recognizes                  (Discrimination)  learning a whole list
    ├── learn_recognizes                    F1 succeeds on the new item
    ├── images_learn_subset                 F1 stores nothing unexpected
    └── learnAll_preserves                  later learning keeps old items
        └── learn_preserves                 one F1 cycle keeps old items   <- the crux
            └── firstDiff_differs           a noticed difference is a real difference
                └── List.find?_some         (Lean's core library)
```

## Level by level, from the bottom up

### Level 1: `firstDiff_differs`: a noticed difference is a real difference

```lean
theorem firstDiff_differs {order : NoticingOrder} {x z : Item} {f : Feature}
    (h : firstDiff order x z = some f) : x.feat f ≠ z.feat f
```

F1 scans features in noticing order and stops at the first one where the new item and the stored image differ. This lemma confirms that what it found really is a difference. It is one step from Lean's own fact about `List.find?`. It sounds trivial, but everything above depends on it: a test grown on that feature *will* send the two items down different branches.

### Level 2: `learn_preserves`, the crux: one learning cycle doesn't interfere

```lean
theorem learn_preserves (order : NoticingOrder) (N : Net) (x y : Item)
    (hy : Recognizes N y) (hyx : y ≠ x) : Recognizes (N.learn order x) y
```

If `y` is already recognized, learning a different item `x` leaves `y` recognized. The proof is by induction on the net, and it captures one cognitive idea, **locality**: F1 changes the net only at the terminal where `x` lands.

- **At a testing point:** if `x` and `y` take different branches, F1 never touches `y`'s subtree. If they take the same branch, the induction hypothesis applies.
- **At the terminal holding `y`:** if `x` lands there, this is the point of confusion. F1 replaces the terminal with a test on the first noticed difference, putting `y`'s image on one side and `x`'s on the other. By Level 1, `x` and `y` really do differ there, so `y` follows its own branch to its own image.

### Level 3: `learnAll_preserves`: a whole sequence doesn't interfere

```lean
theorem learnAll_preserves (order : NoticingOrder) (xs : List Item) :
    ∀ (N : Net) (y : Item), Recognizes N y → y ∉ xs →
      Recognizes (learnAll order N xs) y
```

If `y` is recognized and isn't among the items learned afterwards, it stays recognized through all of them. The proof is a plain induction over the list, applying Level 2 once per item.

### Level 3, alongside: `learn_recognizes` and `images_learn_subset`

```lean
theorem learn_recognizes (order : NoticingOrder) (N : Net) (x : Item)
    (hn : ∀ z ∈ N.images, z ≠ x → Noticeable order x z) :
    Recognizes (N.learn order x) x

theorem images_learn_subset (order : NoticingOrder) (N : Net) (x : Item) :
    ∀ z ∈ (N.learn order x).images, z = x ∨ z ∈ N.images
```

- **`learn_recognizes` (F1 succeeds).** After learning `x`, `x` is recognized, provided it is noticeably different from every image already stored. If it weren't, F1 would find no difference and the confusion would remain.
- **`images_learn_subset` (bookkeeping, but essential).** After learning `x`, the net holds the old images plus `x`, and nothing else. The hypothesis "everything stored is noticeably different from what's coming" has to *stay true* as the net changes, and this lemma is what keeps it true from one step to the next.

### Level 4: `learnAll_recognizes`: the whole list

```lean
theorem learnAll_recognizes (order : NoticingOrder) (xs : List Item) :
    ∀ (N : Net),
      (∀ x ∈ xs, ∀ z, (z ∈ N.images ∨ z ∈ xs) → z ≠ x → Noticeable order x z) →
      ∀ x ∈ xs, Recognizes (learnAll order N xs) x
```

An induction over the list, starting from any net:

- **The item just learned:** `learn_recognizes` gives recognition now, and `learnAll_preserves` keeps it through every later item.
- **An item that comes up again later in the list:** the induction hypothesis covers it.
- **The noticeability hypothesis** is carried from step to step by `images_learn_subset`.

### Level 5: `learning_to_criterion`: the phenomenon

Starting from the empty net `leaf none` (a memory with no images) makes the "already stored images" half of `learnAll_recognizes`'s hypothesis vacuous. All that remains is that the *list's* items are pairwise noticeable, which is hypothesis `h`.

## What the proof teaches about the theory

1. **The hypothesis is the content.** The theorem needs the items to be noticeably different *under the noticing order*. Two items that differ only in features the learner never scans can never be told apart, however long it studies. The proof makes "learnable" precise: learnability is relative to what the learner attends to.

2. **Discrimination never forgets, in this theory.** Levels 2 and 3 say the net is *monotone*: what has been recognized stays recognized. So where does forgetting come from? The theorems in `Association.lean` give the answer: **from the cues, not the net.**
   - `oscillation` shows that a cue code formed when the net was small can become insufficient as the net grows underneath it, so a correct response can fail, and later succeed again.
   - `retroactive_inhibition` shows the same for old material when new material is learned.

   Taken together, the theory puts interference in *retrieval*, not in *storage*. This is a substantive commitment, and it is where theories differ: an activation-based theory such as ACT-R locates interference in activation spread across many associations (the fan effect). Stating both against shared definitions of *cue* and *interference* is what the library is for.

3. **The argument is general.** Nothing in the chain "local change ⇒ non-interference ⇒ monotone learning ⇒ criterion" is specific to EPAM. Any learner whose updates are local in the same sense follows the same chain. That makes it a candidate for a shared, theory-neutral lemma in the library (`Cog/Memory/DiscriminationNet`, `Cog/Phenomena`), which other theories could reuse to prove their own learning-to-criterion results.

## Checking it

```sh
cd EPAM/LEAN && lake build
```

Every theorem above is proved, with no `sorry`. `#print axioms Epam.Phenomena.learning_to_criterion` lists only `propext` and `Quot.sound`, Lean's standard axioms.
