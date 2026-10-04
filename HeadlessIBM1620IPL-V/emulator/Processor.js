/***********************************************************************
* retro-1620/emulator Processor.js
************************************************************************
* Copyright (c) 2022, Paul Kimpel.
* Licensed under the MIT License, see
*       http://www.opensource.org/licenses/mit-license.php
************************************************************************
* JavaScript class module for the 1620 Model 2 processor.
*
* Primary references:
*   "IBM 1620 Central Processing Unit Model 2," Form A26-5781-2, ca 1966.
*   "IBM Data Processing System Model 2 Customer Engineering Intermediate
*       Level Diagrams," Form 227-5857-0 (includes Supplement S27-0500),
*       1964-04-29. Also known as the "ILD".
*   "Programming the IBM 1620," Second Edition, Clarence B. Germain,
*       Prentice-Hall, 1965.
* All are available at http://bitsavers.org/pdf/ibm/1620/.
************************************************************************
* 2022-07-19  P.Kimpel
*   Original version, from retro-g15 Processor.js.
***********************************************************************/

export {Processor}

import {Envir} from "./Envir.js";
import {FlipFlop} from "./FlipFlop.js";
import {Register} from "./Register.js";
import {Timer} from "./Timer.js";

// Processor states
const procStateLimbo = 0;
const procStateI1 = 1;
const procStateI2 = 2;
const procStateI3 = 3;
const procStateI4 = 4;
const procStateI5 = 5;
const procStateI6 = 6;
const procStateIX = 7;
const procStateIA1 = 8;
const procStateIA2 = 9;
const procStateIA3 = 10;
const procStateE1 = 11;
const procStateE2 = 12;
const procStateE3 = 13;
const procStateE4 = 14;
const procStateE5 = 15;


class Processor {

    // Static class properties

    static delayAlpha = 0.001;          // throttling delay average decay factor
    static delayAlpha1 = 1-Processor.delayAlpha;

    static diskAddressSize = 5;         // size of address field in disk sectors
    static diskSectorSize = 105;        // size of a disk sector including address digits

    // Instruction address type codes.
    static adNotUsed = 0;
    static adAddress = 1;
    static adField = 2;
    static adRecord = 3;
    static adLiteral = 4;
    static adDigit = 5;
    static adSpecial = 6;

    // Typewriter numeric input keystroke digit codes.
    static twprASCIInumeric1620 = {
        " ": 0,
        "0": 0,
        "1": 1,
        "2": 2,
        "3": 3,
        "4": 4,
        "5": 5,
        "6": 6,
        "7": 7,
        "8": 8,
        "9": 9,
        "@": Envir.numBlank,
        "|": Envir.numRecMark,
        "}": Envir.numGroupMark};

    // Standard alphanumeric input character codes for most devices.
    static stdASCIIalpha1620 = {
        " ": 0o00_00,
        "$": 0o01_03,
        "(": 0o02_04,
        ")": 0o00_04,
        "*": 0o01_04,
        "+": 0o01_00,
        ",": 0o02_03,
        "-": 0o02_00,
        ".": 0o00_03,
        "/": 0o02_01,
        "0": 0o07_00,
        "1": 0o07_01,
        "2": 0o07_02,
        "3": 0o07_03,
        "4": 0o07_04,
        "5": 0o07_05,
        "6": 0o07_06,
        "7": 0o07_07,
        "8": 0o07_10,
        "9": 0o07_11,
        "=": 0o03_03,
        "@": 0o03_04,
        "A": 0o04_01,
        "B": 0o04_02,
        "C": 0o04_03,
        "D": 0o04_04,
        "E": 0o04_05,
        "F": 0o04_06,
        "G": 0o04_07,
        "H": 0o04_10,
        "I": 0o04_11,
        "J": 0o05_01,
        "K": 0o05_02,
        "L": 0o05_03,
        "M": 0o05_04,
        "N": 0o05_05,
        "O": 0o05_06,
        "P": 0o05_07,
        "Q": 0o05_10,
        "R": 0o05_11,
        "S": 0o06_02,
        "T": 0o06_03,
        "U": 0o06_04,
        "V": 0o06_05,
        "W": 0o06_06,
        "X": 0o06_07,
        "Y": 0o06_10,
        "Z": 0o06_11,
        "|": 0o00_12,       // record mark
        "!": 0o05_12,       // flagged record mark
        "}": 0o00_17,       // group mark
        "\"":0o05_17,       // flagged group mark
        "]": 0o05_00,       // flagged zero (code 50)
        "^": 0o02_06};      // the "special" character (code 26)

    // Translate paper-tape code numerically to memory digits. Negative values
    // indicate paper-tape codes with invalid odd parity. This table implements
    // the behavior when reading alphanumeric data numerically.
    static xlateInNumeric = [   // indexed by paper-tape code
               0,               // ........
        0b000001,               // .......1   '1' -> '1'
        0b000010,               // ......2.   '2' -> '2'
               0,               // ......21
        0b000100,               // .....4..   '4' -> '4'
               0,               // .....4.1
               0,               // .....42.
        0b000111,               // .....421   '7' -> '7'
        0b001000,               // ....8...   '8' -> '8'
               0,               // ....8..1
               0,               // ....8.2.
        0b001011,               // ....8.21   '=' -> '='
               0,               // ....84..
        0b100000,               // ....84.1   '_' -> '0'   unassigned
        0b101110,               // ....842.                DC1 => 842 punch, End Card 1, causes MBR error
               0,               // ....8421
        0b100000,               // ...C....   ' ' -> '0'
               0,               // ...C...1
               0,               // ...C..2.
        0b100011,               // ...C..21   '3' -> '3'
               0,               // ...C.4..
        0b100101,               // ...C.4.1   '5' -> '5'
        0b100110,               // ...C.42.   '6' -> '6'
               0,               // ...C.421
               0,               // ...C8...
        0b101001,               // ...C8..1   '9' -> '9'
        0b101010,               // ...C8.2.   '_' -> '|'   unassigned
               0,               // ...C8.21
        0b101100,               // ...C84..   '@' -> ' '
               0,               // ...C84.1
               0,               // ...C842.
        0b101111,               // ...C8421   '_' -> '}'   unassigned
        0b100000,               // ..0.....   '0' -> '0'
               0,               // ..0....1
               0,               // ..0...2.
        0b100011,               // ..0...21   'T' -> '3'
               0,               // ..0..4..
        0b100101,               // ..0..4.1   'V' -> '5'
        0b100110,               // ..0..42.   'W' -> '6'
               0,               // ..0..421
               0,               // ..0.8...
        0b101001,               // ..0.8..1   'Z' -> '9'
        0b101010,               // ..0.8.2.   '|' -> '|'
               0,               // ..0.8.21
        0b101100,               // ..0.84..   '(' -> ' '
               0,               // ..0.84.1
               0,               // ..0.842.
        0b101111,               // ..0.8421   '}' -> '}'
               0,               // ..0C....
        0b000001,               // ..0C...1   '/' -> '1'
        0b000010,               // ..0C..2.   'S' -> '2'
               0,               // ..0C..21
        0b000100,               // ..0C.4..   'U' -> '4'
               0,               // ..0C.4.1
               0,               // ..0C.42.
        0b000111,               // ..0C.421   'X' -> '7'
        0b001000,               // ..0C8...   'Y' -> '8'
               0,               // ..0C8..1
               0,               // ..0C8.2.
        0b001011,               // ..0C8.21   ',' -> '='
               0,               // ..0C84..
        0b100000,               // ..0C84.1   '_' -> '0'   unassigned
               0,               // ..0C842.   '^' -> '_'   "special char" - paper-tape output only?
               0,               // ..0C8421
        0b010000,               // .X......   '-' -> ']'
               0,               // .X.....1
               0,               // .X....2.
        0b010011,               // .X....21   'L' -> 'L'
               0,               // .X...4..
        0b010101,               // .X...4.1   'N' -> 'N'
        0b010110,               // .X...42.   'O' -> 'O'
               0,               // .X...421
               0,               // .X..8...
        0b011001,               // .X..8..1   'R' -> 'R'
        0b011010,               // .X..8.2.   '!' -> '!'
               0,               // .X..8.21
        0b011100,               // .X..84..   '*' -> '-'
               0,               // .X..84.1
               0,               // .X..842.
        0b011111,               // .X..8421   '"' -> '"'
               0,               // .X.C....
        0b110001,               // .X.C...1   'J' -> 'J'
        0b110010,               // .X.C..2.   'K' -> 'K'
               0,               // .X.C..21
        0b110100,               // .X.C.4..   'M' -> 'M'
               0,               // .X.C.4.1
               0,               // .X.C.42.
        0b110111,               // .X.C.421   'P' -> 'P'
        0b111000,               // .X.C8...   'Q' -> 'Q'
               0,               // .X.C8..1
               0,               // .X.C8.2.                CR  => XC842 punch, Carriage Return, causes MBR error
        0b111011,               // .X.C8.21   '$' -> '$'
               0,               // .X.C84..
        0b010000,               // .X.C84.1   '-' -> ']'
        0b111110,               // .X.C842.                unassigned
               0,               // .X.C8421
               0,               // .X0.....
        0b000001,               // .X0....1   'A' -> '1'
        0b000010,               // .X0...2.   'B' -> '2'
               0,               // .X0...21
        0b000100,               // .X0..4..   'D' -> '4'
               0,               // .X0..4.1
               0,               // .X0..42.
        0b000111,               // .X0..421   'G' -> '7'
        0b001000,               // .X0.8...   'H' -> '8'
               0,               // .X0.8..1
               0,               // .X0.8.2.
        0b001011,               // .X0.8.21   '.' -> '='
               0,               // .X0.84..
        0b100000,               // .X0.84.1   '_' -> '0'   unassigned
        0b111110,               // .X0.842.                unassigned
               0,               // .X0.8421
        0b010000,               // .X0C....   '+' -> ']'
               0,               // .X0C...1
               0,               // .X0C..2.
        0b100011,               // .X0C..21   'C' -> '3'
               0,               // .X0C.4..
        0b100101,               // .X0C.4.1   'E' -> '5'
        0b100110,               // .X0C.42.   'F' -> '6'
               0,               // .X0C.421
               0,               // .X0C8...
        0b101001,               // .X0C8..1   'I' -> '9'
        0b011010,               // .X0C8.2.   '!' -> '!'   alternate for flagged record mark
               0,               // .X0C8.21
        0b101100,               // .X0C84..   ')' -> ' '
               0,               // .X0C84.1
               0,               // .X0C842.
        0b011111];              // .X0C8421   '_' -> '"'   unassigned

    // Translate paper-tape code alphanumerically to memory digits. Negative
    // values indicate paper-tape codes with invalid odd parity.
    static xlateInAlpha = [     // indexed by paper-tape code
                      0,        // ........
        0b000111_000001,        // .......1   '1' -> '1'
        0b000111_000010,        // ......2.   '2' -> '2'
                      0,        // ......21
        0b000111_000100,        // .....4..   '4' -> '4'
                      0,        // .....4.1
                      0,        // .....42.
        0b000111_000111,        // .....421   '7' -> '7'
        0b000111_001000,        // ....8...   '8' -> '8'
                      0,        // ....8..1
                      0,        // ....8.2.
        0b100011_100011,        // ....8.21   '=' -> '='
                      0,        // ....84..
        0b000111_100000,        // ....84.1   '_' -> '0'    unassigned
        0b100000_101110,        // ....842.                 DC1 => 842 punch, End Card 1, causes MBR error
                      0,        // ....8421
        0b100000_100000,        // ...C....   ' ' -> ' '
                      0,        // ...C...1
                      0,        // ...C..2.
        0b000111_100011,        // ...C..21   '3' -> '3'
                      0,        // ...C.4..
        0b000111_100101,        // ...C.4.1   '5' -> '5'
        0b000111_100110,        // ...C.42.   '6' -> '6'
                      0,        // ...C.421
                      0,        // ...C8...
        0b000111_101001,        // ...C8..1   '9' -> '9'
        0b100000_101010,        // ...C8.2.   '_' -> '|'    unassigned
                      0,        // ...C8.21
        0b100011_000100,        // ...C84..   '@' -> '@'
                      0,        // ...C84.1
                      0,        // ...C842.
        0b100000_101111,        // ...C8421   '_' -> '}'    unassigned
        0b000111_100000,        // ..0.....   '0' -> '0'
                      0,        // ..0....1
                      0,        // ..0...2.
        0b100110_100011,        // ..0...21   'T' -> 'T'
                      0,        // ..0..4..
        0b100110_100101,        // ..0..4.1   'V' -> 'V'
        0b100110_100110,        // ..0..42.   'W' -> 'W'
                      0,        // ..0..421
                      0,        // ..0.8...
        0b100110_101001,        // ..0.8..1   'Z' -> 'Z'
        0b100000_101010,        // ..0.8.2.   '|' -> '|'
                      0,        // ..0.8.21
        0b000010_000100,        // ..0.84..   '(' -> '('
                      0,        // ..0.84.1
                      0,        // ..0.842.
        0b100000_101111,        // ..0.8421   '}' -> '}'
                      0,        // ..0C....
        0b000010_000001,        // ..0C...1   '/' -> '/'
        0b100110_000010,        // ..0C..2.   'S' -> 'S'
                      0,        // ..0C..21
        0b100110_000100,        // ..0C.4..   'U' -> 'U'
                      0,        // ..0C.4.1
                      0,        // ..0C.42.
        0b100110_000111,        // ..0C.421   'X' -> 'X'
        0b100110_001000,        // ..0C8...   'Y' -> 'Y'
                      0,        // ..0C8..1
                      0,        // ..0C8.2.
        0b000010_100011,        // ..0C8.21   ',' -> ','
                      0,        // ..0C84..
        0b100110_100000,        // ..0C84.1
                      0,        // ..0C842.   '^' -> '_'    "special char" - paper-tape output only?
                      0,        // ..0C8421
        0b000010_100000,        // .X......   '-' -> '-'
                      0,        // .X.....1
                      0,        // .X....2.
        0b100101_100011,        // .X....21   'L' -> 'L'
                      0,        // .X...4..
        0b100101_100101,        // .X...4.1   'N' -> 'N'
        0b100101_100110,        // .X...42.   'O' -> 'O'
                      0,        // .X...421
                      0,        // .X..8...
        0b100101_101001,        // .X..8..1   'R' -> 'R'
        0b100101_101010,        // .X..8.2.   '!' -> '|'
                      0,        // .X..8.21
        0b000001_000100,        // .X..84..   '*' -> '*'
                      0,        // .X..84.1
                      0,        // .X..842.
        0b100101_101111,        // .X..8421   '"' -> '}'
                      0,        // .X.C....
        0b100101_000001,        // .X.C...1   'J' -> 'J'
        0b100101_000010,        // .X.C..2.   'K' -> 'K'
                      0,        // .X.C..21
        0b100101_000100,        // .X.C.4..   'M' -> 'M'
                      0,        // .X.C.4.1
                      0,        // .X.C.42.
        0b100101_000111,        // .X.C.421   'P' -> 'P'
        0b100101_001000,        // .X.C8...   'Q' -> 'Q'
                      0,        // .X.C8..1
                      0,        // .X.C8.2.
        0b000001_100011,        // .X.C8.21   '$' -> '$'
                      0,        // .X.C84..
        0b100101_100000,        // .X.C84.1   '-' -> ']'
        0b100000_101110,        // .X.C842.                 CR  => XC842 punch, Carriage Return, causes MBR error
                      0,        // .X.C8421
                      0,        // .X0.....
        0b000100_000001,        // .X0....1   'A' -> 'A'
        0b000100_000010,        // .X0...2.   'B' -> 'B'
                      0,        // .X0...21
        0b000100_000100,        // .X0..4..   'D' -> 'D'
                      0,        // .X0..4.1
                      0,        // .X0..42.
        0b000100_000111,        // .X0..421   'G' -> 'G'
        0b000100_001000,        // .X0.8...   'H' -> 'H'
                      0,        // .X0.8..1
                      0,        // .X0.8.2.
        0b100000_100011,        // .X0.8.21   '.' -> '.'
                      0,        // .X0.84..
        0b000100_100000,        // .X0.84.1                 unassigned
        0b100000_001110,        // .X0.842.                 unassigned
                      0,        // .X0.8421
        0b000001_100000,        // .X0C....   '+' -> '+'
                      0,        // .X0C...1
                      0,        // .X0C..2.
        0b000100_100011,        // .X0C..21   'C' -> 'C'
                      0,        // .X0C.4..
        0b000100_100101,        // .X0C.4.1   'E' -> 'E'
        0b000100_100110,        // .X0C.42.   'F' -> 'F'
                      0,        // .X0C.421
                      0,        // .X0C8...
        0b000100_101001,        // .X0C8..1   'I' -> 'I'
        0b100000_101010,        // .X0C8.2.   '!' -> '|'    alternate for flagged Record Mark
                      0,        // .X0C8.21
        0b100000_000100,        // .X0C84..   ')' -> ')'
                      0,        // .X0C84.1
                      0,        // .X0C842.
        0b100000_101111];       // .X0C8421   '_' -> '}'

    // Translate memory digits numerically to paper-tape code.
    static xlateOutNumeric = [  // indexed by the F8421 bits of a digit
        0b00100000,     0b00000001,     0b00000010,     0b00010011,     // 0-3
        0b00000100,     0b00010101,     0b00010110,     0b00000111,     // 4-7
        0b00001000,     0b00011001,     0b00101010,     0b00001011,     // 8-9, RM, =
        0b00011100,              0,              0,     0b00101111,     // NB, ?, ?, GM

        0b01000000,     0b01010001,     0b01010010,     0b01000011,     // 0-3 (flagged)
        0b01010100,     0b01000101,     0b01000110,     0b01010111,     // 4-7 (flagged)
        0b01011000,     0b01001001,     0b01001010,              0,     // 8-9, RM, ? (flagged)
        0b01001100,              0,              0,     0b01001111];    // NB, ?, ?, GM (flagged)

    // Translate memory digit pairs alphanumerically to paper-tape code.
    static xlateOutAlpha = [    // indexed by [(zone 8421)*16 + (numeric 8421)]
        0b00010000,              0,     0b00001101,     0b01101011,     // 00   02=841 for 1443 "?"
        0b01111100,              0,              0,              0,     // 04
                 0,              0,     0b00101010,              0,     // 08
                 0,              0,              0,     0b00101111,     // 0C
        0b01110000,              0,     0b00111101,     0b01011011,     // 10   12=0C841 for 1443 "!"
        0b01001100,              0,              0,              0,     // 14
                 0,              0,              0,              0,     // 18
                 0,              0,              0,              0,     // 1C
        0b01000000,     0b00110001,     0b00101010,     0b00111011,     // 20   22=082 for 1443 RM
        0b00101100,              0,     0b00111110,              0,     // 24
                 0,              0,              0,              0,     // 28
                 0,              0,              0,              0,     // 2C
                 0,              0,              0,     0b00001011,     // 30
        0b00011100,     0b01101101,              0,              0,     // 34   35=X0841 for 1443 ":"
                 0,              0,              0,              0,     // 38
                 0,              0,              0,              0,     // 3C
                 0,     0b01100001,     0b01100010,     0b01110011,     // 40
        0b01100100,     0b01110101,     0b01110110,     0b01100111,     // 44
        0b01101000,     0b01111001,              0,              0,     // 48
                 0,              0,              0,              0,     // 4C
        0b01011101,     0b01010001,     0b01010010,     0b01000011,     // 50   50=XC841 alt for -0
        0b01010100,     0b01000101,     0b01000110,     0b01010111,     // 54
        0b01011000,     0b01001001,     0b01001010,              0,     // 58
                 0,              0,              0,     0b01001111,     // 5C
                 0,              0,     0b00110010,     0b00100011,     // 60
        0b00110100,     0b00100101,     0b00100110,     0b00110111,     // 64
        0b00111000,     0b00101001,              0,              0,     // 68
                 0,              0,              0,              0,     // 6C
        0b00100000,     0b00000001,     0b00000010,     0b00010011,     // 70
        0b00000100,     0b00010101,     0b00010110,     0b00000111,     // 74
        0b00001000,     0b00011001,              0,              0,     // 78
                 0,              0,              0,              0,     // 7C
                 0,              0,              0,              0,     // 80
                 0,              0,              0,              0,     // 84
                 0,              0,              0,              0,     // 88
                 0,              0,              0,              0,     // 8C
                 0,              0,              0,              0,     // 90
                 0,              0,              0,              0,     // 94
                 0,              0,              0,              0,     // 98
                 0,              0,              0,              0,     // 9C
                 0,              0,              0,              0,     // A0
                 0,              0,              0,              0,     // A4
                 0,              0,              0,              0,     // A8
                 0,              0,              0,              0,     // AC
                 0,              0,              0,              0,     // B0
                 0,              0,              0,              0,     // B4
                 0,              0,              0,              0,     // B8
                 0,              0,              0,              0,     // BC
                 0,              0,              0,              0,     // C0
                 0,              0,              0,              0,     // C4
                 0,              0,              0,              0,     // C8
                 0,              0,              0,              0,     // CC
                 0,              0,              0,              0,     // D0
                 0,              0,              0,              0,     // D4
                 0,              0,              0,              0,     // D8
                 0,              0,              0,              0,     // DC
                 0,              0,              0,              0,     // E0
                 0,              0,              0,              0,     // E4
                 0,              0,              0,              0,     // E8
                 0,              0,              0,              0,     // EC
                 0,              0,              0,              0,     // F0
                 0,              0,              0,              0,     // F4
                 0,              0,              0,              0,     // F8
                 0,              0,              0,              0];    // FC


    static addCarryBit = 0b1000000;
    static addCheckBit = 0b0100000;

    // Arithmetic addition table: indexed by the P and Q digit index values,
    // which are obtained from pCompTable[] and qCompTable[], respectively.
    // Output is in format yc08421: y=carry-out bit, c=odd-parity check bit,
    // 0=flag bit (always 0). See ILD drawing 10.01.31.1.
    static addTable = [
        [0x00,0x01,0x02,0x03,0x06,0x07,0x00,0x09,0x0a,0x03,0x0a,0x03,0x0e,0x07,0x0a,0x0b,       // P=0
         0x00,0x01,0x02,0x03,0x06,0x07,0x00,0x09,0x0a,0x03,0x0a,0x03,0x0e,0x07,0x0a,0x0b],
        [0x23,0x02,0x23,0x02,0x25,0x24,0x21,0x08,0x29,0x20,0x29,0x20,0x2d,0x24,0x29,0x28,       // P=1
         0x01,0x00,0x05,0x04,0x27,0x26,0x07,0x0e,0x69,0x60,0x6d,0x64,0x6f,0x66,0x6f,0x6e],
        [0x22,0x23,0x04,0x25,0x26,0x27,0x06,0x29,0x60,0x61,0x44,0x65,0x66,0x67,0x46,0x69,       // P=2
         0x02,0x03,0x04,0x25,0x0e,0x07,0x08,0x29,0x40,0x41,0x44,0x65,0x4e,0x47,0x48,0x69],
        [0x01,0x00,0x25,0x24,0x07,0x04,0x07,0x28,0x61,0x60,0x65,0x64,0x67,0x64,0x67,0x68,       // P=3
         0x03,0x02,0x25,0x24,0x0f,0x06,0x0b,0x2a,0x63,0x62,0x65,0x64,0x6f,0x66,0x6b,0x6a],
        [0x04,0x25,0x26,0x07,0x08,0x29,0x68,0x41,0x42,0x43,0x62,0x43,0x4a,0x4b,0x6a,0x43,       // P=4
         0x04,0x25,0x26,0x07,0x08,0x29,0x60,0x41,0x62,0x63,0x62,0x63,0x6a,0x6b,0x62,0x63],
        [0x23,0x22,0x23,0x02,0x29,0x20,0x69,0x40,0x61,0x60,0x61,0x60,0x69,0x60,0x69,0x60,       // P=5
         0x05,0x24,0x25,0x04,0x23,0x22,0x67,0x46,0x65,0x64,0x65,0x64,0x63,0x62,0x67,0x66],
        [0x26,0x27,0x2c,0x0d,0x68,0x69,0x60,0x41,0x64,0x65,0x6c,0x4d,0x6c,0x6d,0x64,0x45,       // P=6
         0x06,0x07,0x2c,0x0d,0x48,0x49,0x60,0x41,0x64,0x65,0x6c,0x6d,0x6c,0x6d,0x64,0x65],
        [0x09,0x08,0x29,0x28,0x41,0x40,0x65,0x44,0x65,0x64,0x65,0x64,0x65,0x64,0x65,0x64,       // P=7
         0x07,0x06,0x61,0x60,0x43,0x42,0x63,0x42,0x67,0x66,0x65,0x64,0x67,0x66,0x67,0x66],
        [0x28,0x29,0x60,0x61,0x42,0x63,0x44,0x65,0x66,0x67,0x66,0x67,0x46,0x67,0x46,0x67,       // P=8
         0x08,0x09,0x40,0x41,0x42,0x63,0x44,0x65,0x46,0x47,0x46,0x47,0x46,0x67,0x46,0x67],
        [0x21,0x40,0x61,0x42,0x63,0x62,0x67,0x66,0x67,0x66,0x67,0x66,0x67,0x66,0x67,0x66,       // P=9
         0x09,0x48,0x45,0x46,0x67,0x66,0x47,0x46,0x69,0x68,0x65,0x66,0x67,0x66,0x67,0x66],
        [0x2a,0x2b,0x64,0x65,0x66,0x63,0x46,0x65,0x66,0x67,0x66,0x67,0x66,0x67,0x46,0x67,       // P=A
         0x0a,0x0b,0x44,0x65,0x4a,0x63,0x4c,0x65,0x44,0x45,0x44,0x65,0x4e,0x67,0x4c,0x65],
        [0x01,0x40,0x65,0x66,0x67,0x62,0x67,0x66,0x67,0x66,0x67,0x66,0x67,0x66,0x67,0x66,       // P=B
         0x0b,0x4a,0x65,0x66,0x4f,0x46,0x4f,0x66,0x6b,0x6a,0x65,0x66,0x6f,0x66,0x6f,0x66],
        [0x2c,0x2d,0x64,0x65,0x48,0x69,0x6c,0x65,0x66,0x67,0x66,0x67,0x4e,0x6f,0x6e,0x67,       // P=C
         0x0c,0x2d,0x64,0x45,0x48,0x69,0x64,0x65,0x66,0x67,0x66,0x67,0x6e,0x6f,0x66,0x67],
        [0x21,0x60,0x61,0x42,0x6b,0x62,0x6f,0x66,0x67,0x66,0x67,0x66,0x6f,0x66,0x6f,0x66,       // P=D
         0x0d,0x6c,0x65,0x46,0x67,0x66,0x67,0x46,0x6d,0x6c,0x65,0x66,0x67,0x66,0x67,0x66],
        [0x2e,0x2f,0x6c,0x6d,0x68,0x69,0x64,0x65,0x66,0x67,0x6e,0x6f,0x6e,0x6f,0x66,0x67,       // P=E
         0x0e,0x0f,0x6c,0x4d,0x48,0x69,0x64,0x65,0x64,0x65,0x6c,0x6d,0x6c,0x6d,0x64,0x65],
        [0x09,0x48,0x69,0x6a,0x63,0x62,0x67,0x66,0x67,0x66,0x67,0x66,0x67,0x66,0x67,0x66,       // P=F
         0x0f,0x4e,0x61,0x62,0x47,0x46,0x67,0x46,0x6f,0x6e,0x65,0x66,0x67,0x66,0x67,0x66],
        [0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,0x09,0x0a,0x0b,0x0c,0x0d,0x0e,0x0f,       // P=c0
         0x20,0x21,0x22,0x23,0x24,0x25,0x26,0x27,0x28,0x29,0x2a,0x2b,0x2c,0x2d,0x2e,0x2f],
        [0x27,0x26,0x07,0x06,0x21,0x20,0x41,0x40,0x09,0x00,0x09,0x00,0x09,0x00,0x49,0x40,       // P=c1
         0x21,0x00,0x21,0x00,0x21,0x00,0x21,0x00,0x69,0x40,0x69,0x40,0x69,0x40,0x69,0x40],
        [0x02,0x03,0x04,0x25,0x06,0x01,0x06,0x23,0x40,0x41,0x44,0x65,0x46,0x41,0x46,0x63,       // P=c2
         0x22,0x03,0x24,0x25,0x28,0x01,0x2a,0x23,0x60,0x41,0x64,0x65,0x68,0x41,0x6a,0x63],
        [0x05,0x04,0x25,0x24,0x07,0x00,0x47,0x60,0x41,0x40,0x65,0x64,0x47,0x40,0x47,0x60,       // P=c3
         0x23,0x02,0x27,0x26,0x29,0x08,0x29,0x28,0x63,0x42,0x67,0x66,0x69,0x48,0x69,0x68],
        [0x24,0x27,0x02,0x03,0x2c,0x27,0x4e,0x47,0x48,0x4b,0x4a,0x4b,0x4c,0x4f,0x4e,0x4f,       // P=c4
         0x24,0x25,0x2a,0x2b,0x64,0x65,0x66,0x67,0x68,0x69,0x6a,0x6b,0x6c,0x6d,0x6e,0x6f],
        [0x27,0x26,0x07,0x06,0x29,0x22,0x49,0x42,0x63,0x42,0x63,0x42,0x69,0x42,0x69,0x42,       // P=c5
         0x25,0x24,0x09,0x08,0x61,0x60,0x41,0x40,0x65,0x44,0x69,0x48,0x61,0x40,0x61,0x40],
        [0x26,0x07,0x08,0x2b,0x60,0x43,0x42,0x63,0x44,0x47,0x4c,0x6f,0x44,0x47,0x46,0x67,       // P=c6
         0x26,0x07,0x08,0x29,0x60,0x41,0x42,0x63,0x64,0x65,0x6c,0x6d,0x64,0x65,0x66,0x67],
        [0x2f,0x0e,0x2f,0x2e,0x61,0x42,0x45,0x66,0x67,0x46,0x67,0x66,0x65,0x46,0x65,0x66,       // P=c7
         0x27,0x06,0x6b,0x6a,0x69,0x48,0x49,0x68,0x67,0x46,0x6f,0x6e,0x6d,0x4c,0x6d,0x6c],
        [0x28,0x29,0x60,0x61,0x44,0x65,0x46,0x67,0x6e,0x6f,0x6e,0x6f,0x4e,0x6f,0x4e,0x6f,       // P=c8
         0x28,0x29,0x60,0x61,0x64,0x65,0x66,0x67,0x6c,0x6d,0x6c,0x6d,0x6c,0x6d,0x6e,0x6f],
        [0x21,0x60,0x41,0x42,0x63,0x62,0x67,0x66,0x47,0x46,0x47,0x46,0x67,0x66,0x67,0x66,       // P=c9
         0x29,0x48,0x61,0x42,0x65,0x44,0x65,0x46,0x69,0x48,0x61,0x42,0x65,0x44,0x65,0x46],
        [0x2a,0x2b,0x64,0x65,0x46,0x61,0x46,0x67,0x66,0x67,0x66,0x67,0x46,0x67,0x46,0x67,       // P=cA
         0x2a,0x0b,0x64,0x65,0x68,0x61,0x6e,0x67,0x64,0x45,0x64,0x65,0x6c,0x65,0x6e,0x67],
        [0x01,0x40,0x65,0x66,0x67,0x62,0x67,0x66,0x47,0x46,0x67,0x66,0x67,0x66,0x67,0x66,       // P=cB
         0x2b,0x4a,0x67,0x66,0x6d,0x4c,0x6d,0x6e,0x6b,0x4a,0x67,0x66,0x6d,0x4c,0x6d,0x6e],
        [0x2c,0x2f,0x60,0x63,0x6c,0x67,0x4e,0x67,0x6e,0x6f,0x6e,0x6f,0x4e,0x6f,0x4e,0x6f,       // P=cC
         0x2c,0x2d,0x68,0x69,0x64,0x65,0x66,0x67,0x6c,0x6d,0x6c,0x6d,0x6c,0x6d,0x6e,0x6f],
        [0x27,0x66,0x43,0x42,0x6b,0x62,0x6f,0x66,0x67,0x46,0x67,0x46,0x6f,0x66,0x6f,0x66,       // P=cD
         0x2d,0x6c,0x49,0x4a,0x65,0x64,0x45,0x46,0x6d,0x4c,0x69,0x4a,0x65,0x44,0x65,0x46],
        [0x2e,0x2f,0x68,0x6b,0x60,0x63,0x46,0x67,0x66,0x67,0x6e,0x6f,0x46,0x67,0x46,0x67,       // P=cE
         0x2e,0x0f,0x48,0x69,0x60,0x61,0x46,0x67,0x64,0x65,0x6c,0x6d,0x64,0x65,0x66,0x67],
        [0x2f,0x4e,0x6b,0x6a,0x63,0x62,0x67,0x66,0x67,0x46,0x67,0x66,0x67,0x66,0x67,0x66,       // P=cF
         0x2f,0x4e,0x6b,0x6a,0x6d,0x4c,0x4d,0x6e,0x6f,0x4e,0x6f,0x6e,0x6d,0x4c,0x6d,0x6e],
    ];

    static compCarryBit = 0b100000;     // carry bit from qCompTable (not used for pCompTable)

    // Arithmetic complement table for P digit: indexed by true/comp (0/1) and
    // P digit with check and flag bits. Output is format yxxxxx: y=complement
    // carry-out bit (always 0 for P), xxxxx=index into first dimension of
    // addTable[]. See ILD drawing 10.01.32.1. Note that carry-in does not affect
    // the true/complement network for the P digit, so its table has one less
    // dimension than the table for the Q digit.
    static pCompTable = [
        // true
        [0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,0x09,0x0a,0x0b,0x08,0x09,0x0a,0x0b,
         0x10,0x11,0x12,0x13,0x14,0x15,0x16,0x17,0x18,0x19,0x1a,0x1b,0x18,0x19,0x1a,0x1b,
         0x10,0x11,0x12,0x13,0x14,0x15,0x16,0x17,0x18,0x19,0x1a,0x1b,0x18,0x19,0x1a,0x1b,
         0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,0x09,0x0a,0x0b,0x08,0x09,0x0a,0x0b],
        // complement
        [0x05,0x08,0x07,0x02,0x15,0x08,0x17,0x02,0x01,0x08,0x03,0x02,0x11,0x08,0x13,0x02,
         0x19,0x14,0x13,0x16,0x19,0x04,0x13,0x06,0x19,0x10,0x13,0x12,0x19,0x00,0x13,0x02,
         0x19,0x14,0x13,0x16,0x19,0x04,0x13,0x06,0x19,0x10,0x13,0x12,0x19,0x00,0x13,0x02,
         0x05,0x08,0x07,0x02,0x15,0x08,0x17,0x02,0x01,0x08,0x03,0x02,0x11,0x08,0x13,0x02],
    ];

    // Arithmetic complement table for Q digit: indexed by true/comp (0/1) and
    // Q digit with check and flag bits. Output is format yxxxxx: y=complement
    // carry-out bit, xxxxx=index into second dimension of addTable[].
    // See ILD drawing 10.01.32.1.
    static qCompTable = [
        [   // true
            [0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,0x09,0x0a,0x0b,0x0c,0x0d,0x0e,0x0f,   // no carry-in
             0x10,0x11,0x12,0x13,0x14,0x15,0x16,0x17,0x18,0x19,0x1a,0x1b,0x1c,0x1d,0x1e,0x1f,
             0x10,0x11,0x12,0x13,0x14,0x15,0x16,0x17,0x18,0x19,0x1a,0x1b,0x1c,0x1d,0x1e,0x1f,
             0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,0x09,0x0a,0x0b,0x0c,0x0d,0x0e,0x0f],  // carry-in
            [0x13,0x02,0x13,0x02,0x15,0x1c,0x11,0x08,0x19,0x18,0x19,0x18,0x1d,0x1c,0x19,0x18,
             0x01,0x00,0x05,0x04,0x17,0x16,0x07,0x06,0x31,0x30,0x35,0x34,0x37,0x36,0x37,0x36,
             0x01,0x00,0x05,0x04,0x17,0x16,0x07,0x06,0x31,0x30,0x35,0x34,0x37,0x36,0x37,0x36,
             0x13,0x02,0x13,0x02,0x15,0x1c,0x11,0x08,0x19,0x18,0x19,0x18,0x1d,0x1c,0x19,0x18]
        ],
        [   // complement
            [0x09,0x08,0x07,0x06,0x15,0x04,0x13,0x02,0x01,0x00,0x07,0x06,0x15,0x04,0x13,0x02,   // no carry-in
             0x19,0x18,0x17,0x16,0x15,0x04,0x13,0x02,0x11,0x10,0x17,0x16,0x15,0x04,0x13,0x02,
             0x19,0x18,0x17,0x16,0x15,0x04,0x13,0x02,0x11,0x10,0x17,0x16,0x15,0x04,0x13,0x02,
             0x09,0x08,0x07,0x06,0x15,0x04,0x13,0x02,0x01,0x00,0x07,0x06,0x15,0x04,0x13,0x02],
            [0x18,0x19,0x08,0x19,0x16,0x17,0x02,0x13,0x02,0x13,0x02,0x13,0x16,0x17,0x02,0x13,   // carry-in
             0x30,0x11,0x26,0x07,0x14,0x15,0x04,0x05,0x20,0x01,0x26,0x07,0x14,0x15,0x04,0x05,
             0x30,0x11,0x26,0x07,0x14,0x15,0x04,0x05,0x20,0x01,0x26,0x07,0x14,0x15,0x04,0x05,
             0x18,0x19,0x08,0x19,0x16,0x17,0x02,0x13,0x02,0x13,0x02,0x13,0x16,0x17,0x02,0x13]
        ],
    ];


    constructor(context) {
        /* Constructor for the 1620 processor object. The "context" object
        supplies references for objects from the 1620 emulator global environment */

        this.context = context;
        this.devices = null;            // initialized in this.powerUp()
        this.envir = new Envir();
        this.envir.memorySize = context.config.getNode("memorySize");
        this.envir.setIndicator = this.setIndicator.bind(this);

        // Control Gates
        this.gate$$$_OFLO =         new FlipFlop(this.envir, true);
        this.gate1ST_CYC =          new FlipFlop(this.envir, true);
        this.gate1ST_CYC_DELAYD =   new FlipFlop(this.envir, true);
        this.gate1ST_MPLY_CYCLE =   new FlipFlop(this.envir, true);
        this.gate2_DIG_CNTRL =      new FlipFlop(this.envir, true);
        this.gateADD_ENT =          new FlipFlop(this.envir, true);
        this.gateADD_MODE =         new FlipFlop(this.envir, true);
        this.gateBR_EXEC =          new FlipFlop(this.envir, true);
        this.gateBR_OUT =           new FlipFlop(this.envir, true);
        this.gateCARRY_IN =         new FlipFlop(this.envir, true);
        this.gateCARRY_OUT =        new FlipFlop(this.envir, true);
        this.gateCLR_MEM =          new FlipFlop(this.envir, true);
        this.gateCOMP =             new FlipFlop(this.envir, true);
        this.gateDIV_1_CYC =        new FlipFlop(this.envir, true);
        this.gateDVD_L_CYC =        new FlipFlop(this.envir, true);
        this.gateDVD_SIGN =         new FlipFlop(this.envir, true);
        this.gateEOR$ =             new FlipFlop(this.envir, true);
        this.gateEXMIT_ENT =        new FlipFlop(this.envir, true);
        this.gateEXMIT_MODE =       new FlipFlop(this.envir, true);
        this.gateEXP_OFLO =         new FlipFlop(this.envir, true);
        this.gateEXP_UFLO =         new FlipFlop(this.envir, true);
        this.gateEZ =               new FlipFlop(this.envir, true);
        this.gateE_CYC_ENT =        new FlipFlop(this.envir, true);
        this.gateFIELD_MK_1 =       new FlipFlop(this.envir, true);
        this.gateFIELD_MK_2 =       new FlipFlop(this.envir, true);
        this.gateFL_1 =             new FlipFlop(this.envir, true);
        this.gateFL_2 =             new FlipFlop(this.envir, true);
        this.gateHP =               new FlipFlop(this.envir, true);
        this.gateIA_ENT =           new FlipFlop(this.envir, true);
        this.gateIA_REQ =           new FlipFlop(this.envir, true);
        this.gateIA_SEL =           new FlipFlop(this.envir, true);
        this.gateINT_ENT =          new FlipFlop(this.envir, true);
        this.gateINT_MODE =         new FlipFlop(this.envir, true);
        this.gateIX_BAND_1 =        new FlipFlop(this.envir, true);
        this.gateIX_BAND_2 =        new FlipFlop(this.envir, true);
        this.gateIX_ENT =           new FlipFlop(this.envir, true);
        this.gateIX_EXEC =          new FlipFlop(this.envir, true);
        this.gateI_CYC_ENT =        new FlipFlop(this.envir, true);
        this.gateLAST_CARD =        new FlipFlop(this.envir, true);
        this.gateLAST_LD_CYC =      new FlipFlop(this.envir, true);
        this.gateMASK =             new FlipFlop(this.envir, true);
        this.gateMC_1 =             new FlipFlop(this.envir, true);
        this.gateMC_2 =             new FlipFlop(this.envir, true);
        this.gateP =                new FlipFlop(this.envir, true);
        this.gateP_COMP =           new FlipFlop(this.envir, true);
        this.gateRECOMP =           new FlipFlop(this.envir, true);
        this.gateRM =               new FlipFlop(this.envir, true);
        this.gateRUN =              new FlipFlop(this.envir, true);
        this.gateSTOP =             new FlipFlop(this.envir, true);

        // Floating-Point Gates
        this.gateCOUNTER_COMP =     new FlipFlop(this.envir, true);
        this.gateDIGIT_FORCE_ENTRY =new FlipFlop(this.envir, true);
        this.gateDIG_FORCE_MODE =   new FlipFlop(this.envir, true);
        this.gateD_GTR_99 =         new FlipFlop(this.envir, true);
        this.gateEXP_ADD =          new FlipFlop(this.envir, true);
        this.gateEXP_MODIFY =       new FlipFlop(this.envir, true);
        this.gateEXP_MOD_ENTRY =    new FlipFlop(this.envir, true);
        this.gateEXP_MOD_REQ =      new FlipFlop(this.envir, true);
        this.gateEXP_OFLO_CORR =    new FlipFlop(this.envir, true);
        this.gateEXP_XMIT =         new FlipFlop(this.envir, true);
        this.gateEXTRA_SFT_CYC =    new FlipFlop(this.envir, true);
        this.gateFALSE_XMIT =       new FlipFlop(this.envir, true);
        this.gateFALSE_XMIT_ENTRY = new FlipFlop(this.envir, true);
        this.gateFDIV =             new FlipFlop(this.envir, true);
        this.gateFDIV_ENTRY =       new FlipFlop(this.envir, true);
        this.gateFMUL_ENTRY =       new FlipFlop(this.envir, true);
        this.gateFMUL_MODE =        new FlipFlop(this.envir, true);
        this.gateFORCE_CF1 =        new FlipFlop(this.envir, true);
        this.gateFP_HI_PLUS =       new FlipFlop(this.envir, true);
        this.gateFRAC_ADD_ENTRY =   new FlipFlop(this.envir, true);
        this.gateFRAC_ADD_MODE =    new FlipFlop(this.envir, true);
        this.gateFRAC_COMPARE_MODE =new FlipFlop(this.envir, true);
        this.gateFRAC_COMPR_ENTRY = new FlipFlop(this.envir, true);
        this.gateHI_ORDER_ZERO =    new FlipFlop(this.envir, true);
        this.gateLD =               new FlipFlop(this.envir, true);
        this.gateLD_ENTRY =         new FlipFlop(this.envir, true);
        this.gateNORM_SHIFT_RT =    new FlipFlop(this.envir, true);
        this.gateQ_EXIT =           new FlipFlop(this.envir, true);
        this.gateRESULT_XMIT =      new FlipFlop(this.envir, true);
        this.gateSCAN_ENTRY =       new FlipFlop(this.envir, true);
        this.gateSCAN_MINUS =       new FlipFlop(this.envir, true);
        this.gateSCAN_MODE =        new FlipFlop(this.envir, true);
        this.gateSCAN_Q =           new FlipFlop(this.envir, true);
        this.gateSHIFT_ENTRY =      new FlipFlop(this.envir, true);
        this.gateSHIFT_MODE =       new FlipFlop(this.envir, true);
        this.gateSIG_DIGIT =        new FlipFlop(this.envir, true);

        // Input-Output Gates
        this.gateCHAR_GATE =        new FlipFlop(this.envir, true);
        this.gateDISK_ADDR =        new FlipFlop(this.envir, true);
        this.gateDISK_HUND =        new FlipFlop(this.envir, true);
        this.gateDISK_LD_ZERO =     new FlipFlop(this.envir, true);
        this.gateDISK_OP =          new FlipFlop(this.envir, true);
        this.gateDISK_UNIT =        new FlipFlop(this.envir, true);
        this.gateIO_FLAG =          new FlipFlop(this.envir, true);
        this.gateMEM_ADDR =         new FlipFlop(this.envir, true);
        this.gatePCH_FEED =         new FlipFlop(this.envir, true);
        this.gatePC_6XXX =          new FlipFlop(this.envir, true);
        this.gatePC_EZ =            new FlipFlop(this.envir, true);
        this.gatePC_HP =            new FlipFlop(this.envir, true);
        this.gatePC_IND =           new FlipFlop(this.envir, true);
        this.gatePC_OFLO =          new FlipFlop(this.envir, true);
        this.gatePC_TR_8 =          new FlipFlop(this.envir, true);
        this.gateRD =               new FlipFlop(this.envir, true);
        this.gateRDR_FEED =         new FlipFlop(this.envir, true);
        this.gateREL =              new FlipFlop(this.envir, true);
        this.gateRESP_GATE =        new FlipFlop(this.envir, true);
        this.gateSCTR_COUNT =       new FlipFlop(this.envir, true);
        this.gateSCTR_CYC =         new FlipFlop(this.envir, true);
        this.gateSIMO_30 =          new FlipFlop(this.envir, true);
        this.gateSIMO_HOLD =        new FlipFlop(this.envir, true);
        this.gateWR =               new FlipFlop(this.envir, true);

        // Instruction & Execution Cycle Gates
        this.gateE_1 =              new FlipFlop(this.envir, true);
        this.gateE_2 =              new FlipFlop(this.envir, true);
        this.gateE_3 =              new FlipFlop(this.envir, true);
        this.gateE_4 =              new FlipFlop(this.envir, true);
        this.gateE_5 =              new FlipFlop(this.envir, true);
        this.gateIA_1 =             new FlipFlop(this.envir, true);
        this.gateIA_2 =             new FlipFlop(this.envir, true);
        this.gateIA_3 =             new FlipFlop(this.envir, true);
        this.gateIX =               new FlipFlop(this.envir, true);     // INDEXING in the CE docs
        this.gateI_1 =              new FlipFlop(this.envir, true);
        this.gateI_2 =              new FlipFlop(this.envir, true);
        this.gateI_3 =              new FlipFlop(this.envir, true);
        this.gateI_4 =              new FlipFlop(this.envir, true);
        this.gateI_5 =              new FlipFlop(this.envir, true);
        this.gateI_6 =              new FlipFlop(this.envir, true);

        this.procStateGates = [null,
            this.gateI_1, this.gateI_2, this.gateI_3, this.gateI_4, this.gateI_5, this.gateI_6,
            this.gateIX, this.gateIA_1, this.gateIA_2, this.gateIA_3,
            this.gateE_1, this.gateE_2, this.gateE_3, this.gateE_4, this.gateE_5];

        // Operator Control Panel Indicators
        this.gatePOWER_ON =         new FlipFlop(this.envir, true);
        this.gatePOWER_READY =      new FlipFlop(this.envir, true);
        this.gateTHERMAL =          new FlipFlop(this.envir, true);
        this.gateWRITE_INTERLOCK =  new FlipFlop(this.envir, true);
        this.gateREAD_INTERLOCK =   new FlipFlop(this.envir, true);
        this.gateSAVE =             new FlipFlop(this.envir, true);
        this.gateTWPR_SELECT =      new FlipFlop(this.envir, true);
        this.gateRFE1 =             new FlipFlop(this.envir, true);
        this.gateRFE2 =             new FlipFlop(this.envir, true);
        this.gateRFE3 =             new FlipFlop(this.envir, true);
        this.gateAUTOMATIC =        new FlipFlop(this.envir, true);
        this.gateMANUAL =           new FlipFlop(this.envir, true);
        this.gateCHECK_STOP =       new FlipFlop(this.envir, true);

        // Check Indicators
        this.diskAddrCheck =        new FlipFlop(this.envir, true);
        this.diskCylOflowCheck =    new FlipFlop(this.envir, true);
        this.diskWLRRBCCheck =      new FlipFlop(this.envir, true);
        this.dummy1Check =          new FlipFlop(this.envir, true);
        this.dummy2Check =          new FlipFlop(this.envir, true);
        this.dummy3Check =          new FlipFlop(this.envir, true);
        this.ioPrinterCheck =       new FlipFlop(this.envir, true);
        this.ioReadCheck =          new FlipFlop(this.envir, true);
        this.ioWriteCheck =         new FlipFlop(this.envir, true);
        this.oflowArithCheck =      new FlipFlop(this.envir, true);
        this.oflowDummyCheck =      new FlipFlop(this.envir, true);
        this.oflowExpCheck =        new FlipFlop(this.envir, true);
        this.parityMARCheck =       new FlipFlop(this.envir, true);
        this.parityMBREvenCheck =   new FlipFlop(this.envir, true);
        this.parityMBROddCheck =    new FlipFlop(this.envir, true);

        this.ioPrinterChannel9 =    new FlipFlop(this.envir, false);
        this.ioPrinterChannel12 =   new FlipFlop(this.envir, false);
        this.ioPrinterBusy =        new FlipFlop(this.envir, false);

        // Console Registers
        this.regDR =                new Register("DR",  2, this.envir, true,  true,  false);
        this.regMAR =               new Register("MAR", 5, this.envir, true,  true,  false);
        this.regMBR =               new Register("MBR", 2, this.envir, true,  false, true);
        this.regMIR =               new Register("MIR", 2, this.envir, true,  true,  true);
        this.regMQ =                new Register("MQ",  1, this.envir, true,  true,  false);
        this.regOP =                new Register("OP",  2, this.envir, true,  true,  false);
        this.regXR =                new Register("XR",  1, this.envir, true,  false, false);   // indexing bits X-1, X-2, X-3

        // MARS Registers
        this.regCR1 =               new Register("CR1", 5, this.envir, false, true,  false);
        this.regIR1 =               new Register("IR1", 5, this.envir, false, true,  false);
        this.regIR2 =               new Register("IR2", 5, this.envir, false, true,  false);
        this.regIR3 =               new Register("IR3", 5, this.envir, false, true,  false);
        this.regIR4 =               new Register("IR4", 5, this.envir, false, true,  false);
        this.regOR1 =               new Register("OR1", 5, this.envir, false, true,  false);
        this.regOR2 =               new Register("OR2", 5, this.envir, false, true,  false);
        this.regOR3 =               new Register("OR3", 5, this.envir, false, true,  false);
        this.regOR4 =               new Register("OR4", 5, this.envir, false, true,  false);
        this.regOR5 =               new Register("OR5", 5, this.envir, false, true,  false);
        this.regPR1 =               new Register("PR1", 5, this.envir, false, true,  false);
        this.regPR2 =               new Register("PR2", 5, this.envir, false, true,  false);

        this.marsRegisters = [
            this.regOR1, this.regOR2, this.regOR3, this.regOR4, this.regOR5, this.regCR1,
            this.regPR1, this.regPR2, this.regIR1, this.regIR2, this.regIR3, this.regIR4];

        // Internal Control Gates & Registers
        this.gateCLR_CTRL =         new FlipFlop(this.envir, false);    // clear memory control latch
        this.gateCONSOLE_CTRL_SS =  new FlipFlop(this.envir, false);    // console control single-shot(?)
        this.gateDISPLAY_MAR =      new FlipFlop(this.envir, false);    // display MAR latch
        this.gateEND_OF_MODULE =    new FlipFlop(this.envir, false);    // termination latch (clear memory, etc.)
        this.gateINSERT =           new FlipFlop(this.envir, false);    // insert latch
        this.gateSCE =              new FlipFlop(this.envir, true);     // single-cycle execute
        this.gateX_SIG_DIGIT =      new FlipFlop(this.envir, true);     // index register significant digit occurred

        this.regXBR =               new Register("XBR", 5, this.envir, false, true,  true);

        // Console Switches
        this.marSelectorKnob = 0;
        this.diskStopSwitch = 0;
        this.dummy1Switch = 0;
        this.ioStopSwitch = 0;
        this.oflowStopSwitch = 0;
        this.parityStopSwitch = 0;
        this.program1Switch = 0;
        this.program2Switch = 0;
        this.program3Switch = 0;
        this.program4Switch = 0;

        // Core Memory - 2 digits are stored in the low-order 12 bits of each element
        this.MM = new Uint16Array(this.envir.memorySize >> 1);

        // Op Code Attributes
        this.opAddress = 0;                             // binary address of current op code
        this.opBinary = -1;                             // binary value of current op code
        this.opIndexable = 0;                           // op code is valid for indexing addresses
        this.opAtts = new Array(100);                   // op code attributes table
        this.opThisAtts = null;                         // op code attributes for current op

        this.xrInstalled = (context.config.getNode("indexRegisters") ? 1 : 0);
        this.fpInstalled = (context.config.getNode("floatingPoint") ? 1 : 0);
        this.bcInstalled = (context.config.getNode("binaryCapabilities") ? 1 : 0);

        // General emulator state
        this.avgThrottleDelay = 0;                      // running average throttling delay, ms
        this.avgThrottleDelta = 0;                      // running average throttling delay deviation, ms
        this.instructionCount = 0                       // number of instructions executed
        this.limboEntryFcn = null;                      // function to call on entering LimboState
        this.limboEntryContext = null;                  // object context to apply to limboEntryFcn
        this.procState = procStateLimbo;                // processor instruction load/execute state
        this.running = false;                           // true when this.run() is active
        this.runTime = 0;                               // actual system run time, ms
        this.tracing = false;                           // instruction trace is active
        this.traceLine = "";                            // instruction trace fields
        this.tracePAddr = new Register("TR2", 5, this.envir, false, false,  false);
        this.tracePData = "";                           // instruction trace P data string
        this.tracePLabel = "";                          // label for P operand trace data
        this.traceQData = "";                           // instruction trace Q data string
        this.traceQLabel = "";                          // label for Q operand trace data

        // I/O Subsystem
        this.ioDevice = null;                           // I/O device object
        this.ioSelectNr = 0;                            // I/O channel from Q8/Q9
        this.ioVariant = 0;                             // I/O function variant from Q10/Q11
        this.ioDiskDriveCode = 0;                       // Module number for disk I/O
        this.ioReadCheckPending = false;                // Read Check condition has occurred but not yet been set
        this.ioWriteCheckPending = false;               // Write Check condition has occurred but not het been set
        this.ioMBRCheckPending = false;                 // MBR check condition due to even address on alpha I/O

        // Initialization - Address Types
        const adNU = Processor.adNotUsed;
        const adAD = Processor.adAddress;
        const adFL = Processor.adField;
        const adRE = Processor.adRecord;
        const adLT = Processor.adLiteral;
        const adDG = Processor.adDigit;
        const adSP = Processor.adSpecial;

        const buildOpAtts = (opCode,
                opValid, eState, pIA, qIA, pIX, qIX, immed, fp, index, binary, qa4, mnem, pType, qType) => {
            this.opAtts[opCode] = {
                opValid,                // op code is valid (some are set from config)
                eState,                 // initial execution state
                pIA,                    // P address can be indirect
                qIA,                    // Q address can be indirect
                pIX,                    // P address can be indexed
                qIX,                    // Q address can be indexed
                immed,                  // immediate op code, Q field is data
                fp,                     // floating-point op code
                index,                  // index register op code
                binary,                 // binary capabilities op code
                qa4,                    // Q address is 4 digits (binary capabilities only)
                mnem,                   // Opcode mnemonic
                pType,                  // P address type
                qType};                 // Q address type
        };

        //          op   v  es  pi  qi  px  qx  im  fp  ix  bi  q4
        buildOpAtts( 0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<00>", adNU, adNU);    // 00
        buildOpAtts( 1,  1,  1,  1,  1,  1,  1,  0,  1,  0,  0,  0, "FADD", adFL, adFL);    // 01
        buildOpAtts( 2,  1,  1,  1,  1,  1,  1,  0,  1,  0,  0,  0, "FSUB", adFL, adFL);    // 02
        buildOpAtts( 3,  1,  1,  1,  1,  1,  1,  0,  1,  0,  0,  0, "FMUL", adFL, adFL);    // 03
        buildOpAtts( 4,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<04>", adNU, adNU);    // 04
        buildOpAtts( 5,  1,  1,  1,  1,  1,  1,  0,  1,  0,  0,  0, "FSL ", adFL, adAD);    // 05
        buildOpAtts( 6,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0, "TFL ", adFL, adFL);    // 06
        buildOpAtts( 7,  1,  2,  1,  1,  1,  1,  0,  0,  0,  0,  0, "BTFL", adAD, adFL);    // 07
        buildOpAtts( 8,  1,  1,  1,  1,  1,  1,  0,  1,  0,  0,  0, "FSR ", adFL, adAD);    // 08
        buildOpAtts( 9,  1,  1,  1,  1,  1,  1,  0,  1,  0,  0,  0, "FDIV", adFL, adFL);    // 09

        buildOpAtts(10,  1,  2,  1,  0,  1,  0,  1,  0,  0,  0,  0, "BTAM", adAD, adLT);    // 10
        buildOpAtts(11,  1,  1,  1,  0,  1,  0,  1,  0,  0,  0,  0, "AM  ", adFL, adLT);    // 11
        buildOpAtts(12,  1,  1,  1,  0,  1,  0,  1,  0,  0,  0,  0, "SM  ", adFL, adLT);    // 12
        buildOpAtts(13,  1,  5,  1,  0,  1,  0,  1,  0,  0,  0,  0, "MM  ", adFL, adLT);    // 13
        buildOpAtts(14,  1,  1,  1,  0,  1,  0,  1,  0,  0,  0,  0, "CM  ", adFL, adLT);    // 14
        buildOpAtts(15,  1,  1,  1,  0,  1,  0,  1,  0,  0,  0,  0, "TDM ", adDG, adDG);    // 15
        buildOpAtts(16,  1,  1,  1,  0,  1,  0,  1,  0,  0,  0,  0, "TFM ", adFL, adLT);    // 16
        buildOpAtts(17,  1,  2,  1,  0,  1,  0,  1,  0,  0,  0,  0, "BTM ", adAD, adLT);    // 17
        buildOpAtts(18,  1,  5,  1,  0,  1,  0,  1,  0,  0,  0,  0, "LDM ", adFL, adLT);    // 18
        buildOpAtts(19,  1,  1,  1,  0,  1,  0,  1,  0,  0,  0,  0, "DM  ", adFL, adLT);    // 19

        buildOpAtts(20,  1,  2,  1,  1,  1,  1,  0,  0,  0,  0,  0, "BTA ", adAD, adAD);    // 20
        buildOpAtts(21,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0, "A   ", adFL, adFL);    // 21
        buildOpAtts(22,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0, "S   ", adFL, adFL);    // 22
        buildOpAtts(23,  1,  5,  1,  1,  1,  1,  0,  0,  0,  0,  0, "M   ", adFL, adFL);    // 23
        buildOpAtts(24,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0, "C   ", adFL, adFL);    // 24
        buildOpAtts(25,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0, "TD  ", adDG, adDG);    // 25
        buildOpAtts(26,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0, "TF  ", adFL, adFL);    // 26
        buildOpAtts(27,  1,  2,  1,  1,  1,  1,  0,  0,  0,  0,  0, "BT  ", adAD, adFL);    // 27
        buildOpAtts(28,  1,  5,  1,  1,  1,  1,  0,  0,  0,  0,  0, "LD  ", adAD, adFL);    // 28
        buildOpAtts(29,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0, "D   ", adAD, adFL);    // 29

        buildOpAtts(30,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0, "TRNM", adRE, adRE);    // 30
        buildOpAtts(31,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0, "TR  ", adRE, adRE);    // 31
        buildOpAtts(32,  1,  2,  1,  0,  1,  0,  0,  0,  0,  0,  0, "SF  ", adDG, adNU);    // 32
        buildOpAtts(33,  1,  2,  1,  0,  1,  0,  0,  0,  0,  0,  0, "CF  ", adDG, adNU);    // 33
        buildOpAtts(34,  1,  0,  1,  0,  1,  0,  0,  0,  0,  0,  0, "K   ", adAD, adSP);    // 34
        buildOpAtts(35,  1,  2,  1,  0,  1,  0,  0,  0,  0,  0,  0, "DN  ", adAD, adSP);    // 35
        buildOpAtts(36,  1,  0,  1,  0,  1,  0,  0,  0,  0,  0,  0, "RN  ", adAD, adSP);    // 36
        buildOpAtts(37,  1,  0,  1,  0,  1,  0,  0,  0,  0,  0,  0, "RA  ", adAD, adSP);    // 37
        buildOpAtts(38,  1,  2,  1,  0,  1,  0,  0,  0,  0,  0,  0, "WN  ", adAD, adSP);    // 38
        buildOpAtts(39,  1,  2,  1,  0,  1,  0,  0,  0,  0,  0,  0, "WA  ", adAD, adSP);    // 39

        buildOpAtts(40,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<40>", adNU, adNU);    // 40
        buildOpAtts(41,  1,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "NOP ", adNU, adNU);    // 41
        buildOpAtts(42,  1,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "BB  ", adNU, adNU);    // 42
        buildOpAtts(43,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0, "BD  ", adAD, adDG);    // 43
        buildOpAtts(44,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0, "BNF ", adAD, adDG);    // 44
        buildOpAtts(45,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0, "BNR ", adAD, adDG);    // 45
        buildOpAtts(46,  1,  0,  1,  0,  1,  0,  0,  0,  0,  0,  0, "BI  ", adAD, adSP);    // 46
        buildOpAtts(47,  1,  0,  1,  0,  1,  0,  0,  0,  0,  0,  0, "BNI ", adAD, adSP);    // 47
        buildOpAtts(48,  1,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "H   ", adNU, adNU);    // 48
        buildOpAtts(49,  1,  0,  1,  0,  1,  0,  0,  0,  0,  0,  0, "B   ", adAD, adNU);    // 49

        buildOpAtts(50,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<50>", adNU, adNU);    // 50
        buildOpAtts(51,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<51>", adNU, adNU);    // 51
        buildOpAtts(52,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<52>", adNU, adNU);    // 52
        buildOpAtts(53,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<53>", adNU, adNU);    // 53
        buildOpAtts(54,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<54>", adNU, adNU);    // 54
        buildOpAtts(55,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0, "BNG ", adAD, adDG);    // 55
        buildOpAtts(56,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<56>", adNU, adNU);    // 56
        buildOpAtts(57,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<57>", adNU, adNU);    // 57
        buildOpAtts(58,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<58>", adNU, adNU);    // 58
        buildOpAtts(59,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<59>", adNU, adNU);    // 59

        buildOpAtts(60,  1,  1,  1,  0,  1,  0,  0,  0,  0,  0,  0, "BS  ", adAD, adSP);    // 60
        buildOpAtts(61,  1,  1,  1,  0,  1,  0,  0,  0,  1,  0,  0, "BX  ", adAD, adFL);    // 61
        buildOpAtts(62,  1,  1,  1,  0,  1,  0,  1,  0,  1,  0,  0, "BXM ", adAD, adLT);    // 62
        buildOpAtts(63,  1,  1,  1,  0,  1,  0,  0,  0,  1,  0,  0, "BCX ", adAD, adFL);    // 63
        buildOpAtts(64,  1,  1,  1,  0,  1,  0,  1,  0,  1,  0,  0, "BCXM", adAD, adLT);    // 64
        buildOpAtts(65,  1,  1,  1,  0,  1,  0,  0,  0,  1,  0,  0, "BLX ", adAD, adFL);    // 65
        buildOpAtts(66,  1,  1,  1,  0,  1,  0,  1,  0,  1,  0,  0, "BLXM", adAD, adLT);    // 66
        buildOpAtts(67,  1,  1,  1,  0,  1,  0,  0,  0,  1,  0,  0, "BSX ", adAD, adFL);    // 67
        buildOpAtts(68,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<68>", adNU, adNU);    // 68
        buildOpAtts(69,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<69>", adNU, adNU);    // 69

        buildOpAtts(70,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0, "MA  ", adAD, adAD);    // 70
        buildOpAtts(71,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0, "MF  ", adDG, adDG);    // 71
        buildOpAtts(72,  1,  2,  1,  1,  1,  1,  0,  0,  0,  0,  0, "TNS ", adFL, adFL);    // 72
        buildOpAtts(73,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0, "TNF ", adFL, adFL);    // 73
        buildOpAtts(74,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<74>", adNU, adNU);    // 74
        buildOpAtts(75,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<75>", adNU, adNU);    // 75
        buildOpAtts(76,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<76>", adNU, adNU);    // 76
        buildOpAtts(77,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<77>", adNU, adNU);    // 77
        buildOpAtts(78,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<78>", adNU, adNU);    // 78
        buildOpAtts(79,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<79>", adNU, adNU);    // 79

        buildOpAtts(80,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<80>", adNU, adNU);    // 80
        buildOpAtts(81,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<81>", adNU, adNU);    // 81
        buildOpAtts(82,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<82>", adNU, adNU);    // 82
        buildOpAtts(83,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<83>", adNU, adNU);    // 83
        buildOpAtts(84,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<84>", adNU, adNU);    // 84
        buildOpAtts(85,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<85>", adNU, adNU);    // 85
        buildOpAtts(86,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<86>", adNU, adNU);    // 86
        buildOpAtts(87,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<87>", adNU, adNU);    // 87
        buildOpAtts(88,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<88>", adNU, adNU);    // 88
        buildOpAtts(89,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<89>", adNU, adNU);    // 89

        buildOpAtts(90,  1,  1,  1,  1,  1,  1,  0,  0,  0,  1,  1, "BBT ", adAD, adAD);    // 90
        buildOpAtts(91,  1,  1,  1,  1,  1,  1,  0,  0,  0,  1,  1, "BMK ", adAD, adAD);    // 91
        buildOpAtts(92,  1,  1,  1,  1,  1,  1,  0,  0,  0,  1,  0, "ORF ", adFL, adFL);    // 92
        buildOpAtts(93,  1,  1,  1,  1,  1,  1,  0,  0,  0,  1,  0, "ANDF", adFL, adFL);    // 93
        buildOpAtts(94,  1,  1,  1,  1,  1,  1,  0,  0,  0,  1,  0, "CPFL", adFL, adFL);    // 94
        buildOpAtts(95,  1,  1,  1,  1,  1,  1,  0,  0,  0,  1,  0, "EORF", adFL, adFL);    // 95
        buildOpAtts(96,  1,  5,  1,  1,  1,  1,  0,  0,  0,  1,  0, "OTD ", adAD, adFL);    // 96
        buildOpAtts(97,  1,  1,  1,  1,  1,  1,  0,  0,  0,  1,  0, "DTO ", adAD, adFL);    // 97
        buildOpAtts(98,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<98>", adNU, adNU);    // 98
        buildOpAtts(99,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, "<99>", adNU, adNU);    // 99

        // Configure op code attributes for special features.
        for (let att of this.opAtts) {
            // Don't allow indexing of P & Q if indexing not available
            att.pIX &= this.xrInstalled;
            att.qIX &= this.xrInstalled;

            if (att.fp) {
                att.opValid = this.fpInstalled;
            } else if (att.index) {
                att.opValid = this.xrInstalled;
            } else if (att.binary) {
                att.opValid = this.bcInstalled;
            }
        }

        this.opAtts[70].opValid = this.xrInstalled;     // MA part of the XR package
    }


    /*******************************************************************
    *  Utility Methods                                                 *
    *******************************************************************/

    /**************************************/
    getDREven() {
        /* Returns the even (tens) digit of DR with the flag bit reconstructed
        from FL-2 */

        if (this.gateFL_2.value) {
            return (this.regDR.even | Register.flagMask) ^ Register.parityMask;
        } else {
            return this.regDR.even;
        }
    }

    /**************************************/
    setDREven(digit) {
        /* Sets the even (tens) digit of DR and sets FL-2 if DR is flagged.
        Returns the new value of DR-even */

        this.regDR.even = digit;
        this.gateFL_2.value = digit & Register.flagMask;
        return digit;
    }

    /**************************************/
    resetDREven() {
        /* "Resets" the even (tens) digit of DR -- meaning FL-2 is reset */

        this.gateFL_2.value = 0;
    }

    /**************************************/
    getDROdd() {
        /* Returns the odd (units) digit of DR with the flag bit reconstructed
        from FL-1 */

        if (this.gateFL_1.value) {
            return (this.regDR.odd | Register.flagMask) ^ Register.parityMask;
        } else {
            return this.regDR.odd;
        }
    }

    /**************************************/
    setDROdd(digit) {
        /* Sets the odd (units) digit of DR and sets FL-1 if DR is flagged.
        Returns the new value of DR-even */

        this.regDR.odd = digit;
        this.gateFL_1.value = digit & Register.flagMask;
        return digit;
    }

    /**************************************/
    resetDROdd() {
        /* "Resets" the odd (units) digit of DR -- meaning FL-1 is reset */

        this.gateFL_1.value = 0;
    }

    /**************************************/
    shiftDREvenOdd() {
        /* Shifts DR-even (tens) to DR-odd (units), transferring FL-2 to FL-1.
        Returns the new value of DR-odd */
        const digit = this.regDR.odd = this.getDREven();

        this.gateFL_1.value = this.gateFL_2.value;
        this.resetDREven();
        return digit;
    }

    /**************************************/
    setIndexMAR() {
        /* Sets MAR to the address of the index register specified by the
        currently-selected band and regXR */

        this.regMAR.binaryValue = this.gateIX_BAND_2.value*40 + this.regXR.binaryValue*5 + 304;
    }

    /**************************************/
    addDigits(addend) {
        /* Adds two digits and yields their sum. The augend must be in regDR.odd.
        Addition is handled by a two-step process. First, the augend (Q digit)
        and addend (P digit) are converted to index values by the pCompTable[]
        and qCompTable[] lookups on the incoming digit values. These tables auto-
        matically complement as necessary based on gateCOMP for the augend and
        gateP_COMP for the addend. Then the P and Q index values are used to
        look up the sum from addTable[]. gateCARRY_IN is included in the sum
        as part of the qCompTable lookup before storing the sum digit in
        regDR.odd. gateCARRY_OUT is set to the carry from the addTable result.
        Returns the sum digit value */

        let pIndex = Processor.pCompTable[this.gateP_COMP.value][addend];
        let qIndex = Processor.qCompTable[this.gateCOMP.value][this.gateCARRY_IN.value][this.regDR.odd];

        let qCarry = (qIndex & Processor.compCarryBit) ? 1 : 0;
        qIndex &= ~Processor.compCarryBit;      // zero the complement carry bit

        if ((addend & Envir.numRecMark) == Envir.numRecMark || (this.regDR.odd & Envir.numRecMark) == Envir.numRecMark) {
            console.log(`Invalid Record Mark in addition for Model 2 @${this.opAddress.toString().padStart(5, "0")}, ` +
                        `OR1=${this.regOR1.toBCDString()}, OR2=${this.regOR2.toBCDString()}, ` +
                        `augend=${this.regDR.odd.toString(16)}, addend=${addend.toString(16)}`);
            debugger;
        }

        let sum = Processor.addTable[pIndex][qIndex];
        this.gateCARRY_OUT.value = (sum & Processor.addCarryBit) | qCarry; // coerced to 0/1
        sum &= ~Processor.addCarryBit;          // strip off the add carry bit in result
        this.regDR.odd = sum;                   // don't do setDROdd() -- preserve FL_1 state
        return sum;
    }

    /**************************************/
    loadCMEMFile(buffer) {
        /* Clears memory and then loads it from the text of the buffer passed
        as a parameter. The system must be in MANUAL and not AUTOMATIC mode.
        Sets IR1 to zero and resets BR_EXEC at the end.
        Returns a (possibly empty) string with the result of the load */
        let addr = 0;                   // current memory address
        let bufLength = buffer.length;  // length of the "buffer"
        let errors = 0;                 // number of errors detected
        let errMsg = "";                // description of last error
        let index = 0;                  // offset into "buffer"
        let line = "";                  // one line from the file image
        let lineNr = 0;                 // file image 1-relative line number
        let match = null;               // result of eolRex.exec()

        const eolRex = /([^\n\r\f]*)((:?\r[\n\f]?)|\n|\f)?/g;
        const addrRex = /^([0-9]{0,5})\s*:/;
        const dataSplitRex = /\s+/;
        const fullHexRex = /^[0-1]?[0-9a-fA-F]$/;

        let digitRex = /^[0-1]?[0-9acfACF]$/;

        const loadMemory = (addr, data) => {
            /* Loads a string of space-delimited hex digit values to memory
            starting at "addr". Returns the next address to be stored */
            let odd = addr & 1;         // even/odd address flag

            this.regMAR.binaryValue = addr;
            this.fetch();

            let digits = data.split(dataSplitRex);
            for (let c of digits) {
                if (!digitRex.test(c)) {
                    ++errors;
                    errMsg = `Invalid digit value "${c}" @${addr}, line ${lineNr}`;
                    c = "0";
                }

                let d = parseInt(c, 16);
                if (odd) {
                    this.regMIR.odd = Envir.oddParity5[d];
                    this.store();
                    this.regMAR.incr(2);
                    this.fetch();

                } else {
                    this.regMIR.even = Envir.oddParity5[d];
                }

                ++addr;
                odd = 1-odd;
            }

            if (odd) {
                this.store();
            }

            return addr;
        };

        const loadTabStops = (tabList) => {
            /* Parses the sting "tabList" to produce a comma-delimited list of
            typewriter tab stops. Passes that list to the Typewriter to be set
            as a temporary set of tab stops. The persistent Typewriter
            configuration data is not altered. This is a bit of a kludge, but
            it's good enough for the purpose at hand */
            let stopNrs = tabList.split(/[^0-9]+/);

            let stops = this.devices.typewriter.parseTabStops(stopNrs.join(","), this.window);
            if (stops) {
                this.devices.typewriter.tabStops = stops;
                this.devices.typewriter.$$("TabStops").value =
                        this.devices.typewriter.formatTabStops(stops);
            }
        };

        // First, make sure we're in the proper state.
        if (!(this.gatePOWER_ON.value && this.gateMANUAL.value && !this.gateAUTOMATIC.value)) {
            return "Invalid processor state.";
        }

        // Second, clear memory to zeroes.
        this.regMIR.clear();
        this.MM.fill(this.regMIR.value);

        // Read the lines from the file image.
        while (index < bufLength) {
            eolRex.lastIndex = index;
            match = eolRex.exec(buffer);
            if (!match) {               // assume EOF if no delimiter
                line = "";
                index = bufLength;
            } else {                    // process the extracted line
                ++lineNr;
                index += match[0].length;
                line = match[1].trimEnd().toLowerCase();
                let length = line.length;
                match = addrRex.exec(line);
                if (!match) {           // it's not an address:data line
                    if (length == 0) {
                        // empty line -- ignore
                    } else {
                        switch (line.at(0)) {
                        case "/":       // comment line -- ignore
                            break;
                        case "*":       // settings line
                            line = line.substring(1).trim();
                            if (line.startsWith("tabs")) {
                                loadTabStops(line.substring(4).trim());
                            } else if (line.startsWith("invalid")) {
                                digitRex = fullHexRex;
                            }
                            break;
                        default:        // it's something else
                            if (line.trim().at(0) != "/") {
                                ++errors;
                                errMsg = `Unrecognized line ${lineNr}`;
                            }
                            break;
                        }
                    }
                } else {                // process an address:data line
                    let prefix = match[1];
                    if (prefix.length > 0) {
                        addr = parseInt(prefix, 10) ?? 0;
                    }

                    let data = line.substring(match[0].length).trim();
                    let x = data.indexOf("/");
                    if (x >= 0) {
                        data = data.substring(0, x).trim();
                    }

                    addr = loadMemory(addr, data);
                }
            }
        }

        // Finally, clear IR1 and BR_EXEC.
        this.regIR1.value = this.regMAR.clear();
        this.manualReset();
        return (errors ? `${errors} error(s), last was ${errMsg}.` : "");
    }

    /**************************************/
    updateLampGlow(beta) {
        /* Updates the lamp glow for all registers and flip-flops in the
        system. Beta is a bias in the range (0,1). For normal update use 0;
        to freeze the current state in the lamps use 1 */
        const gamma = (this.gateMANUAL.value ? 1 : beta || 0);

        // Control Gates
        this.gate$$$_OFLO.updateLampGlow(gamma);
        this.gate1ST_CYC.updateLampGlow(gamma);
        this.gate1ST_CYC_DELAYD.updateLampGlow(gamma);
        this.gate1ST_MPLY_CYCLE.updateLampGlow(gamma);
        this.gate2_DIG_CNTRL.updateLampGlow(gamma);
        this.gateADD_ENT.updateLampGlow(gamma);
        this.gateADD_MODE.updateLampGlow(gamma);
        this.gateBR_EXEC.updateLampGlow(gamma);
        this.gateBR_OUT.updateLampGlow(gamma);
        this.gateCARRY_IN.updateLampGlow(gamma);
        this.gateCARRY_OUT.updateLampGlow(gamma);
        this.gateCLR_MEM.updateLampGlow(gamma);
        this.gateCOMP.updateLampGlow(gamma);
        this.gateDIV_1_CYC.updateLampGlow(gamma);
        this.gateDVD_L_CYC.updateLampGlow(gamma);
        this.gateDVD_SIGN.updateLampGlow(gamma);
        this.gateEOR$.updateLampGlow(gamma);
        this.gateEXMIT_ENT.updateLampGlow(gamma);
        this.gateEXMIT_MODE.updateLampGlow(gamma);
        this.gateEXP_OFLO.updateLampGlow(gamma);
        this.gateEXP_UFLO.updateLampGlow(gamma);
        this.gateEZ.updateLampGlow(gamma);
        this.gateE_CYC_ENT.updateLampGlow(gamma);
        this.gateFIELD_MK_1.updateLampGlow(gamma);
        this.gateFIELD_MK_2.updateLampGlow(gamma);
        this.gateFL_1.updateLampGlow(gamma);
        this.gateFL_2.updateLampGlow(gamma);
        this.gateHP.updateLampGlow(gamma);
        this.gateIA_ENT.updateLampGlow(gamma);
        this.gateIA_REQ.updateLampGlow(gamma);
        this.gateIA_SEL.updateLampGlow(gamma);
        this.gateINT_ENT.updateLampGlow(gamma);
        this.gateINT_MODE.updateLampGlow(gamma);
        this.gateIX_BAND_1.updateLampGlow(gamma);
        this.gateIX_BAND_2.updateLampGlow(gamma);
        this.gateIX_ENT.updateLampGlow(gamma);
        this.gateIX_EXEC.updateLampGlow(gamma);
        this.gateI_CYC_ENT.updateLampGlow(gamma);
        this.gateLAST_CARD.updateLampGlow(gamma);
        this.gateLAST_LD_CYC.updateLampGlow(gamma);
        this.gateMASK.updateLampGlow(gamma);
        this.gateMC_1.updateLampGlow(gamma);
        this.gateMC_2.updateLampGlow(gamma);
        this.gateP.updateLampGlow(gamma);
        this.gateP_COMP.updateLampGlow(gamma);
        this.gateRECOMP.updateLampGlow(gamma);
        this.gateRM.updateLampGlow(gamma);
        this.gateRUN.updateLampGlow(gamma);
        this.gateSTOP.updateLampGlow(gamma);

        // Floating-point gates
        if (this.fpInstalled) {
            this.gateCOUNTER_COMP.updateLampGlow(gamma);
            this.gateDIGIT_FORCE_ENTRY.updateLampGlow(gamma);
            this.gateDIG_FORCE_MODE.updateLampGlow(gamma);
            this.gateD_GTR_99.updateLampGlow(gamma);
            this.gateEXP_ADD.updateLampGlow(gamma);
            this.gateEXP_MODIFY.updateLampGlow(gamma);
            this.gateEXP_MOD_ENTRY.updateLampGlow(gamma);
            this.gateEXP_MOD_REQ.updateLampGlow(gamma);
            this.gateEXP_OFLO_CORR.updateLampGlow(gamma);
            this.gateEXP_XMIT.updateLampGlow(gamma);
            this.gateEXTRA_SFT_CYC.updateLampGlow(gamma);
            this.gateFALSE_XMIT.updateLampGlow(gamma);
            this.gateFALSE_XMIT_ENTRY.updateLampGlow(gamma);
            this.gateFDIV.updateLampGlow(gamma);
            this.gateFDIV_ENTRY.updateLampGlow(gamma);
            this.gateFMUL_ENTRY.updateLampGlow(gamma);
            this.gateFMUL_MODE.updateLampGlow(gamma);
            this.gateFORCE_CF1.updateLampGlow(gamma);
            this.gateFP_HI_PLUS.updateLampGlow(gamma);
            this.gateFRAC_ADD_ENTRY.updateLampGlow(gamma);
            this.gateFRAC_ADD_MODE.updateLampGlow(gamma);
            this.gateFRAC_COMPARE_MODE.updateLampGlow(gamma);
            this.gateFRAC_COMPR_ENTRY.updateLampGlow(gamma);
            this.gateHI_ORDER_ZERO.updateLampGlow(gamma);
            this.gateLD.updateLampGlow(gamma);
            this.gateLD_ENTRY.updateLampGlow(gamma);
            this.gateNORM_SHIFT_RT.updateLampGlow(gamma);
            this.gateQ_EXIT.updateLampGlow(gamma);
            this.gateRESULT_XMIT.updateLampGlow(gamma);
            this.gateSCAN_ENTRY.updateLampGlow(gamma);
            this.gateSCAN_MINUS.updateLampGlow(gamma);
            this.gateSCAN_MODE.updateLampGlow(gamma);
            this.gateSCAN_Q.updateLampGlow(gamma);
            this.gateSHIFT_ENTRY.updateLampGlow(gamma);
            this.gateSHIFT_MODE.updateLampGlow(gamma);
            this.gateSIG_DIGIT.updateLampGlow(gamma);
        }

        // Input-Output Gates
        this.gateCHAR_GATE.updateLampGlow(gamma);
        this.gateDISK_ADDR.updateLampGlow(gamma);
        this.gateDISK_HUND.updateLampGlow(gamma);
        this.gateDISK_LD_ZERO.updateLampGlow(gamma);
        this.gateDISK_OP.updateLampGlow(gamma);
        this.gateDISK_UNIT.updateLampGlow(gamma);
        this.gateIO_FLAG.updateLampGlow(gamma);
        this.gateMEM_ADDR.updateLampGlow(gamma);
        this.gatePCH_FEED.updateLampGlow(gamma);
        this.gatePC_6XXX.updateLampGlow(gamma);
        this.gatePC_EZ.updateLampGlow(gamma);
        this.gatePC_HP.updateLampGlow(gamma);
        this.gatePC_IND.updateLampGlow(gamma);
        this.gatePC_OFLO.updateLampGlow(gamma);
        this.gatePC_TR_8.updateLampGlow(gamma);
        this.gateRD.updateLampGlow(gamma);
        this.gateRDR_FEED.updateLampGlow(gamma);
        this.gateREL.updateLampGlow(gamma);
        this.gateRESP_GATE.updateLampGlow(gamma);
        this.gateSCTR_COUNT.updateLampGlow(gamma);
        this.gateSCTR_CYC.updateLampGlow(gamma);
        this.gateSIMO_30.updateLampGlow(gamma);
        this.gateSIMO_HOLD.updateLampGlow(gamma);
        this.gateWR.updateLampGlow(gamma);

        // Instruction & Execution Cycle Gates
        this.gateE_1.updateLampGlow(gamma);
        this.gateE_2.updateLampGlow(gamma);
        this.gateE_3.updateLampGlow(gamma);
        this.gateE_4.updateLampGlow(gamma);
        this.gateE_5.updateLampGlow(gamma);
        this.gateIA_1.updateLampGlow(gamma);
        this.gateIA_2.updateLampGlow(gamma);
        this.gateIA_3.updateLampGlow(gamma);
        this.gateIX.updateLampGlow(gamma);
        this.gateI_1.updateLampGlow(gamma);
        this.gateI_2.updateLampGlow(gamma);
        this.gateI_3.updateLampGlow(gamma);
        this.gateI_4.updateLampGlow(gamma);
        this.gateI_5.updateLampGlow(gamma);
        this.gateI_6.updateLampGlow(gamma);

        // Operator Control Panel Indicators
        // this.gatePOWER_ON and this.gatePOWER_READY are not updated since they are on constantly.
        this.gateTHERMAL.updateLampGlow(gamma);
        this.gateWRITE_INTERLOCK.updateLampGlow(gamma);
        this.gateREAD_INTERLOCK.updateLampGlow(gamma);
        this.gateSAVE.updateLampGlow(gamma);
        this.gateTWPR_SELECT.updateLampGlow(gamma);
        //this.gateRFE1.updateLampGlow(gamma);
        //this.gateRFE2.updateLampGlow(gamma);
        //this.gateRFE3.updateLampGlow(gamma);
        this.gateAUTOMATIC.updateLampGlow(gamma);
        this.gateMANUAL.updateLampGlow(gamma);
        this.gateCHECK_STOP.updateLampGlow(gamma);

        // Misc Gates
        this.gateSCE.updateLampGlow(gamma);
        this.gateX_SIG_DIGIT.updateLampGlow(gamma);

        // Check Indicators
        this.diskAddrCheck.updateLampGlow(gamma);
        this.diskCylOflowCheck.updateLampGlow(gamma);
        this.diskWLRRBCCheck.updateLampGlow(gamma);
        this.dummy1Check.updateLampGlow(gamma);
        this.dummy2Check.updateLampGlow(gamma);
        this.dummy3Check.updateLampGlow(gamma);
        this.ioPrinterCheck.updateLampGlow(gamma);
        this.ioReadCheck.updateLampGlow(gamma);
        this.ioWriteCheck.updateLampGlow(gamma);
        this.oflowArithCheck.updateLampGlow(gamma);
        this.oflowDummyCheck.updateLampGlow(gamma);
        this.oflowExpCheck.updateLampGlow(gamma);
        this.parityMARCheck.updateLampGlow(gamma);
        this.parityMBREvenCheck.updateLampGlow(gamma);
        this.parityMBROddCheck.updateLampGlow(gamma);

        // Console Registers
        this.regDR.updateLampGlow(gamma);
        this.regMAR.updateLampGlow(gamma);
        this.regMBR.updateLampGlow(gamma);
        this.regMIR.updateLampGlow(gamma);
        this.regMQ.updateLampGlow(gamma);
        this.regOP.updateLampGlow(gamma);
        this.regXR.updateLampGlow(gamma);
    }


    /*******************************************************************
    *  Tracing Methods                                                 *
    *******************************************************************/

    /**************************************/
    traceGetDigit(addr) {
        /* Fetches and returns the digit at "addr" as bits 0F8421. Ignores and
        strips the parity bit */
        let pair = this.MM[addr >> 1];  // addr div 2

        return ((addr & 1) ? pair : pair >> 6) & Register.notParityMask;
    }

    /**************************************/
    traceGetData(addr, len) {
        /* Translates memory BCD codes and flags to ASCII starting at "addr" for
        "len" digits. Returns the formatted string */
        const limit = addr+len;
        let s = "";

        for (let a=addr; a<limit; ++a) {
            s += Envir.numericGlyphs[this.traceGetDigit(a)];
        }

        return s;
    }

    /**************************************/
    traceGetFieldData(addr, maxLen) {
        /* Formats and returns the digits of a field, starting at "addr" and up
        to "maxLen" digits in length */
        let a = addr-1;                 // ignore flag in first digit: fields are 2+ digits long
        let flag = false;               // found field delimiter flag
        let len = 1;                    // field length
        let s = Envir.numericGlyphs[this.traceGetDigit(addr)];  // result string
        let wrapped = false;            // true if no delimiter found and search wrapped around

        while (true) {
            if (a < 0) {                // memory address wraparound
                a = this.envir.memorySize-1;
            }

            const d = this.traceGetDigit(a);
            ++len;
            if (len <= maxLen) {
                s = Envir.numericGlyphs[d] + s;
            }

            if (d & 0x10) {
                flag = true;
                break;                  // out of while loop
            } else {
                --a;
                if (a == addr) {
                    wrapped = true;
                    break;
                }
            }
        }

        if (len > maxLen || wrapped) {
           s = `${wrapped ? "wrap:" : ""}${len}::` + s;
        }

        return s;
    }

    /**************************************/
    traceGetRecordData(addr, maxLen) {
        /* Formats and returns the digits of a record, starting at "addr" and up
        to "maxLen" digits in length */
        let a = addr;                   // current address
        let len = 0;                    // record length
        let rm = false;                 // found Record Mark delimiter flag
        let s = "";                     // result string
        let wrapped = false;            // true if not delimiter found and search wrapped around

        while (true) {
            if (a >= this.envir.memorySize) {   // memory address wraparound
                a = 0;
            }

            const d = this.traceGetDigit(a);
            ++len;
            if (len <= maxLen) {
                s += Envir.numericGlyphs[d];
            }

            if ((d & Envir.numRecMark) == Envir.numRecMark) {
                rm = true;
                break;                  // out of while loop
            } else {
                ++a;
                if (a == addr) {
                    wrapped = true;
                    break;
                }
            }
        }

        if (len > maxLen || wrapped) {
            s += `::${len}${wrapped ? "[wrap]" : ""}`;
        }

        return s;
    }

    /**************************************/
    tracePOperand() {
        /* Formats and returns the digits of the P operand depending on the op
        code. The address is taken from this.tracePAddr, which is set to the
        address in OR2 at the time of exitAddressing() because this operand's
        data is formatted at the end of an instruction (enterICycle()) and OR2
        typically changes during instruction execution */
        let s = "";

        switch (this.opThisAtts.pType) {
        case Processor.adNotUsed:
            s = "(n/a)";
            break;
        case Processor.adAddress:
            s = `(${this.tracePAddr.toBCDString()})`;
            break;
        case Processor.adField:
            s = this.traceGetFieldData(this.tracePAddr.binaryValue, 30);
            break;
        case Processor.adRecord:
            s = this.traceGetRecordData(this.tracePAddr.binaryValue, 30);
            break;
        case Processor.adLiteral:
            s = "(P-literal?)";
            break;
        case Processor.adDigit:
            s = this.traceGetData(this.tracePAddr.binaryValue, 1);
            break;
        case Processor.adSpecial:
            s = `(special ${this.traceGetData(this.opAddress+7, 5)})`;
            break;
        default:
            s = `(pType=${this.opThisAtts.pType}?)`;
            break;
        }

        return this.tracePLabel.length ? `${this.tracePLabel}=${s}` : "";
    }

    /**************************************/
    traceQOperand() {
        /* Formats and returns the digits of the Q operand depending on the op
        code. This routine must be called from exitAddressing() after OR1 is
        completely determined and before the instruction begins executing */
        let s = "";

        switch (this.opThisAtts.qType) {
        case Processor.adNotUsed:
            s = "(n/a)";
            break;
        case Processor.adAddress:
            s = `(${this.regOR1.toBCDString()})`;
            break;
        case Processor.adField:
            s = this.traceGetFieldData(this.regOR1.binaryValue, 30);
            break;
        case Processor.adRecord:
            s = this.traceGetRecordData(this.regOR1.binaryValue, 30);
            break;
        case Processor.adLiteral:
            s = this.traceGetFieldData(this.regOR1.binaryValue, 5);
            break;
        case Processor.adDigit:
            s = this.traceGetData(this.regOR1.binaryValue, 1);
            break;
        case Processor.adSpecial:
            s = `(special ${this.traceGetData(this.opAddress+7, 5)})`;
            break;
        default:
            s = `(pType=${this.opThisAtts.pType}?)`;
            break;
        }

        return this.traceQLabel.length ? `${this.traceQLabel}=${s}` : "";
    }

    /**************************************/
    traceState() {
        /* Debugging routine to write selected Processor state to the JavaScript
        console. There is no standard way to invoke this -- you have to insert a
        call somewhere in the code (and take it back out when you're done!) */

        console.debug("%2i %s %s %s | %s %s %s %s | %s %s %s %s | %i %i %i %i|%i %i %i %i|%i %i %i %i|%i %i %i %i|%i %i | %s %s %s %s",
            this.procState, this.regOP.toBCDString(),
            this.regIR1.toBCDString(), this.regIR2.toBCDString(),
            this.regOR1.toBCDString(), this.regOR2.toBCDString(), this.regOR3.toBCDString(),
            this.regOR4.toBCDString(), this.regPR1.toBCDString(), this.regPR2.toBCDString(),
            this.regMQ.toBCDString(), this.regDR.toBCDString(),
            this.gateFL_1.value, this.gateFL_2.value, this.gateFIELD_MK_1.value, this.gateFIELD_MK_2.value,
            this.gate1ST_CYC.value, this.gate1ST_CYC_DELAYD.value, this.gateDIV_1_CYC.value, this.gateDVD_L_CYC.value,
            this.gateADD_ENT.value, this.gateADD_MODE.value, this.gate2_DIG_CNTRL.value, this.gateCOMP.value,
            this.gateCARRY_IN.value, this.gateCARRY_OUT.value, this.gateDVD_SIGN.value, this.gateLAST_LD_CYC.value,
            this.gateHP.value, this.gateEZ.value,
            this.regMBR.even.toString(16).padStart(2, "0"), this.regMBR.odd.toString(16).padStart(2, "0"),
            this.regMIR.even.toString(16).padStart(2, "0"), this.regMIR.odd.toString(16).padStart(2, "0"));
    }

    /**************************************/
    traceInstruction() {
        /* Traces the instruction just executed */

        console.log(`<TRACE> ${this.traceLine}  ${this.tracePData}  ${this.traceQData}`);

        this.traceLine = this.tracePData = this.tracePLabel = this.traceQData = this.traceQLabel = "";
    }


    /*******************************************************************
    *  Memory Subsystem                                                *
    *******************************************************************/

    /**************************************/
    fetch() {
        /* Fetches the double-digit pair from memory at the MAR address
        into MBR */
        let addr = this.regMAR.binaryValue;

        if (this.regMAR.invalidBCD) {
            this.marCheck(`fetch() invalid MAR BCD ${this.regMAR.toBCDString()}`);
        } else if (addr >= this.envir.memorySize) {
            this.marCheck(`fetch() invalid memory address=${this.regMAR.toBCDString()}`);
        } else {
            let pair = this.MM[addr >> 1];              // div 2
            this.regMIR.correctedValue = this.regMBR.value = pair;

            // Set indicators for parity errors.
            if (this.regMBR.parityError) {
                let digit = (pair >> Register.digitBits) & Register.digitMask;
                if (Envir.oddParity5[digit] != digit) {
                    this.setIndicator(17, `fetch() parity error odd @${this.regMAR.toBCDString()}`);
                }

                digit = pair & Register.digitMask;
                if (Envir.oddParity5[digit] != digit) {
                    this.setIndicator(16, `fetch() parity error even @${this.regMAR.toBCDString()}`);
                }
            }
        }
    }

    /**************************************/
    store() {
        /* Stores the double-digit pair in MIR to memory at the MAR address */
        let addr = this.regMAR.binaryValue;

        if (this.regMAR.invalidBCD) {
            this.marCheck(`store() invalid MAR BCD ${this.regMAR.toBCDString()}`);
        } else if (addr >= this.envir.memorySize) {
            this.marCheck(`store() invalid memory address=${this.regMAR.toBCDString()}`);
        } else {
            this.MM[addr >> 1] = this.regMIR.value;
        }
    }

    /**************************************/
    async clearMemory() {
        /* Clears all of memory to zeroes */

        this.regMAR.clear();
        this.regMIR.clear();
        this.envir.startTiming();

        let a = 0;
        do {
            this.store();
            this.regMAR.incr(2);
            a += 2;
            if (a % 20000 == 0) {
                this.gateCLR_CTRL.value = 1;
                this.gateEND_OF_MODULE.value = 1;
            }

            if (this.envir.tick()) {
                await this.envir.throttle();
            }
        } while (a < Envir.maxMemorySize);

        this.gateCLR_MEM.value = 0;
        this.regMAR.clear();
        this.enterManual();
    }


    /*******************************************************************
    *  Input/Output Subsystem                                          *
    *******************************************************************/

    /**************************************/
    ioSelect(device, variant) {
        /* Sets up this.ioDevice and this.ioVariant from the parameters */

        this.ioSelectNr = device;
        switch (device) {
        case 1:         // Typewriter
            this.ioDevice = this.devices.typewriter;
            this.ioVariant = variant & Register.bcdMask;
            this.gateTWPR_SELECT.value = 1;
            break;
        case 2:         // Paper Tape Punch / Plotter
            this.ioDevice = this.devices.paperPunch;
            break;
        case 3:         // Paper Tape Reader
            this.ioDevice = this.devices.paperReader;
            break;
        case 4:         // Card Punch
            this.ioDevice = this.devices.cardPunch;
            break;
        case 5:         // Card Reader
            this.ioDevice = this.devices.cardReader;
            break;
        case 7:         // Disk Drive
            this.ioDevice = this.devices.diskDrive;
            this.ioVariant = variant & Register.bcdMask;
            this.gateDISK_OP.value = 1;
            break;
        case 9:         // Line Printer
            this.ioDevice = this.devices.linePrinter;
            this.ioVariant = variant & Register.bcdValueMask;
            break;
        case 32:        // Binary Paper Tape Punch
            if (!this.bcInstalled) {    // must be configured for Binary Capabilities option
                this.ioDevice = null;
            } else if (this.opBinary == 39 /*WA*/) {
                this.ioDevice = this.devices.paperPunch;
            } else {
                this.ioDevice = null;
            }
            break;
        case 33:        // Binary Paper Tape Reader
            if (!this.bcInstalled) {    // must be configured for Binary Capabilities option
                this.ioDevice = null;
            } else if (this.opBinary == 37 /*RA*/) {
                this.ioDevice = this.devices.paperReader;
            } else {
                this.ioDevice = null;
            }
            break;
        default:
            this.ioDevice = null;
            break;
        }
    }

    /**************************************/
    paperTapeErrorHalt(halt) {
        /* Handles special halt and restart behavior for invalid punches on the
        paper-tape reader. If "halt" is true, halts the Processor in both MANUAL
        and AUTOMATIC modes and sets Write Check. If false, resets Write Check
        and AUTOMATIC mode, leaving the Processor in manual, ready to be
        restarted by the START button. Returns true if the operation is Write
        Binary */

        if (halt) {
            this.stopSCE();
            this.gateWRITE_INTERLOCK.value = 1;
        } else {
            this.gateWRITE_INTERLOCK.value = 0;
            this.ioWriteCheck.value = 0;
            this.exitAutomatic();
            this.gateSCE.value = 0;
            this.setProcState(procStateE2);     // to continue the I/O
            if (this.opBinary == 38 /*WN*/) {
                this.regOR2.decr(1);    // back up to the bad digit
            } else if (this.opBinary == 39 /*WA*/) {
                this.regOR2.decr(2);    // back up to the bad character
            }
        }

        return this.opBinary == 39 /*WA*/ && this.ioSelectNr == 32 /*RBPT*/;
    }

    /**************************************/
    async dumpNumerically(digit) {
        /* Executes one digit cycle of Dump Numerically (DN, 35). If the device
        returns an end-of-block indication and we're at END OF MODULE, or
        RELEASE occurs, terminate the I/O. Note that OR2 gets incremented before
        this routine is called */
        let eob = 0;                    // end-of-buffer indication

        this.gateRESP_GATE.value = 0;
        this.gateCHAR_GATE.value = 1;

        if (this.gateWR.value) {        // we haven't been released...
            this.gateRESP_GATE.value = 1;

            if (this.regOR2.binaryValue % 20000 == 0) {
                this.gateEND_OF_MODULE.value = 1;
            }

            switch (this.ioSelectNr) {
            case 1:     // Typewriter
                eob = await this.ioDevice.dumpNumeric(digit);
                if (this.gateEND_OF_MODULE.value) {
                    this.ioExit();
                } else {
                    this.envir.restartTiming();         // update emulation clock
                }
                break;
            case 2:     // Paper Tape Punch/Plotter
                eob = await this.ioDevice.dumpNumeric(
                        Processor.xlateOutNumeric[digit & Register.notParityMask]);
                if (eob) {                              // punch error occurred
                    this.enterLimbo();                  // just hang on device error
                } else if (this.gateEND_OF_MODULE.value) {
                    await this.ioDevice.dumpNumeric(-1);// punch the EOL
                    this.ioExit();
                } else {
                    this.envir.restartTiming();         // update emulation clock
                }
                break;
            case 4:     // Card Punch
                eob = await this.ioDevice.dumpNumeric(
                        Processor.xlateOutNumeric[digit & Register.notParityMask]);
                if (eob) {
                    if (this.gateEND_OF_MODULE.value) {
                        this.ioExit();
                    } else {
                        this.envir.restartTiming();     // update emulation clock
                    }
                }
                break;
            case 9:     // Line Printer
                eob = await this.ioDevice.dumpNumeric(
                        Processor.xlateOutNumeric[digit & Register.notParityMask]);
                if (eob) {
                    this.ioExit();
                }
                break;
            default:    // all others
                eob = 1;
                this.ioExit();
                this.checkStop(`dumpNumerically: invalid device ${this.ioSelectNr}`);
                break;
            }
        }

        this.gateCHAR_GATE.value = 0;
        if (this.gateWR.value) {    // we haven't been released...
            this.gateRESP_GATE.value = 1;
        }
    }

    /**************************************/
    async writeNumerically(digit) {
        /* Executes one digit cycle of Write Numerically (WN, 38).
        Terminate the I/O if:
            * For Card Punch, if it returns eob=true (=> 80th column sent)
            * For Line Printer, if it returns eob=true (=> buffer full)
            * For all others (not used by Disk Drive), if the digit matches a record mark
            * If a RELEASE occurs
        Note that OR2 gets incremented before this routine is called */
        const ptCode = Processor.xlateOutNumeric[digit & Register.notParityMask];
        let eob = 0;                    // end-of-buffer indication (meaning varies)

        this.gateRESP_GATE.value = 0;
        this.gateCHAR_GATE.value = 1;
        switch (this.ioSelectNr) {
        case 1:         // Typewriter
            if ((digit & Envir.numRecMark) == Envir.numRecMark) {
                this.ioExit();
            } else {
                eob = await this.ioDevice.writeNumeric(digit);
            }
            break;
        case 2:         // Paper Tape Punch/Plotter
            if ((digit & Envir.numRecMark) == Envir.numRecMark) {
                this.gateRM.value = 1;
                eob = await this.ioDevice.writeNumeric(-1);     // punch the EOL
                this.ioExit();
            } else {
                eob = await this.ioDevice.writeNumeric(ptCode);
                if (eob) {                                      // bad character punched
                    this.enterLimbo();                          // just hang on device error
                }
            }
            break;
        case 4:         // Card Punch
            eob = await this.ioDevice.writeNumeric(ptCode);
            if (eob) {
                this.ioExit();
            }
            break;
        case 9:         // Line Printer
            if ((digit & Envir.numRecMark) == Envir.numRecMark) {
                this.gateRM.value = 1;
            }

            if (this.gateRM.value) {
                eob = await this.ioDevice.writeNumeric(-1);     // dummy buffer fill
            } else {
                eob = await this.ioDevice.writeNumeric(ptCode);
            }

            if (eob) {
                this.ioExit();
            }
            break;
        default:
            eob = 1;
            this.ioExit();
            this.checkStop(`writeNumerically: invalid device ${this.ioSelectNr}`);
            break;
        }

        this.gateCHAR_GATE.value = 0;
        if (this.gateWR.value) {    // we haven't been released...
            this.gateRESP_GATE.value = 1;
        }
    }

    /**************************************/
    async writeAlphanumerically(digitPair) {
        /* Executes one character cycle of Write Numerically (WN, 39).
        Terminate the I/O if:
            * For Card Punch, if it returns eob=true (=> 80th column sent)
            * For Line Printer, if it returns eob=true (=> buffer full)
            * For all others (not used by Disk Drive), if the odd digit matches a record mark
            * If a RELEASE occurs
        Note that OR2 gets incremented before this routine is called */
        const even = (digitPair >> 6) & Register.bcdMask;
        const odd =  digitPair & Register.bcdMask;
        let ptCode = Processor.xlateOutAlpha[even*16 + odd];
        let eob = 0;

        this.gateRESP_GATE.value = 0;
        this.gateCHAR_GATE.value = 1;
        switch (this.ioSelectNr) {
        case 1:         // Typewriter
            if ((digitPair & Envir.numRecMark) == Envir.numRecMark) {
                this.gateRM.value = 1;
                this.ioExit();
            } else {
                eob = await this.ioDevice.writeAlpha(digitPair);
            }
            break;
        case 2:         // Paper Tape Punch/Plotter
            if ((digitPair & Envir.numRecMark) == Envir.numRecMark) {
                this.gateRM.value = 1;
                eob = await this.ioDevice.writeAlpha(-1);       // punch the EOL
                this.ioExit();
            } else {
                eob = await this.ioDevice.writeAlpha(ptCode);
                if (eob) {
                    this.enterLimbo();                          // just hang on device error
                }
            }
            break;
        case 4:         // Card Punch
            eob = await this.ioDevice.writeAlpha(ptCode);
            if (eob) {
                this.ioExit();
            }
            break;
        case 9:         // Line Printer
            if ((digitPair & Envir.numRecMark) == Envir.numRecMark) {
                this.gateRM.value = 1;
            }

            if (this.gateRM.value) {
                eob = await this.ioDevice.writeAlpha(-1);       // dummy buffer fill
            } else {
                eob = await this.ioDevice.writeAlpha(ptCode);
            }

            if (eob) {
                this.ioExit();
            }
            break;
        case 32:        // Binary Paper Tape
            // Construct the binary tape code.
            ptCode = ((even & 0b110) << 4) | ((even & 1) << 3) | (odd & 0b111);
            ptCode |= (Envir.oddParity7[ptCode] >> 3) & 0b10000;        // insert check bit

            if ((digitPair & Envir.numRecMark) == Envir.numRecMark) {
                this.gateRM.value = 1;
                eob = await this.ioDevice.writeBinary(-1);      // EOL
                this.ioExit();
            } else {
                eob = await this.ioDevice.writeBinary(ptCode);
                if (eob) {
                    this.enterLimbo();                          // just hang on device error
                }
            }
            break;
        default:
            eob = 1;
            this.ioExit();
            this.checkStop(`writeAlphanumerically: invalid device ${this.ioSelectNr}`);
            break;
        }

        this.gateCHAR_GATE.value = 0;
        if (this.gateWR.value) {    // we haven't been released...
            this.gateRESP_GATE.value = 1;
        }
    }

    /**************************************/
    receiveKeystroke(code, flagged) {
        /* Receives the next keystroke code from the Typewriter. Determines
        whether input is being accepted (i.e., keyboard is unlocked), and if so
        either stores the character or performs the special function. Code can be:
            (>=0) the ASCII code for the key pressed.
            (-1) indicates the R/S (Enter) key was pressed.
            (-2) indicates the CORR (Backspace) key was pressed.
            (-3) indicates the FLG (` [grave accent] or ~ [tilde] key was pressed.
            (-4) indicates the INSERT (ESC) key was pressed.
            (-5) indicates the RETURN (Enter) key was pressed.
            (-6) indicates the TAB key was pressed.
            (-7) indicates the SPACE key was pressed.
        For numeric input (RN, 36)
            only the decimal digits, record mark (|), and numeric blank (@) are
            accepted. CORR causes OR2 to be decremented by 1.
        For alphanumeric input (RA, 37)
            only the valid 1620 characters and record mark are accepted. Other
            ASCII characters and FLG are ignored.
        The method returns:
            0 if the keystroke is to be ignored and not echoed (keyboard locked).
            (-1) if an R/S code is accepted and should be echoed to the paper.
            (-2) if a CORR code is accepted and should be printed.
            (-3) if a FLG code is accepted and a flagged echo should be set up.
            (-4) if an INSERT code is accepted.
            (-5) indicates a local carriage-return should be output.
            (-6) indicates a local tab should be output.
            (-7) indicates a local space should be output.
            otherwise, the 1620 internal code for the character to be echoed.
        "flagged" indicates the keystroke was preceded by the FLG key. This is
        ignored for Read Alphanumerically.
        Note that the Typewriter will call this routine whenever the Typewriter
        window has the focus and the user presses a keyboard key. It's the job
        of this routine to figure out whether that keystroke should be accepted.
        Thus, keyboard lock is enforced here, not in the Typewriter. The
        Typewriter will not send 1620 characters invalid for it */
        let reply = 0;                  // ignore keystrokes by default

        if (this.ioSelectNr == 1 && this.gateRD.value) { // must be waiting for Typewriter input
            const readNumeric = (this.opBinary == 36 /*RN*/);

            switch (code) {
            case -1:    // R/S key
                reply = code;
                break;

            case -2:    // CORR key
                reply = code;
                this.regMAR.value = this.regOR2.value;
                this.regOR2.decr(readNumeric ? 1 : 2);
                break;

            case -3:    // FLG key
                if (readNumeric) {
                    reply = code;
                }
                break;

            case -4:    // INSERT key -- can't be used while I/O in progress
                break;

            case -5:    // RETURN key
            case -6:    // TAB key
                reply = code;           // just return these for local echo
                break;

            case -7:    // SPACE key: convert to the space code and continue
                code = (" ").charCodeAt(0);
                //--no break
            default:    // some other character
                this.gateRESP_GATE.value = 1;
                if (readNumeric) {
                    let char = Processor.twprASCIInumeric1620[String.fromCharCode(code)];
                    if (char !== undefined) {
                        if (flagged) {
                            this.gateIO_FLAG.value = 1;
                            reply = Envir.oddParity5[char | Register.flagMask];
                        } else {
                            this.gateIO_FLAG.value = 0;
                            reply = Envir.oddParity5[char];
                        }

                        this.regMAR.value = this.regOR2.value;
                        this.fetch();
                        this.regMIR.setDigit(this.regMAR.isEven, reply);
                        this.store();
                        this.regOR2.incr(1);
                        if (this.gateINSERT.value && this.regMAR.binaryValue == 99) {
                            this.ioExit();
                            this.enterManual();
                        }
                    }
                } else {        // read alphanumeric
                    let char = Processor.stdASCIIalpha1620[String.fromCharCode(code)];
                    if (char !== undefined) {
                        let even = (char >> Register.digitBits) & Register.bcdMask;
                        let odd  = char & Register.bcdMask;
                        reply = (Envir.oddParity5[even] << Register.digitBits) | Envir.oddParity5[odd];
                        this.regMAR.value = this.regOR2.value;
                        this.fetch();

                        // Simulate the problem with even starting addresses.
                        // The input translator was sensitive to whether it was
                        // dealing with zone or numeric digits, so an even address
                        // could cause translation and parity errors. This
                        // approach just sets MBR Check Pending, which will set
                        // the check indicator in ioExit.
                        if (this.regMAR.isEven) {
                            [even, odd] = [odd | 8, even];
                            if (!this.ioMBRCheckPending) {
                                this.parityMBREvenCheck.value = 1;
                                this.ioMBRCheckPending = true;
                            }
                        }

                        // Preserve any flags already in memory.
                        this.regMIR.setDigitNoFlag(1, even);
                        this.regMIR.setDigitNoFlag(0, odd);
                        this.store();
                        this.regOR2.incr(2);
                    }
                }
                break;
            }

            this.gateRESP_GATE.value = 0;
            this.envir.restartTiming(); // restart the throttling clock (because Typewriter is so slow)
        } else {                        // check for local action
            switch (code) {
            case -4:                    // INSERT key
                reply = code;
                this.insert(false);             // will check for MANUAL mode, etc.
                break;
            case -5:                    // RETURN key
            case -6:                    // TAB key
            case -7:                    // SPACE key
                reply = code;                   // just echo the key locally
                break;
            }
        }

        return reply;
    }

    /**************************************/
    receiveCardColumn(ptCode, lastCol) {
        /* Called by the CardReader to transfer one character code to core
        memory. "ptCode" is the paper-tape code for the character, "lastCol" is
        true if this is the last column (80) of the card. If the CardReader
        transfers invalid 1620 characters, the RD CHK indicator will be set */

        if (this.ioSelectNr == 5 && this.gateRD.value) { // must be waiting for CardReader input
            const readNumeric = (this.opBinary == 36 /*RN*/);

            this.gateRESP_GATE.value = 1;
            if (readNumeric) {
                let digit = Processor.xlateInNumeric[ptCode];
                if ((digit ?? 0) == 0) {
                    this.ioReadCheckPending = true;
                    digit = 0;
                } else {
                    this.gateIO_FLAG.value = digit & Register.flagMask;
                }

                this.regMAR.value = this.regOR2.value;
                this.fetch();
                this.regMIR.setDigit(this.regMAR.isEven, digit);
                this.store();
                this.regOR2.incr(1);
                if (this.gateINSERT.value && this.regMAR.binaryValue == 99) {
                    this.ioExit();
                    this.enterManual();
                }
            } else {    // read alphanumeric
                let digitPair = Processor.xlateInAlpha[ptCode];
                if ((digitPair ?? 0) == 0) {
                    this.ioReadCheckPending = true;
                    digitPair = 0;
                }

                let even = (digitPair >> Register.digitBits) & Register.bcdMask;
                let odd  = digitPair & Register.bcdMask;
                this.regMAR.value = this.regOR2.value;
                this.fetch();

                // Simulate the problem with even starting addresses. The input
                // translator was sensitive to whether it was dealing with zone
                // or numeric digits, so an even address could cause translation
                // and parity errors. This approach just sets MBR Check Pending,
                // which will set the check indicator at lastCol below.
                if (this.regMAR.isEven) {
                    [even, odd] = [odd | 8, even];
                    this.ioMBRCheckPending = true;
                }

                // Preserve any flags already in memory.
                this.regMIR.setDigitNoFlag(1, even);
                this.regMIR.setDigitNoFlag(0, odd);
                this.store();
                this.regOR2.incr(2);
            }

            this.envir.tick();                  // advance the emulation clock
            this.envir.tick();                  // by 2 memory cycles
            this.gateRESP_GATE.value = 0;
            if (lastCol) {
                if (this.ioReadCheckPending) {
                    this.ioReadCheckPending = false;
                    this.setIndicator(6, "CardReader read check");
                }

                if (this.ioMBRCheckPending) {
                    this.ioMBRCheckPending = false;
                    this.setIndicator(16, "CardReader even address for alphanumeric I/O");
                }

                this.ioExit();                  // exits Limbo state; will reset INSERT if it's set
                if (!this.gateMANUAL.value) {
                    this.run();
                }
            }
        }
    }

    /**************************************/
    receivePaperTapeFrame(ptCode, eol) {
        /* Called by the PaperTapeReader to transfer one character code to core
        memory. "ptCode" is the ASCII 1-character string, "eol" is true if this
        frame has the EOL punch (and ptCode is not stored). If the PaperTapeReader
        transfers invalid 1620 characters, the RD CHK indicator will be set */

        if (this.ioSelectNr == 3 && this.gateRD.value) { // must be waiting for PaperTapeReader input
            const readNumeric = (this.opBinary == 36 /*RN*/);

            this.gateRESP_GATE.value = 1;
            if (readNumeric) {
                switch (ptCode) {
                case 0b00001110:
                case 0b01011110:
                    // Check for DC1 (842 punch, End Card 1) or CR  (XC842 punch, Carriage Return)
                    // frames that cause MBRE errors. See Germain, p.32.
                    this.parityMBREvenCheck.value = 1;
                    this.ioMBRCheckPending = true;
                    break;
                case 0b0111000:
                    // Check for X0C punch (alternate for -0 on paper-tape input)
                    ptCode = 0b01000000;
                    break;
                }

                let digit = Processor.xlateInNumeric[ptCode];
                if (eol) {
                    digit = Envir.numRecMark;
                } else if ((digit ?? 0) == 0) {
                    digit = 0;
                    this.ioReadCheck.value = 1;
                    this.ioReadCheckPending = true;
                } else {
                    this.gateIO_FLAG.value = digit & Register.flagMask;
                }

                this.regMAR.value = this.regOR2.value;
                this.fetch();
                this.regMIR.setDigit(this.regMAR.isEven, digit);
                this.store();
                this.regOR2.incr(1);
            } else {    // read alphanumeric
                let digitPair = Processor.xlateInAlpha[ptCode];
                if (eol) {
                    digitPair = Envir.numRecMark;
                } else if ((digitPair ?? 0) == 0) {
                    digitPair = 0;
                    this.ioReadCheck.value = 1;
                    this.ioReadCheckPending = true;
                }

                let even = (digitPair >> Register.digitBits) & Register.bcdMask;
                let odd  = digitPair & Register.bcdMask;
                this.regMAR.value = this.regOR2.value;
                this.fetch();

                // Simulate the problem with even starting addresses. The input
                // translator was sensitive to whether it was dealing with zone
                // or numeric digits, so an even address could cause translation
                // and parity errors. This approach just sets MBR Check Pending,
                // which will set the check indicator at eol below.
                if (this.regMAR.isEven) {
                    [even, odd] = [odd | 8, even];
                    if (!this.ioMBRCheckPending) {
                        this.ioMBRCheckPending = true;
                        this.parityMBREvenCheck.value = 1;
                    }
                }

                // Preserve any flags already in memory.
                this.regMIR.setDigitNoFlag(1, even);
                this.regMIR.setDigitNoFlag(0, odd);
                this.store();
                this.regOR2.incr(2);
            }

            this.envir.tick();                  // advance the emulation clock
            this.envir.tick();                  // by 2 memory cycles
            this.gateRESP_GATE.value = 0;
            if (eol) {
                if (this.ioReadCheckPending) {
                    this.ioReadCheckPending = false;
                    this.setIndicator(6, "PaperTapeReader read check");
                }

                if (this.ioMBRCheckPending) {
                    this.ioMBRCheckPending = false;
                    this.setIndicator(16, "PaperTapeReader even address for alphanumeric I/O");
                }

                this.ioExit();                  // exits Limbo state;
                if (!this.gateMANUAL.value) {
                    this.run();
                }
            }
        }
    }

    /**************************************/
    receivePaperTapeBinary(ptCode, eol) {
        /* Called by the PaperTapeReader to transfer one binary frame to core
        memory. "ptCode" is the raw binary frame, "eol" is true if this frame
        indicates EOL (and code is not stored) */

        if (this.ioSelectNr == 33 && this.gateRD.value) {// must be waiting for PaperTapeReader input
            let even = ((ptCode >> 3) & 1) | ((ptCode >> 4) & 0b110);   // X08 bits
            let odd  = ptCode & 0b111;                                  // 421 bits
            if (eol) {
                even = 0;
                odd = Envir.numRecMark;
            } else {
                if (Envir.oddParity7[ptCode] != ptCode) {
                    this.ioReadCheck.value = 1;
                    this.ioReadCheckPending = true;
                }
            }

            this.regMAR.value = this.regOR2.value;
            this.fetch();

            // Simulate the problem with even starting addresses. The input
            // translator was sensitive to whether it was dealing with zone
            // or numeric digits, so an even address could cause translation
            // and parity errors. This approach just sets MBR Check Pending,
            // which will set the check indicator at eol below.
            if (this.regMAR.isEven) {
                [even, odd] = [odd | 8, even];
                if (!this.ioMBRCheckPending) {
                    this.ioMBRCheckPending = true;
                    this.parityMBREvenCheck.value = 1;
                }
            }

            // Preserve any flags already in memory.
            this.regMIR.setDigitNoFlag(1, even);
            this.regMIR.setDigitNoFlag(0, odd);
            this.store();
            this.regOR2.incr(2);

            this.envir.tick();                  // advance the emulation clock
            this.envir.tick();                  // by 2 memory cycles
            this.gateRESP_GATE.value = 0;
            if (eol) {
                if (this.ioReadCheckPending) {
                    this.ioReadCheckPending = false;
                    this.setIndicator(6, "PaperTapeReader read check");
                }

                if (this.ioMBRCheckPending) {
                    this.ioMBRCheckPending = false;
                    this.setIndicator(16, "PaperTapeReader even address for alphanumeric I/O");
                }

                this.ioExit();                  // exits Limbo state;
                if (!this.gateMANUAL.value) {
                    this.run();
                }
            }
        }
    }

    /**************************************/
    loadDiskControl() {
        /* Loads the fields of the Disk Control Field addressed by OR2 to the
        OR1, OR2, and PR2 registers. The drive code is converted to a disk
        module number and stored in this.ioDiskDriveCode. This process involves 10
        memory cycles which are not visible when doing STOP/SCE. Returns true if
        there is an error */
        let result = false;

        this.regMAR.value = this.regOR2.value;
        if (this.regMAR.isOdd) {
            result = true;
            this.marCheck("Disk Control Field at odd address");
        }

        this.gateDISK_LD_ZERO.value = 1;
        this.fetch();
        let driveCode = this.regMBR.even & Register.bcdMask;
        this.regOR1.clear();
        this.regOR2.clear();
        this.regPR2.clear();
        this.envir.tick();
        this.gateDISK_LD_ZERO.value = 0;

        // Load OR1.

        this.gateDISK_ADDR.value = 1;
        this.fetch();   // no MAR increment
        this.regOR1.setDigit(4, this.regMBR.odd);
        this.envir.tick();

        this.gateDISK_HUND.value = 1;
        this.regMAR.incr(2);
        this.fetch();
        this.regOR1.setDigit(3, this.regMBR.even);
        this.regOR1.setDigit(2, this.regMBR.odd);
        this.envir.tick();
        this.gateDISK_HUND.value = 0;

        this.gateDISK_UNIT.value = 1;
        this.regMAR.incr(2);
        this.fetch();
        this.regOR1.setDigit(1, this.regMBR.even);
        this.regOR1.setDigit(0, this.regMBR.odd);
        this.envir.tick();
        this.gateDISK_UNIT.value = 0;
        this.gateDISK_ADDR.value = 0;

        // Load PR2.

        this.gateSCTR_COUNT.value = 1;
        this.gateDISK_HUND.value = 1;
        this.regMAR.incr(2);
        this.fetch();
        this.regPR2.setDigit(2, this.regMBR.even);
        this.regPR2.setDigit(1, this.regMBR.odd);
        this.envir.tick();
        this.gateDISK_HUND.value = 0;

        this.gateDISK_UNIT.value = 1;
        this.regMAR.incr(2);
        this.fetch();
        this.regPR2.setDigit(0, this.regMBR.even);
        this.envir.tick();
        this.gateDISK_UNIT.value = 0;
        this.gateSCTR_COUNT.value = 0;

        // Load OR2.

        this.gateMEM_ADDR.value = 1;
        this.fetch();   // no MAR increment
        this.regOR2.setDigit(4, this.regMBR.odd);
        this.envir.tick();

        this.gateDISK_HUND.value = 1;
        this.regMAR.incr(2);
        this.fetch();
        this.regOR2.setDigit(3, this.regMBR.even);
        this.regOR2.setDigit(2, this.regMBR.odd);
        this.envir.tick();
        this.gateDISK_HUND.value = 0;

        this.gateDISK_UNIT.value = 1;
        this.regMAR.incr(2);
        this.fetch();
        this.regOR2.setDigit(1, this.regMBR.even);
        this.regOR2.setDigit(0, this.regMBR.odd);
        this.envir.tick();
        this.gateDISK_UNIT.value = 0;
        this.gateMEM_ADDR.value = 0;

        // Finish load.

        this.gateSCTR_CYC.value = 1;
        if (driveCode < 8) {
            this.ioDiskDriveCode = driveCode;
        } else {
            result = true;
            this.ioDiskDriveCode = 9;
            this.checkStop(`Disk invalid drive code ${driveCode}`);
        }

        this.envir.tick();
        this.gateDISK_OP.value = 0;
        return result;
    }

    /**************************************/
    initiateDiskControl() {
        /* Initiates a seek operation to the disk drive. Module selection errors
        are ignored */

        if (this.loadDiskControl()) {
            // Check Stop occurred during load of registers
        } else if (this.ioVariant == 1) {
            this.gateSCTR_CYC.value = 0;
            if (this.ioDevice.selectModule(this.ioDiskDriveCode, this.regOR1.value)) {
                this.ioDevice.initiateSeek();   // async, returns immediately
            }
            this.ioExit();
        } else {
            this.gateWRITE_INTERLOCK.value = 1;
            this.enterLimbo();                  // just hang on undefined variant
        }
    }

    /**************************************/
    async readDiskSectors(check, wlrc) {
        /* Reads one or more disk sectors from the currently selected disk
        module at the address specified by OR1 for the number of sectors
        specified by PR2 to the memory address specified by OR2.
            check: compare data to memory instead of storing data to memory
            wlrc: detect group marks and wrong-length records.
        Runs in Limbo, so restarts this.run() on completion */

        const storeSector = (finished, error, data) => {
            /* Callback function to receive disk sector data into memory:
                finished: disk module has no more sectors to send (usually sector overflow)
                error: disk module detected a fatal error during read
                data: Uint8Array buffer holding the disk sector digits
            Returns false to indicate the disk module should continue reading
            sectors; returns true on error or after the sector count has been
            exhausted */
            let terminate = false;

            if (finished) {
                terminate = true;
            } else if (error) {
                terminate = true;
            } else {
                this.gateRESP_GATE.value = 1;
                for (let x=Processor.diskAddressSize; x<Processor.diskSectorSize; x+=2) {
                    const d1 = data[x] & Register.notParityMask;
                    const d2 = data[x+1] & Register.notParityMask;
                    this.regMAR.value = this.regOR2.value;
                    this.fetch();
                    if (check) {
                        const m1 = this.regMBR.even & Register.notParityMask;
                        const m2 = this.regMBR.odd & Register.notParityMask;
                        if (wlrc && ((d1 & Register.bcdMask) == Envir.numGroupMark ||
                                     (m1 & Register.bcdMask) == Envir.numGroupMark)) {
                            terminate = true;
                            this.setIndicator(37, `Disk check WLRC compare group mark at ${x}`);
                        } else if (d1 != m1) {
                            terminate = true;
                            this.setIndicator(37, `Disk check compare mismatch at ${x}`);
                        } else if (wlrc && ((d2 & Register.bcdMask) == Envir.numGroupMark ||
                                            (m2 & Register.bcdMask) == Envir.numGroupMark)) {
                            terminate = true;
                            this.setIndicator(37, `Disk check WLRC compare group mark at ${x+1}`);
                        } else if (d2 != m2) {
                            terminate = true;
                            this.setIndicator(37, `Disk check compare mismatch at digit ${x+1}`);
                        }
                    } else {
                        this.regMIR.even = d1;
                        if (wlrc && (d1 & Register.bcdMask) == Envir.numGroupMark) {
                            terminate = true;
                            this.setIndicator(37, `Disk read WLRC group mark at ${x}`);
                        } else {
                            this.regMIR.odd = d2;
                            if (wlrc && (d2 & Register.bcdMask) == Envir.numGroupMark) {
                                terminate = true;
                                this.setIndicator(37, `Disk read WLRC group mark at ${x+1}`);
                            }
                        }
                    }

                    this.store();
                    this.envir.tick();
                    this.regOR2.incr(2);
                    if (terminate) {
                        break;          // out of for loop
                    }
                } // for x

                this.gateRESP_GATE.value = 0;
            }

            this.regOR1.incr(1);                                // increment sector address
            this.ioDevice.sectorAddr = this.regOR1.value;       // tell device what address should be
            if (this.regPR2.isZero) {
                terminate = true;
            } else {
                this.regPR2.decr(1);    // decrement count for next sector
                if (wlrc && !terminate) {
                    this.regMAR.value = this.regOR2.value;
                    this.fetch();
                    if ((this.regMBR.even & Register.bcdMask) == Envir.numGroupMark) {
                        terminate = true;
                        this.setIndicator(37, "Disk early end-of-sector group mark in memory");
                    }
                }
            }

            return terminate;
        }; // storeSector

        this.regPR2.decr(1);            // decrement count for initial sector
        await this.ioDevice.readSectors(storeSector);
        if (wlrc && this.regPR2.isZero) {
            this.regMAR.value = this.regOR2.value;
            this.fetch();
            if ((this.regMBR.even & Register.bcdMask) != Envir.numGroupMark) {
                this.setIndicator(37, "Disk read WLRC no memory group mark after end of read");
            }
        }

        this.ioExit();                  // exits Limbo state; will reset INSERT if it's set
        if (!this.gateMANUAL.value) {
            this.run();
        }
    }

    /**************************************/
    async readDiskTrack(wlrc) {
        /* Reads one track of disk sectors from the currently selected disk
        module at the address specified by OR1 to the memory address specified
        by OR2.
            wlrc: detect group marks and wrong-length records.
        Runs in Limbo, so restarts this.run() on completion */
        let evenAddr = 0;               // even/odd half of memory digit pair

        const storeTrack = (finished, error, data) => {
            /* Callback function to receive disk sector data into memory:
                finished: disk module has no more sectors to send (usually sector overflow)
                error: disk module detected a fatal error during read
                data: Uint8Array buffer holding the disk sector digits
            Returns false to indicate the disk module should continue reading
            sectors; returns true on error */
            let terminate = false;

            if (finished) {
                terminate = true;
            } else if (error) {
                terminate = true;
            } else {
                this.gateRESP_GATE.value = 1;
                for (let x=0; x<Processor.diskSectorSize; ++x) {
                    const d = data[x] & Register.notParityMask;

                    evenAddr = 1-evenAddr;
                    if (evenAddr) {
                        this.regMAR.value = this.regOR2.value;
                        this.fetch();
                    }

                    this.regMIR.setDigit(evenAddr, d);
                    if (wlrc && (d & Register.bcdMask) == Envir.numGroupMark) {
                        terminate = true;
                        this.setIndicator(37, `Disk readTrack WLRC group mark at ${x}`);
                    }

                    if (!evenAddr || terminate) {
                        this.store();
                        this.envir.tick();
                        this.regOR2.incr(2);
                        if (terminate) {
                            break;      // out of for loop
                        }
                    }
                } // for x

                this.gateRESP_GATE.value = 0;
            }

            this.ioDevice.sectorAddr = this.regOR1.value;       // tell device what address should be
            if (wlrc && !terminate) {
                if (!evenAddr) {        // if even address, digit is already in MBR
                    this.regMAR.value = this.regOR2.value;
                    this.fetch();
                }
                if ((this.regMBR.getDigit(evenAddr) & Register.bcdMask) == Envir.numGroupMark) {
                    terminate = true;
                    this.setIndicator(37, "Disk readTrack early end-of-sector group mark in memory");
                }
            }

            return terminate;
        }; // storeTrack

        this.regPR2.decr(1);            // decrement count for initial sector
        await this.ioDevice.readTrack(storeTrack);
        if (wlrc) {
            this.regMAR.value = this.regOR2.value;
            this.fetch();
            if ((this.regMBR.even & Register.bcdMask) != Envir.numGroupMark) {
                this.setIndicator(37, "Disk WLRC no memory group mark after end of read");
            }
        }

        this.ioExit();                  // exits Limbo state; will reset INSERT if it's set
        if (!this.gateMANUAL.value) {
            this.run();
        }
    }

    /**************************************/
    async checkDiskTrack(wlrc) {
        /* Reads one track of disk sectors from the currently selected disk
        module at the address specified by OR1 and compares the sector data to
        the memory address specified by OR2.
            wlrc: detect group marks and wrong-length records.
        Runs in Limbo, so restarts this.run() on completion */
        let evenAddr = 0;               // even/odd half of memory digit pair

        const compareTrack = (finished, error, data) => {
            /* Callback function to receive disk sector data and compare it with
            core memory:
                finished: disk module has no more sectors to send (usually sector overflow)
                error: disk module detected a fatal error during read
                data: Uint8Array buffer holding the disk sector digits
            Returns false to indicate the disk module should continue reading
            sectors; returns true on error */
            let terminate = false;

            if (finished) {
                terminate = true;
            } else if (error) {
                terminate = true;
            } else {
                this.gateRESP_GATE.value = 1;
                for (let x=0; x<Processor.diskSectorSize; ++x) {
                    const d = data[x] & Register.notParityMask;

                    evenAddr = 1-evenAddr;
                    if (evenAddr) {
                        this.regMAR.value = this.regOR2.value;
                        this.fetch();
                    }

                    const m = this.regMBR.getDigit(evenAddr) & Register.notParityMask;
                    if (wlrc && ((d & Register.bcdMask) == Envir.numGroupMark ||
                                 (m & Register.bcdMask) == Envir.numGroupMark)) {
                        terminate = true;
                        this.setIndicator(37, `Disk checkTrack WLRC compare group mark at ${x}`);
                    } else if (d != m) {
                        terminate = true;
                        this.setIndicator(37, `Disk check compare mismatch at ${x}`);
                    }

                    if (!evenAddr) {
                        this.envir.tick();
                        this.regOR2.incr(2);
                    }

                    if (terminate) {
                        break;          // out of for loop
                    }
                } // for x

                this.gateRESP_GATE.value = 0;
            }

            this.regOR1.incr(1);                                // increment sector address
            this.ioDevice.sectorAddr = this.regOR1.value;       // tell device what address should be
            if (wlrc && !terminate) {
                if (!evenAddr) {        // if even address, digit is already in MBR
                    this.regMAR.value = this.regOR2.value;
                    this.fetch();
                }
                if ((this.regMBR.getDigit(evenAddr) & Register.bcdMask) == Envir.numGroupMark) {
                    terminate = true;
                    this.setIndicator(37, "Disk compare track early end-of-sector group mark in memory");
                }
            }

            return terminate;
        }; // compareTrack

        await this.ioDevice.readTrack(compareTrack);
        if (wlrc) {
            this.regMAR.value = this.regOR2.value;
            this.fetch();
            if ((this.regMBR.even & Register.bcdMask) != Envir.numGroupMark) {
                this.setIndicator(37, "Disk WLRC no memory group mark after end of read");
            }
        }

        this.ioExit();                  // exits Limbo state; will reset INSERT if it's set
        if (!this.gateMANUAL.value) {
            this.run();
        }
    }

    /**************************************/
    initiateDiskRead() {
        /* Initiates a read operation to the disk drive. The individual read
        functions are defined as async, but we don't await them as we are in
        Limbo state -- they will run asynchronously and restart the processor
        on completion */

        if (this.loadDiskControl()) {
            // Check Stop occurred during load of registers
        } else if (this.regOR2.isOdd) {
            this.checkStop(`Disk read buffer at odd address ${this.regOR2.binaryValue}`);
        } else if (!this.ioDevice.selectModule(this.ioDiskDriveCode, this.regOR1.value)) {
            this.gateWRITE_INTERLOCK.value = 1; // just hang on invalid disk module
        } else {
            this.gateREAD_INTERLOCK.value = 1;
            this.gateSCTR_CYC.value = 0;
            switch (this.ioVariant) {
            case 0:     // read disk sectors WLRC
                this.readDiskSectors(false, true);
                break;
            case 1:     // check disk sectors WLRC
                this.readDiskSectors(true, true);
                break;
            case 2:     // read disk sectors No WLRC
                this.readDiskSectors(false, false);
                break;
            case 3:     // check disk sectors No WLRC
                this.readDiskSectors(true, false);
                break;
            case 4:     // read disk track WLRC
                this.readDiskTrack(true);
                break;
            case 5:     // check disk track WLRC
                this.checkDiskTrack(true);
                break;
            case 6:     // read disk track No WLRC
                this.readDiskTrack(false);
                break;
            case 7:     // check disk track No WLRC
                this.checkDiskTrack(false);
                break;
            default:
                // undefined operation -- just hang in Limbo
                break;
            }
        }
    }

    /**************************************/
    async writeDiskSectors(wlrc) {
        /* Writes one or more disk sectors to the currently selected disk module
        at the address specified by OR1 for the number of sectors specified by
        PR2 from the memory address specified by OR2.
            wlrc: detect group marks and wrong-length records.
        Runs in Limbo, so restarts this.run() on completion */

        const loadSector = (finished, error, data) => {
            /* Callback function to send disk sector data from memory:
                finished: disk module has no more sectors to send (usually sector overflow)
                error: disk module detected a fatal error during write
                data: Uint8Array buffer holding the disk sector digits
            Returns false to indicate the disk module should continue writing
            sectors; returns true on error or after the sector count has been
            exhausted */
            let terminate = false;

            if (finished) {
                terminate = true;
            } else if (error) {
                terminate = true;
            } else {
                this.gateCHAR_GATE.value = 1;
                this.gateRESP_GATE.value = 0;
                for (let x=Processor.diskAddressSize; x<Processor.diskSectorSize; x+=2) {
                    this.regMAR.value = this.regOR2.value;
                    this.fetch();
                    const m1 = this.regMBR.even & Register.notParityMask;
                    const m2 = this.regMBR.odd & Register.notParityMask;
                    data[x] = m1;
                    data[x+1] = m2;
                    if (wlrc) {
                        if ((m1 & Register.bcdMask) == Envir.numGroupMark) {
                            terminate = true;
                            this.setIndicator(37, `Disk write WLRC group mark at ${x}`);
                        } else if ((m2 & Register.bcdMask) == Envir.numGroupMark) {
                            terminate = true;
                            this.setIndicator(37, `Disk write WLRC group mark at ${x+1}`);
                        }
                    }

                    this.envir.tick();
                    this.regOR2.incr(2);
                } // for x

                this.gateCHAR_GATE.value = 0;
                this.gateRESP_GATE.value = 1;
            }

            this.regOR1.incr(1);                                // increment sector address
            this.ioDevice.sectorAddr = this.regOR1.value;       // tell device what address should be
            if (this.regPR2.isZero) {
                terminate = true;
            } else {
                this.regPR2.decr(1);    // decrement count for next sector
                if (wlrc && !terminate) {
                    this.regMAR.value = this.regOR2.value;
                    this.fetch();
                    if ((this.regMBR.even & Register.bcdMask) == Envir.numGroupMark) {
                        terminate = true;
                        this.setIndicator(37, "Disk write early end-of-sector group mark in memory");
                    }
                }
            }

            return terminate;
        }; // loadSector

        this.regPR2.decr(1);            // decrement count for initial sector
        await this.ioDevice.writeSectors(loadSector);
        if (wlrc && this.regPR2.isZero) {
            this.regMAR.value = this.regOR2.value;
            this.fetch();
            if ((this.regMBR.even & Register.bcdMask) != Envir.numGroupMark) {
                this.setIndicator(37, "Disk write WLRC no memory group mark after end of write");
            }
        }

        this.ioExit();                  // exits Limbo state; will reset INSERT if it's set
        if (!this.gateMANUAL.value) {
            this.run();
        }
    }

    /**************************************/
    async writeDiskTrack(wlrc) {
        /* Writes one track of disk sectors to the currently selected disk module
        at the address specified by OR1 to the memory address specified by OR2.
            wlrc: detect group marks and wrong-length records.
        Runs in Limbo, so restarts this.run() on completion */
        let evenAddr = 0;               // even/odd half of memory digit pair

        const loadTrack = (finished, error, data) => {
            /* Callback function to receive disk sector data into memory:
                finished: disk module has no more sectors to send (usually sector overflow)
                error: disk module detected a fatal error during write
                data: Uint8Array buffer holding the disk sector digits
            Returns false to indicate the disk module should continue writing
            sectors; returns true on error */
            let terminate = false;

            if (finished) {
                terminate = true;
            } else if (error) {
                terminate = true;
            } else {
                this.gateCHAR_GATE.value = 1;
                this.gateRESP_GATE.value = 0;
                for (let x=0; x<Processor.diskSectorSize; ++x) {
                    evenAddr = 1-evenAddr;
                    if (evenAddr) {
                        this.regMAR.value = this.regOR2.value;
                        this.fetch();
                    }

                    const d = this.regMBR.getDigit(evenAddr);
                    data[x] = d;
                    if (wlrc) {
                        if ((d & Register.bcdMask) == Envir.numGroupMark) {
                            terminate = true;
                            this.setIndicator(37, `Disk writeTrack WLRC group mark at ${x}`);
                        }
                    }

                    if (!evenAddr) {
                        this.envir.tick();
                        this.regOR2.incr(2);
                    }
                } // for x

                this.gateCHAR_GATE.value = 0;
                this.gateRESP_GATE.value = 1;
            }

            this.regOR1.incr(1);                                // increment sector address
            this.ioDevice.sectorAddr = this.regOR1.value;       // tell device what address should be
            if (wlrc && !terminate) {
                if (!evenAddr) {        // if even address, digit is already in MBR
                    this.regMAR.value = this.regOR2.value;
                    this.fetch();
                }
                if ((this.regMBR.getDigit(evenAddr) & Register.bcdMask) == Envir.numGroupMark) {
                    terminate = true;
                    this.setIndicator(37, "Disk writeTrack early end-of-sector group mark in memory");
                }
            }

            return terminate;
        }; // loadTrack

        await this.ioDevice.writeTrack(loadTrack);
        if (wlrc) {
            this.regMAR.value = this.regOR2.value;
            this.fetch();
            if ((this.regMBR.even & Register.bcdMask) != Envir.numGroupMark) {
                this.setIndicator(37, "Disk writeTrack WLRC no memory group mark after end of write");
            }
        }

        this.ioExit();                  // exits Limbo state; will reset INSERT if it's set
        if (!this.gateMANUAL.value) {
            this.run();
        }
    }

    /**************************************/
    initiateDiskWrite() {
        /* Initiates a write operation to the disk drive. The individual write
        functions are defined as async, but we don't await them as, unlike other
        write operations, we are in Limbo state -- they will run asynchronously
        and restart the processor on completion */

        if (this.loadDiskControl()) {
            // Check Stop occurred during load of registers
        } else if (this.regOR2.isOdd) {
            this.checkStop(`Disk write buffer at odd address ${this.regOR2.binaryValue}`);
        } else if (!this.ioDevice.selectModule(this.ioDiskDriveCode, this.regOR1.value)) {
            this.gateWRITE_INTERLOCK.value = 1; // just hang on invalid disk module
        } else {
            this.gateWRITE_INTERLOCK.value = 1;
            this.gateSCTR_CYC.value = 0;
            switch (this.ioVariant) {
            case 0:     // write disk sectors WLRC
                if (this.ioDevice.writeAddress) {
                    return;             // just hang in Limbo
                } else {
                    this.writeDiskSectors(true);
                }
                break;
            case 2:     // write disk sectors No WLRC
                if (this.ioDevice.writeAddress) {
                    return;             // just hang in Limbo
                } else {
                    this.writeDiskSectors(false);
                }
                break;
            case 4:     // write disk track WLRC
                if (this.ioDevice.writeAddress) {
                    this.writeDiskTrack(true);
                } else {
                    return;             // just hang in Limbo
                }
                break;
            case 6:     // write disk track No WLRC
                if (this.ioDevice.writeAddress) {
                    this.writeDiskTrack(false);
                } else {
                    return;             // just hang in Limbo
                }
                break;
            default:
                // undefined operation -- just hang in Limbo
                break;
            }
        }
    }

    /**************************************/
    ioExit() {
        /* Releases and terminates an I/O operation, resetting state */

        if (this.gateRD.value || this.gateWR.value) {
            this.envir.startTiming();           // restart the emulation clock and timeslice
            if (this.ioReadCheckPending) {
                this.ioReadCheckPending = false;
                this.setIndicator(6, `I/O device ${this.ioSelectNr} Read Check`);
            } else if (this.ioWriteCheckPending) {
                this.ioWriteCheckPending = false;
                this.setIndicator(7, `I/O device ${this.ioSelectNr} Write Check`);
            }

            if (this.ioMBRCheckPending) {
                this.ioMBRCheckPending = false;
                this.setIndicator(16, `I/O device ${this.ioSelectNr} Even address on alphanumeric I/O`);
            }

            this.gateREL.value = 1;
            this.gateIO_FLAG.value = 0;         // not sure about this...
            this.gateRD.value = 0;
            this.gateWR.value = 0;
            this.gateCHAR_GATE.value = 0;
            this.gateRESP_GATE.value = 0;       // not sure about this, either...
            this.ioDevice?.release();
            this.ioDevice = null;
            this.ioSelectNr = 0;
            this.ioVariant = 0;
            this.gateTWPR_SELECT.value = 0;
            this.gateREAD_INTERLOCK.value = 0;
            this.gateWRITE_INTERLOCK.value = 0;
            this.gateINSERT.value = 0;
            this.enterICycle();
        }
    }


    /*******************************************************************
    *  Instruction Cycle                                               *
    *******************************************************************/

    /**************************************/
    testIndicator() {
        /* Tests the indicator specified by DR. Resets those indicators that
        get reset when tested. Returns the original status of the indicator */
        let isSet = 0;

        switch (this.regDR.binaryValue) {
        case  1:        // Program Switch 1
            isSet = this.program1Switch;
            break;
        case  2:        // Program Switch 2
            isSet = this.program2Switch;
            break;
        case  3:        // Program Switch 3
            isSet = this.program3Switch;
            break;
        case  4:        // Program Switch 4
            isSet = this.program4Switch;
            break;
        case  6:        // Read Check
            isSet = this.ioReadCheck.value;
            this.ioReadCheck.value = 0;
            break;
        case  7:        // Write Check
            isSet = this.ioWriteCheck.value;
            this.ioWriteCheck.value = 0;
            break;
        case  9:        // Last card (1622 read)
            isSet = this.gateLAST_CARD.value;
            this.gateLAST_CARD.value = 0;
            break;
        case 11:        // High-Positive (H/P)
            isSet = this.gateHP.value;
            break;
        case 12:        // Equal-Zero (E/Z)
            isSet = this.gateEZ.value;
            break;
        case 13:        // H/P or E/Z
            isSet = (this.gateHP.value | this.gateEZ.value) & 1;
            break;
        case 14:        // Arithmetic Check
            isSet = this.oflowArithCheck.value;
            this.oflowArithCheck.value = 0;
            break;
        case 15:        // Exponent Check
            isSet = this.oflowExpCheck.value
            this.oflowExpCheck.value = 0;
            break;
        case 16:        // MBR-even Check
            isSet = this.parityMBREvenCheck.value;
            this.parityMBREvenCheck.value = 0;
            break;
        case 17:        // MBR-odd Check
            isSet = this.parityMBROddCheck.value;
            this.parityMBROddCheck.value = 0;
            break;
        case 19:        // Any Check (6, 7, 16, 17, 25, 39)
            isSet = (this.ioReadCheck.value | this.ioWriteCheck.value |
                    this.parityMBREvenCheck.value | this.parityMBROddCheck.value |
                    this.ioPrinterCheck.value | this.diskAddrCheck.value |
                    this.diskWLRRBCCheck.value | this.diskCylOflowCheck.value) & 1;
            break;
        case 30:        // IX Band 0 (indexing off)
            isSet = ((this.gateIX_BAND_1.value | this.gateIX_BAND_2.value) & 1 ? 0 : 1);
            break;
        case 31:        // IX Band 1
            isSet = this.gateIX_BAND_1.value;
            break;
        case 32:        // IX Band 2
            isSet = this.gateIX_BAND_2.value;
            break;
        case 36:        // 1311 Address Check
            isSet = this.diskAddrCheck.value;
            this.diskAddrCheck.value = 0;
            break;
        case 37:        // 1311 Wrong-length Record / Read-back Check
            isSet = this.diskWLRRBCCheck.value;
            this.diskWLRRBCCheck.value = 0;
            break;
        case 38:        // 1311 Cylinder Overflow
            isSet = this.diskCylOflowCheck.value;
            this.diskCylOflowCheck.value = 0;
            break;
        case 39:        // 1311 Any Disk Error (36, 37, 38)
            isSet = (this.diskAddrCheck.value | this.diskWLRRBCCheck.value | this.diskCylOflowCheck.value) & 1;
            break;
        case 25:        // 1443 Printer Check
            isSet = this.ioPrinterCheck.value;
            this.ioPrinterCheck.value = 0;      // but not if it's a sync check
            if (!this.devices.linePrinter?.printCheck) {
                this.devices.linePrinter?.setPrintCheck(false);
            }
            break;
        case 33:        // 1443 Channel 9
            isSet = this.ioPrinterChannel9.value;
            this.ioPrinterChannel9.value = 0;   // also reset by printer sensing channel 1
            break;
        case 34:        // 1443 Channel 12
            isSet = this.ioPrinterChannel12.value;
            this.ioPrinterChannel12.value = 0;  // also reset by printer sensing channel 1
            break;
        case 35:        // 1443 Printer Busy
            isSet = this.ioPrinterBusy.value;
            break;
        }

        this.verifyCheckStop();
        return isSet;
    }

    /**************************************/
    enterICycle() {
        /* Initiates the start of the next instruction I-cycles */

        this.gateI_CYC_ENT.value = 1;
        if (this.gateEZ.value) {
            this.gateHP.value = 0;
        }

        if (this.gateEXP_OFLO.value || this.gateEXP_UFLO.value) {
            this.setIndicator(15, `Exponent overflow/underflow: op=${this.opBinary}, IR1=$this.opAddress.toString().padStart(5, "0")}`);
        }

        // Trace the instruction just completed.
        if (this.tracing && this.opBinary >= 0 && this.opThisAtts) {
            // opThisAtts is null after a LOAD/INSERT synthesizes the initial
            // RN directly (bypassing normal decode), so guard against that
            // as well as tracing nothing after a START.
            this.tracePData = this.tracePOperand();
            this.traceInstruction();
            this.opBinary = -1;
        }

        this.resetICycle();
        this.exitAutomatic();
        this.gateRUN.value = 0;
        if (!(this.gateSAVE.value || this.gateDISPLAY_MAR.value ||
                this.gateINSERT.value || this.gateCLR_MEM.value)) {
            this.gateDISK_OP.value = 0;         // ILD 10.00.30.1
            this.setProcState(procStateI1);
        }

        if (this.gateSTOP.value) {
            this.gateSTOP.value = 0;
            this.enterManual();
        }
    }

    /**************************************/
    resetICycle() {
        /* Resets processor state at the beginning of an I-Cycle,  */

        this.gate1ST_CYC.value = 0;
        this.gate1ST_CYC_DELAYD.value = 0;
        this.gate1ST_MPLY_CYCLE.value = 0;
        this.gate2_DIG_CNTRL.value = 0;
        this.gateADD_ENT.value = 0;
        this.gateADD_MODE.value = 0;
        this.gateCARRY_IN.value = 0;
        this.gateCARRY_OUT.value = 0;
        this.gateCOMP.value = 0;
        this.gateDIV_1_CYC.value = 0;
        this.gateDVD_L_CYC.value = 0;
        this.gateDVD_SIGN.value = 0;
        this.gateEXMIT_ENT.value = 0;
        this.gateEXMIT_MODE.value = 0;
        this.gateFIELD_MK_1.value = 0;
        this.gateFIELD_MK_2.value = 0;
        this.gateIX.value = 0;
        this.gateIX_EXEC.value = 0;
        this.gateLAST_LD_CYC.value = 0;
        this.gateMC_1.value = 0;
        this.gateMC_2.value = 0;
        this.gateP_COMP.value = 0;
        this.gateRECOMP.value = 0;
        this.gateRM.value = 0;
        this.gateX_SIG_DIGIT.value = 0;
        this.resetDREven();
        this.resetDROdd();

        // Floating-point gates
        if (this.fpInstalled) {
            this.gateCOUNTER_COMP.value = 0;
            this.gateDIGIT_FORCE_ENTRY.value = 0;
            this.gateDIG_FORCE_MODE.value = 0;
            this.gateD_GTR_99.value = 0;
            this.gateEXP_ADD.value = 0;
            this.gateEXP_MODIFY.value = 0;
            this.gateEXP_MOD_ENTRY.value = 0;
            this.gateEXP_MOD_REQ.value = 0;
            this.gateEXP_OFLO.value = 0;
            this.gateEXP_OFLO_CORR.value = 0;
            this.gateEXP_UFLO.value = 0;
            this.gateEXP_XMIT.value = 0;
            this.gateEXTRA_SFT_CYC.value = 0;
            this.gateFALSE_XMIT.value = 0;
            this.gateFALSE_XMIT_ENTRY.value = 0;
            this.gateFDIV.value = 0;
            this.gateFDIV_ENTRY.value = 0;
            this.gateFMUL_ENTRY.value = 0;
            this.gateFMUL_MODE.value = 0;
            this.gateFORCE_CF1.value = 0;
            this.gateFP_HI_PLUS.value = 0;
            this.gateFRAC_ADD_ENTRY.value = 0;
            this.gateFRAC_ADD_MODE.value = 0
            this.gateFRAC_COMPARE_MODE.value = 0;
            this.gateFRAC_COMPR_ENTRY.value = 0;
            this.gateHI_ORDER_ZERO.value = 0;
            this.gateLD.value = 0;
            this.gateLD_ENTRY.value = 0;
            this.gateNORM_SHIFT_RT.value = 0;
            this.gateQ_EXIT.value = 0;
            this.gateRESULT_XMIT.value = 0;
            this.gateSCAN_ENTRY.value = 0;
            this.gateSCAN_MINUS.value = 0;
            this.gateSCAN_MODE.value = 0;
            this.gateSCAN_Q.value = 0;
            this.gateSHIFT_ENTRY.value = 0;
            this.gateSHIFT_MODE.value = 0;
            this.gateSIG_DIGIT.value = 0;
        }

        // Registers
        this.regMQ.clear();
        this.gateE_1.value = 0;
        this.gateE_2.value = 0;
        this.gateE_3.value = 0;
        this.gateE_4.value = 0;
        this.gateE_5.value = 0;
        this.gateIA_3.value = 0;
        this.gateI_2.value = 0;
        this.gateI_3.value = 0;
        this.gateI_4.value = 0;
        this.gateI_5.value = 0;

        this.gateEND_OF_MODULE.value = 0;
        this.gateREL.value = 0;
    }

    /**************************************/
    stepICycle1() {
        /* Executes I-Cycle 1. If the last instruction effected a branch, loads
        the next instruction using OR2 instead of IR1. Clears registers, sets
        P gate to process the P address, and loads the op code digits. As an
        optimization, converts the op code digits to binary and stores in
        this.opBinary for later use. If the op code is zero, initiates a stop.
        Steps to I-Cycle 2 */

        ++this.instructionCount;
        this.gateI_CYC_ENT.value = 0;
        this.enterAutomatic();
        if (this.gateBR_EXEC.value) {
            this.regIR1.value = this.regOR2.value;
            this.gateBR_EXEC.value = 0;
        }

        this.opAddress = this.regIR1.binaryValue;       // for tracing
        this.regMAR.value = this.regIR1.value;
        this.fetch();
        if (this.regMAR.value & 1) {
            this.marCheck(`I-1: instruction at odd MAR address ${this.regMAR.toBCDString()}`);
        }

        this.regOP.value = this.regMBR.value;
        this.gateP.value = 1;                   // now working on the P address
        this.regOR1.clear();
        this.regOR2.clear();
        this.regOR3.clear();
        this.regPR2.clear();
        this.regXBR.clear();
        this.regXR.clear();

        this.regIR1.incr(2);
        this.opBinary = this.regOP.binaryValue;
        if (this.regOP.invalidBCD) {
            console.log(`I-1: invalid opcode BCD ${this.regOP.toBCDString()} @${this.regMAR.toBCDString()}`);
            if (this.opAtts[this.opBinary] && this.opAtts[this.opBinary].opValid) {
                this.opBinary = 99;     // to be sure it's not been 8/9 coerced to a valid opcode
            }
        } else if (this.opBinary == 0) {
            // If the op code is 0, go immediately into MANUAL to halt at the
            // end of this cycle (see ILD 10.01.41.1). The state will advance to
            // I-2. If START is then pressed, this will cause a MAR check stop
            // in E-Cycle entry due to the invalid op code. Not sure the 1620-2
            // actually worked this way, but the result is what's expected.
            console.log(`I-1: invalid opcode 00 (special stop) @${this.regMAR.toBCDString()}`);
            this.exitAutomatic();
            this.enterManual();
        }

        this.opThisAtts = this.opAtts[this.opBinary];
        this.setProcState(procStateI2);
        if (this.tracing) {
            this.traceLine = `${this.opAddress.toString().padStart(5, "0")} ` +
                    `${this.traceGetData(this.opAddress, 2)} ${this.traceGetData(this.opAddress+2, 5)} ${this.traceGetData(this.opAddress+7, 5)}: ` +
                    `${this.opThisAtts.mnem} ${this.regOP.toBCDString()}`;
        }
    }

    /**************************************/
    stepICycle2() {
        /* Executes I-Cycle 2. If the op code is 42 (BB), sets IR1 based on the
        SAVE gate and terminates the instruction to effect the branch. Otherwise,
        loads the P2/P3 digits to the MARS registers. Sets the 4-bit in XR from
        the P3 flag as necessary. Steps to I-Cycle 3 */

        this.opIndexable = this.opThisAtts.pIX &&
                (this.gateIX_BAND_1.value || this.gateIX_BAND_2.value);

        switch (this.opBinary) {
        case 42:                                // 42=BB, Branch Back
            // ?? MAR Check Stop if no prior BT instruction or SAVE control ?? Mod2 Ref p.38 vs Germain p.97
            if (this.gateSAVE.value) {
                this.gateSAVE.value = 0;
                this.regIR1.value = this.regMAR.value = this.regPR1.value;
            } else {
                this.regIR1.value = this.regMAR.value = this.regIR2.value;      // per Germain, p.97
            }
            this.enterICycle();
            break;

        default:                                // everything else
            this.regMAR.value = this.regIR1.value;
            this.fetch();
            let mbrEven = this.regMBR.even;
            let mbrOdd = this.regMBR.odd;

            this.regOR2.setDigit(4, mbrEven);
            this.regOR2.setDigit(3, mbrOdd);
            this.regOR3.setDigit(4, mbrEven);
            this.regOR3.setDigit(3, mbrOdd);
            this.regXBR.setDigit(4, mbrEven);
            this.regXBR.setDigit(3, mbrOdd);
            if (this.opIndexable && (mbrOdd & Register.flagMask)) {
                this.regXR.incr(4);
            }

            this.regIR1.incr(2);
            this.setProcState(procStateI3);
            break;
        }
    }

    /**************************************/
    stepICycle3() {
        /* Executes I-Cycle 3. Loads the P4, P5 digits to the MARS registers. Sets
        the 2- and 1-bits in XR from P4, P5 flags as necessary.
        Steps to I-Cycle 4 */

        this.regMAR.value = this.regIR1.value;
        this.fetch();
        let mbrEven = this.regMBR.even;
        let mbrOdd = this.regMBR.odd;

        this.regOR2.setDigit(2, mbrEven);
        this.regOR2.setDigit(1, mbrOdd);
        this.regOR3.setDigit(2, mbrEven);
        this.regOR3.setDigit(1, mbrOdd);
        this.regXBR.setDigit(2, mbrEven);
        this.regXBR.setDigit(1, mbrOdd);
        if (this.opIndexable) {
            if (mbrEven & Register.flagMask) {
                this.regXR.incr(2);
            }
            if (mbrOdd & Register.flagMask) {
                this.regXR.incr(1);
            }
        }

        this.regIR1.incr(2);
        this.setProcState(procStateI4);
    }

    /**************************************/
    stepICycle4() {
        /* Executes I-Cycle 4. Loads the P6 digit to the MARS registers. Stashes
        the Q7 digit in DR-even until the next cycle and clears DR-odd. Sets the
        IA latch from the P6 4-bit as necessary. Starts the chain of indexing
        and indirect address evaluation if needed. Note that if the op code is
        49 (B), BR_EXEC will be set and the instruction will terminate after any
        indexing or indirect address chaining takes place. Otherwise, will step
        to I-Cycle 5 (see exitAddressing) */

        this.regMAR.value = this.regIR1.value;
        this.fetch();
        let mbrEven = this.regMBR.even;

        this.regOR2.setDigit(0, mbrEven);
        this.regOR3.setDigit(0, mbrEven);
        this.regXBR.setDigit(0, mbrEven);
        this.resetDREven();
        this.setDREven(this.regMBR.odd);
        this.resetDROdd();
        this.setDROdd(0);
        this.regPR1.clear();
        if ((mbrEven & Register.flagMask) &&
                this.opThisAtts.pIA && this.gateIA_SEL.value) {
            this.gateIA_REQ.value = 1;          // set the IA latch
        }

        if (this.tracing) {
            this.tracePLabel = "P";
        }

        this.regIR1.incr(2);
        if (this.regXR.isntZero) {
            this.enterIndexing();
        } else if (this.gateIA_REQ.value) {
            this.enterIndirecting();
        } else {
            this.exitAddressing();
        }
    }

    /**************************************/
    stepICycle5() {
        /* Executes I-Cycle 5. Resets the P gate to process the Q address and
        clears registers. Sets the 4- and 2-bits in XR from Q8, Q9 flags as
        necessary. For immediate ops and 60 (BS), does nothing else.
        For I/O, BI, BNI, BBT, BMK ops, only loads DR from Q8, Q9.
        For all other ops:
           - Shifts DR-even (with the stashed Q7 digit) to DR-odd and sets Q7
             in the MARS registers from that digit.
           - Loads the Q8, Q9 digits to the MARS registers */

        this.regMAR.value = this.regIR1.value;
        this.fetch();
        let mbrEven = this.regMBR.even;
        let mbrOdd = this.regMBR.odd;

        this.gateP.value = 0;                   // now working on the Q address
        this.gateIX.value = 0;
        this.regOR1.clear();
        this.regXBR.clear();                    // ??
        this.regXR.clear();
        this.regMQ.clear();
        this.opIndexable = (this.opThisAtts.qIX || this.opThisAtts.index) &&
                (this.gateIX_BAND_1.value || this.gateIX_BAND_2.value);

        switch (this.opBinary) {
        case 34:        // K, Control I/O device
        case 35:        // DN, Dump Numerically
        case 36:        // RN, Read Numerically
        case 37:        // RA, Read Alphanumerically
        case 38:        // WN, Write Numerically
        case 39:        // WA, Write Alphanumerically
        case 46:        // BI, Branch Indicator
        case 47:        // BNI, Branch No Indicator
            // Set up DR for S/B decode, don't load OR1 for S/B ops.
            this.setDREven(mbrEven);
            this.setDROdd(mbrOdd);
            break;

        case 60:        // BS, Branch and Select
            break;                              // do nothing in I-5

        case 90:        // BBT, Branch on Bit
        case 91:        // BMK, Branch on Mask
            this.regOR1.setDigit(3, mbrEven);
            this.regOR1.setDigit(2, mbrOdd);
            this.regXBR.setDigit(3, mbrEven);
            this.regXBR.setDigit(2, mbrOdd);
            break;

        default:
            if (!this.opThisAtts.immed) {       // don't load OR1 for immediate ops in I-5
                let drOdd = this.shiftDREvenOdd();
                this.regOR1.setDigit(4, drOdd);
                this.regOR1.setDigit(3, mbrEven);
                this.regOR1.setDigit(2, mbrOdd);
                this.regXBR.setDigit(4, drOdd);
                this.regXBR.setDigit(3, mbrEven);
                this.regXBR.setDigit(2, mbrOdd);
            }
            break;
        }

        if (this.opIndexable) {
            if (mbrEven & Register.flagMask) {
                this.regXR.incr(4);
            }
            if (mbrOdd & Register.flagMask) {
                this.regXR.incr(2);
            }
        }

        this.regIR1.incr(2);
        this.setProcState(procStateI6);
    }

    /**************************************/
    stepICycle6() {
        /* Executes I-Cycle 6.
        Sets the 1-bit in XR from the Q10 flag and the IA latch from the Q11
        flag as necessary. Takes the following special actions:
          - For immediate ops, sets OR1 to the address of the Q11 digit.
          - For op 41 (NOP), terminates the instruction.
          - For op 48 (H), terminates the instruction and initiates a stop.
          - For ops 46 (BI) & 47 (BNI), evaluates the selected indicator and
            terminates the instruction, initiating a branch if necessary.
          - For op 60 (BS), terminates the instruction, initiates a branch, and
            sets the indexing or indirect addressing modes as necessary.
          - For ops 7 (BTFL), 17 (BTM), 27 (BT), clears IR2.
          - For all other ops, sets Q10, Q11 in the MARS registers.
        If the instruction has not been terminated, starts the chain of indexing
        and indirect address evaluation if needed. At the end of that chain will
        enter the E-Cycles to execute the instruction (see exitAddressing) */

        this.regMAR.value = this.regIR1.value;
        this.fetch();
        let mbrEven = this.regMBR.even;
        let mbrOdd = this.regMBR.odd;

        switch (this.opBinary) {
        case 34:        // K, Control I/O device [handled in exitAddressing()]
            this.gateWR.value = 1;
            this.ioSelect(this.regDR.binaryValue, this.regMBR.value);
            break;
        case 36:        // RN, Read Numerically
        case 37:        // RA, Read Alphanumerically
            this.gateRD.value = 1;
            this.ioSelect(this.regDR.binaryValue, this.regMBR.value);
            break;
        case 35:        // DN, Dump Numerically
        case 38:        // WN, Write Numerically
        case 39:        // WA, Write Alphanumerically
            this.gateWR.value = 1;
            this.ioSelect(this.regDR.binaryValue, this.regMBR.value);
            break;

        case 46:        // BI, Branch Indicator
            if (this.testIndicator()) {
                this.gateBR_EXEC.value = 1;
            }
            break;

        case 47:        // BNI, Branch No Indicator
            if (!this.testIndicator()) {
                this.gateBR_EXEC.value = 1;
            }
            break;

        case 60:        // Branch and Select - set indexing and indirect addressing modes
            switch (mbrOdd & Register.bcdMask) {
            case 0:     // turn off indexing
            case 1:     // set index Band 1
            case 2:     // set index Band 2
                if (this.xrInstalled) {
                    this.gateIX_BAND_1.value = mbrOdd & 1;
                    this.gateIX_BAND_2.value = mbrOdd & 2;
                }
                break;
            case 8:     // turn off indirect addressing
            case 9:     // turn on indirect addressing
                this.gateIA_SEL.value = mbrOdd & 1;
                break;
            }
            this.gateBR_EXEC.value = 1;
            break;

        case  7:        // BTFL, Branch and Transmit Floating
        case 10:        // BTAM, Branch and Transmit Address Immediate
        case 17:        // BTM, Branch and Transmit Immediaate
        case 20:        // BTA, Branch and Transmit Address
        case 27:        // BT, Branch and Transmit
            this.regIR2.value = this.regIR1.value;
            this.regIR2.incr(2);                // address of next instruction for return
            //--no break
        default:
            if (this.opThisAtts.immed) {        // set OR1 to Q11 addr for immediate ops
                this.regOR1.value = this.regMAR.value |= 1;
            } else {
                this.regOR1.setDigit(1, mbrEven);
                this.regOR1.setDigit(0, mbrOdd);
                this.regXBR.setDigit(1, mbrEven);
                this.regXBR.setDigit(0, mbrOdd);
            }
            break;
        }

        if (this.opIndexable && (mbrEven & Register.flagMask)) {
            this.regXR.incr(1);
        }

        if ((mbrOdd & Register.flagMask) &&
                this.opThisAtts.qIA && this.gateIA_SEL.value) {
            this.gateIA_REQ.value = 1;          // set the IA latch
        }

        if (this.tracing) {
            this.traceQLabel = "Q";
        }

        this.regIR1.incr(2);
        if (this.regXR.isntZero && !this.opThisAtts.index) {
            this.enterIndexing();
        } else if (this.gateIA_REQ.value) {
            this.enterIndirecting();
        } else {
            this.exitAddressing();
        }
    }

    /**************************************/
    enterIndexing() {
        /* Initiates the process for indexing an address register */

        this.gateIX_ENT.value = 1;
        this.gateIA_ENT.value = 0;
        this.gateIA_3.value = 0;
        this.regPR2.clear();
        this.regMQ.clear();
        if (this.gateP.value) {
            this.regOR2.clear();
            this.regOR3.clear();
            if (this.tracing) {
                if (this.tracePLabel.length < 20) {
                    this.tracePLabel = `[${this.gateIXBand1.value ? "A":"B"}${this.regXR.binaryValue}]${this.tracePLabel}`;
                } else if (!this.tracePLabel.startsWith("...")) {
                    this.tracePLabel = `...${this.tracePLabel}`;
                }
            }
        } else {
            this.regOR1.clear();
            if (this.tracing) {
                if (this.traceQLabel.length < 20) {
                    this.traceQLabel = `[${this.gateIXBand1.value ? "A":"B"}${this.regXR.binaryValue}]${this.traceQLabel}`;
                } else if (!this.traceQLabel.startsWith("...")) {
                    this.traceQLabel = `...${this.traceQLabel}`;
                }
            }
        }

        this.gateIX.value = 1;
        this.setIndexMAR();
        this.setProcState(procStateIX);
    }

    /**************************************/
    stepIndexing() {
        /* Executes the steps for indexing an address register. MQ is used as a
        digit counter. On the first call, the address of the index register
        digit is in MAR; subsequently it is in PR2. Note that the base address
        to be indexed is already in XBR from state I-4 or I-6. Also note that if
        the resulting address is negative, it is left in complement form.
        Any overflow is lost */

        if (this.gateIX_ENT.value) {
            this.gateIX_ENT.value = 0;
            this.fetch();               // first IX cycle: MAR was initially set in enterIndexing()
            this.setDROdd(this.regMBR.getDigit(this.regMAR.isEven));
            this.gateCOMP.value = this.gateCARRY_IN.value = this.gateFL_1.value; // sign flag
        } else {
            this.regMAR.value = this.regPR2.value;
            this.fetch();               // non-first IX cycle: use address in PR2
            this.setDROdd(this.regMBR.getDigit(this.regMAR.isEven));
            this.regMQ.incr(1);         // use MQ as the digit counter
        }

        // Compute the sum of the address and index register digits, propagating any carry.
        let mq = this.regMQ.binaryValue;
        let sum = this.addDigits(this.regXBR.getDigit(mq));     // leaves the sum in DR odd
        this.gateCARRY_IN.value = this.gateCARRY_OUT.value;
        this.regXBR.setDigit(mq, sum);
        if (mq < 4) {                   // if there are more digits, decrement PR2
            this.regPR2.value = this.regMAR.value;
            this.regPR2.decr(1);
        } else {                        // otherwise, set the appropriate address registers and finish
            if (this.gateP.value) {
                this.regOR2.value = this.regOR3.value = this.regMAR.value = this.regXBR.value;
            } else {
                this.regOR1.value = this.regMAR.value = this.regXBR.value;
            }

            if (this.gateIA_REQ.value) {
                this.enterIndirecting();
            } else {
                this.exitAddressing();
            }
        }
    }

    /**************************************/
    enterIndirecting() {
        /* Initiates the process for indirect addressing in a register */

        this.gateIA_ENT.value = 1;
        this.setProcState(procStateIA1);
        if (this.tracing) {
            if (this.gateP.value) {
                if (this.tracePLabel.length < 20) {
                    this.tracePLabel = `*${this.tracePLabel}`;
                } else if (!this.tracePLabel.startsWith("...")) {
                    this.tracePLabel = `...${this.tracePLabel}`;
                }
            } else {
                if (this.traceQLabel.length < 20) {
                    this.traceQLabel = `*${this.traceQLabel}`;
                } else if (!this.traceQLabel.startsWith("...")) {
                    this.traceQLabel = `...${this.traceQLabel}`;
                }
            }
        }
    }

    /**************************************/
    stepIndirecting1() {
        /* Handles the indirect addressing IA-1 state */

        this.gateIA_ENT.value = 0;      // (not sure this is correct: it resets at T603)
        this.gateIX.value = 0;
        this.regXR.clear();
        if (this.gateP.value) {         // set PR2 to step thru the indirect address
            this.regMAR.value = this.regPR2.value = this.regOR2.value;
        } else {
            this.regMAR.value = this.regPR2.value = this.regOR1.value;
        }

        this.fetch();
        let mbrEven = this.regMBR.even;
        if (this.regMAR.isOdd) {
            let mbrOdd = this.regMBR.odd;
            this.regXBR.setDigit(0, mbrOdd);
            this.regXBR.setDigit(1, mbrEven);
            this.gateIA_REQ.value = mbrOdd & Register.flagMask;
            if (this.opIndexable && (mbrEven & Register.flagMask)) {
                this.regXR.incr(1);
            }
        } else {
            this.regXBR.setDigit(0, mbrEven);
            this.gateIA_REQ.value = mbrEven & Register.flagMask;
        }

        if (this.gateP.value) {
            this.regOR2.value = this.regOR3.value = this.regXBR.value;
        } else {
            this.regOR1.value = this.regXBR.value;
        }

        this.regPR2.decr(2);
        this.setProcState(procStateIA2);
    }

    /**************************************/
    stepIndirecting2() {
        /* Handles the indirect addressing IA-2 state */

        this.regMAR.value = this.regPR2.value;
        this.fetch();
        let mbrEven = this.regMBR.even;
        let mbrOdd = this.regMBR.odd;
        if (this.regMAR.isOdd) {
            this.regXBR.setDigit(2, mbrOdd);
            this.regXBR.setDigit(3, mbrEven);
            if (this.opIndexable) {
                if (mbrOdd & Register.flagMask) {
                    this.regXR.incr(2);
                }
                if (mbrEven & Register.flagMask) {
                    this.regXR.incr(4);
                }
            }
        } else {
            this.regXBR.setDigit(1, mbrOdd);
            this.regXBR.setDigit(2, mbrEven);
            if (this.opIndexable) {
                if (mbrOdd & Register.flagMask) {
                    this.regXR.incr(1);
                }
                if (mbrEven & Register.flagMask) {
                    this.regXR.incr(2);
                }
            }
        }

        if (this.gateP.value) {
            this.regOR2.value = this.regOR3.value = this.regXBR.value;
        } else {
            this.regOR1.value = this.regXBR.value;
        }

        this.regPR2.decr(2);
        this.setProcState(procStateIA3);
    }

    /**************************************/
    stepIndirecting3() {
        /* Handles the indirect addressing IA-3 state */

        this.regMAR.value = this.regPR2.value;
        this.fetch();
        let mbrOdd = this.regMBR.odd;
        if (this.regMAR.isOdd) {
            this.regXBR.setDigit(4, mbrOdd);
        } else {
            let mbrEven = this.regMBR.even;
            this.regXBR.setDigit(3, mbrOdd);
            this.regXBR.setDigit(4, mbrEven);
            if (this.opIndexable && (mbrOdd & Register.flagMask)) {
                this.regXR.incr(4);
            }
        }

        if (this.gateP.value) {
            this.regOR2.value = this.regOR3.value = this.regMAR.value = this.regXBR.value;
        } else {
            this.regOR1.value = this.regMAR.value = this.regXBR.value;
        }

        if (this.regXR.isntZero && (this.gateP.value || !this.opThisAtts.index)) {
            this.enterIndexing();
        } else if (this.gateIA_REQ.value) {
            this.enterIndirecting();
        } else {
            this.exitAddressing();
        }
    }

    /**************************************/
    exitAddressing() {
        /* Handles the details of state advancement and the end of setting up
        the P or Q addresses */

        if (this.gateP.value) {         // finish with P address
            if (this.tracing) {
                this.traceLine += ` ${this.regOR2.toBCDString()}`;
                this.tracePAddr.value = this.regOR2.value;      // P data is formatted in enterICycle()
            }

            if (this.opBinary == 49) {  // 49 = Branch (B) early exit
                this.gateBR_EXEC.value = 1;
                this.enterICycle();
            } else {
                this.setProcState(procStateI5);
            }
        } else {                        // finish with Q address
            if (this.tracing) {
                this.traceLine += ` ${this.regOR1.toBCDString()}`;
                this.traceQData = this.traceQOperand();
            }

            switch(this.opBinary) {
            case 16:    // TFM, Transmit Field Immediate
            case 26:    // TF,  Transmit Field
                if (this.regOR1.binaryValue - this.regOR2.binaryValue == 1) {   // Q-P
                    // This is a backward smearing move with a distance of 1: works on Mod 1 but not 2.
                    console.debug(`Invalid smearing Transmit for Model 2 @${this.opAddress.toString().padStart(5, "0")}, ` +
                                  `P=${this.regOR2.toBCDString()}, Q=${this.regOR1.toBCDString()}`);
                    debugger;
                }
                this.enterECycle();
                break;
            case 31:    // TR,  Transmit record
                if (this.regOR2.binaryValue - this.regOR1.binaryValue == 1) {   // P-Q
                    // This is a forward smearing move with a distance of 1: works on Mod 1 but not 2.
                    console.debug(`Invalid smearing Transmit for Model 2 @${this.opAddress.toString().padStart(5, "0")}, ` +
                                  `P=${this.regOR2.toBCDString()}, Q=${this.regOR1.toBCDString()}`);
                    debugger;
                }
                this.enterECycle();
                break;
            case 34:    // K, Control
                if (!this.ioDevice) {
                    this.enterLimbo();
                    this.gateWRITE_INTERLOCK.value = 1;
                } else {
                    switch (this.ioSelectNr) {
                    case 1:     // Typewriter
                        this.enterLimbo();      // stop run() while control() runs async
                        this.ioDevice.control(this.ioVariant).then(() => {
                            this.ioExit();
                            if (!this.gateMANUAL.value) {
                                this.run();     // exit Limbo state
                            }
                        });
                        break;
                    case 7:     // Disk Drive
                        this.initiateDiskControl();
                        this.ioExit();
                        break;
                    case 9:     // Line Printer
                        this.ioDevice.control(this.ioVariant);  // runs async
                        this.ioExit();
                        break;
                    default:
                        this.gateWRITE_INTERLOCK.value = 1;
                        this.enterLimbo();      // just hang on an undefined device
                        break;
                    }
                }
                break;
            case 36:    // RN, Read Numerically
            case 37:    // RA, Read Alphanumerically
                if (!this.ioDevice) {
                    this.gateREAD_INTERLOCK.value = 1;
                    this.enterLimbo();
                } else {
                    switch (this.ioSelectNr) {
                    case 1:     // Typewriter
                    case 3:     // Paper Tape Reader
                        this.enterLimbo(this.ioDevice, this.ioDevice.initiateRead);
                        break;
                    case 5:     // Card Reader
                        this.gateREAD_INTERLOCK.value = 1;
                        this.enterLimbo(this.ioDevice, this.ioDevice.initiateRead);
                        break;
                    case 7:     // Disk Drive
                        if (this.opBinary == 36 /*RN*/) { // disk reads only numerically
                            this.enterLimbo(this, this.initiateDiskRead);
                        } else {
                            this.gateREAD_INTERLOCK.value = 1;
                            this.enterLimbo();          // just hang if not Read Numerically
                        }
                        break;
                    case 33:    // Binary Paper Tape Reader
                        if (this.opBinary == 37 /*RA*/) { // reads alphanumerically only
                            this.enterLimbo(this.ioDevice, this.ioDevice.initiateReadBinary);
                        } else {
                            this.gateREAD_INTERLOCK.value = 1;
                            this.enterLimbo();          // just hang if not Read Alphanumerically
                        }
                        break;
                    default:
                        this.gateREAD_INTERLOCK.value = 1;
                        this.enterLimbo();              // just hang on an undefined device
                    }
                }
                break;
            case 35:    // DN, Dump Numerically
            case 38:    // WN, Write Numerically
            case 39:    // WA, Write Alphabetically
                if (!this.ioDevice) {
                    this.gateWRITE_INTERLOCK.value = 1;
                    this.enterLimbo();
                } else {
                    this.setProcState(procStateE2);     // no E-cycle entry for I/O
                    switch (this.ioSelectNr) {
                    case 1:     // Typewriter
                        this.ioDevice.initiateWrite();
                        break;
                    case 2:     // Paper Tape Punch / Plotter
                        this.ioDevice.initiateWrite();
                        break;
                    case 4:     // Card Punch
                    case 9:     // Printer
                        this.gateWRITE_INTERLOCK.value = 1;
                        this.ioDevice.initiateWrite(this.ioVariant);
                        break;
                    case 7:     // Disk Drive
                        if (this.opBinary == 38 /*WN*/) {
                            this.enterLimbo(this, this.initiateDiskWrite);
                        } else {
                            this.gateWRITE_INTERLOCK.value = 1;
                            this.enterLimbo();          // just hang if not Write Numerically
                        }
                        break;
                    case 32:    // Binary Paper Tape Punch
                        if (this.opBinary == 39 /*WA*/) { // writes alphanumerically only
                            this.ioDevice.initiateWrite();
                        } else {
                            this.gateWRITE_INTERLOCK.value = 1;
                            this.enterLimbo();          // just hang if not Write Alphanumerically
                        }
                        break;
                    default:
                        this.gateWRITE_INTERLOCK.value = 1;
                        this.enterLimbo();              // just hang on an undefined device
                        break;
                    }
                }
                break;
            case 41:    // NOP, No Operation
            case 46:    // BI, Branch Indicator
            case 47:    // BNI, Branch No Indicator
            case 60:    // BS, Branch and Select
                this.enterICycle();
                break;
            case 48:    // H, Halt
                this.enterICycle();
                this.enterManual();
                break;
            default:
                this.enterECycle();
                break;
            }
        }
    }


    /*******************************************************************
    *  Execution Cycle                                                 *
    *******************************************************************/

    /**************************************/
    enterECycle() {
        /* Initiates the start of the current instruction E-cycles */

        this.gateE_CYC_ENT.value = 1;
        this.gateIX.value = 0;
        this.regMQ.clear();

        if (!this.opThisAtts.opValid) {
            this.marCheck(`E-Cyc-Ent: invalid op code ${this.regOP.toBCDString()} @${this.opAddress.toString().padStart(5, "0")}`);
            return;
        }

        let initialEState = this.opThisAtts.eState;
        switch (this.opBinary) {
        case  1:        // FADD - Floating Add (for exponent compare)
        case  2:        // FSUB - Floating Subtract (for exponent compare)
        case  9:        // FDIV - Floating Divide (for exponent subtract)
            this.gateCOMP.value = 1;
            //--no break
        case  3:        // FMUL - Floating Multiply (for exponent add)
            this.gateEXP_ADD.value = 1;
            this.gateADD_ENT.value = 1;
            break;

        case  5:        // FSL - Floating Shift Left
            this.gateSCAN_Q.value = 1;
            this.enterFPScan();
            break;

        case  8:        // FSR - Floating Shift Right
            this.enterFPShift();
            break;

        case  6:        // TFL - Transmit Floating
        case  7:        // BTFL - Branch and Transmit Floating
        case 10:        // BTA - Branch and Transmit
        case 15:        // TDM - Transmit Digit Immediate
        case 16:        // TFM - Transmit Field Immediate
        case 17:        // BTM - Branch and Transmit Immediate
        case 20:        // BTAM - Branch and Transmit Immediate
        case 25:        // TD - Transmit Digit
        case 26:        // TF - Transmit Field
        case 27:        // BT - Branch and Transmit
        case 30:        // TRNM - Transmit Record No Record Mark
        case 31:        // TR - Transmit Record
        case 70:        // MA - Move Address
            this.gateEXMIT_ENT.value = 1;
            break;

        case 12:        // SM - Subtract Immediate
        case 14:        // CM - Compare Immediate
        case 22:        // S - Subtract
        case 24:        // C - Compare
            this.gateCOMP.value = 1;
            //--no break
        case 11:        // AM - Add Immediate
        case 21:        // A - Add
            this.gateADD_ENT.value = 1;
            break;

        case 13:        // MM - Multiply Immediate
        case 23:        // M - Multiply
        case 96:        // OTD - Octal to Decimal
            this.gate1ST_CYC.value = 1;
            this.gateEZ.value = 1;
            this.gateHP.value = 1;
            break;

        case 18:        // LDM - Load Dividend Immediate
        case 28:        // LD - Load Dividend
            this.gateEXMIT_ENT.value = 1;
            //--no break
        case 72:        // TNS - Transmit Numeric Strip
        case 73:        // TNF - Transmit Numeric Fill
            this.gate1ST_CYC.value = 1;
            break;

        case 19:        // DM - Divide Immediate
        case 29:        // D - Divide
        case 97:        // DTO - Decimal to Octal
            this.gateDIV_1_CYC.value = 1;
            this.enterAdd();            // DO NOT set ADD_ENT for first cycle
            this.gateCOMP.value = 1;
            break;

        case 61:        // BX - Branch and Modify Index Register
        case 62:        // BXM - Branch and Modify Index Register Immediate
        case 63:        // BCX - Branch Conditionally and Modify Index Register
        case 64:        // BCXM - Branch Conditionally and Modify Index Register Immediate
            this.gateADD_ENT.value = 1;
            if (!(this.gateIX_BAND_1.value || this.gateIX_BAND_2.value)) {
                this.marCheck(`E-Cyc-Ent: IX op no band ${this.regOP.toBCDString()} @${this.opAddress.toString().padStart(5, "0")}`);
            } else {
                this.gateIX_EXEC.value = 1;
            }
            break;

        case 65:        // BLX - Branch and Load Index Register
        case 66:        // BLXM - Branch and Load Index Register Immediate
        case 67:        // BSX - Branch and Store Index Register
            this.gateEXMIT_ENT.value = 1;
            if (!(this.gateIX_BAND_1.value || this.gateIX_BAND_2.value)) {
                this.marCheck(`E-Cyc-Ent: IX op no band ${this.regOP.toBCDString()} @${this.opAddress.toString().padStart(5, "0")}`);
            } else {
                this.gateIX_EXEC.value = 1;
            }
            break;

        case 92:        // ORF - OR to Field
        case 93:        // ANDF - AND to Field
        case 94:        // CPLF - Complement Octal Field
        case 95:        // EORF - Exclusive OR to Field
            this.gateEZ.value = 1;
            break;
        }

        if (initialEState) {
            this.setProcState(procStateE1 - 1 + initialEState);
        } else {
            this.checkStop(`E-Cyc-Ent: Unimplemented op code=${this.opBinary}`);
        }
    }

    /**************************************/
    enterAdd() {
        /* Sets up execution for the add-like ops: A, AM, S, SM, C, CM,
        FADD, FSUB, etc. */

        this.gate1ST_CYC.value = 1;
        this.gateADD_MODE.value = 1;
        this.gateFIELD_MK_1.value = 0;
        this.gateFIELD_MK_2.value = 0;
        if (!this.gateEXP_MOD_ENTRY.value && !this.gateFRAC_ADD_ENTRY.value &&
                !this.gateFRAC_COMPR_ENTRY.value && !this.gateFDIV_ENTRY.value &&
                !this.gateSCAN_ENTRY.value && !this.gateSHIFT_ENTRY.value) {
            this.gateEZ.value = 1;
            this.gateHP.value = 1;
        }
    }

    /**************************************/
    enterTransmit() {
        /* Sets up execution for the transmit-like ops: TF, TFM, TD, TDM, TR,
        TRNM, ADD, SUB */

        this.gateEXMIT_MODE.value = 1;
        this.gate1ST_CYC.value = 1;
        this.gateEXMIT_ENT.value = 0;
        this.gateFIELD_MK_1.value = 0;
        this.gateFIELD_MK_2.value = 0;
        this.gateRECOMP.value = 0;
    }

    /**************************************/
    enterFPScan() {
        /* Sets up execution for the floating-point scan sub-operations.
        See ILD 10.00.82.1 */

        this.gateSCAN_ENTRY.value = 1;
        this.changeFPMode();
        this.gate1ST_CYC.value = 1;
        this.gateADD_MODE.value = 0;
        this.gateSCAN_MODE.value = 1;
        this.gateEXP_ADD.value = 0;
        this.gateEXP_XMIT.value = 0;
        this.gateFRAC_ADD_MODE.value = 0;
        this.setProcState(procStateE1);
    }

    /**************************************/
    enterFPShift() {
        /* Sets up execution for the floating-point shift sub-operations.
        See ILD 10.0.0.84.1 */

        this.gateSHIFT_ENTRY.value = 1;
        this.gateADD_MODE.value = 0;
        this.changeFPMode();
        this.gateSHIFT_MODE.value = 1;
        this.gateSCAN_MODE.value = 0;
        this.gateSIG_DIGIT.value = 0;
        this.gateEXP_MODIFY.value = 0;
        this.enterTransmit();
        this.setProcState(procStateE1);
    }

    /**************************************/
    enterFPFractionAdd() {
        /* Sets up execution for the floating-point fraction add sub-operation.
        See ILD 10.00.85.1 */

        this.gateFRAC_ADD_ENTRY.value = 1;
        this.changeFPMode();
        this.gateADD_ENT.value = 1;
        if (this.opBinary == 2 /*FSUB*/) {
            this.gateCOMP.value = 1;
        }

        this.gateCARRY_IN.value = this.gateCOMP.value;  // not in ILD
        this.gateFRAC_ADD_MODE.value = 1;
        this.gateSCAN_MODE.value = 0;
        this.gateEXMIT_MODE.value = 0;
        this.gateEXP_ADD.value = 0;
        this.gateSHIFT_MODE.value = 0;
        this.setProcState(procStateE1);
    }

    /**************************************/
    enterFPFractionCompare() {
        /* Sets up execution for the floating-point fraction compare sub-
        operation. See ILD 10.00.90.1 */

        this.gateFRAC_COMPR_ENTRY.value = 1;
        this.changeFPMode();
        this.gateFRAC_COMPARE_MODE.value = 1;
        this.gateEXP_ADD.value = 0;
        this.gateCOMP.value = 1;
        this.gateADD_ENT.value = 1;
        this.setProcState(procStateE1);
    }

    /**************************************/
    enterFPMultiply() {
        /* Sets up execution for the floating-point multiply sub-operation.
        See ILD 10.00.89.1 */

        this.gateFMUL_ENTRY.value = 1;
        this.changeFPMode();
        this.gateADD_MODE.value = 0;
        this.gateEXP_ADD.value = 0;
        this.gateFMUL_MODE.value = 1;
        this.gate1ST_CYC.value = 1;
        this.setProcState(procStateE5);
    }

    /**************************************/
    enterFPLD() {
        /* Sets up execution for the floating-point load dividend sub-operation.
        See ILD 10.00.92.1 */

        this.gateLD_ENTRY.value = 1;
        this.gateEXMIT_MODE.value = 0;
        this.gateLD.value = 1;
        this.gateFALSE_XMIT.value = 0;
        this.gateEXMIT_ENT.value = 1;
        this.gate1ST_CYC.value = 1;
        this.setProcState(procStateE5);
    }

    /**************************************/
    enterFPDivide() {
        /* Sets up execution for the floating-point divide sub-operation.
        See ILD 10.00.92.1 */

        this.gateFDIV_ENTRY.value = 1;
        this.changeFPMode();
        this.gateDIV_1_CYC.value = 1;
        this.enterAdd();                // DO NOT set ADD_ENT for first cycle
        this.gateCOMP.value = 1;
        this.gateFDIV.value = 1;
        this.gateLD.value = 0;
        this.gateLAST_LD_CYC.value = 0;
        this.setProcState(procStateE1);
    }

    /**************************************/
    enterFPExponentModify() {
        /* Sets up execution for the floating-point exponent modify
        sub-operation. See ILD 10.0.86.1 */

        this.gateEXP_MOD_ENTRY.value = 1;
        if (this.gateHP.value) {
            this.gateFP_HI_PLUS.value = 1;
        }

        this.gateHP.value = 1;          // not set by enterAdd()
        this.gateEXMIT_MODE.value = 0;
        this.gateEXP_MODIFY.value = 1;
        this.gateSHIFT_MODE.value = 0;
        this.gateFMUL_MODE.value = 0;
        this.gateFRAC_ADD_MODE.value = 0;
        this.gateFDIV.value = 0;
        if (this.gateEXP_MOD_REQ.value && this.gateEXP_OFLO_CORR.value) {
            this.gateEXP_OFLO.value = 0;
            this.gateEXP_UFLO.value = 0;
        }

        this.gateADD_ENT.value = 1;
        this.setProcState(procStateE1);
    }

    /**************************************/
    enterFPExponentTransmit() {
        /* Sets up execution for the floating-point exponent transmit
        sub-operation. See ILD 10.00.81.1 */

        this.gateEXP_XMIT.value = 1;
        this.gateEXMIT_ENT.value = 1;
        this.gateADD_MODE.value = 0;
        this.gateEXP_ADD.value = 0;
        this.changeFPMode();
        this.setProcState(procStateE1);
    }

    /**************************************/
    enterFPFalseTransmit() {
        /* Sets up execution for the floating-point false transmit sub-operation.
        See ILD 10.00.91.1 */

        this.gateFALSE_XMIT_ENTRY.value = 1;
        this.gateADD_MODE.value = 0;
        this.gateFALSE_XMIT.value = 1;
        this.gateFRAC_COMPARE_MODE.value = 0;
        this.enterTransmit();
        this.setProcState(procStateE1);
    }

    /**************************************/
    enterFPResultTransmit() {
        /* Sets up execution for the floating-point result (mantissa) transmit
        sub-operation. See ILD 10.00.83.1 */

        this.gateRESULT_XMIT.value = 1;
        this.gateEXMIT_ENT.value = 1;
        this.gateADD_MODE.value = 0;
        this.gateSCAN_MODE.value = 0;
        this.gateEXP_MODIFY.value = 0;
        this.setProcState(procStateE1);
    }

    /**************************************/
    enterFPDigitForce() {
        /* Sets up execution for the floating-point digit force (store special
        floating-point zero or infinity value) sub-operation.
        See ILD 10.00.88.1 */

        this.gateDIGIT_FORCE_ENTRY.value = 1;
        this.regMQ.clear();
        this.gate1ST_CYC.value = 1;     // not in the ILD
        this.gateEXMIT_ENT.value = 0;   // not in the ILD
        this.gateFIELD_MK_1.value = 0;  // not in the ILD
        this.gateFIELD_MK_2.value = 0;  // not in the ILD
        this.gateADD_MODE.value = 0;
        this.gateFRAC_ADD_MODE.value = 0;
        this.gateEXP_MODIFY.value = 0;
        this.gateDIG_FORCE_MODE.value = 1;
        this.setProcState(procStateE2); // no E1 cycles are done
    }

    /**************************************/
    changeFPMode() {
        /* Change arithmetic mode gates on entry for various FP operations.
        See ILD 10.00.93.1 */

        this.gateFIELD_MK_1.value = 0;
        this.gateFIELD_MK_2.value = 0;
        this.gateCOMP.value = 0;
        this.gateP_COMP.value = 0;
        this.gateRECOMP.value = 0;
        this.gateCARRY_OUT.value = 0;
        if (!this.gateSHIFT_ENTRY.value && !this.gateSCAN_ENTRY.value) {
            this.gateHP.value = 1;
            this.gateEZ.value = 1;
        }
    }

    /**************************************/
    checkFPExponentOfloUflo(op) {
        /* Evaluates the end of an exponent add/subtract operation for overflow
        or underflow and sets the oflo/uflo gates appropriately.
        See ILD 10.0.00.93.1. Note that the ILD lies about using FP_HI_PLUS --
        it should be HP */

        if (this.gateCARRY_OUT.value && !this.gateCOMP.value) {
            if ((op == 3 /*FMUL*/ && this.gateHP.value) ||
                    (op == 9 /*FDIV*/ && !this.gateHP.value)) {
                if (this.gateEZ.value) {
                    this.gateEXP_OFLO_CORR.value = 1;
                }
            }

            if (this.gateHP.value ) {
                this.gateEXP_OFLO.value = 1;
            } else {
                this.gateEXP_UFLO.value = 1;
            }
        }
    }

    /**************************************/
    stepE1FPScan05() {
        /* Handles the E1 scan state for op 05=FSL. Scans the Q address,
        decrementing OR1 to the Q field mark, leaving PR1 at the high-order
        digit. See ILD 10.00.82.1 */

        if (this.gate1ST_CYC.value) {
            this.gateSCAN_ENTRY.value = 0;
        }

        this.regMAR.value = this.regOR1.value;
        this.fetch();
        this.regPR1.value = this.regMAR.value;
        this.regOR1.decr(1);
        if (this.regMBR.getDigit(this.regMAR.isEven) & Register.flagMask) {
            if (this.gate1ST_CYC.value) {
                this.gateSCAN_MINUS.value = 1;
            } else {
                this.gateFIELD_MK_1.value = 1;
            }
        }

        this.setProcState(procStateE2);
    }

    /**************************************/
    stepE2FPScan05() {
        /* Handles the E2 scan state for op 05=FSL. Reads digit at PR1. Once FM-1
        is detected, clears the flag (old field mark) and rewrites that digit.
        See ILD 10.00.82.1 */

        this.regMAR.value = this.regPR1.value;
        this.fetch();
        if (this.gateFIELD_MK_1.value) {
            this.regMIR.setDigitFlag(this.regMAR.isEven, 0);
            this.store();
            this.gateHI_ORDER_ZERO.value = 1;
            this.enterFPShift();
        } else {
            this.setProcState(procStateE1);
        }
    }

    /**************************************/
    stepE1FPScanP() {
        /* Handles the E1 scan P state for op 01/02. Scans P address via PR1,
        decrementing PR1 until the field mark flag is encountered. Leaves PR1
        pointing to the next lower digit, which will be treated as the low-order
        digit of the P mantissa during fraction add. See ILD 10.00.82.1 */

        if (this.gate1ST_CYC.value) {
            this.gateSCAN_ENTRY.value = 0;
        }

        this.regMAR.value = this.regPR1.value;
        this.fetch();
        this.regPR1.decr(1);
        if (this.regMBR.getDigit(this.regMAR.isEven) & Register.flagMask) {
            if (this.gate1ST_CYC.value) {
                this.gateSCAN_MINUS.value = 1;
            } else {
                this.gateFIELD_MK_1.value = 1;
            }
        }

        this.setProcState(procStateE2);
    }

    /**************************************/
    stepE2FPScanP() {
        /* Handles the E2 scan P state for op 01/02. Does not access memory.
        Counts CR1 down or up depending on COUNTER_COMP. If CR1 becomes zero,
        exits to shift right to align the remainder of the mantissa. If FM-1 was
        detected in E1, exit to result transmit (adjusted P fraction is
        insignificant thus the result is the Q fraction). See ILD 10.00.82.1 */

        this.gateEZ.value = 0;
        if (this.gateFIELD_MK_1.value) {
            this.gateEXMIT_ENT.value = 1;
            this.enterFPResultTransmit();
        } else {
            this.regMAR.value = this.regCR1.value;
            if (this.gateCOUNTER_COMP.value) {
                this.regMAR.incr(1);
            } else {
                this.regMAR.decr(1);
            }

            this.regCR1.clear();
            this.regCR1.setDigit(0, this.regMAR.getDigit(0));   // keep only the 2 low-order digits
            this.regCR1.setDigit(1, this.regMAR.getDigit(1));
            if (this.regCR1.isZero && !this.gateD_GTR_99.value) {
                this.enterFPShift();
            } else {
                this.setProcState(procStateE1);
            }
        }
    }

    /**************************************/
    stepE1FPScanQ() {
        /* Handles the E1 scan Q state for op 01/02. Scans Q address via OR1,
        decrementing OR1 field mark flag is encountered. Leaves OR1 pointing to
        the next lower digit, which will be treated as the low-order digit of
        the Q mantissa during fraction add. On first cycle, sets  the field
        sign in SCAN_MINUS. See ILD 10.00.82.1 */

        if (this.gate1ST_CYC.value) {
            this.gateSCAN_ENTRY.value = 0;
        }

        this.regMAR.value = this.regOR1.value;
        this.fetch();
        this.regOR1.decr(1);
        if (this.regMBR.getDigit(this.regMAR.isEven) & Register.flagMask) {
            if (this.gate1ST_CYC.value) {
                this.gateSCAN_MINUS.value = 1;
            } else {
                this.gateFIELD_MK_1.value = 1;
                this.gateQ_EXIT.value = 1;
            }
        }

        this.setProcState(procStateE2);
    }

    /**************************************/
    stepE2FPScanQ() {
        /* Handles the E2 scan Q state for op 01/02. Counts CR1 down or up
        depending on COUNTER_COMP. If CR1 becomes zero, exits to shift right to
        align the remainder of the mantissa. If FM-1 was detected in E1, exit
        to I-Cycle Entry (result is the P value, and HP is set from the P digit
        sign via OR1). See ILD 10.00.82.1 */

        if (this.gateQ_EXIT.value) {
            this.regMAR.value = this.regOR2.value;
            this.fetch();               // read low-order P mantissa digit for sign
            if (this.regMBR.getDigit(this.regMAR.isEven) & Register.flagMask) {
                this.gateHP.value = 0;
            }
            this.enterICycle();         // result is P; Q is scaled to insignificance
        } else {
            this.gateEZ.value = 0;
            this.regMAR.value = this.regCR1.value;
            if (this.gateCOUNTER_COMP.value) {
                this.regMAR.incr(1);
            } else {
                this.regMAR.decr(1);
            }

            this.regCR1.clear();
            this.regCR1.setDigit(0, this.regMAR.getDigit(0));   // keep only the 2 low-order digits
            this.regCR1.setDigit(1, this.regMAR.getDigit(1));
            if (this.regCR1.isZero && !this.gateD_GTR_99.value) {
                this.enterFPFractionAdd();
            } else {
                this.setProcState(procStateE1);
            }
        }
    }

    /**************************************/
    stepE1FPScanZero() {
        /* Handles the E1 scan zero state for op 01/02. The HI_ORDER_ZERO gate
        is on. Scans P address via PR1, incrementing PR1 and CR1 until the
        first non-zero digit is encountered. Leaves PR1 pointing to the highest-
        order non-zero digit. See ILD 10.00.82.1 */

        this.gateEZ.value = 0;
        if (this.gate1ST_CYC.value) {
            this.gateSCAN_ENTRY.value = 0;
        }

        this.regMAR.value = this.regPR1.value;
        this.fetch();
        if (this.regMBR.getDigit(this.regMAR.isEven) & Register.bcdMask) {
            this.gateSIG_DIGIT.value = 1;
            this.regPR1.decr(1);
        } else {
            this.regPR1.incr(1);
        }

        if (this.regMBR.getDigit(this.regMAR.isEven) & Register.flagMask) {
            if (this.gate1ST_CYC.value) {
                this.gateSCAN_MINUS.value = (this.gateHP.value ? 0 : 1);
            } else {
                this.gateFIELD_MK_1.value = 1;
            }
        }

        this.setProcState(procStateE2);
    }

    /**************************************/
    stepE2FPScanZero() {
        /* Handles the E2 scan zero state for op 01/02. Counts CR1 while
        SIG_DIGIT is not on. Does not access memory until the SIG_DIGIT gate is
        on, at which point it exits to normalize shift left to align the
        remainder of the mantissa. See ILD 10.00.82.1 */

        if (!this.gateSIG_DIGIT.value) {
            this.regCR1.incr(1);
            this.setProcState(procStateE1);
        } else {
            this.regMAR.value = this.regPR1.value;
            this.fetch();
            this.regPR1.incr(1);
            if (!this.gateFIELD_MK_1.value) {
                this.enterFPShift();
            }
        }
    }

    /**************************************/
    stepE1FPExponentTransmit() {
        /* Handles the E1 exponent transmit state for op 01/02. Similar to TF,
        but reads via OR4. See ILD 10.00.81.1 */

        if (this.gateEXMIT_ENT.value) {
            this.enterTransmit();
        }

        this.regMAR.value = this.regOR4.value;
        this.fetch();
        this.setDREven(this.regMBR.even);
        if (this.regMAR.isEven) {   // MAR is even
            this.regOR4.decr(1);
        } else {                    // MAR is odd
            this.gate2_DIG_CNTRL.value = 1;
            this.setDROdd(this.regMBR.odd);
            this.regOR4.decr(this.gate1ST_CYC.value ? 2 : 1);
        }
        this.setProcState(procStateE2);
    }

    /**************************************/
    stepE2FPExponentTransmit() {
        /* Handles the E2 exponent transmit state for op 01/02. Similar to TF,
        but initializes OR3 to OR5 and stores via OR3. Transmits only two digits,
        leaving OR3 at the low-order-digit of the mantissa. See ILD 10.00.81.1 */
        let digit = 0;
        let nextState = procStateE2;

        if (this.gate2_DIG_CNTRL.value) {
            this.gate2_DIG_CNTRL.value = 0;
            digit = this.getDROdd();
        } else {
            digit = this.shiftDREvenOdd();
            nextState = procStateE1;
        }

        if (this.gate1ST_CYC_DELAYD.value) {
            this.regMAR.value = this.regOR3.value = this.regOR5.value;
        } else {
            this.regMAR.value = this.regOR3.value;
        }

        this.fetch();
        this.regMIR.setDigit(this.regMAR.isEven, digit);
        this.store();
        this.regOR3.decr(1);
        if (this.gate1ST_CYC_DELAYD.value) {
            this.setProcState(nextState);       // do either E1 or continue with E2
        } else {
            this.gateFIELD_MK_1.value = 1;
            this.enterFPScan();                 // for Scan P
        }
    }

    /**************************************/
    stepE1FPResultTransmit(op) {
        /* Handles the E1 result transmit state for op 01/02. Similar to TF,
        reading via OR1. Sets HP from the Q field sign. See ILD 10.00.83.1 */

        if (this.gateEXMIT_ENT.value) {
            this.enterTransmit();
        }

        this.regMAR.value = this.regOR1.value;
        this.fetch();
        const dx = this.regMAR.isEven;
        this.setDREven(this.regMBR.even);
        if (dx) {                       // MAR is even
            this.regOR1.decr(1);
        } else {                        // MAR is odd
            this.gate2_DIG_CNTRL.value = 1;
            this.setDROdd(this.regMBR.odd);
            this.regOR1.decr(2);
        }

        if (this.gate1ST_CYC.value && op != 9 /*FDIV*/ && (this.regMBR.getDigit(dx) & Register.flagMask)) {
            this.gateHP.flip();
        }

        this.setProcState(procStateE2);
    }

    /**************************************/
    stepE2FPResultTransmit(op) {
        /* Handles the E2 result transmit state for op 01/02. Similar to TF, and
        stores via OR2. Reverses HP if necessary from the P field sign.
        See IDL 10.00.83.1 */
        let digit = 0;
        let nextState = 0;

        if (this.gate2_DIG_CNTRL.value) {
            this.gate2_DIG_CNTRL.value = 0;
            digit = this.getDROdd();
        } else {
            digit = this.shiftDREvenOdd();
            nextState = procStateE1;
        }

        this.regMAR.value = this.regOR2.value;
        this.fetch();
        if (this.gate1ST_CYC_DELAYD.value) {
            if (op == 2 /*FSUB*/) {
                this.gateHP.flip();
            }

            if (this.gateHP.value) {
                digit &= Register.notFlagMask;
            } else {
                digit |= Register.flagMask;
            }
        }

        this.regMIR.setDigit(this.regMAR.isEven, digit);
        this.store();
        this.regOR2.decr(1);
        if (this.gateFL_1.value && !this.gate1ST_CYC_DELAYD.value) {
            this.gateFIELD_MK_1.value = 1;
            this.enterICycle();
        } else if (nextState) {     // do either E1 or continue with E2
            this.setProcState(nextState);
        }
    }

    /**************************************/
    stepE1FPFalseTransmit() {
        /* Handles the E1 state for the False Transmit sub-operation of op 09.
        This is actually a form of Scan P to determine the length of P, the
        dividend. Sets OR1 to the low-order digit of the P mantissa in PR1, then
        scans P, decrementing PR1 until the FM flag is encountered.
        See ILD 10.00.91.1 */

        this.regMAR.value = this.regPR1.value;
        if (this.gate1ST_CYC.value) {
            this.gateFALSE_XMIT_ENTRY.value = 0;
            this.regOR1.value = this.regMAR.value;
        }

        this.fetch();
        const dx = this.regMAR.isEven;
        this.setDREven(this.regMBR.even);
        if (dx) {                       // MAR is even
            this.regPR1.decr(1);
        } else {                        // MAR is odd
            this.gate2_DIG_CNTRL.value = 1;
            this.setDROdd(this.regMBR.odd);
            this.regPR1.decr(2);
        }

        this.setProcState(procStateE2);
    }

    /**************************************/
    stepE2FPFalseTransmit() {
        /* Handles the E2 state for the False Transmit sub-operation of op 09.
        Decrements OR2 from 00099 until the dividend FM flag is detected, leaving
        OR2 at 100-L if the EXP_MOD_REQ gate is set, 99-L otherwise. This
        positions the dividend in the product area. OR3 is set to 100-L.
        Exits to the Load Dividend sub-operation. See ILD 10.00.91.1 */
        let digit = 0;
        let nextState = 0;

        if (this.gate2_DIG_CNTRL.value) {
            this.gate2_DIG_CNTRL.value = 0;
            digit = this.getDROdd();            // digit value not used
        } else {
            digit = this.shiftDREvenOdd();      // digit value not used
            nextState = procStateE1;
        }

        if (this.gate1ST_CYC_DELAYD.value) {
            this.regMAR.binaryValue = 99;
        } else {
            this.regMAR.value = this.regOR2.value;
        }

        this.fetch();                           // memory data not used
        this.regOR3.value = this.regMAR.value;
        this.regMAR.decr(1);

        if (this.gate1ST_CYC_DELAYD.value || !this.gateFL_1.value) {
            this.regOR2.value = this.regMAR.value;
            if (nextState) {                    // do either E1 or continue with E2
                this.setProcState(nextState);
            }
        } else {                                // dividend field mark encountered
            this.gateFIELD_MK_1.value = 1;
            if (!this.gateEXP_MOD_REQ.value) {
                this.regOR2.value = this.regMAR.value;  // leave OR2 at 100-L
            }

            if (!this.gateFALSE_XMIT_ENTRY.value) {     // should be off by the time we get here
                this.enterFPLD();
            }
        }

    }
    /**************************************/
    stepE1FPShift05() {
        /* Handles the E1 shift state for op 05=FSL. Fetch digits in forward
        direction via PR1 (set from scan mode) and leave in DR for the E2 state.
        See ILD 10.00.82.1 */

        if (this.gate1ST_CYC.value) {
            this.gateSHIFT_ENTRY.value = 0;
        }

        this.regMAR.value = this.regPR1.value;
        this.fetch();
        this.setDREven(this.regMBR.odd);
        if (this.regMAR.isOdd) {        // MAR is odd
            this.regPR1.incr(1);
        } else {                        // MAR is even
            this.gate2_DIG_CNTRL.value = 1;
            this.setDROdd(this.regMBR.even);
            this.regPR1.incr(2);
        }

        this.setProcState(procStateE2);
    }

    /**************************************/
    stepE2FPShift05() {
        /* Handles the E2 shift state for op 05=FSL. Transfers digits from DR
        to OR2 until end of mantissa detected, then zero fills the rest of the
        original mantissa area. See ILD 10.00.84.1 */
        let digit = 0;
        let dx = this.regOR2.isEven;
        let nextState = 0;

        this.regMAR.value = this.regOR2.value;
        this.fetch();

        if (this.gateFIELD_MK_1.value) {
            // Do zero fill
            digit = this.regMBR.getDigit(dx);
            if (!(digit & Register.flagMask)) {
                digit = 0;
            } else {
                this.gateFIELD_MK_2.value = 1;
                this.enterICycle();             // done -- otherwise, stay in E2
                if (this.gateSCAN_MINUS.value) {// detected flag in negative low-order digit
                    digit = Register.flagMask;
                } else {                        // detected flag in high-order exponent digit
                    return;
                }
            }

            this.regMIR.setDigit(dx, digit);
            this.store();
            this.regOR2.incr(1);
        } else {
            // Do mantissa transfer
            if (this.gate2_DIG_CNTRL.value) {
                this.gate2_DIG_CNTRL.value = 0;
                digit = this.getDROdd();
            } else {
                digit = this.shiftDREvenOdd();
                nextState = procStateE1;        // otherwise stay in E2
            }

            if (this.gate1ST_CYC_DELAYD.value) {
                digit |= Register.flagMask;     // set flag on H.O. digit
            } else {
                digit &= Register.notFlagMask;  // reset flag on all other digits
                if (this.gateFL_1.value) {
                    this.gateFIELD_MK_1.value = 1;
                    nextState = 0;              // stay in E2 for zero fill
                    if (this.gateHI_ORDER_ZERO.value && !this.gateSCAN_MINUS.value) {
                        this.gateEXTRA_SFT_CYC.value = 1;   // detected flag in exponent field
                    }
                }
            }

            if (!this.gateEXTRA_SFT_CYC.value) {
                this.regMIR.setDigit(dx, digit);
                this.store();
                this.regOR2.incr(1);
            }
        }

        if (nextState) {
            this.setProcState(nextState);
        }
    }

    /**************************************/
    stepE1FPShift08() {
        /* Handles the E1 shift right state for op 08. Reads digits via OR1 to
        DR. MBR is fetched via OR1 by caller. See ILD 10.00.84.1 */

        if (this.gate1ST_CYC.value) {
            this.gateSHIFT_ENTRY.value = 0;
        }

        this.setDREven(this.regMBR.even);
        if (this.regMAR.isEven) {   // MAR is even
            this.regOR1.decr(1);
        } else {                    // MAR is odd
            this.gate2_DIG_CNTRL.value = 1;
            this.setDROdd(this.regMBR.odd);
            this.regOR1.decr(2);
        }
        this.setProcState(procStateE2);
    }

    /**************************************/
    stepE2FPShift08(dx) {
        /* Handles the E2 shift state for op 08=FSR. Shifts digits right by
        transfering digits from DR to OR2 until the mantissa FM is detected,
        then zero fills the vacated part of the original mantissa area.
        MBR and MIR are set via OR2 by caller. See ILD 10.00.84.1 */
        let digit = 0;
        let nextState = 0;

        if (this.gateFIELD_MK_1.value) {
            // Do zero fill
            if (this.regMBR.getDigit(dx) & Register.flagMask) {
                digit |= Register.flagMask;
                this.gateFIELD_MK_2.value = 1;
                this.enterICycle();             // done -- otherwise, stay in E2
            }
        } else {
            // Do mantissa transfer
            if (this.gate2_DIG_CNTRL.value) {
                this.gate2_DIG_CNTRL.value = 0;
                digit = this.getDROdd();
            } else {
                digit = this.shiftDREvenOdd();
                nextState = procStateE1;        // otherwise stay in E2
            }

            if (this.gate1ST_CYC_DELAYD.value) {// set sign flag on L.O. digit
                digit = (digit & Register.notFlagMask) | (this.regMBR.getDigit(dx) & Register.flagMask);
            } else {
                digit &= Register.notFlagMask;  // clear all other flags in transferred digits
            }

            if (this.gateFL_1.value) {          // check for end of Q field
                this.gateFIELD_MK_1.value = 1;
                nextState = 0;                  // stay in E2 for zero fill
            }
        }

        this.regMIR.setDigit(dx, digit);
        this.store();
        this.regOR2.decr(1);
        if (nextState) {
            this.setProcState(nextState);
        }
    }

    /**************************************/
    stepE1FPShiftRightP() {
        /* Handles the E1 shift right P state for op 01/02. Reads digits via
        PR1 to DR. See ILD 10.00.84.1 */

        if (this.gate1ST_CYC.value) {
            this.gateSHIFT_ENTRY.value = 0;
        }

        this.regMAR.value = this.regPR1.value;
        this.fetch();
        this.setDREven(this.regMBR.even);
        if (this.regMAR.isEven) {   // MAR is even
            this.regPR1.decr(1);
        } else {                    // MAR is odd
            this.gate2_DIG_CNTRL.value = 1;
            this.setDROdd(this.regMBR.odd);
            this.regPR1.decr(2);
        }
        this.setProcState(procStateE2);
    }

    /**************************************/
    stepE2FPShiftRightP() {
        /* Handles the E2 shift right P state for op 01/02. Shifts P right by
        transferring digits from DR to PR2 until the mantissa FM is detected,
        then zero fills the vacated part of the original mantissa area.
        See ILD 10.00.84.1 */
        let digit = 0;
        let nextState = 0;

        this.regMAR.value = this.regPR2.value;
        this.fetch();
        const dx = this.regMAR.isEven;

        if (this.gateFIELD_MK_1.value) {
            // Do zero fill
            if (this.regMBR.getDigit(dx) & Register.flagMask) {
                digit |= Register.flagMask;
                this.gateFIELD_MK_2.value = 1;
                this.enterFPFractionAdd();      // done -- otherwise, stay in E2
            }
        } else {
            // Do mantissa transfer
            if (this.gate2_DIG_CNTRL.value) {
                this.gate2_DIG_CNTRL.value = 0;
                digit = this.getDROdd();
            } else {
                digit = this.shiftDREvenOdd();
                nextState = procStateE1;        // otherwise stay in E2
            }

            if (this.gate1ST_CYC_DELAYD.value) {// set sign flag on L.O. digit
                digit = (digit & Register.notFlagMask) | (this.regMBR.getDigit(dx) & Register.flagMask);
            } else {
                digit &= Register.notFlagMask;  // clear all other flags in transferred digits
            }

            if (this.gateFL_1.value) {          // check for end of Q field
                this.gateFIELD_MK_1.value = 1;
                nextState = 0;                  // stay in E2 for zero fill
            }
        }

        this.regMIR.setDigit(dx, digit);
        this.store();
        this.regPR2.decr(1);
        if (nextState) {
            this.setProcState(nextState);
        }
    }

    /**************************************/
    stepE1FPShiftRightNormalize() {
        /* Handles the E1 shift right normalize state for op 01/02. Reads digits
        via PR1 to DR. If the FORCE_CF1 gate is set (which happens on the last
        cycle), resets FM-1 and sets the units position of DR to 0 in preparation
        for storing a high-order 1 in the mantissa during E2. See ILD 10.00.84.1 */

        if (this.gate1ST_CYC.value) {
            this.gateSHIFT_ENTRY.value = 0;
        }

        this.regMAR.value = this.regPR1.value;
        this.fetch();
        this.setDREven(this.regMBR.even);
        if (this.regMAR.isEven) {   // MAR is even
            this.regPR1.decr(1);
        } else {                    // MAR is odd
            this.gate2_DIG_CNTRL.value = 1;
            this.setDROdd(this.regMBR.odd);
            this.regPR1.decr(2);
        }

        if (this.gateFORCE_CF1.value) {
            this.gateFIELD_MK_1.value = 0;
            this.resetDROdd();
        }
        this.setProcState(procStateE2);
    }

    /**************************************/
    stepE2FPShiftRightNormalize() {
        /* Handles the E2 shift right normalize state for op 01/02. Shifts P
        right by transferring digits from DR via PR2 until the mantissa FM-1 is
        detected. On the next cycle, E1 will have reset FM-1 and set FORCE_CF1,
        which causes a flagged 1 to be stored in the mantissa high-order digit,
        representing the carry from fraction addition.
        See ILD 10.00.84.1 */
        let digit = 0;
        let nextState = 0;

        this.regMAR.value = this.regPR2.value;
        this.fetch();
        const dx = this.regMAR.isEven;

        if (this.gateFORCE_CF1.value && !this.gateFIELD_MK_1.value) {
            // Set high-order 1 in mantissa and terminate
            digit = 1 | Register.flagMask;
            this.gateFIELD_MK_2.value = 1;
            this.enterICycle();
        } else {
            // Do mantissa transfer
            if (this.gate2_DIG_CNTRL.value) {
                this.gate2_DIG_CNTRL.value = 0;
                digit = this.getDROdd();
            } else {
                digit = this.shiftDREvenOdd();
                nextState = procStateE1;        // otherwise stay in E2
            }

            if (!this.gate1ST_CYC_DELAYD.value) {
                if (this.gateFL_1.value) {          // check for end of Q field
                    this.gateFIELD_MK_1.value = 1;
                }
            }

            if (this.gateFIELD_MK_1.value) {    // check for end of Q field
                digit = (digit & Register.notFlagMask); // clear original FM
                this.gateFORCE_CF1.value = 1;
                nextState = procStateE1;        // do one more E1, suppress any 2_DIG_CNTRL effect
            } else {
                digit = (digit & Register.notFlagMask) | (this.regMBR.getDigit(dx) & Register.flagMask);
            }
        }

        this.regMIR.setDigit(dx, digit);
        this.store();

        // Don't decrement PR2 on the first cycle -- results in a 1 digit right shift.
        if (!this.gate1ST_CYC_DELAYD.value) {
            this.regPR2.decr(1);
        }

        if (nextState) {
            this.setProcState(nextState);
        }
    }

    /**************************************/
    stepE1FPShiftLeftNormalize() {
        /* Handles the E1 shift left state for op 01/02. Fetch digits in forward
        direction via PR1 (set from scan mode) and leave in DR for the E2 state.
        See ILD 10.00.82.1 */

        if (this.gate1ST_CYC.value) {
            this.gateSHIFT_ENTRY.value = 0;
        }

        this.regMAR.value = this.regPR1.value;
        this.fetch();
        this.setDREven(this.regMBR.odd);
        if (this.regMAR.isOdd) {        // MAR is odd
            this.regPR1.incr(1);
        } else {                        // MAR is even
            this.gate2_DIG_CNTRL.value = 1;
            this.setDROdd(this.regMBR.even);
            this.regPR1.incr(2);
        }

        this.setProcState(procStateE2);
    }

    /**************************************/
    stepE2FPShiftLeftNormalize() {
        /* Handles the E2 shift left state for op 01/02. Transfers digits from
        DR via PR2 until end of mantissa detected, then zero fills the rest of the
        original mantissa area. See ILD 10.00.84.1 */
        let digit = 0;
        let dx = this.regPR2.isEven;
        let nextState = 0;

        this.regMAR.value = this.regPR2.value;
        this.fetch();

        if (this.gateFIELD_MK_1.value) {
            // Do zero fill
            digit = this.regMBR.getDigit(dx);
            if (!(digit & Register.flagMask)) {
                digit = 0;
            } else {
                this.gateFIELD_MK_2.value = 1;
                this.enterFPExponentModify();
                if (this.gateSCAN_MINUS.value) {// detected flag in negative low-order digit
                    digit = Register.flagMask;
                } else {                        // detected flag in high-order exponent digit
                    return;
                }
            }

            this.regMIR.setDigit(dx, digit);
            this.store();
            this.regPR2.incr(1);
        } else {
            // Do mantissa transfer
            if (this.gate2_DIG_CNTRL.value) {
                this.gate2_DIG_CNTRL.value = 0;
                digit = this.getDROdd();
            } else {
                digit = this.shiftDREvenOdd();
                nextState = procStateE1;        // otherwise stay in E2
            }

            if (this.gate1ST_CYC_DELAYD.value) {
                digit |= Register.flagMask;     // set flag on H.O. digit
            } else {
                digit &= Register.notFlagMask;  // reset flag on all other digits
                if (this.gateFL_1.value) {
                    this.gateFIELD_MK_1.value = 1;
                    nextState = 0;              // stay in E2 for zero fill
                    if (this.gateHI_ORDER_ZERO.value && !this.gateSCAN_MINUS.value) {
                        this.gateEXTRA_SFT_CYC.value = 1;   // detected flag in exponent field
                    }
                }
            }

            if (!this.gateEXTRA_SFT_CYC.value) {
                this.regMIR.setDigit(dx, digit);
                this.store();
                this.regPR2.incr(1);
            }
        }

        if (nextState) {
            this.setProcState(nextState);
        }
    }

    /**************************************/
    stepE1FPExponentAdd(op) {
        /* Handles the E1 state for floating-point exponent add/sub/compare.
        Fetches digits via the OR1 register. Similar to the E1 state for ADD/
        SUB/C, but on first cycle clears CR1, PR1, PR2, and sets OR4 to the
        OR1 address. See ILD 10.00.90.1 */
        const compare = (op==1 || op==2);

        this.regMAR.value = this.regOR1.value;
        this.fetch();
        const dx = this.regMAR.isEven;
        const digit = this.regMBR.getDigit(dx);
        if (this.gateADD_ENT.value) {
            this.enterAdd();
            this.gateADD_ENT.value = 0;
        }

        if (this.gate1ST_CYC.value) {
            this.regCR1.clear();
            this.regPR1.clear();
            this.regPR2.clear();
            this.regOR4.value = this.regMAR.value;
            // If the low-order Q digit is flagged, reverse COMP, CARRY_IN
            if (digit & Register.flagMask) {
                this.gateCOMP.flip();
                this.gateCARRY_IN.value = this.gateCOMP.value;
            }
        }

        this.resetDROdd();
        this.setDREven(this.regMBR.even);
        if (dx) {                   // MAR is even
            this.regOR1.decr(1);
        } else {                    // MAR is odd
            this.gate2_DIG_CNTRL.value = 1;
            this.setDROdd(digit);
            this.regOR1.decr(this.gate1ST_CYC.value ? 2 : 1);
        }

        this.setProcState(procStateE2);
    }

    /**************************************/
    stepE2FPExponentAdd(op) {
        /* Handles the E2 state for FP Exponent add/subtract and compare. If not
        comparing, stores digits via the OR2 register. If comparing,
        accumulates the exponent difference in CR1. See ILD 10.0.80.1 */
        const compare = (op==1 || op==2);
        let nextState = 0;

        this.gateCARRY_OUT.value = 0;
        if (this.gate2_DIG_CNTRL.value) {
            this.gate2_DIG_CNTRL.value = 0;
        } else {
            this.shiftDREvenOdd();
            if (!this.gateRECOMP.value) {
                nextState = procStateE1;
            }
        }

        this.regMAR.value = this.regOR2.value;
        this.fetch();
        let dx = this.regMAR.isEven;
        let digit = this.regMBR.getDigit(dx);

        // Handle 1st cycle and non-1st cycle special actions.
        if (this.gate1ST_CYC_DELAYD.value) {
            // The following tests are conditioned on 1ST_CYC in the ILD, but we just
            // turned that off above when turning on 1ST_CYC_DELAYD, so sameo-sameo.
            if (this.gateCOMP.value) {
                this.gateCARRY_IN.value = 1;    // pre-set carry if subtract
            }

            if (this.gateRECOMP.value) {
                // Set up initial conditions for the RECOMP phase.
                this.gateCARRY_IN.value = 1;
                this.gateCOMP.value = 0;
                this.gateFIELD_MK_2.value = 0;
                this.gateP_COMP.value = 1;
                // We need to redo the E2 fetch and start with the low-order P digit.
                this.regOR2.value = this.regMAR.value = this.regOR3.value;
                dx = this.regMAR.isEven;
                this.fetch();
                digit = this.regMBR.getDigit(dx);
            } else {
                this.regOR5.value = this.regMAR.value;  // not in the ILD, but in Ref Card
                // If not RECOMP and the low-order P digit is flagged, reverse COMP, CARRY_IN, HP
                if (digit & Register.flagMask) {
                    this.gateCOMP.flip();
                    this.gateCARRY_IN.value = this.gateCOMP.value;
                    this.gateHP.flip();
                }
            }
        } else {
            // Detect end-of-field flags.
            if (this.gateFL_1.value) {
                this.gateFIELD_MK_1.value = 1;  // end of Q field
            }

            if (digit & Register.flagMask) {
                this.gateFIELD_MK_2.value = 1;  // end of P field
            }
        }

        // After the Q field mark, the addend digit is always zero.
        if (this.gateFIELD_MK_1.value) {
            this.resetDREven();
            this.setDREven(0);
            nextState = 0;                      // no more E1 cycles -- E2 only
        }

        // Check for Compare early exit: P or Q != 0.
        if (compare) {
            if (((digit | this.regDR.odd) & Register.bcdMask) && !this.gateCOMP.value) {
                this.gateEZ.value = 0;
            }
        }

        // Do the actual addition.
        digit = this.addDigits(digit);
        if (digit & Register.bcdMask) {
            this.gateEZ.value = 0;
        }

        // Propagate the carry and decrement the P address register
        this.gateCARRY_IN.value = this.gateCARRY_OUT.value;
        this.regOR2.decr(1);                    // update OR2 before chance of early exits

        // Store compare difference in low-order 2 digits of CR1; set PR1, PR2 to P fraction.
        if (this.gate1ST_CYC_DELAYD.value) {
            this.regCR1.setDigit(0, digit);
        } else {
            this.regCR1.setDigit(1, digit);
            this.regPR1.value = this.regOR2.value;
            this.regPR2.value = this.regOR2.value;
        }

        // If doing compare, set OR3 to mantissa address, else store the result digit.
        if (compare) {
            this.regOR3.value = this.regOR2.value;
        } else {
            if (this.gateFIELD_MK_2.value || (this.gate1ST_CYC_DELAYD.value && !this.gateHP.value)) {
                digit |= Register.flagMask;     // low-order P digit sign or high-order P digit flag
            }
            this.regMIR.setDigit(dx, digit);
            this.store();
        }

        // Check for end of P field and overflow; exit or start recomplement phase.
        if (this.gateFIELD_MK_2.value) {
            // Check for exponent overflow/underflow.
            if (!compare) {
                this.checkFPExponentOfloUflo(op);
            }

            // Check for initiation of RECOMP phase.
            if (this.gateCOMP.value && !this.gateCARRY_OUT.value) {
                this.gate1ST_CYC.value = 1;
                this.gateHP.flip();
                this.gateRECOMP.value = 1;
            }

            if (compare) {
                nextState = 0;
                if (this.gateCARRY_OUT.value && !this.gateCOMP.value) {
                    this.gateD_GTR_99.value = 1;
                } else if (this.gateCOMP.value && !this.gateCARRY_OUT.value) {
                    this.gateCOUNTER_COMP.value = 1;
                }

                if (this.gateEZ.value) {
                    this.enterFPFractionAdd();          // PE == QE, so proceed to add
                } else if (this.gateHP.value) {
                    this.gateSCAN_Q.value = 1;          // PE > QE, so scale Q value
                    this.enterFPScan();
                } else {
                    this.enterFPExponentTransmit();     // PE < QE, so scale P value
                }
            } else {
                // Check for end of add operation: COMP&CARRY | !COMP
                if (this.gateCOMP.value ? this.gateCARRY_OUT.value : 1) {
                    nextState = 0;                      // so as not to override enterICycle()
                    if (op == 3 /*FMUL*/) {
                        this.enterFPMultiply();
                    } else if (op == 9 /*FDIV*/) {
                        this.enterFPFractionCompare();
                    } else {
                        this.panic("Invalid exit from Exponent Add");
                    }
                }
            }
        }

        if (nextState) {                        // either do E1 or continue with E2 or terminate.
            this.setProcState(nextState);
        }
    }

    /**************************************/
    stepE1FPExponentModify(op) {
        /* Handles the E1 state for floating-point exponent modify.
        Does not access memory; instead loads DR with:
          - literal 01 if EXP_MOD_REQ is set and HI_ORDER_ZERO is not
          - low-order 2 digits of CR if HI_ORDER_ZERO is set.
        Otherwise, similar to the E1 state for ADD/SUB/C given that the augend
        is never considered to be negative. Note that since only two digits are
        involved and 2_DIG_CNTRL is set, there is only one E1 state, so
        effectively everything executes with 1ST_CYC set. See ILD 10.00.87.1 */

        if (this.gateADD_ENT.value) {
            this.enterAdd();
            this.gateADD_ENT.value = 0;
            this.gateEXP_MOD_ENTRY.value = 0;   // turn off after enterAdd()
        }

        this.gateFL_2.value = 1;
        this.gate2_DIG_CNTRL.value = 1;
        this.gateCARRY_OUT.value = 0;
        this.gateCARRY_IN.value = 0;    // not in ILD (at least not obviously)
        if (op == 9 /*FDIV*/) {
            this.gateCOMP.value = 0;
        }

        if (op != 3 /*FMUL*/) {
            this.regMAR.value = this.regCR1.value;
        } else {
            this.regMAR.value = this.regPR1.value;
            if (this.gateEXP_MOD_REQ.value) {
                this.regMAR.incr(1);
            }
            this.regOR1.value = this.regMAR.value;
        }

        if (this.gateHI_ORDER_ZERO.value || (op == 3 && this.gateEXP_MOD_REQ.value)) {
            if (this.gate1ST_CYC.value) {
                this.gateCOMP.flip();
            }
        }

        if (this.gateHI_ORDER_ZERO.value) {
            this.regDR.clear();
            this.regDR.setDigit(0, this.regMAR.getDigit(0));
            this.regDR.setDigit(1, this.regMAR.getDigit(1));
        } else {
            if (this.gateEXP_MOD_REQ.value) {
                this.regDR.value = 1;
            } else {
                this.regDR.value = 0;
            }
        }

        this.setProcState(procStateE2);
    }

    /**************************************/
    stepE2FPExponentModify(op) {
        /* Handles the E2 state for floating-point exponent modify.
        See ILD 10.0.87.1 */
        let nextState = 0;

        this.gateCARRY_OUT.value = 0;
        if (this.gate2_DIG_CNTRL.value) {
            this.gate2_DIG_CNTRL.value = 0;
        } else {
            this.shiftDREvenOdd();
            if (!this.gateRECOMP.value) {
                nextState = procStateE1;
            }
        }

        if (this.gate1ST_CYC_DELAYD.value) {
            this.regMAR.value = this.regOR5.value;
        } else {
            this.regMAR.value = this.regOR2.value;
        }

        this.fetch();
        let dx = this.regMAR.isEven;
        let digit = this.regMBR.getDigit(dx);

        // Handle 1st cycle and non-1st cycle special actions.
        if (this.gate1ST_CYC_DELAYD.value) {
            // The following tests are conditioned on 1ST_CYC in the ILD, but we just
            // turned that off above when turning on 1ST_CYC_DELAYD, so sameo-sameo.
            if (this.gateCOMP.value) {
                this.gateCARRY_IN.value = 1;    // pre-set carry if subtract
            }

            if (this.gateRECOMP.value) {
                // Set up initial conditions for the RECOMP phase.
                this.gateCARRY_IN.value = 1;
                this.gateCOMP.value = 0;
                this.gateFIELD_MK_2.value = 0;
                this.gateP_COMP.value = 1;
                // We need to redo the E2 fetch and start with the low-order P digit.
                this.regOR2.value = this.regMAR.value = this.regOR5.value;
                dx = this.regMAR.isEven;
                this.fetch();
                digit = this.regMBR.getDigit(dx);
            } else {
                // If not RECOMP and the low-order P digit is flagged, reverse COMP, CARRY_IN, HP
                if (digit & Register.flagMask) {
                    this.gateCOMP.flip();
                    this.gateCARRY_IN.value = this.gateCOMP.value;
                    this.gateHP.flip();
                }
            }
        } else {
            // Detect end-of-field flags.
            if (this.gateFL_1.value) {
                this.gateFIELD_MK_1.value = 1;  // end of Q field
            }

            if (digit & Register.flagMask) {
                this.gateFIELD_MK_2.value = 1;  // end of P field
            }
        }

        // After the Q field mark, the addend digit is always zero.
        if (this.gateFIELD_MK_1.value) {
            this.resetDREven();
            this.setDREven(0);
            nextState = 0;                      // no more E1 cycles -- E2 only
        }


        // Do the actual addition, do not turn off EZ.
        digit = this.addDigits(digit);

        // Store the result digit.
        if (this.gateFIELD_MK_2.value || (this.gate1ST_CYC_DELAYD.value && !this.gateHP.value)) {
            digit |= Register.flagMask;         // low-order P digit sign or high-order P digit flag
        }
        this.regMIR.setDigit(dx, digit);
        this.store();

        // Propagate the carry and decrement the P address register
        this.gateCARRY_IN.value = this.gateCARRY_OUT.value;
        this.regMAR.decr(1);

        this.regOR2.value = this.regMAR.value;
        if (this.gateNORM_SHIFT_RT.value) {
            this.regPR1.value = this.regMAR.value;
            this.regPR2.value = this.regMAR.value;
        }

        // Check for end of P field and overflow; exit or start recomplement phase.
        if (this.gateFIELD_MK_2.value) {
            // Check for exponent overflow/underflow.
            this.checkFPExponentOfloUflo(op);
            const expOfloCorrCond = this.gateEXP_OFLO_CORR.value && this.gateEXP_MODIFY.value && this.gateEXP_MOD_REQ.value;
            if (expOfloCorrCond) {
                this.gateEXP_OFLO.value = 0;
                this.gateEXP_UFLO.value = 0;
            }

            // Check for initiation of RECOMP phase.
            if (this.gateCOMP.value && !this.gateCARRY_OUT.value) {
                this.gate1ST_CYC.value = 1;
                this.gateHP.flip();
                if (!expOfloCorrCond) {
                    this.gateRECOMP.value = 1;
                }
            }

            // Check for end of add operation: COMP&CARRY | !COMP | (OFLO_CORR & EXP_MODIFY & EXP_MOD_REQ).
            if ((this.gateCOMP.value ? this.gateCARRY_OUT.value : 1) || expOfloCorrCond) {
                nextState = 0;                  // so as not to override enterICycle()
                this.gateHP.value = this.gateFP_HI_PLUS.value;
                if (this.gateEZ.value || this.gateEXP_OFLO.value || this.gateEXP_UFLO.value) {
                    this.enterFPDigitForce();
                    if (this.gateEZ.value && (op == 3 /*FMUL*/ || op == 9 /*FDIV*/)) {
                        this.gateEXP_UFLO.value = 0;    // implied by "F/MUL F/DIV EXIT ZERO" on ILD 10.00.93.1
                    }
                } else {
                    if (this.gateHI_ORDER_ZERO.value) {
                        this.enterICycle();     // exit to I-Cycle entry
                    } else if (op == 3 /*FMUL*/ || op == 9 /*FDIV*/) {
                        this.enterFPResultTransmit();
                    } else if (this.gateNORM_SHIFT_RT.value ){
                        this.enterFPShift();
                    } else {
                        this.panic("FPExponentModify invalid exit condition");
                    }
                }
            }
        }

        if (nextState) {                        // either do E1 or continue with E2 or terminate.
            this.setProcState(nextState);
        }
    }

    /**************************************/
    stepE1FPFractionAdd() {
        /* Handles the E1 state for the floating point fraction add/compare
        sub-operation. Similar to E1 state for regular ADD/SUB, reading digits
        via OR1, but for add/subtract takes the Q sign from the SCAN_MINUS gate
        instead of the low-order digit flag. When comparing, ignores both P and
        Q signs and considers only the absolute values of the mantissas.
        See ILD 10.00.85.1 */

        this.regMAR.value = this.regOR1.value;
        this.fetch();
        const dx = this.regMAR.isEven;
        const digit = this.regMBR.getDigit(dx);

        if (this.gateADD_ENT.value) {
            this.enterAdd();
            this.gateADD_ENT.value = 0;
            this.gateFRAC_ADD_ENTRY.value = 0;
            this.gateFRAC_COMPR_ENTRY.value = 0;
        }

        if (this.gate1ST_CYC.value) {
            if (this.gateADD_MODE.value && !this.gateRECOMP.value) {
                // If doing add instead of compare and Q is negative, reverse COMP, CARRY_IN
                if (this.gateFRAC_ADD_MODE.value) {
                    if (this.gateSCAN_Q.value ? this.gateSCAN_MINUS.value : (digit & Register.flagMask)) {
                        this.gateCOMP.flip();
                        this.gateCARRY_IN.value = this.gateCOMP.value;
                    }
                }
            }

            if (this.gateFRAC_COMPARE_MODE.value) {
                this.regOR4.value = this.regMAR.value;
            }
        }

        this.resetDROdd();
        this.setDREven(this.regMBR.even);
        if (dx) {                   // MAR is even
            this.regOR1.decr(1);
        } else {                    // MAR is odd
            this.gate2_DIG_CNTRL.value = 1;
            this.setDROdd(digit);
            this.regOR1.decr(2);
        }
        this.setProcState(procStateE2);
    }

    /**************************************/
    stepE2FPFractionAdd() {
        /* Handles the E2 state for the floating point fraction add/compare
        sub-operation. Similar to the E2 state for regular ADD/SUB, fetching
        and storing digits via OR2, but copies the updated OR2 to PR1 and PR2.
        Exits:
          - to I-Cycle Entry if no carry and the high-order digit is not zero,
          - to Digit Force if no carry and the result is zero,
          - to Normalize Left if no carry and the high-order digit is zero,
          - to Normalize Right and insert high-order 1 if there is a carry.
        See ILD 10.00.85.1 */
        const compare = this.gateFRAC_COMPARE_MODE.value;
        let nextState = 0;

        this.regMAR.value = this.regOR2.value;
        this.fetch();
        let dx = this.regOR2.isEven;
        let digit = this.regMBR.getDigit(dx);

        this.gateCARRY_OUT.value = 0;
        if (this.gate2_DIG_CNTRL.value) {
            this.gate2_DIG_CNTRL.value = 0;
        } else {
            this.shiftDREvenOdd();
            if (!this.gateRECOMP.value) {
                nextState = procStateE1;
            }
        }

        // Handle 1st cycle and non-1st cycle special actions.
        if (this.gate1ST_CYC_DELAYD.value) {
            // The following tests are conditioned on 1ST_CYC in the ILD, but we just
            // turned that off above when turning on 1ST_CYC_DELAYD, so sameo-sameo.
            if (this.gateCOMP.value) {
                this.gateCARRY_IN.value = 1;    // pre-set carry if subtract
            }

            if (this.gateRECOMP.value) {
                // Set up initial conditions for the RECOMP phase.
                this.gateCARRY_IN.value = 1;
                this.gateCOMP.value = 0;
                this.gateFIELD_MK_2.value = 0;
                this.gateP_COMP.value = 1;
                // We need to redo the E2 fetch and start with the low-order P digit.
                this.regOR2.value = this.regMAR.value = this.regOR3.value;
                dx = this.regMAR.isEven;
                this.fetch();
                digit = this.regMBR.getDigit(dx);
            } else {
                // If not RECOMP and the low-order P digit is flagged, reverse COMP, CARRY_IN, HP
                if ((digit & Register.flagMask) && !compare) {
                    this.gateCOMP.flip();
                    this.gateCARRY_IN.value = this.gateCOMP.value;
                    this.gateHP.flip();
                }
            }

            // If SCAN_Q is set, end-of-field can occur on first digit.
            if (this.gateFL_1.value && this.gateSCAN_Q.value && !compare) {
                this.gateFIELD_MK_1.value = 1;  // end of Q field
            }
        } else {
            // Detect Q end-of-field flags.
            if (this.gateFL_1.value) {
                this.gateFIELD_MK_1.value = 1;  // end of Q field
            }

            if (digit & Register.flagMask) {
                this.gateFIELD_MK_2.value = 1;  // end of P field
            }
        }

        // After the Q field mark, the addend digit is always zero.
        if (this.gateFIELD_MK_1.value) {
            this.resetDREven();
            this.setDREven(0);
            nextState = 0;                      // no more E1 cycles -- E2 only
        }

        // Check for Compare early exit: P or Q != 0.
        if (compare) {
            if (((digit | this.regDR.odd) & Register.bcdMask) && !this.gateCOMP.value) {
                this.gateEZ.value = 0;
            }
        }

        if (!compare) {
            this.regPR1.value = this.regMAR.value;
            this.regPR2.value = this.regMAR.value;
            this.gateCOUNTER_COMP.value = 0;
        }

        // Do the actual addition.
        digit = this.addDigits(digit);
        if (digit & Register.bcdMask) {
            this.gateEZ.value = 0;
        }

        // if not doing Compare, store the result digit.
        if (!compare) {
            if (this.gateFIELD_MK_2.value || (this.gate1ST_CYC_DELAYD.value && !this.gateHP.value)) {
                digit |= Register.flagMask;     // low-order P digit sign or high-order P digit flag
            }
            this.regMIR.setDigit(dx, digit);
            this.store();
        }

        // Propagate the carry and decrement the P address register
        this.gateCARRY_IN.value = this.gateCARRY_OUT.value;
        this.regOR2.decr(1);                    // update OR2 before chance of early exits

        // Check for end of P field and overflow; exit or start recomplement phase.
        if (this.gateFIELD_MK_2.value) {
            // Check for initiation of RECOMP phase.
            if (this.gateCOMP.value && !this.gateCARRY_OUT.value) {
                this.gateRECOMP.value = 1;
                this.gate1ST_CYC.value = 1;
                this.gateHP.flip();
            }

            // Check for end of add operation: COMP&CARRY | !COMP | Compare.
            if ((this.gateCOMP.value ? this.gateCARRY_OUT.value : 1) || compare) {
                nextState = 0;                  // so as not to override exit states
                if (compare) {
                    this.enterFPFalseTransmit();
                    if (this.gateCARRY_OUT.value) {
                        this.gateEXP_MOD_REQ.value = 1;
                    }
                } else {
                    if (this.gateCARRY_OUT.value && !this.gateCOMP.value) {
                        // Carry out of high-order digit sum occurred.
                        this.enterFPExponentModify();
                        this.gateNORM_SHIFT_RT.value = 1;
                        this.gateEXP_MOD_REQ.value = 1;
                        this.gateEZ.value = 0;
                    } else {
                        if (digit & Register.bcdMask) {
                            // High-order digit sum not zero, no carry -- finito.
                            this.enterICycle();
                        } else if (this.gateEZ.value) {
                            // High-order digit sum is zero, EZ set -- store FP zero in result.
                            this.enterFPDigitForce();
                        } else {
                            // High-order digit sum is zero, EZ not set -- normalize result.
                            this.gateHI_ORDER_ZERO.value = 1;
                            this.enterFPScan();
                        }
                    }
                }
            }
        }

        if (nextState) {                        // either do E1 or continue with E2 or terminate.
            this.setProcState(nextState);
        }
    }

    /**************************************/
    stepE2FPDigitForce() {
        /* Handles the E2 state for the floating-point digit force sub-operation.
        Stores zeroes and nines to set floating-point zero or infinity, based on
        the exponent over/underflow gates. No E1 states are performed.
        See ILD 10.0.88.1, but take that diagram with a large grain of salt */

        this.gateDIGIT_FORCE_ENTRY.value = 0;
        this.regMAR.value = this.regOR5.value;
        this.fetch();
        let dx = this.regMAR.isEven;

        if (!(this.regMQ.value & 0b0100)) {
            this.regMQ.incr(1);
        }

        let mq = this.regMQ.binaryValue;        // local copy of incremented value
        let digit = (mq < 3 || !(this.gateEXP_UFLO.value || this.gateEZ.value) ? 9 : 0);
        if (this.gateEXP_UFLO.value) {
            this.gateEZ.value = 1;
        }

        switch (mq) {
        case 1:                         // set exponent sign
            if (!this.gateEXP_OFLO.value) {
                digit |= Register.flagMask;
            }
            break;
        case 2:                         // set exponent field mark
            digit |= Register.flagMask;
            break;
        case 3:                         // set mantissa sign
            if (!(this.gateEZ.value || this.gateFP_HI_PLUS.value)) {
                digit |= Register.flagMask;
            }
            break;
        case 4:                         // set mantissa field mark & done
            if ((this.regMBR.getDigit(dx) & Register.flagMask)) {
                digit |= Register.flagMask;
                this.enterICycle();
            }
            break;
        default:                        // no way, no how
            this.panic("stepE2DigitForce impossible MQ value");
            break;
        }

        this.regMIR.setDigit(dx, digit);
        this.store();
        this.regOR5.decr(1);
    }

    /**************************************/
    stepE2Addition(compare, dx) {
        /* Handles the E2 state for Add, Subtract, and Compare. Caller does the
        MBR/MIR fetch via OR2 */
        let nextState = 0;
        let digit = this.regMBR.getDigit(dx);

        this.gateCARRY_OUT.value = 0;
        if (this.gate2_DIG_CNTRL.value) {
            this.gate2_DIG_CNTRL.value = 0;
        } else {
            this.shiftDREvenOdd();
            if (!this.gateRECOMP.value) {
                nextState = procStateE1;
            }
        }

        // Handle 1st cycle and non-1st cycle special actions.
        if (this.gate1ST_CYC_DELAYD.value) {
            // The following tests are conditioned on 1ST_CYC in the ILD, but we just
            // turned that off above when turning on 1ST_CYC_DELAYD, so sameo-sameo.
            if (this.gateCOMP.value) {
                this.gateCARRY_IN.value = 1;    // pre-set carry if subtract
            }

            if (this.gateRECOMP.value) {
                // Set up initial conditions for the RECOMP phase.
                this.gateCARRY_IN.value = 1;
                this.gateCOMP.value = 0;
                this.gateFIELD_MK_2.value = 0;
                this.gateP_COMP.value = 1;
                // We need to redo the E2 fetch and start with the low-order P digit.
                this.regOR2.value = this.regMAR.value = this.regOR3.value;
                dx = this.regMAR.isEven;
                this.fetch();
                digit = this.regMBR.getDigit(dx);
            } else {
                // If not RECOMP and the low-order P digit is flagged, reverse COMP, CARRY_IN, HP
                if (digit & Register.flagMask) {
                    this.gateCOMP.flip();
                    this.gateCARRY_IN.value = this.gateCOMP.value;
                    this.gateHP.flip();
                }
            }
        } else {
            // Detect end-of-field flags.
            if (this.gateFL_1.value) {
                this.gateFIELD_MK_1.value = 1;  // end of Q field
            }

            if (digit & Register.flagMask) {
                this.gateFIELD_MK_2.value = 1;  // end of P field
            }
        }

        // After the Q field mark, the addend digit is always zero.
        if (this.gateFIELD_MK_1.value) {
            this.resetDREven();
            this.setDREven(0);
            nextState = 0;                      // no more E1 cycles -- E2 only
        }

        // Check for Compare early exit: P or Q != 0.
        if (compare) {
            if (((digit | this.regDR.odd) & Register.bcdMask) && !this.gateCOMP.value) {
                this.gateEZ.value = 0;
                this.enterICycle();             // early exit to I-Cycle entry
                return;
            }
        }

        // Do the actual addition.
        digit = this.addDigits(digit);
        if (digit & Register.bcdMask) {
            this.gateEZ.value = 0;
        }

        // if not doing Compare, store the result digit.
        if (!compare) {
            if (this.gateFIELD_MK_2.value || (this.gate1ST_CYC_DELAYD.value && !this.gateHP.value)) {
                digit |= Register.flagMask;     // low-order P digit sign or high-order P digit flag
            }
            this.regMIR.setDigit(dx, digit);
            this.store();
        }

        // Propagate the carry and decrement the P address register
        this.gateCARRY_IN.value = this.gateCARRY_OUT.value;
        this.regOR2.decr(1);                    // update OR2 before chance of early exits

        // Check for end of P field and overflow; exit or start recomplement phase.
        if (this.gateFIELD_MK_2.value) {
            // Check for overflow.
            if (!this.gateFIELD_MK_1.value ||
                    (this.gateCARRY_OUT.value && !this.gateCOMP.value && !compare)) {
                this.setIndicator(14, `A/S/C Arithmetic overflow: op=${this.opBinary}, IR1=${this.opAddress.toString().padStart(5, "0")}`);
            }

            // Check for initiation of RECOMP phase.
            if (this.gateCOMP.value && !this.gateCARRY_OUT.value) {
                this.gateRECOMP.value = 1;
                this.gate1ST_CYC.value = 1;
                this.gateHP.flip();
            }

            // Check for end of add operation: COMP&CARRY | !COMP | Compare.
            if ((this.gateCOMP.value ? this.gateCARRY_OUT.value : 1) || compare) {
                this.enterICycle();             // exit to I-Cycle entry
                nextState = 0;                  // so as not to override enterICycle()
            }
        }

        if (nextState) {                        // either do E1 or continue with E2 or terminate.
            this.setProcState(nextState);
        }
    }

    /**************************************/
    stepE1Multiply() {
        /* Handles the E1 state for Multiply and Floating Multiply */

        // Fetch multiplier digit to MQ, determine multiplier sign.
        this.regMAR.value = this.regOR1.value;
        this.fetch();
        const digit = this.regMBR.getDigit(this.regMAR.isEven);

        this.gateMC_1.value = 0;                // reset carry propagation flags
        this.gateMC_2.value = 0;
        this.resetDROdd();
        this.setDREven(0);                      // per ILD, but not clear what should be set ??
        if (!this.gateEXP_MOD_ENTRY.value) {
            this.gate1ST_MPLY_CYCLE.value = 1;
            this.regMQ.value = digit;
            this.gateFIELD_MK_2.value = 0;
            if (digit & Register.flagMask) {
                if (this.gate1ST_CYC.value) {
                    this.gateHP.flip();             // multiplier sign from low-order digit
                } else {
                    this.gateFIELD_MK_1.value = 1;  // last multiplier digit
                }
            }
        }

        this.regOR1.decr(1);
        this.setProcState(procStateE3);
    }

    /**************************************/
    stepE2Multiply(op) {
        /* Handles the E2 state for Multiply */

        if (this.gate1ST_MPLY_CYCLE.value) {    // ILD has this as 1ST_CYC, but that can't be right
            if (op == 96 /*OTD*/) {
                this.regMAR.binaryValue = 99;   // reset product area addr on each OTD cycle
            } else {
                this.regMAR.value = this.regPR1.value;
                this.regPR1.decr(1);
            }
        } else {
            this.regMAR.value = this.regPR2.value;
        }

        this.fetch();
        let dx = this.regMAR.isEven;            // digit index
        let digit = this.regMBR.getDigit(dx);
        if (this.gate2_DIG_CNTRL.value) {       // first E-2 cycle
            this.regPR2.value = this.regMAR.value;
            this.regPR2.decr(1);                // next product digit
            this.gateCARRY_OUT.value = this.gateMC_2.value;
        } else {
            this.shiftDREvenOdd();              // second (and third) E-2 cycle
            this.setDREven(0);                      // addend will be zero on 3rd E-2 cycle...
        }

        this.gateCARRY_IN.value = this.gateCARRY_OUT.value;
        digit = this.addDigits(digit);
        if ((digit & Register.bcdMask) && !this.gateEXP_MODIFY.value) {
            this.gateEZ.value = 0;
        }

        if (!this.gateHP.value &&
                (this.gate1ST_CYC_DELAYD.value || (op == 96 /*OTD*/ && this.gate1ST_MPLY_CYCLE.value))) {
            digit |= Register.flagMask;         // set product sign in low-order digit
        }

        if (this.gate2_DIG_CNTRL.value) {       // first E-2 cycle
            if (op == 3 /*FMUL*/ &&
                    this.gateFIELD_MK_1.value && this.gateFIELD_MK_2.value &&
                    !this.gateCARRY_OUT.value && !this.gateMC_1.value &&
                    (this.regDR.even & Register.bcdMask) == 0) {
                this.gateEXP_MOD_REQ.value = 1;
                digit |= Register.flagMask;     // set product area field mark
            }
        } else {                                // non-first E-2 cycle
            // Propagate 2nd E-2 carry 2 cycles ahead.
            this.gateMC_2.value = this.gateMC_1.value;
            this.gateMC_1.value = this.gateCARRY_OUT.value;
            // Determine final digit status.
            if (this.gateFIELD_MK_2.value && this.gateFIELD_MK_1.value) {
                digit |= Register.flagMask; // set product area field mark
            }
        }

        this.regMIR.setDigit(dx, digit);
        this.store();

        // Now, figure out how to get outta here...
        this.gate1ST_MPLY_CYCLE.value = 0;
        if (this.gate2_DIG_CNTRL.value) {
            this.gate2_DIG_CNTRL.value = 0;     // stay in E-2 for 2nd cycle
        } else {
            if (this.gateFIELD_MK_2.value) {
                if (this.gateMC_2.value) {      // stay in E-2 for 3rd cycle to add final carry
                    this.gateCARRY_OUT.value = this.gateMC_2.value;
                } else if (this.gateFIELD_MK_1.value) {
                    if (op == 3 /*FMUL*/) {
                        this.enterFPExponentModify();
                    } else {
                        this.enterICycle();     // finito
                    }
                } else {
                    this.setProcState(procStateE1); // advance to next multiplier digit
                }
            } else if (this.regMQ.isZero && !this.gateFIELD_MK_1.value && op != 96 /*OTD*/) {
                this.setProcState(procStateE1); // zero multiplier - early exit to next multiplier digit
            } else {
                this.setProcState(procStateE3); // advance to next multiplicand digit
            }
        }
    }

    /**************************************/
    stepE1LoadDividend() {
        /* Handles the E1 state for Load Dividend */

        if (this.gateEXMIT_ENT.value) {
            this.enterTransmit();
        }

        this.regMAR.value = this.regOR1.value;
        this.fetch();
        this.setDREven(this.regMBR.even);
        if (this.regMAR.isEven) {   // MAR is even
            this.regOR1.decr(1);
        } else {                    // MAR is odd
            this.gate2_DIG_CNTRL.value = 1;
            this.setDROdd(this.regMBR.odd);
            this.regOR1.decr(2);
        }

        this.setProcState(procStateE2);
    }

    /**************************************/
    stepE2LoadDividend() {
        /* Handles the E2 state for Load Dividend */
        let digit = 0;
        let dx = 0;
        let nextState = 0;

        if (this.gateLAST_LD_CYC.value) {       // final LD/LDM cycle
            this.regMAR.value = this.regPR1.value;
            this.fetch();                       // fetch product area at 00099
            dx = this.regMAR.isEven;
            digit = this.regMBR.getDigit(dx);
            if (this.gateFIELD_MK_2.value) {
                if (this.gateDVD_SIGN.value) {  // set sign in quotient field
                    this.regMIR.setDigit(dx, digit | Register.flagMask);
                }

                if (this.gateLD.value) {
                    this.enterFPDivide();
                } else {
                    this.enterICycle();
                }
            }
            this.store();
        } else {                                // transfer P digit to product area
            this.regMAR.value = this.regOR2.value;
            this.fetch();
            if (this.gate2_DIG_CNTRL.value) {
                this.gate2_DIG_CNTRL.value = 0;
                digit = this.getDROdd();
            } else {
                digit = this.shiftDREvenOdd();
                nextState = procStateE1;
            }

            if (this.gate1ST_CYC_DELAYD.value) {// first P digit
                digit &= Register.notFlagMask;  // reset flag on low-order P digit
                if (this.gateFL_1.value) {
                    this.gateDVD_SIGN.value = 1;// save P-field sign for final cycle
                }
            } else if (this.gateFL_1.value) {   // last P digit, set up final cycle
                this.gateFIELD_MK_1.value = 1;
                this.gateLAST_LD_CYC.value = 1;
                this.gateEXMIT_MODE.value = 0;
                this.gateFIELD_MK_2.value = 1;
                nextState = 0;                  // stay in E2 for last load cycle - don't do another E1
            }

            dx = this.regMAR.isEven;
            this.regMIR.setDigit(dx, digit);
            this.store();
            this.regOR2.decr(1);

            if (nextState) {                    // do either E1 or continue with E2
                this.setProcState(nextState);
            }
        }
    }

    /**************************************/
    stepE1Divide(op) {
        /* Handles the E1 step for Divide. For DTO, it's not clear what should
        happen here. The ILD flowchart (10.00.17.1) says that during the add-
        correction cycles (!COMP), we should step using OR1 rather than PR1 to
        leave PR1 in place to advance to next power-of-8 table entry, but doesn't
        say how OR1 then gets reset to that next entry. So we don't do anything
        special for DTO here and step OR1 in E4 */

        if (this.gateADD_ENT.value) {           // not set initially
            this.gateADD_ENT.value = 0;
            this.gate1ST_CYC.value = 1;
            this.gateADD_MODE.value = 1;
            this.gateFIELD_MK_1.value = 0;
            this.gateFIELD_MK_2.value = 0;
            if (!this.gateCARRY_OUT.value) {
                this.gateCOMP.value = 0;
            }
        }

        if (this.gate1ST_CYC.value) {
            this.gateFDIV_ENTRY.value = 0;
            this.regMAR.value = (this.gateFDIV.value ? this.regOR4.value : this.regOR1.value);
        } else {
            this.regMAR.value = this.regPR1.value;
        }

        this.fetch();
        this.resetDROdd();
        this.setDREven(this.regMBR.even);
        if (this.regMAR.isEven) {
            this.regMAR.decr(1);
        } else {                                // MAR is odd
            this.gate2_DIG_CNTRL.value = 1;
            this.setDROdd(this.regMBR.odd);
            this.regMAR.decr(2);
        }

        this.regPR1.value = this.regMAR.value;
        this.setProcState(procStateE2);
    }

    /**************************************/
    stepE2Divide(op) {
        /* Handles the E2 state for Divide */
        let nextState = 0;

        if (this.gate1ST_CYC_DELAYD.value) {
            this.gateCARRY_IN.value = this.gateCOMP.value;  // preset carry on first cycle
            if (op == 97 /*DTO*/) {
                this.regMAR.binaryValue = 99;
                this.regPR2.value = this.regMAR.value;
            } else {
                this.regMAR.value = this.regOR3.value;  // reset the dividend digit address
                this.regOR2.value = this.regMAR.value;
            }
        } else if (op == 97 /*DTO*/) {
            this.regMAR.value = this.regPR2.value;
        } else {
            this.regMAR.value = this.regOR2.value;
        }

        this.fetch();                           // next dividend/remainder digit
        let dx = this.regMAR.isEven;
        let digit = this.regMBR.getDigit(dx);

        if (this.gate2_DIG_CNTRL.value) {
            this.gate2_DIG_CNTRL.value = 0;
        } else {
            this.shiftDREvenOdd();
            nextState = procStateE1;
        }

        digit = this.addDigits(digit);
        if (this.gateDVD_L_CYC.value || op == 97 /*DTO*/) {
            if (this.gate1ST_CYC_DELAYD.value) {
                digit |= this.regMBR.getDigit(dx) & Register.flagMask; // preserve remainder sign
            } else if (this.gateFL_1.value) {
                digit |= Register.flagMask;     // set remainder field mark
            }
        }

        this.gateCARRY_IN.value = this.gateCARRY_OUT.value;
        this.regMIR.setDigit(dx, digit);
        this.store();
        if (op == 97 /*DTO*/) {                 // update OR2/PR2 before chance of early exits
            this.regPR2.decr(1);
        } else {
            this.regOR2.decr(1);
        }

        if (this.gate1ST_CYC_DELAYD.value) {    // this was the first cycle of a divide cycle
            if (this.gateDVD_L_CYC.value && !this.gateCOMP.value) { // last divide cycle add mode
                if (this.gateFL_1.value) {
                    this.gateHP.flip();         // flip sign if divisor negative
                }
                if (this.regMBR.getDigit(dx) & Register.flagMask) {
                    this.gateHP.flip();         // flip sign if dividend negative
                }
            }
        } else if (this.gateFIELD_MK_1.value) { // this was the third E2 cycle (see below)
            this.gateFIELD_MK_2.value = 1;
            if (!this.gateCOMP.value && op == 97 /*DTO*/) { // was extra add-correction cycle for DTO
                nextState = procStateE3;
            } else {
                this.gateADD_ENT.value = 1;     // restart field processing in E1
                if (this.gateCARRY_OUT.value) { // result from this cycle is still positive, so...
                    if (this.regMQ.binaryValue < (op==97 /*DTO*/ ? 7 : 9)) {
                        this.regMQ.incr(1);     // increment quotient digit
                        nextState = procStateE1;// and do another subtraction cycle
                    } else {                    // exceeded max subtractions, set overflow and quit
                        this.regMQ.value = (op==97 /*DTO*/ ? 0x8 : 0xA); // MQ counted to binary 10 or 8 on overflow
                        this.setIndicator(14, `DIV Arithmetic overflow: op=${op}, IR1=${this.opAddress.toString().padStart(5, "0")}`);
                        nextState = 0;          // inhibit any other state change and exit
                        this.enterICycle();
                    }
                } else {                            // result from this cycle is negative, so...
                    nextState = procStateE1;        // start the add-correction cycle (COMP turned off in E1)
                }
            }
        } else if (this.gateFL_1.value) {       // at the end of the divisor field
            this.gateFIELD_MK_1.value = 1;
            if (this.gateCOMP.value || op == 97 /*DTO*/) { // we've been doing a third E2 cycle
                this.resetDREven();             // addend will be zero for next single E2 cycle
                this.setDREven(0);              // do one more E2 cycle to apply borrow/carry to next quotient digit
                nextState = 0;
            } else {                            // otherwise, this was an add-correction cycle
                this.gateFIELD_MK_2.value = 1;
                nextState = procStateE3;        // finish this quotient digit in E3
            }
        }

        if (nextState) {
            this.setProcState(nextState);
        }
    }

    /**************************************/
    stepE2ModifyIndex(op) {
        /* Handles the E2 state for Branch and Modify Index Register */
        let nextState = 0;

        this.gateCARRY_OUT.value = 0;
        if (this.gate1ST_CYC_DELAYD.value) {
            this.setIndexMAR();
            this.regPR2.value = this.regMAR.value;
        } else {
            this.regMAR.value = this.regPR2.value;
        }

        if (this.gate2_DIG_CNTRL.value) {
            this.gate2_DIG_CNTRL.value = 0;
        } else {
            this.shiftDREvenOdd();
            if (!this.gateRECOMP.value) {
                nextState = procStateE1;
            }
        }

        this.fetch();
        let dx = this.regMAR.isEven;
        let digit = this.regMBR.getDigit(dx);

        if (this.gate1ST_CYC_DELAYD.value) {
            // The following tests are conditioned on 1ST_CYC in the ILD, but we just
            // turned that off above when turning on 1ST_CYC_DELAYD, so sameo-sameo.
            if (this.gateCOMP.value) {
                this.gateCARRY_IN.value = 1;    // pre-set carry if subtract
            }

            if (this.gateRECOMP.value) {
                // Set up initial conditions for the RECOMP phase.
                this.gateCARRY_IN.value = 1;
                this.gateCOMP.value = 0;
                this.gateFIELD_MK_2.value = 0;
                this.gateP_COMP.value = 1;
                // We need to redo the E2 fetch and start with the low-order XR digit.
                this.setIndexMAR();
                this.regPR2.value = this.regMAR.value;
                dx = this.regMAR.isEven;
                this.fetch();
                digit = this.regMBR.getDigit(dx);
            } else {
                // If not RECOMP and the low-order XR digit is flagged, reverse COMP, CARRY_IN, HP
                if (digit & Register.flagMask) {
                    this.gateCOMP.flip();
                    this.gateCARRY_IN.value = this.gateCOMP.value;
                    this.gateHP.flip();
                }
            }
        } else {
            this.regMQ.incr(1);
            if (op == 62 || op == 64) {         // BXM or BCXM
                if (this.regMQ.value & 4) {     // imm Q field ignores field marks: strictly 5 digits
                    this.gateFIELD_MK_1.value = 1;  // end of immediate Q field
                }
            } else if (this.gateFL_1.value) {
                this.gateFIELD_MK_1.value = 1;  // end of Q field
            }

            if (digit & Register.flagMask) {
                this.gateFIELD_MK_2.value = 1;  // end of XR field
            }
        }

        if (this.gateFIELD_MK_1.value) {
            this.resetDREven();
            this.setDREven(0);                  // addend will be zero from here on...
            nextState = 0;                      // no more E1 cycles -- E2 only
        }

        digit = this.addDigits(digit);
        if (digit & Register.bcdMask) {
            this.gateEZ.value = 0;
            if (!this.gateRECOMP.value) {
                this.gateX_SIG_DIGIT.value = 1;   // result has a non-zero digit
            }
        }

        this.gateCARRY_IN.value = this.gateCARRY_OUT.value;
        this.regPR2.decr(1);                    // update PR2 before chance of early exits

        if (this.gateFIELD_MK_2.value || (this.gate1ST_CYC_DELAYD.value && !this.gateHP.value)) {
            digit |= Register.flagMask;         // low-order XR digit sign or high-order XR digit flag
        }
        this.regMIR.setDigit(dx, digit);
        this.store();

        if (this.gateFIELD_MK_2.value) {
            // Check for overflow.
            if (!this.gateFIELD_MK_1.value) {
                this.setIndicator(14, `A/S/C Arithmetic overflow: op=${op}, IR1=${this.opAddress.toString().padStart(5, "0")}`);
            }

            // Check for initiation of RECOMP phase.
            if (this.gateCOMP.value && !this.gateCARRY_OUT.value) {
                this.gateRECOMP.value = 1;
                this.gate1ST_CYC.value = 1;
                this.gateHP.flip();
            }

            // Check for end of add operation: COMP&CARRY | !COMP.
            if (this.gateCOMP.value ? this.gateCARRY_OUT.value : 1) {
                if (op == 61 || op == 62 ||     // BX or BXM
                        !(this.gateEZ.value ||
                            (this.gateCARRY_OUT.value && !this.gateCOMP.value) ||
                            (this.gateX_SIG_DIGIT.value && this.gateRECOMP.value))) {
                    this.gateBR_EXEC.value = 1;
                }

                this.enterICycle();             // exit to I-Cycle entry
                return;
            }
        }

        if (nextState) {                        // do either E1 or continue with E2
            this.setProcState(nextState);
        }
    }

    /**************************************/
    stepE2LoadStoreIndex(op) {
        /* Handles the E2 state for Branch and Load/Store Index Register */
        let digit = 0;
        let nextState = 0;

        if (op == 67 /*BSX*/) {
            this.regMAR.value = this.regOR1.value;
            this.regOR1.decr(1);
        } else {
            if (this.gate1ST_CYC_DELAYD.value) {
                this.setIndexMAR();
                this.regPR2.value = this.regMAR.value;
            } else {
                this.regMAR.value = this.regPR2.value;
            }
            this.regPR2.decr(1);
        }

        if (this.gate2_DIG_CNTRL.value) {
            this.gate2_DIG_CNTRL.value = 0;
            digit = this.getDROdd();
        } else {
            digit = this.shiftDREvenOdd();
            nextState = procStateE1;
        }

        this.fetch();
        let dx = this.regMAR.isEven;
        if (this.gate1ST_CYC_DELAYD.value) {                        // set sign flag
            this.regMIR.setDigit(dx, this.gateFL_1.value ? digit | Register.flagMask : digit);
        } else {
            this.regMQ.incr(1);
            if (this.regMQ.binaryValue & 4) {                       // check for 5 digits
                this.regMIR.setDigit(dx, digit | Register.flagMask);// set h.o. digit flag
            } else {
                this.regMIR.setDigitNoFlag(dx, digit);              // don't overwrite flags
            }
        }

        this.store();

        if (this.regMQ.binaryValue & 4) {                           // 5 digit address field
            this.gateFIELD_MK_1.value = 1;
            this.gateBR_EXEC.value = 1;
            this.enterICycle();
        } else if (nextState) {                                     // do either E1 or continue with E2
            this.setProcState(nextState);
        }
    }

    /**************************************/
    stepECycle1() {
        /* Executes E-Cycle 1 - processes data at the OR1 (Q) address */
        let digit = 0;
        let dx = this.regOR1.isEven;    // digit index: 0/1

        switch (this.opBinary) {
        case  1:        // FADD - Floating Add
        case  2:        // FSUB - Floating Subtract
        case  3:        // FMUL - Floating Multiply
        case  5:        // FSL - Floating Shift Left
        case  9:        // FDIV - Floating Divide
        case 18:        // LDM - Load Dividend Immediate
        case 19:        // DM - Divide Immediate
        case 28:        // LD - Load Dividend
        case 29:        // D - Divide
        case 67:        // BSX - Branch and Store Index Register
            break;              // fetch done later, below
        default:
            this.regMAR.value = this.regOR1.value;
            this.fetch();
            break;
        }

        switch (this.opBinary) {
        case  1:        // FADD - Floating Add
        case  2:        // FSUB - Floating Subtract
            if (this.gateEXP_ADD.value) {
                this.stepE1FPExponentAdd(this.opBinary);
            } else if (this.gateSCAN_MODE.value) {
                if (this.gateHI_ORDER_ZERO.value) {
                    this.stepE1FPScanZero();
                } else if (this.gateSCAN_Q.value) {
                    this.stepE1FPScanQ();
                } else {
                    this.stepE1FPScanP();
                }
            } else if (this.gateEXP_XMIT.value) {
                this.stepE1FPExponentTransmit();
            } else if (this.gateRESULT_XMIT.value) {
                this.stepE1FPResultTransmit(this.opBinary);
            } else if (this.gateSHIFT_MODE.value) {
                if (this.gateNORM_SHIFT_RT.value) {
                    this.stepE1FPShiftRightNormalize();
                } else if (this.gateHI_ORDER_ZERO.value) {
                    this.stepE1FPShiftLeftNormalize();
                } else {
                    this.stepE1FPShiftRightP();
                }
            } else if (this.gateFRAC_ADD_MODE.value) {
                this.stepE1FPFractionAdd();
            } else if (this.gateEXP_MODIFY.value) {
                this.stepE1FPExponentModify(this.opBinary);
            } else {
                this.panic("01/02=FADD/FSUB invalid E1 mode");
            }
            break;

        case  3:        // FMUL - Floating Multiply
            if (this.gateEXP_ADD.value) {
                this.stepE1FPExponentAdd(this.opBinary);
            } else if (this.gateFMUL_MODE.value) {
                this.stepE1Multiply();
            } else if (this.gateEXP_MODIFY.value) {
                this.stepE1FPExponentModify(this.opBinary);
            } else if (this.gateRESULT_XMIT.value) {
                this.stepE1FPResultTransmit(this.opBinary);
            } else {
                this.panic("03=FMUL invalid E1 mode");
            }
            break;

        case  5:        // FSL - Floating Shift Left
            if (this.gateSCAN_MODE.value) {
                this.stepE1FPScan05();
            } else if (this.gateSHIFT_MODE.value) {
                this.stepE1FPShift05();
            } else {
                this.panic("05=FSL invalid E1 mode");
            }
            this.setProcState(procStateE2);
            break;

        case  8:        // FSR - Floating Shift Right
            this.stepE1FPShift08(dx);
            break;

        case  9:        // FDIV - Floating Divide
            if (this.gateEXP_ADD.value) {
                this.stepE1FPExponentAdd(this.opBinary);
            } else if (this.gateFRAC_COMPARE_MODE.value) {
                this.stepE1FPFractionAdd();
            } else if (this.gateFALSE_XMIT.value) {
                this.stepE1FPFalseTransmit();
            } else if (this.gateLD.value) {
                this.stepE1LoadDividend();
            } else if (this.gateFDIV.value) {
                this.stepE1Divide(this.opBinary);
            } else if (this.gateEXP_MODIFY.value) {
                this.stepE1FPExponentModify(this.opBinary);
            } else if (this.gateRESULT_XMIT.value) {
                this.stepE1FPResultTransmit(this.opBinary);
            } else {
                this.panic("09=FDIV invalid E1 mode");
            }
            break;

        case  6:        // TFL - Transmit Floating
        case 15:        // TDM - Transmit Digit Immediate
        case 16:        // TFM - Transmit Field Immediate
        case 25:        // TD - Transmit Digit
        case 26:        // TF - Transmit Field
        case 65:        // BLX - Branch and Load Index Register
        case 66:        // BLXM - Branch and Load Index Register Immediate
        case 70:        // MA - Move Address
            if (this.gateEXMIT_ENT.value) {
                this.enterTransmit();
            }
            //--no break
        case  7:        // BTFL - Branch and Transmit Floating
        case  8:        // FSR - Floating Shift Right
        case 10:        // BTA - Branch and Transmit
        case 17:        // BTM - Branch and Transmit Immediate
        case 20:        // BTAM - Branch and Transmit Immediate
        case 27:        // BT - Branch and Transmit
            this.setDREven(this.regMBR.even);
            if (dx) {                   // MAR is even
                this.regOR1.decr(1);
            } else {                    // MAR is odd
                this.gate2_DIG_CNTRL.value = 1;
                this.setDROdd(this.regMBR.odd);
                this.regOR1.decr(2);
            }
            this.setProcState(procStateE2);
            break;

        case 11:        // AM - Add Immediate
        case 12:        // SM - Subtract Immediate
        case 14:        // CM - Compare Immediate
        case 21:        // A - Add
        case 22:        // S - Subtract
        case 24:        // C - Compare
        case 61:        // BX - Branch and Modify Index Register
        case 62:        // BXM - Branch and Modify Index Register Immediate
        case 63:        // BCX - Branch Conditionally and Modify Index Register
        case 64:        // BCXM - Branch Conditionally and Modify Index Register Immediate
            digit = this.regMBR.getDigit(dx);
            if (this.gateADD_ENT.value) {
                this.enterAdd();
                this.gateADD_ENT.value = 0;
            }

            if (this.gate1ST_CYC.value && this.gateADD_MODE.value && !this.gateRECOMP.value) {
                // If the low-order Q digit is flagged, reverse COMP, CARRY_IN
                if (digit & Register.flagMask) {
                    this.gateCOMP.flip();
                    this.gateCARRY_IN.value = this.gateCOMP.value;
                }
            }

            this.resetDROdd();
            this.setDREven(this.regMBR.even);
            if (dx) {                   // MAR is even
                this.regOR1.decr(1);
            } else {                    // MAR is odd
                this.gate2_DIG_CNTRL.value = 1;
                this.setDROdd(digit);
                this.regOR1.decr(2);
            }
            this.setProcState(procStateE2);
            break;

        case 13:        // MM - Multiply Immediate
        case 23:        // M - Multiply
        case 96:        // OTD - Octal to Decimal
            this.stepE1Multiply(dx);
            break;

        case 18:        // LDM - Load Dividend Immediate
        case 28:        // LD - Load Dividend
            this.stepE1LoadDividend();
            break;

        case 19:        // DM - Divide Immediate
        case 29:        // D - Divide
        case 97:        // DTO - Decimal to Octal
            this.stepE1Divide(this.opBinary);
            break;

        case 30:        // TRNM - Transmit Record No Record Mark
        case 31:        // TR - Transmit Record
            if (this.gateE_CYC_ENT.value) {
                this.enterTransmit();
            }

            this.setDREven(this.regMBR.odd);
            if (!dx) {                  // MAR is odd
                this.regOR1.incr(1);
            } else {                    // MAR is even
                this.gate2_DIG_CNTRL.value = 1;
                this.setDROdd(this.regMBR.even);
                this.regOR1.incr(2);
            }
            this.setProcState(procStateE2);
            break;

        case 43:        // BD - Branch on Digit (!= zero)
            if (this.regMBR.getDigit(dx) & Register.bcdMask) {
                this.gateBR_EXEC.value = 1;
            }
            this.enterICycle();
            break;

        case 44:        // BNF - Branch No Flag
            if (!(this.regMBR.getDigit(dx) & Register.flagMask)) {
                this.gateBR_EXEC.value = 1;
            }
            this.enterICycle();
            break;

        case 45:        // BNR - Branch No Record Mark
            if ((this.regMBR.getDigit(dx) & Envir.numRecMark) != Envir.numRecMark) {
                this.gateRM.value = 1;
                this.gateBR_EXEC.value = 1;
            }
            this.enterICycle();
            break;

        case 55:        // BNG - Branch No Group Mark
            if ((this.regMBR.getDigit(dx) & Register.bcdMask) != Envir.numGroupMark) {
                this.gateBR_EXEC.value = 1;
            }
            this.enterICycle();
            break;

        case 67:        // BSX - Branch and Store Index Register
            if (this.gateE_CYC_ENT.value) {
                this.enterTransmit();
            }

            if (this.gate1ST_CYC.value) {
                this.setIndexMAR();
                this.regPR2.value = this.regMAR.value;
            } else {
                this.regMAR.value = this.regPR2.value;
            }

            dx = this.regMAR.isEven;
            this.fetch();
            this.setDREven(this.regMBR.even);
            if (dx) {                   // MAR is even
                this.regPR2.decr(1);
            } else {                    // MAR is odd
                this.gate2_DIG_CNTRL.value = 1;
                this.setDROdd(this.regMBR.odd);
                this.regPR2.decr(2);
            }

            this.setProcState(procStateE2);
            break;

        case 71:        // MF - Move Flag
            digit = this.regMBR.getDigit(dx);
            if (digit & Register.flagMask) {
                this.gateFIELD_MK_1.value = 1;
                this.regMIR.setDigitFlag(dx, 0);
                this.store();
            }
            this.regOR1.decr(1);
            this.setProcState(procStateE2);
            break;

        case 72:        // TNS - Tranmit Numeric Strip
            digit = this.regMBR.getDigit(dx);
            if ((digit & Register.flagMask) && !this.gate1ST_CYC_DELAYD.value) {
                this.gateFIELD_MK_1.value = 1;
                this.regMIR.setDigit(dx, this.regDR.odd | Register.flagMask);
                this.enterICycle();
            } else {
                this.regMIR.setDigit(dx, this.getDROdd());
                this.setProcState(procStateE2);
            }

            this.gate1ST_CYC.value = 0;
            this.store();
            this.regOR1.decr(1);
            break;

        case 73:        // TNF - Transmit Numeric Fill
            digit = this.regMBR.getDigit(dx);
            this.setDROdd(digit);
            if (this.gate1ST_CYC.value) {
                this.gateFIELD_MK_1.value = 0;
                if (digit & Register.flagMask) {
                    this.gateFIELD_MK_2.value = 1;
                }
            } else {
                this.gateFIELD_MK_2.value = 0;
                if (digit & Register.flagMask) {
                    this.gateFIELD_MK_1.value = 1;
                }
            }

            this.regOR1.decr(1);
            this.setProcState(procStateE2);
            break;

        case 90:        // BBT - Branch on Bit
            digit = this.regMBR.getDigit(dx);
            if (this.getDREven() & digit & Register.notParityMask) {
                this.gateBR_EXEC.value = 1;
            }
            this.enterICycle();
            break;

        case 91:        // BMK - Branch on Mask
            digit = this.regMBR.getDigit(dx);
            if ((this.getDREven() & Register.bcdMask) == (digit & Register.bcdMask) &&
                    (!this.gateFL_2.value || (digit & Register.flagMask))) {
                this.gateBR_EXEC.value = 1;
            }
            this.enterICycle();
            break;

        case 92:        // ORF - OR to Field
        case 93:        // ANDF - AND to Field
        case 94:        // CPLF - Complement to Octal Field
        case 95:        // EORF - Exclusive OR to Field
            digit = this.regMBR.getDigit(dx);
            this.setDREven(digit);
            this.setDROdd(0);
            if (digit & Register.flagMask) {
                this.gateFIELD_MK_1.value = 1;
            }

            this.regOR1.decr(1);
            this.setProcState(procStateE2);
            break;

        default:
            this.panic(`E-1 op not implemented ${this.opBinary}`);
            break;
        }

        this.gateE_CYC_ENT.value = 0;
    }

    /**************************************/
    async stepECycle2() {
        /* Executes E-Cycle 2 - processes data at the OR2 (P) address */
        let digit = 0;
        let dx = this.regOR2.isEven;    // digit index: 0/1
        let nextState = 0;
        const op = this.opBinary;

        switch (op) {
        case  1:        // FADD - Floating Add
        case  2:        // FSUB - Floating Subtract
        case  3:        // FMUL - Floating Multiply
        case  5:        // FSL - Floating Shift Left
        case  9:        // FDIV - Floating Divide
        case 13:        // MM - Multiply Immediate
        case 18:        // LDM - Load Dividend Immediate
        case 19:        // DM - Divide Immediate
        case 23:        // M - Multiply
        case 28:        // LD - Load Dividend
        case 29:        // D - Divide
        case 61:        // BX - Branch and Modify Index Register
        case 62:        // BXM - Branch and Modify Index Register Immediate
        case 63:        // BCX - Branch Conditionally and Modify Index Register
        case 64:        // BCXM - Branch Conditionally and Modify Index Register Immediate
        case 65:        // BLX - Branch and Load Index Register
        case 66:        // BLXM - Branch and Load Index Register Immediate
        case 67:        // BSX - Branch and Store Index Register
        case 96:        // OTD - Octal to Decimal
        case 97:        // DTO - Decimal to Octal
            break;              // fetch done later, below
        default:
            this.regMAR.value = this.regOR2.value;
            this.fetch();
            break;
        }

        if (this.gate1ST_CYC.value) {
            this.gate1ST_CYC.value = 0;
            this.gate1ST_CYC_DELAYD.value = 1;
        } else if (this.gate1ST_CYC_DELAYD.value) {
            this.gate1ST_CYC_DELAYD.value = 0;
        }

        switch (op) {
        case  1:        // FADD - Floating Add
        case  2:        // FSUB - Floating Subtract
            if (this.gateEXP_ADD.value) {
                this.stepE2FPExponentAdd(op);
            } else if (this.gateSCAN_MODE.value) {
                if (this.gateHI_ORDER_ZERO.value) {
                    this.stepE2FPScanZero();
                } else if (this.gateSCAN_Q.value) {
                    this.stepE2FPScanQ();
                } else {
                    this.stepE2FPScanP();
                }
            } else if (this.gateEXP_XMIT.value) {
                this.stepE2FPExponentTransmit();
            } else if (this.gateRESULT_XMIT.value) {
                this.stepE2FPResultTransmit(op);
            } else if (this.gateSHIFT_MODE.value) {
                if (this.gateNORM_SHIFT_RT.value) {
                    this.stepE2FPShiftRightNormalize();
                } else if (this.gateHI_ORDER_ZERO.value) {
                    this.stepE2FPShiftLeftNormalize();
                } else {
                    this.stepE2FPShiftRightP();
                }
            } else if (this.gateFRAC_ADD_MODE.value) {
                this.stepE2FPFractionAdd();
            } else if (this.gateEXP_MODIFY.value) {
                this.stepE2FPExponentModify(op);
            } else if (this.gateDIG_FORCE_MODE.value) {
                this.stepE2FPDigitForce();
            } else {
                this.panic("01/02=FADD/FSUB invalid E2 mode");
            }
            break;

        case  3:        // FMUL - Floating Multiply
            if (this.gateEXP_ADD.value) {
                this.stepE2FPExponentAdd(op);
            } else if (this.gateFMUL_MODE.value) {
                this.stepE2Multiply(op);
            } else if (this.gateEXP_MODIFY.value) {
                this.stepE2FPExponentModify(op);
            } else if (this.gateRESULT_XMIT.value) {
                this.stepE2FPResultTransmit(op);
            } else if (this.gateDIG_FORCE_MODE.value) {
                this.stepE2FPDigitForce();
            } else {
                this.panic("03=FMUL invalid E2 mode");
            }
            break;

        case  5:        // FSL - Floating Shift Left
            if (this.gateSCAN_MODE.value) {
                this.stepE2FPScan05();
            } else if (this.gateSHIFT_MODE.value) {
                this.stepE2FPShift05();
            } else {
                this.panic("05=FSL invalid E2 mode");
            }
            break;

        case  8:        // FSR - Floating Shift Right
            this.stepE2FPShift08(dx);
            break;

        case  9:        // FDIV - Floating Divide
            if (this.gateEXP_ADD.value) {
                this.stepE2FPExponentAdd(op);
            } else if (this.gateFRAC_COMPARE_MODE.value) {
                this.stepE2FPFractionAdd();
            } else if (this.gateFALSE_XMIT.value) {
                this.stepE2FPFalseTransmit();
            } else if (this.gateLD.value) {
                this.stepE2LoadDividend();
            } else if (this.gateFDIV.value) {
                this.stepE2Divide();
            } else if (this.gateEXP_MODIFY.value) {
                this.stepE2FPExponentModify(op);
            } else if (this.gateRESULT_XMIT.value) {
                this.stepE2FPResultTransmit(op);
            } else if (this.gateDIG_FORCE_MODE.value) {
                this.stepE2FPDigitForce();
            } else {
                this.panic("09=FDIV invalid E2 mode");
            }
            break;

        case 15:        // TDM - Transmit Digit Immediate
        case 25:        // TD - Transmit Digit
            if (this.gate2_DIG_CNTRL.value) {
                digit = this.getDROdd();
            } else {
                digit = this.shiftDREvenOdd();
            }

            this.regMIR.setDigit(dx, digit);
            this.store();
            this.regOR2.decr(1);
            this.enterICycle();
            break;

        case  7:        // BTFL - Branch and Transmit Floating
        case 10:        // BTA - Branch and Transmit
        case 17:        // BTM - Branch and Transmit Immediate
        case 20:        // BTAM - Branch and Transmit Immediate
        case 27:        // BT - Branch and Transmit
            if (!this.gateEXMIT_MODE.value) {   // first BT E-cycle only
                this.regIR1.value = this.regOR2.value;  // branch address
                this.regOR2.decr(1);                    // starting xmit dest address
                this.enterTransmit();
                this.setProcState(procStateE1);
                break;  // out of switch -- NOTE this only occurs for first cycle
            }
            //--no break
        case  6:        // TFL - Transmit Floating
        case 16:        // TFM - Transmit Field Immediate
        case 26:        // TF - Transmit Field
            if (this.gate2_DIG_CNTRL.value) {
                this.gate2_DIG_CNTRL.value = 0;
                digit = this.getDROdd();
            } else {
                digit = this.shiftDREvenOdd();
                nextState = procStateE1;
            }

            this.regMIR.setDigit(dx, digit);
            this.store();
            this.regOR2.decr(1);

            if (((op == 6 || op == 7) && this.regMQ.binaryValue < 3) ||         // TFL or BTFL: 3+ digit FP field
                    ((op == 10 || op == 20) && this.regMQ.binaryValue < 4)) {   // BTA or BTAM: 5+ digit address field
                this.regMQ.incr(1);
                if (nextState) {
                    this.setProcState(nextState);
                }
            } else if (this.gateFL_1.value && !this.gate1ST_CYC_DELAYD.value) {
                this.gateFIELD_MK_1.value = 1;
                this.enterICycle();
            } else if (nextState) {     // do either E1 or continue with E2
                this.setProcState(nextState);
            }
            break;

        case 11:        // AM - Add Immediate
        case 12:        // SM - Subtract Immediate
        case 21:        // A - Add
        case 22:        // S - Subtract
            this.stepE2Addition(false, dx);
            break;

        case 14:        // CM - Compare Immediate
        case 24:        // C - Compare
            this.stepE2Addition(true, dx);
            break;

        case 13:        // MM - Multiply Immediate
        case 23:        // M - Multiply
        case 96:        // OTD - Octal to Decimal
            this.stepE2Multiply(op);
            break;

        case 18:        // LDM - Load Dividend Immediate
        case 28:        // LD - Load Dividend
            this.stepE2LoadDividend();
            break;

        case 19:        // DM - Divide Immediate
        case 29:        // D - Divide
        case 97:        // DTO - Decimal to Octal
            this.stepE2Divide(op);
            break;

        case 30:        // TRNM - Transmit Record No Record Mark
        case 31:        // TR - Transmit Record
            if (this.gate2_DIG_CNTRL.value) {
                this.gate2_DIG_CNTRL.value = 0;
                digit = this.getDROdd();
            } else {
                digit = this.shiftDREvenOdd();
                nextState = procStateE1;
            }

            if ((digit & Envir.numRecMark) == Envir.numRecMark) {
                this.gateRM.value = 1;
                if (op == 31) {         // only store the RM if it's TR
                    this.regMIR.setDigit(dx, digit);
                    this.store();
                    this.regOR2.incr(1);
                }
                this.enterICycle();
            } else {
                this.regMIR.setDigit(dx, digit);
                this.store();
                this.regOR2.incr(1);
                if (nextState) {        // do either E1 or continue with E2
                    this.setProcState(nextState);
                }
            }
            break;

        case 32:        // SF - Set Flag
            this.regMIR.setDigitFlag(dx, 1);
            this.store();
            this.enterICycle();
            break;

        case 33:        // CF - Clear Flag
            this.regMIR.setDigitFlag(dx, 0);
            this.store();
            this.enterICycle();
            break;

        case 35:        // DN - Dump Numerically
            this.regOR2.incr(1);
            await this.dumpNumerically(this.regMBR.getDigit(dx));
            break;

        //case 36:      // RN - Read Numerically (runs in Limbo)
        //case 37:      // RA - Read Alphanumerically (runs in Limbo)

        case 38:        // WN - Write Numerically
            this.regOR2.incr(1);
            await this.writeNumerically(this.regMBR.getDigit(dx));
            break;

        case 39:        // WA - Write Alphanumerically
            this.regOR2.incr(2);
            if (this.regMAR.isOdd) {
                await this.writeAlphanumerically(this.regMBR.value);
            } else {
                // Simulate the problem with even starting addresses. The output
                // translator was sensitive to whether it was dealing with zone
                // or numeric digits, so an even address could cause translation
                // and parity errors. This approach just sets MBR Check Pending
                // and sets the check indicator in ioExit.
                await this.writeAlphanumerically(
                        ((this.regMBR.odd << Register.digitBits) | 8) | this.regMBR.even);
                if (!this.ioMBRCheckPending) {
                    this.ioMBRCheckPending = true;
                    this.parityMBREvenCheck.value = 1;
                }
            }
            break;

        case 61:        // BX - Branch and Modify Index Register
        case 62:        // BXM - Branch and Modify Index Register Immediate
        case 63:        // BCX - Branch Conditionally and Modify Index Register
        case 64:        // BCXM - Branch Conditionally and Modify Index Register Immediate
            this.stepE2ModifyIndex(op);
            break;

        case 65:        // BLX - Branch and Load Index Register
        case 66:        // BLXM - Branch and Load Index Register Immediate
        case 67:        // BSX - Branch and Store Index Register
            this.stepE2LoadStoreIndex(op);
            break;

        case 70:        // MA - Move Address
            if (this.gate2_DIG_CNTRL.value) {
                this.gate2_DIG_CNTRL.value = 0;
                digit = this.getDROdd();
            } else {
                digit = this.shiftDREvenOdd();
                nextState = procStateE1;
            }

            this.regMIR.setDigitNoFlag(dx, digit);
            this.store();
            this.regOR2.decr(1);

            if (this.regMQ.binaryValue < 4) {   // 5 digit address field
                this.regMQ.incr(1);
                if (nextState) {                // do either E1 or continue with E2
                    this.setProcState(nextState);
                }
            } else {
                this.gateFIELD_MK_1.value = 1;
                this.enterICycle();
            }
            break;

        case 71:        // MF - Move Flag
            if (this.regMBR.getDigitFlag(dx) ^ this.gateFIELD_MK_1.value) {
                this.regMIR.setDigitFlag(dx, this.gateFIELD_MK_1.value);
                this.store();
            }
            this.regOR2.decr(1);
            this.enterICycle();
            break;

        case 72:        // TNS - Transmit Numeric Strip
            // Note that if MAR is even (a no-no for this instruction), the
            // digits will be reversed -- zone will be taken from the even
            // address and numeric will be taken from the odd address.
            digit = this.regMBR.even & Register.bcdMask;
            this.setDROdd(this.regMBR.odd);

            if (this.gate1ST_CYC_DELAYD.value) { // special sign logic for TNS
                if (digit == 5 || digit == 1 || (digit == 2 &&
                        (this.regDR.odd & Register.bcdMask) == 0)) {
                    this.gateFL_1.value = 1;
                }
            }

            this.regOR2.decr(2);
            this.setProcState(procStateE1);
            break;

        case 73:        // TNF - Transmit Numeric Fill
            // Note that if MAR is even (a no-no for this instruction), the
            // digits will be reversed -- zone will be in the even address and
            // numeric will be in the odd address.
            this.regMIR.even = (this.gateFIELD_MK_2.value ? 5 : 7);
            this.regMIR.odd = this.regDR.odd;

            this.store();
            this.regOR2.decr(2);
            if (this.gateFIELD_MK_1.value) {
                this.enterICycle();
            } else {
                this.setProcState(procStateE1);
            }
            break;

        case 92:        // ORF - OR to Field
        case 93:        // ANDF - AND to Field
        case 94:        // CPLF - Complement to Octal Field
        case 95:        // EORF - Exclusive OR to Field
            digit = this.regMBR.getDigit(dx);
            switch (op) {
            case 92:                    // ORF - OR to Field
                digit = (digit | this.shiftDREvenOdd()) & 0x07;
                this.regMIR.setDigitNoFlag(dx, digit);
                break;
            case 93:                    // ANDF - AND to Field
                digit = (digit & this.shiftDREvenOdd()) & 0x07;
                this.regMIR.setDigitNoFlag(dx, digit);
                break;
            case 94:                    // CPLF - Complement to Octal Field
                digit = (~this.shiftDREvenOdd()) & 0x07;
                if (this.gateFIELD_MK_1.value) {
                    digit |= Register.flagMask;
                }
                this.regMIR.setDigit(dx, digit);
                break;
            case 95:                    // EORF - Exclusive OR to Field
                digit = (digit ^ this.shiftDREvenOdd()) & 0x07;
                this.regMIR.setDigitNoFlag(dx, digit);
                break;
            }

            if (digit & Register.bcdMask) {
                this.gateEZ.value = 0;
            }

            this.store();
            this.regOR2.decr(1);
            if (this.gateFIELD_MK_1.value) {
                this.enterICycle();
            } else {
                this.setProcState(procStateE1);
            }
            break;

        default:
            this.panic(`E-2 op not implemented ${op}`);
            break;
        }
    }

    /**************************************/
    stepECycle3() {
        /* Executes E-Cycle 3 */
        let digit = 0;
        let dx = 0;                     // digit index: 0/1
        const op = this.opBinary;

        switch (op) {
        case  3:        // FMUL - Floating Multiply
        case 13:        // MM - Multiply Immediate
        case 23:        // M - Multiply
        case 96:        // OTD - Octal to Decimal
            // Fetch Multiplicand digit to DR-odd, determine multiplicand sign.
            if (this.gate1ST_MPLY_CYCLE.value) {
                this.regMAR.value = this.regOR2.value;
            } else {
                this.regMAR.value = this.regOR3.value;
            }

            this.fetch();
            dx = this.regMAR.isEven;
            digit = this.regMBR.getDigit(dx);
            if (digit & Register.flagMask) {
                if (this.gate1ST_CYC.value) {
                    this.gateHP.flip();                 // multiplicand sign from low-order digit
                }
                if (!this.gate1ST_MPLY_CYCLE.value) {
                    this.gateFIELD_MK_2.value = 1;      // last multiplicand digit
                }
            }

            this.resetDREven();
            this.setDROdd(digit);
            this.regMAR.decr(1);
            this.regOR3.value = this.regMAR.value;
            if (op == 96 /*OTD*/) {
                this.regOR2.value = this.regMAR.value;
            }
            this.setProcState(procStateE4);
            break;

        case  9:        // FDIV - Floating Divide
        case 19:        // DM - Divide Immediate
        case 29:        // D - Divide
        case 97:        // DTO - Decimal to Octal
            this.regMAR.value = this.regOR2.value;
            this.fetch();
            if (this.gateFDIV.value) {
                this.regOR1.value = this.regMAR.value;
            }

            this.gateADD_MODE.value = 0;
            digit = this.regMQ.value;                   // get quotient digit value
            if (digit & Register.bcdMask) {             // check for non-zero
                this.gateEZ.value = 0;
            }

            if (this.gateDIV_1_CYC.value) {
                digit |= Register.flagMask;             // set quotient field mark
            }

            this.setProcState(procStateE4);
            if (this.gateDVD_L_CYC.value) {
                if (!this.gateHP.value) {
                    digit |= Register.flagMask;         // set quotient sign
                }

                if (!this.gateFDIV.value) {
                    this.enterICycle();                 // last digit -- we're done
                }
            }

            this.regMIR.setDigit(this.regMAR.isEven, digit);
            this.store();                               // store quotient digit in product area
            if (op == 97 /*DTO*/) {
                this.gate1ST_CYC.value = 1;
                this.regOR2.incr(1);
            }
            break;

        default:
            this.panic(`E-3 op not implemented ${op}`);
            break;
        }
    }

    /**************************************/
    stepECycle4() {
        /* Executes E-Cycle 4 */
        let q2 = 0;                     // multiply table address term
        const op = this.opBinary;

        switch (op) {
        case  3:        // FMUL - Floating Multiply
        case 13:        // MM - Multiply Immediate
        case 23:        // M - Multiply
        case 96:        // OTD - Octal to Decimal
            // Fetch product digits based on multiplier (MQ) and multiplicand (DR-odd).
            // The table address caculation is adapted from Dave Babcock's CHM 1620 Jr. emulator.
            this.gate2_DIG_CNTRL.value = 1;
            q2 = (this.regMQ.value & Register.bcdMask)*2 + 10;
            this.regMAR.binaryValue =
                    (q2 - q2%10 +                               // hundreds digit
                    (this.regDR.odd & Register.bcdMask))*10 +   // tens digit
                    q2%10;                                      // units digit
            this.fetch();
            this.setDREven(this.regMBR.odd);    // product tens digit
            this.setDROdd(this.regMBR.even);    // product units digit
            this.setProcState(procStateE2);
            break;

        case  9:        // FDIV - Floating Divide
        case 19:        // DM - Divide Immediate
        case 29:        // D - Divide
            this.regMQ.clear();                     // zero the quotient digit counter
            this.gateADD_ENT.value = 1;             // initialize fields on next cycle
            this.gateCOMP.value = 1;                // stop adding and enable subtract cycles again
            this.gateDIV_1_CYC.value = 0;           // not the first division cycle anymore
            this.regMAR.value = this.regOR3.value;
            if ((this.regMAR.value & 0b001111_000000_000000_001111_001111) == 0b001001_001000) { // MAR == 0XX98
                this.gateDVD_L_CYC.value = 1;       // next cycle is the last one
            }

            if (this.gateDVD_L_CYC.value) {
                if (this.gateFDIV.value &&
                        (this.regMAR.value & 0b001111_000000_000000_001111_001111) == 0b001001_001001) { // MAR == 0XX99
                    this.enterFPExponentModify();
                    if (this.gateEZ.value) {
                        // turn off O'FLO ??
                        this.gateEXP_MOD_REQ.value = 0;
                    }
                }
            }

            this.regOR3.incr(1);                    // step to next dividend digit
            this.setProcState(procStateE1);
            break;

        case 97:        // DTO - Decimal to Octal
            /* It's not clear exactly how this should work. The ILD flowchart
            (10.00.17.1) says that during the DTO add-correction cycles (!COMP),
            we should step using OR1 rather than PR1 and leave PR1 at the
            original value of OR1 to advance PR1 to next power-of-8 table entry
            in E4, but doesn't say how OR1 then gets reset to that next entry.
            Advancing OR1 is the only thing that makes sense, so we take the
            liberty here of not using PR1 and simply advancing OR1, even though
            that's not mentioned at all for E4 in ILD 10.01.02.1.
             */

            this.regMQ.clear();
            this.regMAR.value = this.regOR1.value;  // current entry low-order digit
            this.fetch();
            if (this.gate1ST_CYC.value) {   // skip over this field FM
                this.gate1ST_CYC.value = 0;
                this.regMAR.incr(2);
            } else {                        // search for following field FM or terminating RM/GM
                const digit = this.regMBR.getDigit(this.regMAR.isEven);
                const rmgmLatch = (digit & Envir.numRecMark) == Envir.numRecMark;
                if (rmgmLatch) {            // it's a Record Mark-like character
                    this.gateRM.value = 1;
                    this.gateDVD_L_CYC.value = 1;
                }

                if (!((digit & Register.flagMask) || rmgmLatch)) {
                    this.regMAR.incr(1);
                } else {                    // found start of next divisor field
                    this.gateADD_ENT.value = 1;
                    this.gateCOMP.value = 1;
                    this.gateDIV_1_CYC.value = 0;       // not the first division cycle anymore
                    this.regMAR.decr(1);
                    this.setProcState(procStateE1);
                }
            }

            this.regOR1.value = this.regMAR.value;
            break;

        default:
            this.panic(`E-4 op not implemented ${op}`);
            break;
        }
    }

    /**************************************/
    stepECycle5() {
        /* Executes E-Cycle 5 */

        switch (this.opBinary) {
        case  3:        // FMUL - Floating Multiply
        case  9:        // FDIV - Floating Divide
        case 13:        // MM - Multiply Immediate
        case 18:        // LDM - Load Dividend Immediate
        case 23:        // M - Multiply
        case 28:        // LD - Load Dividend
        case 96:        // OTD - Octal to Decimal
            // Clear the product area, 00081-00099
            if (this.gate1ST_CYC.value) {
                this.gate1ST_CYC.value = 0;
                this.gateFMUL_ENTRY.value = 0;
                this.gateLD_ENTRY.value = 0;
                this.regPR1.clear();
                this.regMAR.binaryValue = 81;
            } else {
                this.regMAR.value = this.regPR1.value;
            }

            this.regMIR.clear();
            this.store();
            if (this.regMAR.binaryValue == 99) {
                this.gate1ST_CYC.value = 1;
                this.setProcState(procStateE1);
            } else {
                this.regMAR.incr(2);
                this.regPR1.value = this.regMAR.value;
            }
            break;

        default:
            this.panic(`E-5 op not implemented ${this.opBinary}`);
            break;
        }

        this.gateE_CYC_ENT.value = 0;
    }


    /*******************************************************************
    *  Processor Control                                               *
    *******************************************************************/

    /*************************************/
    setProcState(state) {
        /* Sets the current processor state and resets the previous state */

        let gate = this.procStateGates[this.procState];
        if (gate) {
            gate.value = 0;
        }

        this.procState = state;
        gate = this.procStateGates[state];
        if (gate) {
            gate.value = 1;
        } else if (state != procStateLimbo) {
            this.panic(`>>EMULATOR INVALID PROC STATE: ${state}`);
            debugger;
        }
    }

    /**************************************/
    enterLimbo(entryContext=null, entryFcn=null) {
        /* Stops processing by setting this.procState to procStateLimbo. This
        will cause this.run() to exit but leave the Processor in AUTOMATIC and
        not MANUAL mode. Typically used for read/write interlock conditions and
        input I/O. To get out of Limbo, you'll need to call run(), or do RELEASE
        and RESET then manually restart the system.
        "entryFcn" is a function to call upon entering Limbo state. "entryContext"
        is the object context ("this" value) to apply to that call */

        this.limboEntryFcn = entryFcn;
        this.limboEntryContext = entryContext;
        this.setProcState(procStateLimbo);
    }

    /**************************************/
    enterManual() {
        /* Places the processor in Manual mode */
        const now = performance.now();

        this.gateMANUAL.value = 1;
        this.gateRUN.value = 0;
        this.gateCLR_CTRL.value = 0;
        while (this.runTime < 0) {
            this.runTime += now;
        }
    }

    /**************************************/
    exitManual() {
        /* Releases the processor from Manual mode */
        const now = performance.now();

        this.gateMANUAL.value = 0;
        while (this.runTime >= 0) {
            this.runTime -= now;
        }
    }

    /**************************************/
    enterAutomatic() {
        /* Starts the run time clock for AUTOMATIC mode */

        this.gateAUTOMATIC.value = 1;
    }

    /**************************************/
    exitAutomatic() {
        /* Stops the run time clock for AUTOMATIC mode */

        this.gateAUTOMATIC.value = 0;
    }

    /**************************************/
    checkStop(msg) {
        /* Turns on the CHECK STOP lamp, enters MANUALmode, and logs "msg" */

        this.gateCHECK_STOP.value = 1;
        this.exitAutomatic();
        this.enterManual();
        console.info(`>>CHECK STOP: ${msg}`);
        console.trace();
    }

    /**************************************/
    verifyCheckStop() {
        /* Examines all of the conditions that can cause a check stop and turns
        off the lamp if none exist any longer */

        const disk = this.diskAddrCheck.value || this.diskCylOflowCheck.value || this.diskWLRRBCCheck.value;
        const parity = this.parityMBREvenCheck.value || this.parityMBROddCheck.value;
        const io = this.ioPrinterCheck.value || this.ioReadCheck.value || this.ioWriteCheck.value;
        const oflow = this.oflowArithCheck.value || this.oflowExpCheck.value;

        if (!this.parityMARCheck.value &&
                !(disk && this.diskStopSwitch) && !(parity && this.parityStopSwitch) &&
                !(io && this.ioStopSwitch) && !(oflow && this.oflowStopSwitch)) {
            this.gateCHECK_STOP.value = 0;
        }
    }

    /**************************************/
    panic(msg) {
        /* Forces a CHECK STOP and immediate MANUAL mode. Used internally */

        this.gateTHERMAL.value = 1;
        this.checkStop(msg);
        this.context.controlPanel.alert("<PANIC STOP> " + msg);         // Debug only //
    }

    /**************************************/
    marCheck(msg) {
        /* Stops the processor for MAR addressing errors */

        this.setIndicator(0, msg);
    }


    /**************************************/
    setIndicator(code, msg) {
        /* Sets the indicator specified by "code" and does a Check Stop based on
        any associated stop switch. Not all indicators are settable -- any codes
        that are not supported by this function are simply ignored. The "msg"
        parameter is used only when a Check Stop occurs.
        Code 0 is used to set a MAR Check condition, which does not have an
        associated indicator, and always results in a Check Stop */
        const text = msg ?? "";

        switch (code) {
        case 0:         // MAR Check (parity, invalid digit, invalid address)
            this.parityMARCheck.value = 1;
            this.checkStop(`MAR Check: ${text}`);
            break;
        case  6:        // Read Check
            this.ioReadCheck.value = 1;
            if (this.ioStopSwitch) {
                this.checkStop(`Read Check: ${text}`);
            }
            break;
        case  7:        // Write Check
            this.ioWriteCheck.value = 1;
            if (this.ioStopSwitch) {
                this.checkStop(`Write Check: ${text}`);
            }
            break;
        case  9:        // Last card (1622 read)
            this.gateLAST_CARD.value = 1;
            break;
        case 14:        // Arithmetic Check
            this.oflowArithCheck.value = 1;
            if (this.oflowStopSwitch) {
                this.checkStop(`Arithmetic Overflow Check: ${text}`);
            }
            break;
        case 15:        // Exponent Check
            this.oflowExpCheck.value = 1;
            if (this.oflowStopSwitch) {
                this.checkStop(`Exponent Check: ${text}`);
            }
            break;
        case 16:        // MBR-even Check
            this.parityMBREvenCheck.value = 1;
            if (this.parityStopSwitch) {
                this.checkStop(`MBR-Even Check: ${text}`);
            }
            break;
        case 17:        // MBR-odd Check
            this.parityMBROddCheck.value = 1;
            if (this.parityStopSwitch) {
                this.checkStop(`MBR-Odd Check: ${text}`);
            }
            break;
        case 36:        // 1311 Address Check
            this.diskAddrCheck.value = 1;
            if (this.diskStopSwitch) {
                this.checkStop(`Disk Address Check: ${text}`);
            }
            break;
        case 37:        // 1311 Wrong-length Record / Read-back Check
            this.diskWLRRBCCheck.value = 1;
            if (this.diskStopSwitch) {
                this.checkStop(`Disk WRL/RBC Check: ${text}`);
            }
            break;
        case 38:        // 1311 Cylinder Overflow
            this.diskCylOflowCheck.value = 1;
            if (this.diskStopSwitch) {
                this.checkStop(`Disk Cylinder Overflow Check: ${text}`);
            }
            break;
        case 25:        // 1443 Printer Check
            this.ioPrinterCheck.value = 1;      // but not if it's a sync check
            if (!this.devices.linePrinter?.printCheck) {
                this.devices.linePrinter?.setPrintCheck(true);
            }
            if (this.ioStopSwitch) {
                this.checkStop(`Printer Check: ${text}`);
            }
            break;
        case 33:        // 1443 Channel 9
            this.ioPrinterChannel9.value = 1;   // also reset by sensing channel 1
            break;
        case 34:        // 1443 Channel 12
            this.ioPrinterChannel12.value = 1;  // also reset by sensing channel 1
            break;
        case 35:        // 1443 Printer Busy
            this.ioPrinterBusy.value = 1;
            break;
        }
    }

    /**************************************/
    resetIndicator(code) {
        /* Resets the specified indicator in the Processor, complementing the
        function of this.setIndicator() */

        switch (code) {
        case  6:        // Read Check
            this.ioReadCheck.value = 0;
            break;
        case  7:        // Write Check
            this.ioWriteCheck.value = 0;
            break;
        case  9:        // Last card (1622 read)
            this.gateLAST_CARD.value = 0;
            break;
        case 14:        // Arithmetic Check
            this.oflowArithCheck.value = 0;
            break;
        case 15:        // Exponent Check
            this.oflowExpCheck.value = 0;
            break;
        case 16:        // MBR-even Check
            this.parityMBREvenCheck.value = 0;
            break;
        case 17:        // MBR-odd Check
            this.parityMBROddCheck.value = 0;
            break;
        case 36:        // 1311 Address Check
            this.diskAddrCheck.value = 0;
            break;
        case 37:        // 1311 Wrong-length Record / Read-back Check
            this.diskWLRRBCCheck.value = 0;
            break;
        case 38:        // 1311 Cylinder Overflow
            this.diskCylOflowCheck.value = 0;
            break;
        case 25:        // 1443 Printer Check
            this.ioPrinterCheck.value = 0;      // but not if it's a sync check
            if (this.devices.linePrinter?.printCheck) {
                this.devices.linePrinter?.setPrintCheck(false);
            }
            break;
        case 33:        // 1443 Channel 9
            this.ioPrinterChannel9.value = 0;   // also reset by sensing channel 1
            break;
        case 34:        // 1443 Channel 12
            this.ioPrinterChannel12.value = 0;  // also reset by sensing channel 1
            break;
        case 35:        // 1443 Printer Busy
            this.ioPrinterBusy.value = 0;
            break;
        }
    }

    /**************************************/
    async run() {
        /* Main execution control loop for the processor. Does one iteration per
        memory cycle until the Processor is put in MANUAL mode. Attempts to
        throttle performance to approximate that of a real 1620. Executes memory
        cycles until some sort of stop condition is detected */

        if (this.running) {
            this.panic("Multiple instances of this.run() active");
            return;
        }

        this.running = true;
        this.envir.startTiming();

        do {
            // this.traceState();          // >>>>> DEBUG ONLY <<<<<

            switch (this.procState) {
            case procStateI1:
                this.stepICycle1()
                break;

            case procStateI2:
                this.stepICycle2();
                break;

            case procStateI3:
                this.stepICycle3();
                break;

            case procStateI4:
                this.stepICycle4();
                break;

            case procStateI5:
                this.stepICycle5();
                break;

            case procStateI6:
                this.stepICycle6();
                break;

            case procStateIX:
                this.stepIndexing();
                break;

            case procStateIA1:
                this.stepIndirecting1();
                break;

            case procStateIA2:
                this.stepIndirecting2();
                break;

            case procStateIA3:
                this.stepIndirecting3();
                break;

            case procStateE1:
                this.stepECycle1();
                break;

            case procStateE2:
                await this.stepECycle2();
                break;

            case procStateE3:
                this.stepECycle3();
                break;

            case procStateE4:
                this.stepECycle4();
                break;

            case procStateE5:
                this.stepECycle5();
                break;

            case procStateLimbo:
                await this.envir.throttle();
                this.running = false;
                if (this.limboEntryFcn) {
                    this.limboEntryFcn.call(this.limboEntryContext, this.limboEntryFcn);
                }
                return;             // exit into Limbo state
                break;

            default:
                this.panic(`>>INVALID PROC STATE: ${this.procState}`);
                break;
            }

            // Increment the emulation clock, and if the time slice has ended,
            // throttle performance. We need to increment after the register and
            // flip-flop states have been set so that register their glow values
            // will be computed properly.
            if (this.envir.tick()) {
                if (!(this.gateRD.value || this.gateWR.value)) { // not doing I/O
                    const delayStart = performance.now();
                    const delay = this.envir.eTime - delayStart;
                    this.avgThrottleDelay =
                            this.avgThrottleDelay*Processor.delayAlpha1 + delay*Processor.delayAlpha;

                    await this.envir.throttle();

                    this.avgThrottleDelta = this.avgThrottleDelta*Processor.delayAlpha1 +
                            (performance.now() - delayStart - delay)*Processor.delayAlpha;
                }
            }
        } while (!this.gateMANUAL.value && this.gatePOWER_ON.value);

        this.running = false;
        this.envir.restartTiming();
    }


    /*******************************************************************
    *  Operator Interface                                              *
    *******************************************************************/

    /**************************************/
    manualReset() {
        /* Resets the internal processor state after power-on or the MANUAL key.
        It can only be performed in manual mode */

        if (!(this.gatePOWER_ON.value && this.gateMANUAL.value)) { // allow if in dual MANUAL/
            return;                                                // AUTOMATIC mode during STOP/SCE
        }

        this.gate$$$_OFLO.value = 0;
        this.gate1ST_CYC.value = 0;
        this.gate1ST_CYC_DELAYD.value = 0;
        this.gateBR_EXEC.value = 0;
        this.gateBR_OUT.value = 0;
        this.gateCARRY_IN.value = 0;
        this.gateCARRY_OUT.value = 0;
        this.gateCLR_MEM.value = 0;
        this.gateCOMP.value = 0;
        this.gateEOR$.value = 0;
        this.gateEXP_OFLO.value = 0;
        this.gateEXP_UFLO.value = 0;
        this.gateEZ.value = 0;
        this.gateE_CYC_ENT.value = 0;
        this.gateFL_1.value = 0;
        this.gateFL_2.value = 0;
        this.gateHP.value = 0;
        this.gateIA_ENT.value = 0;
        this.gateIA_REQ.value = 0;
        this.gateINT_ENT.value = 0;
        this.gateINT_MODE.value = 0;
        this.gateIX_ENT.value = 0;
        this.gateLAST_CARD.value = 0;
        this.gateMASK.value = 0;
        this.gateP.value = 0;
        this.gateRM.value = 0;

        // Floating-point gates
        if (this.fpInstalled) {
            this.gateCOUNTER_COMP.value = 0;
            this.gateDIGIT_FORCE_ENTRY.value = 0;
            this.gateDIG_FORCE_MODE.value = 0;
            this.gateD_GTR_99.value = 0;
            this.gateEXP_ADD.value = 0;
            this.gateEXP_MODIFY.value = 0;
            this.gateEXP_MOD_ENTRY.value = 0;
            this.gateEXP_MOD_REQ.value = 0;
            this.gateEXP_OFLO_CORR.value = 0;
            this.gateEXP_XMIT.value = 0;
            this.gateEXTRA_SFT_CYC.value = 0;
            this.gateFALSE_XMIT.value = 0;
            this.gateFALSE_XMIT_ENTRY.value = 0;
            this.gateFDIV.value = 0;
            this.gateFDIV_ENTRY.value = 0;
            this.gateFMUL_ENTRY.value = 0;
            this.gateFMUL_MODE.value = 0;
            this.gateFORCE_CF1.value = 0;
            this.gateFP_HI_PLUS.value = 0;
            this.gateFRAC_ADD_ENTRY.value = 0;
            this.gateFRAC_ADD_MODE.value = 0
            this.gateFRAC_COMPARE_MODE.value = 0;
            this.gateFRAC_COMPR_ENTRY.value = 0;
            this.gateHI_ORDER_ZERO.value = 0;
            this.gateLD.value = 0;
            this.gateLD_ENTRY.value = 0;
            this.gateNORM_SHIFT_RT.value = 0;
            this.gateQ_EXIT.value = 0;
            this.gateRESULT_XMIT.value = 0;
            this.gateSCAN_ENTRY.value = 0;
            this.gateSCAN_MINUS.value = 0;
            this.gateSCAN_MODE.value = 0;
            this.gateSCAN_Q.value = 0;
            this.gateSHIFT_ENTRY.value = 0;
            this.gateSHIFT_MODE.value = 0;
            this.gateSIG_DIGIT.value = 0;
        }

        // Input-Output Gates
        this.gateDISK_ADDR.value = 0;
        this.gateDISK_HUND.value = 0;
        this.gateDISK_LD_ZERO.value = 0;
        this.gateDISK_OP.value = 0;
        this.gateDISK_UNIT.value = 0;
        this.gateMEM_ADDR.value = 0;
        this.gatePCH_FEED.value = 0;
        this.gatePC_6XXX.value = 0;
        this.gatePC_EZ.value = 0;
        this.gatePC_HP.value = 0;
        this.gatePC_IND.value = 0;
        this.gatePC_OFLO.value = 0;
        this.gatePC_TR_8.value = 0;
        this.gateRDR_FEED.value = 0;
        this.gateREL.value = 0;
        this.gateSCTR_COUNT.value = 0;
        this.gateSCTR_CYC.value = 0;
        this.gateSIMO_30.value = 0;
        this.gateSIMO_HOLD.value = 0;
        this.ioExit();

        this.gateWRITE_INTERLOCK.value = 0;
        this.gateREAD_INTERLOCK.value = 0;
        this.gateTHERMAL.value = 0;

        this.gateIA_1.value = 0;
        this.gateI_1.value = 0;
        this.gateI_6.value = 0;

        this.gateCLR_CTRL.value = 0;
        this.gateCLR_MEM.value = 0;
        this.gateCONSOLE_CTRL_SS.value = 0;
        this.gateDISPLAY_MAR.value = 0;
        this.gateSAVE.value = 0;
        this.gateINSERT.value = 0;
        this.gateREL.value = 0;
        this.gateSCE.value = 0;

        this.regXR.clear();
        this.regXBR.clear();

        this.parityMARCheck.value = 0;
        this.oflowArithCheck.value = 0;
        this.oflowExpCheck.value = 0;
        this.resetIndicator(25);        // printer check
        this.ioPrinterChannel9.value = 0;
        this.ioPrinterChannel12.value = 0;
        this.checkReset();              // will turn off this.gateCHECK_STOP

        this.gateSTOP.value = 0;
        this.running = false;
        this.enterICycle();
        this.enterManual();             // will turn off this.gateRUN
    }

    /**************************************/
    checkReset() {
        /* Resets the internal processor state by the CHECK RESET key */

        this.ioPrinterCheck.value = 0;
        this.ioReadCheck.value = 0;
        this.ioWriteCheck.value = 0;
        this.parityMBREvenCheck.value = 0;
        this.parityMBROddCheck.value = 0;
        this.verifyCheckStop();
    }

    /**************************************/
    diskReset() {
        /* Resets the Disk Check indicators */

        this.release();
        this.diskAddrCheck.value = 0;
        this.diskCylOflowCheck.value = 0;
        this.diskWLRRBCCheck.value = 0;
        this.verifyCheckStop();
        if (this.devices.diskDrive) {
            this.devices.diskDrive.diskReset();
        }
    }

    /**************************************/
    enableMemoryClear() {
        /* Enables a clear-memory operation to take place the next time the
        START key is pressed. On a real 1620-2 this was activated by pressing
        MODIFY and CHECK RESET simultaneously, but that's not feasible with a
        pointer-based UI, so in retro-1620 it's activated by pressing MODIFY and
        then CHECK RESET without activating any other keys or switches on the
        lower Control Panel in between. To cancel the clear before pressing
        START, click CHECK RESET twice, or click any other key except START
        (well, maybe not POWER, either) */

        if (this.gatePOWER_ON.value && this.gateMANUAL.value && !this.gateAUTOMATIC.value) {
            this.gateCLR_MEM.value = 1;
        }
    }

    /**************************************/
    displayMAR() {
        /* Displays the value of the MARS register selected by the big MARS
        selector switch in the MAR lamps */

        if (this.gatePOWER_ON.value && this.gateMANUAL.value  && !this.gateAUTOMATIC.value) {
            // ?? also gated by this.gateCONSOLE_CTRL_SS ??
            this.gateDISPLAY_MAR.value = 1;
            this.gateRUN.value = 1;
            this.regMAR.value = this.marsRegisters[this.marSelectorKnob].value;

            // ?? Not sure how DISPLAY_MAR gets reset, other than the RESET key,
            // so for now just reset it after once clock tick here.
            this.envir.tick();
            this.gateDISPLAY_MAR.value = 0;
        }
    }

    /**************************************/
    saveIR1() {
        /* Saves the value of IR1 in PR1 and turns on the SAVE lamp */

        if (this.gatePOWER_ON.value && this.gateMANUAL.value && !this.gateAUTOMATIC.value) {
            this.gateSAVE.value = 1;
            this.gateRUN.value = 1;
            this.regPR1.value = this.regMAR.value = this.regIR1.value;
        }
    }

    /**************************************/
    insert(cardLoad) {
        /* Initiates input from the typewriter via the INSERT key (cardLoad=false)
        or the CardReader LOAD button (cardLoad=true) */

        if (this.gatePOWER_ON.value && this.gateMANUAL.value && !this.gateAUTOMATIC.value &&
                !this.gateCHECK_STOP.value) {
            this.gateINSERT.value = 1;
            this.enterAutomatic();
            this.gateREL.value = 0;
            this.regOP.binaryValue = this.opBinary = 36; // RN, Read Numerically
            this.ioSelect((cardLoad ? 5 : 1), 0);        // select card(5) or typewriter(1)
            if (!this.gateRD.value) {   // not sure about this...
                this.gateRD.value = 1;
                this.gate1ST_CYC.value = 1;
                this.exitManual();
                this.gateRUN.value = 1;
            }

            this.enterLimbo();
            this.envir.tick();          // pretend to do a delayed 1st cycle
            this.gate1ST_CYC.value = 0;
            this.gateBR_EXEC.value = 0;
            this.regIR1.clear();
            this.regOR2.clear();
            this.regMAR.clear();

            this.enterLimbo();          // device will trigger the memory cycles
            if (!this.ioDevice) {
                this.gateREAD_INTERLOCK.value = 1;
            } else {
                if (this.ioSelectNr == 3) {             // card reader
                    this.gateREAD_INTERLOCK.value = 1;
                }

                this.ioDevice.initiateRead(true);
            }
        }
    }

    /**************************************/
    release() {
        /* Releases any currently-active I/O operation */

        if (this.gatePOWER_ON.value && (this.gateRD.value || this.gateWR.value)) {
            this.gateSTOP.value = 1;
            this.ioDevice?.manualRelease();
            this.ioExit();              // STOP will force MANUAL mode in I-Cycle Entry
        }
    }

    /**************************************/
    start() {
        /* Initiates the processor on the Javascript thread */

        if (this.gatePOWER_ON.value && this.gateMANUAL.value && !this.gateCHECK_STOP.value) {
            this.gateSCE.value = 0;     // reset single-cycle mode
            this.gateSAVE.value = 0;
            this.exitManual();
            this.gateRUN.value = 1;
            if (this.gateCLR_MEM.value) {
                this.clearMemory();     // async -- returns immediately
            } else {
                this.enterAutomatic();  // necessary when resuming an I/O (e.g., after PT punch error)
                this.run();             // async
            }
        }
    }

    /**************************************/
    stopSIE() {
        /* If the processor is running, stops it at the end of the current
        instruction. If the processor is already in manual mode, executes the
        next instruction, then stops the processor */

        if (this.gatePOWER_ON.value && !this.gateCHECK_STOP.value) {
            this.gateSTOP.value = 1;    // stop processor at end of current instruction
            if (this.gateMANUAL.value) {
                this.exitManual();
                this.run();             // async - singe-step one instruction
            }
        }
    }

    /**************************************/
    stopSCE() {
        /* If the processor is running, stops it at the end of the current
        memory cycle, but leaves it in AUTOMATIC mode, even though MANUAL is also
        set. Otherwise, executes the next memory cycle, then stops the processor */

        if (this.gatePOWER_ON.value && !this.gateCHECK_STOP.value &&
                // Not sure about this next part, but it's mentioned in Germain p.25:
                // Don't allow SCE during I/O unless it's Typewriter or Paper Tape output.
                !(this.gateRD.value || (this.gateWR.value &&
                        !(this.ioSelectNr==1 || this.ioSelectNr==2 || this.ioSelectNr==32)))) {
            this.gateSCE.value = 1;     // single memory-cycle latch
            this.gateRUN.value = 1;
            if (this.gateMANUAL.value) {
                // Singe-step one memory cycle (ignoring that we're in MANUAL mode).
                this.run();             // async
            } else {
                // Stop processor after next memory cycle.
                this.enterManual();
            }
        }
    }


    /*******************************************************************
    *  Initialization & Termination                                    *
    *******************************************************************/

    /**************************************/
    powerUp() {
        /* Powers up and initializes the processor */

        if (!this.gatePOWER_ON.value) {
            this.gatePOWER_ON.value = 1;
            this.enterManual();                         // must be set for manualReset()
            this.gateIA_SEL.value = 1;                  // enable indirect addressing
            this.devices = this.context.devices;        // I/O device objects
            this.loadMemory();                          // >>> DEBUG ONLY <<<
            this.manualReset();
            this.envir.startTiming();
        }
    }

    /**************************************/
    powerDown() {
        /* Powers down the processor */

        if (this.gateRD.value || this.gateWR.value || !this.gateMANUAL.value) {
            this.release();
            this.enterManual();                         // stop immediately
            setTimeout(() => {this.powerDown}, 100);
            return;
        }

        this.gatePOWER_ON.value = false;
        this.gatePOWER_READY.value = false;
        for (let prop in this) {
            if (this[prop] instanceof FlipFlop || this[prop] instanceof Register) {
                this[prop].intVal = 0;
            }
        }
    }

    /**************************************/
    loadMemory() {
        /* Loads the multiply table and any optional debugging code into the
        initial memory image. The routine should be enabled in this.powerUp()
        only temporarily for demo and debugging purposes */

        const loadMemory = (addr, digits) => {
            const numRex = /[0-9]/;
            const flagRex = /[@-I]/;
            const zero = ("0").charCodeAt(0);
            const flagZero = ("]").charCodeAt(0);
            const undigitMap = {"|": 0xA, "$": 0xB, "@": 0xC, "%": 0xD, "&": 0xE, "}": 0xF};

            let d = 0;
            let flagged = false;
            let odd = addr & 1;

            this.regMAR.binaryValue = addr;
            this.regMIR.correctedValue = this.MM[addr >> 1];

            for (let c of digits.toUpperCase()) {
                if (c == "~") {
                    flagged = true;
                } else if (c != " ") {
                    if (numRex.test(c)) {
                        d = c.charCodeAt(0) - zero;
                    } else if (flagRex.test(c)) {
                        d = (c.charCodeAt(0) - flagZero) | Register.flagMask;
                    } else if (c in undigitMap) {
                        d = undigitMap[c];
                    } else {
                        d = 0xF;    // Group Mark
                    }

                    if (flagged) {
                        flagged = false;
                        d |= Register.flagMask;
                    }

                    if (odd) {
                        this.regMIR.odd = Envir.oddParity5[d];
                        this.store();
                        this.regMAR.incr(2);
                    } else {
                        this.regMIR.even = Envir.oddParity5[d];
                    }

                    odd = 1-odd;
                }
            }

            if (odd) {
                this.regMIR.odd = Envir.oddParity5[0];
                this.store();
            }
        };

        // First, clear memory to zeroes.
        this.regMIR.clear();
        this.MM.fill(this.regMIR.value);

        // Multiplication table
        loadMemory(100,
            "00000000000010203040002040608000306090210040802161" +      // 100-149
            "00500151020060218142007041128200806142230090817263" +      // 150-199
            "00000000005060708090012141618151811242720242822363" +      // 200-249
            "52035304540363248445532494653604846546275445362718");      // 250-299

        this.regMAR.clear();
        this.regMIR.clear();
    }

} // class Processor
