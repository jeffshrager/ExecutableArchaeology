# Simon's Information-Annexing Scheme (RAND RM-3588-PR, Appendix B, 1962-63)

This is a small IPL-V program from Herbert Simon's RAND Memorandum *The Heuristic Compiler* (RM-3588-PR, May 1963), section IX "Definite Descriptions" and Appendix B. It is separate from the Heuristic Coder in `../`.

## What it does

It reads statements written as "definite descriptions":

```
X114 is the X33 of the X25 of X105.
```

and annexes the information to a store of IPL description lists. Each statement is punched as a card of symbols separated by blanks. **X99** stands for "is the". Values come before X99, and the chain of attributes and the object come after it:

```
X114 X99 X33 X25 X105
```

The method (memo pp. 55-57) has two phases:

1. **Identify.** Work from the right, following existing attribute values with J10.
2. **Annex.** Where J10 fails, work from the left, creating new objects and attaching them with J11 until the chain meets the part already in memory.

So the same phrase can either identify something already stored or describe something new.

## Routines

| Routine | Job |
|---|---|
| **M2** | Driver: run M10, then M0 and M1 for each statement (printing X105 after each one), then M4 and M7 |
| **M10/M11** | Read statements from cards: J180 to read a card, J184/J183 to find and measure each symbol, J181 to input it |
| **M0** | Split a statement at X99 into a value part and a function part |
| **M1** | Assign the value: M20/M21 build and reduce a "find list", and M22-M26 identify list members and copy or delete sections (X97/X98 mark sections) |
| **M4/M5/M6/M7** | Build and print a description of an expression: which of its parts are description lists (X86), lists (X85), or symbols (X45) |

Data:
- **A0-A2:** the three statements as lists.
- **X24, X41, X71, X72, X75, X76:** a small type lexicon for state descriptions.
- **X85-X91:** types.

## Files

| File | Contents |
|---|---|
| `transcription/p119.txt` … `p125.txt` | card-by-card transcription. The first field is the machine address printed in the listing. |
| `build.py` | builds `annexer.card` |
| `input.txt` | the input statement cards (the same three statements as A0-A2) |
| `output_1963.txt` | the only surviving output from 1963, the start of M2's dump of the statement list (memo p. 125) |
| `run.sh` | builds and runs on `../../IPL-V/iplv.lisp`. It writes `output.txt` (the program's printing) and `memory.txt` |

## Result

`./run.sh` runs M2 to completion. The statement list it prints matches the surviving 1963 output: three statements, the first being `X113 X99 X31 X20 X105`. After the run, memory holds:

```
the X20 of X105 = 9-774, whose X31 = X113
the X25 of X105 = 9-908, whose X33 = X114 and X34 = 9-596
members of 9-596 = (X115 X116)
```

That is:
- X113 is the X31 of the X20 of X105.
- X114 is the X33 of the X25 of X105.
- X115 and X116 are the X34 of the X25 of X105.

The third statement **found** the X25 object created by the second (the identify phase), instead of making a new one.

## Notes

- The input cards are not in the memorandum. The surviving output shows that the first card read was A0, so the input here is A0-A2 written as cards.
- Running this needed a few interpreter changes in `../../IPL-V/iplv.lisp`:
  - J77 was added.
  - Regional symbols that are used but not defined (X97-X100, X105, …) are created as empty cells.
  - J60 of the symbol 0 finds no next cell.
  - Three line-input fixes:
    - J180 clears the line before reading.
    - J181 does not overwrite an existing symbol.
    - J183 adds the scanned count to (0), as the manual says.

  The Heuristic Coder's T1 output is unchanged by these.
- Not yet tried: the memo's "member" sentences ("X125 is the X41 of a member of …", "the member whose X41 is X125 …"). M22-M25 are written for them, but the listing gives no example of how they are punched.
