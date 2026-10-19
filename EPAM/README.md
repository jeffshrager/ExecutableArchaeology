# EPAM

Feigenbaum's EPAM (Elementary Perceiver and Memorizer), a theory of verbal learning written in
IPL-V. Work so far is on **EPAM II** (RAND P-1817, 1959), which was only ever hand-simulated.
It now runs on the Lisp IPL-V (`../IPL-V/`); first light was 2026-10-18 (tag `epam-first-light`).

Start with:

- `EPAM_II_model.md`: what EPAM II models and is supposed to do, with our outputs (kept up to date)
- `HISTORY.md`: the sources and EPAM's versions (I to V), and what each source settles

| File | What it is |
|---|---|
| `epamfixed.card` | The EPAM II listing (P-1817 appendix) as cards. It is the earlier transcription, corrected only where checked against the page images |
| `CORRECTIONS.md` | Those corrections, with card IDs and pages |
| `EPAMFixed.liplv`, `liplv2cards.py` | The earlier `.liplv` transcription, and the converter that produced `epamfixed.card` |
| `make_run.py` | Builds the runnable `epam2-run.card` from `epamfixed.card` plus a driver. Every change is listed in its header (spelling, sections, the D0 patch, ...) |
| `drivers/` | Driver decks: *not* part of EPAM II. `write-a.card` sorts and writes the letter A |
| `EPAM_sc0340_1986-052_b56_f2.pdf`, `.txt` | A later EPAM listing (Stanford, Feigenbaum papers), not yet transcribed |

Run the first-light test:

```sh
python3 make_run.py --driver drivers/write-a.card
sbcl --non-interactive --eval '(load (compile-file "../IPL-V/iplv.lisp"))' \
     --eval '(progn (set-trace-mode :none) (load-ipl "epam2-run.card"))'   # prints A
```
