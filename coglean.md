# CogLean: a library of cognitive theory in Lean

## The goal

Mathlib is a single, shared, machine-checked library of mathematics. Definitions are made once and reused everywhere, and every theorem is proved from them. CogLean aims at the same thing for **cognitive theory**: one library in which the constructs of cognitive science are defined once, the theories built from them are stated precisely, and the phenomena those theories claim to explain are proved from their assumptions.

- **Constructs:** representations, memories, learning and selection processes, attention, architectures.
- **Theories:** discrimination-net learning, production systems, search, activation-based memory, connectionist and Bayesian models, and others.
- **Phenomena:** generalization, interference, forgetting, the serial position effect, capacity limits, practice effects, and others.

Cognitive theories are usually stated in prose, in simulation code, or as systems of equations fitted to data. What follows from their core assumptions, as distinct from their parameter settings or implementation details, is rarely checked. In CogLean that is what a proof does. A proof shows *which* assumptions a phenomenon depends on. A failed proof shows that a theory needs an assumption it never stated. And because the constructs are shared, theories can be compared on common ground: two theories explain a phenomenon *in the same way* if their proofs use the same lemmas.

## What goes in the library

| Layer | Contents | Examples |
|---|---|---|
| **Representations** | the stuff of cognition | feature codes, symbols and list structures, chunks, propositions, vectors |
| **Memory structures** | how it is stored and accessed | discrimination nets, associative cue-response links, bounded short-term stores, activation, schemas |
| **Processes** | what operates on memory | selection and recognition, discrimination learning, association, retrieval with partial cues, search, rule matching |
| **Control** | how processing is organized | serial mechanisms, attention and its order, time per operation, goal stacks |
| **Phenomena** | theory-neutral statements of what is observed | "a stimulus similar to a learned one evokes its response", "responses learned earlier can be lost by later learning", "errors are bowed over serial position" |
| **Theories** | named bundles of the above, with their postulates | EPAM, and in time production-system, activation-based, connectionist and probabilistic theories |
| **Experiments** | tasks as instances | serial anticipation, paired associates, recognition, list learning, with concrete stimuli |

A *phenomenon* is stated once, independently of any theory, as a property a learner can have. A *theory* then proves that its learners have it, possibly only under stated conditions. A *theory* may also fail to have it, and that failure is itself a theorem.

## Principles

- **Define once, reuse everywhere.** A discrimination net, a cue, a bounded store or an attention schedule is defined in one place and imported by every theory that uses it.
- **Theory-neutral phenomena.** Phenomena are stated without reference to any mechanism, so that different theories can be proved to have, or lack, the same phenomenon.
- **Qualitative first.** Most cognitive claims are qualitative ("can occur", "increases with", "is bowed"), and theorems are stated at that level. Quantitative claims can come later, as refinements.
- **Possibility and necessity.** Stochastic mechanisms are stated relationally: what *can* happen, and what *must*. Probability can be added on top.
- **Assumptions are explicit.** Each theory's postulates are definitions or hypotheses, cited to their source where there is one, with simplifications listed. Robustness to the arbitrary choices (codes, orders, parameters) is itself tested, by proof or, where the space is too large, by sampling with the cases that matter certified.
- **Fully checked.** No `sorry`; `#print axioms` shows only Lean's standard axioms. Core Lean where possible, so the library stays light and builds in seconds.
- **Instances keep the theory honest.** Concrete experiments are computed by the kernel (`decide`) and compared with observed or reported behavior.

## Where it stands

The first theory in the library is **EPAM** (`EPAM/LEAN/`), 48 theorems, no `sorry`:

- **Constructs it defines:**
  - feature codes;
  - discrimination nets with selection;
  - discrimination learning with a noticing order and redundancy;
  - cue codes and retrieval from partial cues with random branching;
  - restoration of cues;
  - serial attention with anchor points;
  - learner state and learning events for an experiment.
- **Phenomena it proves:**
  - stimulus generalization;
  - the cost of intralist similarity;
  - oscillation (correct responses that fail and recover);
  - retroactive inhibition;
  - learning to criterion without unlearning;
  - total time growing with the amount to be learned;
  - the serial position effect.
- **An experiment it computes:** serial anticipation of a six-syllable list. The responses the postulates make possible are compared trial by trial with a published simulation (33 or 34 of 34 agree, depending on the stimulus codes), and the result's sensitivity to codes, noticing order and parameters is measured (`EPAM/LEAN/analysis/RESULTS.md`).

At present these constructs live inside the EPAM theory. The next step for the library is to lift the general ones out into shared modules.

## Roadmap

1. **Library structure.** Move the general constructs out of `EPAM/LEAN/` into theory-neutral modules. Each phenomenon becomes a predicate on learners, and EPAM proves it about its learner. Proposed layout:
   - `Cog/Rep` (codes and features)
   - `Cog/Memory/DiscriminationNet`
   - `Cog/Memory/Cue`
   - `Cog/Control/Attention`
   - `Cog/Phenomena`
   - `Cog/Theories/EPAM`
   - `Cog/Experiments/SerialAnticipation`
2. **Finish EPAM:**
   - paired associates;
   - response generalization;
   - the distribution of error types;
   - cue codes sized by trial and error;
   - immediate memory.
3. **A second, different theory, to test that the constructs really are shared.** Candidates:
   - a bounded-memory account of sentence production (Yngve's depth hypothesis);
   - a production-system theory;
   - an activation-based retrieval theory.
4. **Comparisons:** for each phenomenon, which theories have it, under what conditions, and through which shared lemmas.

## Getting started

```sh
curl -sSfL https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh   # installs ~/.elan
cd EPAM/LEAN && lake build
```
