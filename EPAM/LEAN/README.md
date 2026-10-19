# EPAM's cognitive postulates in Lean

EPAM, the first theory in CogLean (`../../coglean.md`), a library of cognitive theory in Lean 4. This directory states EPAM's cognitive propositions (selection by a discrimination net, discrimination learning, association by cue codes, restoration, serial attention with anchor points; P-1817 §2.4). It then proves from them alone the phenomena they explain, and computes a full serial-anticipation experiment.

The proofs are **qualitative**. They show that a phenomenon *follows from* (or *is possible under*) the postulates, not that it matches human data in size. All 48 theorems are machine-checked: `lake build` succeeds, there is no `sorry`, and `#print axioms` shows only Lean's standard `propext`, `Quot.sound` and `Classical.choice`.

```sh
cd EPAM/LEAN
lake build          # Lean 4.35.0 via elan (~/.elan); core Lean only, no Mathlib
```

## What is modelled

The model is deliberately abstract. It formalizes the *propositions*, not the 1959 IPL-V code in `../IPL/`.

| Concept (P-1817) | Lean |
|---|---|
| Stimulus code, a string of bits (§3.3.2) | `Item := List Bool`, `Item.feat` |
| Discrimination net: testing points and terminals holding an image or the null image (§3.4.1) | `inductive Net` (`leaf`, `test`) |
| Noticing order (F1b; the listing's P0/P1) | `NoticingOrder := List Feature` |
| Cue code: partial information about a response (F2) | `Cue := Feature → Option Bool`, `cueOf` |
| A test with missing information branches at random (§3.5.1.2) | `Net.CueSelects`, a relation with `guess0`/`guess1` |

## Postulates (definitions) and what is proved

**Microprocesses**

| Postulate (§2.4) | Lean definition | Proved properties |
|---|---|---|
| D2 Selection: codes select images in a discrimination net | `Net.select`, `Net.path` | `select_depends_only_on_noticed_features`: what a stimulus is recognized as depends only on the features examined on its path. `discrimination_needs_a_difference`: a net that tells two stimuli apart must have tested a feature on which they differ. |
| F1 Discrimination learning: find a unique terminal, or grow the net at a point of confusion | `Net.learn` | `learn_recognizes`: after learning, the stimulus is recognized. `learn_preserves`: learning never disturbs another stimulus's recognition. `learnAll_recognizes`: a list of noticeably different stimuli is learned with one F1 cycle each. |
| F1b Noticing order | `firstDiff`, `scanCost` | `learned_test_is_first_noticed_difference`: the test grown is the first difference in the noticing order. `scanCost_ge_of_agree`: stimuli that agree on the first *k* noticed features cost at least *k* scanning steps. |
| F2 Association by cue code ("enough of the code for Y") | `cueOf`, `Net.CueSelects` | `cue_from_path_selects`: the cue holding the response's path features selects it, and nothing else. |
| R Responder (D2 applied to the cue) | `Net.CueSelects` | (used by the results below) |
| D8 Restoration: add information to the cue after a failure | `cueOf y (N.path y)` on the grown net | `restoration`: the rebuilt cue re-establishes the link. |

**Macroprocesses** (Feigenbaum & Simon 1962)

| Postulate | Lean definition | Proved properties |
|---|---|---|
| M0 Serial mechanism + M1 Unit processing time | one learning cycle per trial | `trials_at_least_pairs`: *n* associations need at least *n* trials. |
| M3 Anchor points: attend first to the ends, then inward | `anchorDist`, `learnedOnTrial`, `errorsAt` | `serial_position_effect`: positions further from the nearer anchor collect strictly more errors. `first_position_fewest_errors`, `errors_rise_toward_middle`, `errors_fall_toward_end`: the error curve is bowed. |

M2 (immediate memory) is not used yet.

## The phenomena, and the claims they formalize

| Phenomenon (P-1817 §4.1.1.3, unless noted) | Theorem | Reading |
|---|---|---|
| **Stimulus generalization** (4.1.1.3.2; e.g. Fig. 4.1, trial 4, "PEM is confused with ROM") | `select_depends_only_on_noticed_features` | An untrained stimulus that agrees with a learned one on the features its path examines is recognized *as* that one. |
| **Intralist similarity** (4.1.1.3.3) | `discrimination_needs_a_difference`, `scanCost_ge_of_agree` | Similar items can only be told apart on their few differing features, and finding those costs more scanning. |
| **Oscillation** (4.1.1.3.4: a response is right, then wrong, then right) | `oscillation` | A cue that was enough when formed may not be after the net grows. The same stimulus can then give a wrong response, or still the right one. |
| **Recovery** (D8) | `restoration` | Adding the new path's features to the cue makes the response correct again. |
| **Retroactive inhibition** (4.1.2) | `retroactive_inhibition` | Learning new material can undo a correct old response, by the same mechanism as oscillation. |
| **Learning to criterion is possible, and incremental** | `learnAll_recognizes`, `learn_preserves` | Discrimination learning is local, so a list is learned without unlearning. |
| **Total time ~ amount to be learned** (M0/M1) | `trials_at_least_pairs` | |
| **Serial position effect** (Feigenbaum & Simon 1962) | `serial_position_effect` and companions | A bowed error curve, from anchor-point attention. |

## Simplifications (for honesty)

- **F1 adds one test per confusion.** That corresponds to the listing's P2 = 1. The §4.1 hand simulation allowed up to three. F1a (redundant tests) is not modelled.
- **Cues are built exactly from the response's path** at learning time, the minimal sufficient cue. P-1817 says the amount is set "by trial and error"; this model takes the end state of that process.
- **The macro model is the simplest anchor-point schedule.** Attention works inward from both ends, one association per trial, front first at equal distances. It gives the qualitative bow, not the McCrary-Hunter percentages that the 1962 paper fits quantitatively.
- **No timing, no probabilities.** "Random" branching is modelled as possibility (either branch can happen), so `oscillation` says a wrong response *can* occur, not how often.
- **Not yet stated:** response generalization, error types and their distribution (4.1.1.3.5), and serial anticipation vs paired associates (4.1.1.3.6).

## Files

| File | Contents |
|---|---|
| `Epam/Selection.lean` | Items, nets, D2, and the noticed-features theorem |
| `Epam/Discrimination.lean` | F1, F1b, learning lists, scan cost |
| `Epam/Association.lean` | F2, R, D8, oscillation, restoration, retroactive inhibition |
| `Epam/Macro.lean` | M0, M1, M3 and the serial position effect |
| `Epam/ListA.lean` | The List A instance (generated by `gen_lista.py`): Fig. 4.1's trial-4 confusion of PEM with ROM, computed by the kernel |
| `Epam/Phenomena.lean` | The phenomena under their psychological names, as corollaries of the postulates |
| `Epam/Experiment.lean` | The experiment machinery: F1 with up to *k* differences and null images (P2, F1a), cues stored with images (F2), and all possible responses (R) |
| `Epam/Fig41.lean` | Fig. 4.1, checked: the figure's learning schedule, and its 34 recorded responses compared with what the postulates make possible |
| `Epam/Fig41Alt.lean` | Fig. 4.1 under other U1-consistent codes, which reproduce all 34 (generated by `analysis/gen_alt.py`) |
| `analysis/` | `robustness.py` and `RESULTS.md`, testing Feigenbaum's robustness footnote (p. 87) |

## A concrete case: List A and Fig. 4.1

`Epam/ListA.lean` codes List A (KAG LUK RIL PEM ROM TIL, §4.1.1.1.1) letter by letter.
- **The codes.** A's code is the listing's Q1. The other letters' codes are reconstructed from EPAM II's own letter net U1 (`../IPL/letter_codes.py`, `../IPL/letter_codes.txt`): the bits U1 tests on a letter's path are fixed by U1, and untested bits are 0. All 26 reconstructed codes sort back to their own letter through U1.
- **The setup.** The noticing order is first letter, third, second (§4.1.1.1.2, the listing's P0). The net starts empty, and the syllables are learned in Fig. 4.1's order.

The kernel then checks (`decide`):

- `trial4_PEM_confused_with_ROM`: after KAG, LUK, RIL, ROM and TIL have been learned (trials 1-3), **the unlearned PEM is recognized as ROM**. This is Fig. 4.1, trial 4: "PEM is confused with ROM and response to ROM is made".
- `PEM_agrees_with_ROM_on_ROMs_path`, `PEM_ROM_first_noticed_difference`: why. P and R differ only in bit 8 of the first letter, the third letters are both M, and the net has never needed to test that bit.
- `scan_costs`: PEM/ROM is the most similar pair. Its scan costs 8 steps; KAG/LUK costs 5.
- `trial5_all_recognized`: once PEM is learned (trial 5), all six are recognized.

`Phenomena.stimulus_generalization_List_A` derives the trial-4 confusion from the general theorem `stimulus_generalization`. The confusion was *predicted* from the postulates and the reconstructed codes; it was not built in. Feigenbaum's hand simulation used idealized codes.

## Fig. 4.1, the whole experiment (`Fig41.lean`)

The experiment machinery (`Experiment.lean`) adds what the hand simulation used:
- F1 notices up to P2 = 3 differences and adds redundant tests with null images (F1a); those are where "none" responses come from;
- each image stores a cue code for its response (F2);
- responding sorts the cue, and either branch is possible where it is silent.

The learning schedule (which F1, F2 and D8 happens on which trial and row) is transcribed from the figure, because timing and attention are left to the experimenter. The responses are computed from the postulates. The kernel checks:

- **33 of the figure's 34 recorded responses are possible** (`fig41_agreement`);
- note 7, trial 4: PEM *can only* give TIL, ROM's response (`trial4_PEM_gives_ROMs_response`);
- note 6, trial 4: LUK's cue is insufficient, so RIL, ROM or none are possible (oscillation);
- note 10: once D8 restores it, LUK gives RIL;
- criterion on trial 7, and not on trial 6;
- the one disagreement, KAG on trial 6, depends on the codes (`fig41_disagreement`). Under other U1-consistent codes all 34 are possible (`Fig41Alt.alt_agreement`). There KAG's trial-7 success is possible but not certain (`alt_trial7_KAG_by_chance`), which is what note 12 says ("by chance").

## Robustness (`analysis/RESULTS.md`)

Feigenbaum claimed that the qualitative behavior does not depend sensitively on the codes, the noticing order or P2 (p. 87). Sampling U1-consistent codes, all six letter orders and P2 = 1-3, the claim is **partly right**:
- the phenomena (generalization errors, oscillation, learning in about seven trials) are robust;
- the particular errors are not;
- oscillation by omission needs P2 ≥ 2 (F1a);
- the PEM/ROM confusion needs the third letter noticed before the vowel;
- vowel-first noticing fits the figure worst.

## Contribution to the library

Most of what is defined here is not EPAM-specific, and is to be lifted into shared CogLean modules (`../../coglean.md`, roadmap):

| General construct | Here | Destined for |
|---|---|---|
| Feature codes | `Item`, `Item.feat` | `Cog/Rep` |
| Discrimination nets, selection, learning with noticing order and redundancy | `Net`, `select`, `learn`, `learnK`, `NoticingOrder` | `Cog/Memory/DiscriminationNet` |
| Cue codes, retrieval from partial cues, restoration | `Cue`, `cueOf`, `CueSelects`, `cueResults` | `Cog/Memory/Cue` |
| Serial attention with anchor points | `anchorDist`, `learnedOnTrial` | `Cog/Control/Attention` |
| Learner state, learning events, possible responses | `Learner`, `Event`, `responses` | `Cog/Experiments` |
| Phenomena (generalization, oscillation, interference, serial position, ...) | `Phenomena.lean` | `Cog/Phenomena`, stated theory-neutrally as properties of learners |

## Next

1. Lift the general constructs into shared modules (above).
2. Tie the model to the running IPL-V program (`../IPL/`): run List A with the same codes and check for the same confusions (needs the experiment driver; OPEN_ISSUES #17-18).
2. State the rest of Fig. 4.1 (oscillations, trials to criterion) and Fig. 4.2 (paired associates: RIL → LUK, ROM → LUK).
3. The phenomena not yet stated: response generalization, error types (4.1.1.3.5), serial anticipation vs paired associates (4.1.1.3.6).
