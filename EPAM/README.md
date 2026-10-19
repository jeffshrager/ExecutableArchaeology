# EPAM

Feigenbaum's EPAM (Elementary Perceiver and Memorizer), a theory of verbal learning written in
IPL-V. Work so far is on **EPAM II** (RAND P-1817, 1959), which was only ever hand-simulated.
It now runs on the Lisp IPL-V (`../IPL-V/`); first light was 2026-10-18 (tag `epam-first-light`).

Start with:

- `EPAM_II_model.md`: what EPAM II models and is supposed to do, with our outputs (kept up to date)
- `HISTORY.md`: the sources and EPAM's versions (I to V), and what each source settles
- `LEAN/`: EPAM's cognitive postulates in Lean 4, and machine-checked proofs of the phenomena they explain (see `../coglean.md`)

| File | What it is |
|---|---|
| `IPL/epamfixed.card` | The EPAM II listing (P-1817 appendix) as cards. It is the earlier transcription, corrected only where checked against the page images |
| `IPL/CORRECTIONS.md` | Those corrections, with card IDs and pages |
| `IPL/EPAMFixed.liplv`, `IPL/liplv2cards.py` | The earlier `.liplv` transcription, and the converter that produced `epamfixed.card` |
| `IPL/make_run.py` | Builds the runnable `epam2-run.card` from `epamfixed.card` plus a driver. Every change is listed in its header (spelling, sections, the D0 patch, ...) |
| `IPL/drivers/` | Driver decks: *not* part of EPAM II. `write-a.card` sorts and writes the letter A |
| `EPAM_sc0340_1986-052_b56_f2.pdf`, `.txt` | A later EPAM listing (Stanford, Feigenbaum papers), not yet transcribed |

Run the first-light test:

```sh
cd IPL
python3 make_run.py --driver drivers/write-a.card
sbcl --non-interactive --eval '(load (compile-file "../../IPL-V/iplv.lisp"))' \
     --eval '(progn (set-trace-mode :none) (load-ipl "epam2-run.card"))'   # prints A
```
