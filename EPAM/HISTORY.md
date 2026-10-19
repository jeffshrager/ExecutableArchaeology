# EPAM: sources and history (a note for future reference)

Collected 2026-10-18 while bringing EPAM II to first light. It records what each source is, where it is, and how it bears on the reanimation. `~/Documents` below means `~/Desktop/AIHistory/Documents`.

## The versions of EPAM

| Version | Date | Language and machine | Source we have | Status here |
|---|---|---|---|---|
| EPAM I | ~1958 | IBM 650 | none; mentioned in P-1817 §2.5 ("programmed for the IBM 650 computer over a year ago", macroprocesses only) | none |
| **EPAM II** | 1959 | IPL-V; **never run**, hand-simulated (P-1817 §4.0, p. 85) | listing in the appendix of P-1817 | **running** (`epamfixed.card`, `make_run.py`; first light 2026-10-18) |
| later EPAM (EPAM III?) | early 1960s | IPL-V, assembled (machine addresses in the listing) | Stanford SC0340 1986-052 box 56 folder 2 (`EPAM_sc0340_1986-052_b56_f2.pdf`, here) | not started |
| EPAM III | 1964 | IPL-V | Simon & Feigenbaum (1964); Feigenbaum & Simon (1984) (not in hand) | none |
| EPAM IV | 1988 | IPL-V **compiled for MS-DOS on a PC** (Richman) | described in Richman & Simon (1988), App. A | none |
| EPAM-V | 1987 | IPL-V | Richman (1987), listing pp. 9-21 | none |

Richman (1987) calls EPAM-V "a combination of EPAM III, EPAM IV and ZBIE", and contrasts "EPAM-III n-ary nodes" with "EPAM-II binary nodes". The binary nodes are what our U1 shows.

## The sources

**1. Feigenbaum, E. A., *An Information Processing Theory of Verbal Learning*. RAND P-1817, 9 October 1959.**
`~/Documents/P-1817_Feigenbaum_EPAM_Oct59_OCRed.pdf` (170 pp., with a text layer). There is another scan, `1959_Feigenbaum_EPAMII_P-1817_bp208rg5709.pdf` (165 pp.).
- The theory: macroprocesses M0-M3 and microprocesses D2, F1, F1a, F1b, F2, D8, F0, R, D1 (§2.3-2.4).
- The program's design (§3.0-3.6).
- Hand-simulated experiments with List A, KAG LUK RIL PEM ROM TIL: Fig. 4.1 (serial anticipation) and Fig. 4.2 (paired associates).
- **The Appendix (pp. 133ff, PDF pp. 141-170) is the EPAM II listing**, the source of `epamfixed.card`. "No specific data inputs are shown, with the exception of an example of a capital letter code" (Q1 = A).
- Printed page = PDF page − 8. The page images can be pulled out with pypdf/pillow (see the seshsums); the text layer breaks the listing's columns apart.
- Feigenbaum thanks Newell, Simon, J. C. Shaw and Fred Tonge (Preface).

**2. Stanford, Feigenbaum papers, SC0340, accession 1986-052, box 56, folder 2.**
`EPAM/EPAM_sc0340_1986-052_b56_f2.pdf` (68 pp.) with layout OCR `.txt`.
- An *assembled* IPL-V listing: each line has machine addresses next to the symbolic card, and card IDs like `F013-0010`, `K010-0010E`.
- Contents: F13-F31 ("RECORD NEW RESPONSE", "RECITE SERIAL LIST"), T4/T5 (task routines: "RESET AND DO READING TEST", "FIRST TASK"), Q2-Q38 letter tests ("LETTER L", "B(PBU)"), and K/L/N/P/B data (K10 "NULL RESPONSE", L64-L73 words such as CAR, DOG, CAT).
- Its F13 calls D21, D23 and F1, which EPAM II also has, with matching meanings. So it is probably a later version of the same system; whether its core routines match EPAM II's is unknown.
- An older rough OCR of the same folder is `Code/EPAM_Rough_OCR_vq775jv4844.txt` in the archived IPL-V folder (`vq775jv4844` is presumably its Stanford digital-repository ID).

**3. Feigenbaum, E. A., & Simon, H. A. A theory of the serial position effect. *Brit. J. Psychol.* 53 (1962), 307-320.**
`~/Documents/1962-FEIGENBAUM-EPAM.pdf`. This is the macroprocess model (M0-M3: serial mechanism, immediate memory, anchor points), the part of EPAM that is *not* in the EPAM II code. It was first a CIP Working Paper #14 (1959), cited in P-1817.

**4. Richman, H. B. *EPAM-V Definitions*. 1987.**
`~/Documents/1987-Richamn-EPAM-5.pdf` (21 pp.; the filename misspells Richman).
- Pp. 1-8: EPAM-V's structures. Objects have a REALM ("letter", "word", ...); there are simple and complex test nodes and images. FAMILIARIZATION and GENERALIZATION are dropped in favor of redundancy learning.
- **Pp. 9-21: an IPL-V listing of EPAM-V.** It has region cards; A0-A31 defined as `10An J10` (the same idiom as EPAM II's A0-A8); K10 as the null image; attributes "1ST BIT" to "14TH BIT"; and an "INPUTS NEXT ITEM FROM A SEQUENTIAL [file]" routine. As far as we have seen it contains no letter data.
- A candidate for a future reanimation.

**5. Richman, H. B., & Simon, H. A. *Context Effects in Letter Perception: A Comparison of Two Theories*. CMU Technical Report AIP-45, 30 June 1988.**
`~/Desktop/AIHistory/ELIZA_See_also_GDrive/1989_Richman_Simon_EPAM.pdf` (51 pp.). Published in *Psychological Review* 96 (1989).
- EPAM IV against McClelland & Rumelhart's interactive activation model, on word-superiority and letter-perception effects.
- **Appendix A: EPAM IV "was implemented in this study using a version of the IPL-V programming language… compiled in MSDOS for use on a personal computer."** So a PC IPL-V existed in 1988.
- Letters are coded by **Rumelhart's (1970) font of 14 line segments** (present, absent, or "0" for undeterminable; each feature 8% unclassifiable). This is a later scheme than EPAM II's 14-bit codes (EPAM II's A predates it), so it does not supply EPAM II's letter codes.
- Echoes of EPAM II: a word net "predisposed to test words for first letter, then last letter, then second letter, then third letter" (cf. EPAM II's 1-3-2 noticing order for syllables), anchor points, and a letter net whose root tests letter type (vowel, consonant, or can't tell).
- Cites EPAM III as Simon & Feigenbaum (1964) and Feigenbaum & Simon (1984).

## Earlier work in the archived IPL-V repo

`~/Desktop/AIHistory/IPL-V -- mostly replaced by Executable Archaeology -- consider stripping and deleting/repo`, commit `22eb767` ("Added EPAM code", 2026-01-27):
- `EPAM/EPAMFixed.liplv`, the earlier transcription of the P-1817 appendix (now `epamfixed.card` here);
- copies of P-1817 and Richman (1987);
- `1991_EPAM_Typicality_Programs_from_Simon_Archive.pdf`;
- four Simon-archive PDFs (`Simon_box00008_fld00557...`, `Simon_box00015_fld01056...` ×3).

These last five have not been examined yet. The same `.pdf` is also in `~/Desktop/AIHistory/Archives/SimonArchiveCMU/`. EPAMFixed was never run there: it had an added start card at Z1, a net test.

## What the sources settle, and what they don't

- **Settled:** EPAM II is the microprocesses only. The experiment (attention, trials) was Feigenbaum by hand, which is why there is no main program, apart from F10 ("THE SUBJECT, LEARNING IN NET U2, SERIAL ANTICIPATION"), which expects a memory drum (C0, C1).
- **Settled:** in this listing, leading zeros in a symbol's number don't matter (U0002 is U2).
- **Open:** EPAM II's letter codes other than A. We plan to reconstruct them from the letter net U1; Rumelhart's 14-segment font belongs to a later EPAM.
- **Open:** how the Stanford folder relates to EPAM II and to EPAM III.
- **Open:** whether Richman's PC IPL-V, or EPAM IV's code, survives anywhere.
