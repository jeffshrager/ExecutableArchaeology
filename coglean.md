# CogLean: classic cognitive models as checked theories

## The idea

The early cognitive-simulation programs, including EPAM, the Logic Theorist, GPS and the Heuristic Compiler, were offered as *theories*. Feigenbaum says it directly of EPAM: "The precise statement of the theory is given in the language of a digital computer" (P-1817, Summary, 1959). Each program came with a short list of **cognitive propositions** (EPAM's "postulates": selection by a discrimination net, discrimination learning, association by cue codes, a serial mechanism with anchor points, and so on). It also came with a list of **behavioral phenomena** the propositions were meant to explain (stimulus generalization, oscillation, the serial position effect, ...).

The connection between the two was argued in prose, and sometimes demonstrated by running the program, or, for EPAM II, by simulating it by hand. CogLean makes that connection explicit and checkable. For each model:

1. **State the cognitive propositions** as definitions in Lean 4, at the level of abstraction the authors used (codes, nets, cues, attention), not at the level of their implementation.
2. **State the phenomena** as theorems, in the qualitative form the original papers claim: "can occur", "increases with", "is bowed".
3. **Prove the phenomena from the propositions alone**, machine-checked. A proof shows exactly which propositions a phenomenon depends on. A failed proof shows where the original argument needed something it never stated.

## How it relates to executable archaeology

The rest of this repository *runs* the historical programs: the original code on reconstructed interpreters. That tells us what the programs *do*. CogLean says what their *theories* imply. The two check each other:

- **Program → theory.** A behavior observed in a run (e.g. EPAM confusing two syllables) should be an instance of a proved theorem. If it is not, either the program departs from its stated theory, or the theory is incomplete.
- **Theory → program.** A theorem saying a phenomenon *can* occur names the mechanism. That says which part of the code to examine, and what input should produce it.
- **Theory without a program.** Some claims were never run at all; EPAM II was only hand-simulated. The propositions can still be checked for whether they really entail what was claimed.

## Principles

- **Qualitative, as the originals were.** The 1959-1962 claims are mostly qualitative ("EPAM exhibits oscillation", "the curve is bowed"), so the theorems are too. Quantitative fits are out of scope unless a paper made one.
- **Faithful to the authors' propositions.** Definitions follow the wording of the original postulates and cite them (paper, section, page). Simplifications are listed openly in each model's README.
- **Possibility vs necessity.** Where a mechanism is random (e.g. EPAM's tests with missing information), the theorem says what *can* happen, using a relation rather than a probability.
- **Fully checked.** No `sorry`, and only Lean's standard axioms (`#print axioms`). Core Lean where possible, so the proofs build quickly with no large libraries.
- **Next to the program.** Each model's Lean lives beside its executable reconstruction (`<Model>/LEAN/` beside `<Model>/IPL/`), so the two can be compared.

## Models

| Model | Lean | Status |
|---|---|---|
| **EPAM II** (Feigenbaum 1959; Feigenbaum & Simon 1962) | `EPAM/LEAN/` | 48 theorems proved (no `sorry`). Fig. 4.1's whole serial-anticipation run is checked: 33/34 recorded responses under codes reconstructed from U1, 34/34 under others. Feigenbaum's robustness footnote is tested (`analysis/RESULTS.md`). Postulates: selection (D2), discrimination learning (F1, F1b), association and restoration (F2, R, D8), macroprocesses (M0, M1, M3). Phenomena: stimulus generalization, intralist similarity, oscillation, retroactive inhibition, learning to criterion, serial position effect. |
| Logic Theorist (Newell, Shaw & Simon 1956) | — | candidate: the "methods" (substitution, detachment, chaining) and claims about search |
| Heuristic Compiler (Simon 1961-63) | — | candidate |
| Simon-Yngve generator (1962) | — | candidate: Yngve's depth hypothesis is a claim about bounded memory |

## Getting started

```sh
curl -sSfL https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh   # installs ~/.elan
cd EPAM/LEAN && lake build
```
