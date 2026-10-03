# Page map: Simon Papers, Box 14, FF965, "Heuristic Coder 7/16/61"

The 95-page scan is a printout of the complete IPL-V card deck, one card per line. Each line shows the comment, type, name, sign, PQ, SYMB, LINK and card ID in the standard columns. The ID is in cols 73-80, e.g. `U133 160`; from page 67 on, a letter `C` or `D` follows it. Page 1 has a pencilled total of "4464", probably the card count. Many pages carry handwritten debugging notes.

Each page image is a single 1880x2444 JPEG. To extract them, use `qpdf --show-pages --with-images` and `qpdf --show-object=N --raw-stream-data`.

Local symbols come in two styles: old-style `90`, `91`, `910`, `9-0` and new-style `9-90`. Both can appear in the same routine.

| Pages | First ID -> last ID | Contents |
|---|---|---|
| 1-2 | `000 010` -> `000 695` | Title "HEURISTIC CODER 7/16/61" (type 1). Type-2 region cards for A, B, C, D, E0, F, G, I, K, L, M, N0, O-Z and punctuation regions. Type-3 cards: "RESERVE PRINT LINE L101" (1L101, 1T100), then repeated region sizes. Type-5 header "MACHINE LANGUAGE" (PQ 30). |
| 2-3 | `E004 000` -> `E055 020` | E routines: print utilities (E4, E8, E40/E41 trace marking, E50-E55 print and space) |
| 3 | `R000 010` -> `R001 170` | R0 (mark to trace, lookup) and R1 (generate sentences for lookup, parse) |
| 4-14 | `T001 010` -> `T300 790` | T routines: translation, dictionary and parsing (T102 create dictionary entry, T106 search dictionary, T184-T188, T300 large) |
| 15-62 | `U023 010` -> `U199 220` | U routines: the coder proper (U100-U104 construct IPL-V words, symbols and processes; U133 assemble segments into JDEF; U153/U154 substitution; ...). **Pages 40 and 41 are the same page (`U133 160`-`U133 630`) scanned twice.** |
| 63-67 | `U199 230` -> `X007 840` | X routines (X5-X7) |
| 67-71 | `000 000 C` -> `T049 090 C` | Section "C": T tables (T10-T49, character and lexical tables, e.g. "T42 = TABLE FOR CHAR AFTER *") |
| 71-95 | `000 000 D` -> `X199 110 D` | Section "D": data list structures. A100s (word and phrase lists with 21-alphanumerics), L lists (L1-L45, L100, L130-L144, with "LOAD", "LOOKUP", "PARSE"), N integer terms, R5, T189-T201, U38/U80-U90, X1-X199 (the problem data). |

Per-page ranges (first ID on the page; `?` means the ID was cut off in the survey crop):

```
p01 000 010   p25 U098 120  p49 U141 610  p73 L016 01
p02 000 490   p26 U104 040  p50 U142 450  p74 L130 010
p03 E008 180  p27 U110 050  p51 U147 040  p75 L135 070
p04 T001 010  p28 U112 380  p52 U149 220  p76 N002 010
p05 T050 090  p29 U113 360  p53 U149 700  p77 U038 040
p06 T053 010  p30 U115 3?   p54 U149 118? p78 X003 010
p07 T069 030  p31 U116 470  p55 U152 110  p79 X066 01?
p08 T080 090  p32 U118 060  p56 U154 08?  p80 X101 010
p09 T081 140  p33 U119 190  p57 U155 02?  p81 X102 160
p10 T102 000  p34 U125 130  p58 U155 500  p82 X104 110
p11 T106 200  p35 U127 080  p59 U155 980  p83 X105 260
p12 T108 002  p36 U128 200  p60 U161 020  p84 X106 120
p13 T185 000  p37 U130 290  p61 U163 020  p85 X106 600
p14 T188 020  p38 U131 360  p62 U165 300  p86 X107 150
p15 T300 380  p39 U132 420  p63 U199 230  p87 X110 010
p16 U024 030  p40 U133 160  p64 X005 240  p88 X114 010
p17 U031 030  p41 U133 160  p65 X006 120  p89 X121 24?
p18 U035 050  p42 U133 640  p66 X007 360  p90 X124 110
p19 U046 230  p43 U1331120  p67 X007 840  p91 X171 040
p20 U050 010  p44 U136 100  p68 T034 050  p92 X180 220
p21 U055 290  p45 U139 350  p69 T040 190  p93 X180 700
p22 U070 010  p46 U139 830  p70 T041 220  p94 X181 200
p23 U076 100  p47 U140 410  p71 T049 030  p95 X199 040
p24 U095 020  p48 U141 130  p72 A113 060
```

The last card is `X199 110 D`. **No type-5 start card is visible**, so the program was presumably started by a separate card or another deck.

## RAND Memorandum RM-3588-PR (May 1963)

Simon, H. A., *The Heuristic Compiler*, RAND RM-3588-PR, May 1963. From bitsavers; not under copyright.

| File | Contents |
|---|---|
| `RM-3588-PR_The_Heuristic_Compiler_May63.pdf` | the whole memorandum, 133 scanned pages, no text layer |
| `RM-3588-PR_part1paper.pdf` / `_OCRed.pdf` | the paper: Parts I-III (memo pp. i-64), 72 pages |
| `RM-3588-PR_part2code.pdf` / `_OCRed.pdf` | the listings, 61 pages: Appendix A, "Program Listing of the Heuristic Compiler" (memo pp. 65-117; the compiler subset with T1, including U126); Appendix B, "Program Listing of an Information-Annexing Scheme" (memo pp. 118-125) |

The OCR versions were made by Jeff Shrager. In the code half, memo p. 125 comes second, after p. 65.
