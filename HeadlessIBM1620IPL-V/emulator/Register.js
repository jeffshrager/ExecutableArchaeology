/***********************************************************************
* retro-1620/emulator Register.js
************************************************************************
* Copyright (c) 2022, Paul Kimpel.
* Licensed under the MIT License, see
*       http://www.opensource.org/licenses/mit-license.php
************************************************************************
* JavaScript class module for an internal processor register with lamp
* intensity averaging for incandescent bulbs.
************************************************************************
* 2022-07-19  P.Kimpel
*   Original version, from retro-g15 Register.js.
* 2023-01-19  P.Kimpel
*   Reformat to use newer JavaScript static and public field definitions.
***********************************************************************/

export {Register}

import {BitField} from "./BitField.js";
import {Envir} from "./Envir.js";
import {FlipFlop} from "./FlipFlop.js";


class Register {

    // Static class properties

    static digitBits =      6;          // bits/digit
    static maxDigits =      5;          // max digits register can hold
    static flagBitNr =      4;          // 0-relative bit number for the flag

    static digitMask =      0b111111;
    static parityMask =     0b100000;
    static notParityMask =  0b011111;
    static flagMask =       0b010000;
    static notFlagMask =    0b101111;
    static parityFlagMask=  0b110000;
    static bcdMask =        0b001111;
    static undigitBase =    0b001010;   // (digit & bcdMask) >= undigitBase => it's an undigit
    static bcdValueMask =   0b001111_001111_001111_001111_001111;

    // Public Instance Properties

    lastETime = 0;                      // emulation time register was last set
    intVal = 0;                         // bitmask value of register: read-only externally
    intBinaryVal = 0;                   // binary value of register: read-onlyl externally
    invalidBCD = false;                 // true if arithmetic or conversion done on an undigit
    parityError = false;                // true if last update had a digit parity error


    constructor(mnemonic, digits, envir, visible, parity, flagged) {
        /* Constructor for the generic Register class. Defines a binary register
        of "digits" 6-bit digits. The bits in each digit are arranged, from high-
        to low-order, as C F 8 4 2 1 (C=odd parity).

        The maximum number of digits supported is 5 (30 bits). Since this
        fits in a 32-bit 2s-complement value, we can use Javascript bit
        operators to maniuplate the values.

        "mnemonic" is a short string identifying the register for use in error
        messages.

        "envir" is a reference to the object that maintains the emulation clock,
        which must support the property "eTime". That property reports the
        current emulation time in milliseconds. Emulation time is used to compute
        lamp glow decay and a time-weighted exponential average intensity.

        "visible" should be false if the register does not have a visible
        presence in the UI -- this will inhibit computing average lamp glow values
        for the register.

        "parity" should be true if correct parity should be computed when setting
        values in the register. If false, the raw value will be set in the
        register (subject to the "flagged" option below). this.parityError will
        be set on each update of the register regardless of the "parity" setting.

        "flagged" must be true if the register digits have flag bits. If false,
        incoming flag (F) bits will be unconditionally reset and will not
        contribute to the parity sum.

        The 1620 technical documentation refers to the "even" and "odd" digits
        of two-digit registers, with "even" referring to the high-order and
        "odd" referring to the low-order. Don't confuse this with indexes used
        by Register to select digits, though. Register.even selects digit [1]
        and Register.odd selects digit [0].

        Note that it is important to call envir.tick() in the caller to increment
        envir.eTime AFTER setting new values in registers and flip-flops. This
        allows the average intensity to be computed based on the amount of time
        a bit was actually in that state */

        this.mnemonic = mnemonic;       // name of the register
        this.digits = digits;           // number of 6-bit digits in register
        this.envir = envir;             // local copy of clock object
        this.visible = (visible ? true : false);
        this.parity = (parity ? true : false);
        this.flagged = (flagged ? true : false);
        this.bits = digits*Register.digitBits;
        this.digitMask = (flagged ? Register.digitMask : Register.notFlagMask);

        this.glow = new Float64Array(this.bits);    // average lamp glow values

        this.clear();                   // initialize with proper parity
    }

    // Public Instance Methods

    get value() {
        return this.intVal;
    }

    set value(value) {
        /* Set a BCD mask of digits into the register. The binary value is
        computed by coercing undigit values to 8 or 9. Use this rather than
        setting the value member directly so that parity and average lamp glow
        can be computed */

        if (this.intVal != value) {
            let binVal = 0;
            let bits = 0;
            let newVal = 0;
            let power = 1;
            let val = value;
            this.parityError = this.invalidBCD = false;

            this.updateLampGlow(0);
            do {
                let digit = val & this.digitMask;
                let corr = Envir.oddParity5[digit];
                if (corr != digit) {
                    this.parityError = true;
                }

                newVal |= (this.parity ? corr : digit) << bits;

                digit &= Register.bcdMask;
                corr = Envir.bcdBinary[digit];
                if (corr != digit) {
                    this.invalidBCD = true;
                }

                binVal += corr*power;
                power *= 10;
                val >>= Register.digitBits;
                bits += Register.digitBits;
            } while (bits < this.bits);

            this.intBinaryVal = binVal;
            this.intVal = newVal;
        }
    }

    set correctedValue(value) {
        /* Does what set value() does, but unconditionally sets correct parity
        in the register. Does not set this.parityError, but will set invalidBCD
        if there is an undigit */

        if (this.intVal != value) {
            let binVal = 0;
            let bits = 0;
            let newVal = 0;
            let power = 1;
            let val = value;
            this.parityError = this.invalidBCD = false;

            this.updateLampGlow(0);
            do {
                let digit = Envir.oddParity5[val & this.digitMask];
                newVal |= digit << bits;

                digit &= Register.bcdMask;
                let corr = Envir.bcdBinary[digit];
                if (corr != digit) {
                    this.invalidBCD = true;
                }

                binVal += corr*power;
                power *= 10;
                val >>= Register.digitBits;
                bits += Register.digitBits;
            } while (bits < this.bits);

            this.intBinaryVal = binVal;
            this.intVal = newVal;
        }
    }

    get binaryValue() {
        /* Returns the value of the register as a binary integer */

        return this.intBinaryVal;
    }

    set binaryValue(value) {
        /* Sets the BCD value of the register from a binary integer. Preserves
        flag bits but recomputes parity for each digit */
        let bin = value;
        let binVal = 0;
        let bits = 0;
        let newVal = 0;
        let power = 1;
        let val = this.intVal;
        this.parityError = this.invalidBCD = false;

        this.updateLampGlow(0);
        do {
            let digit = bin % 10;
            newVal |= Envir.oddParity5[(val & Register.parityFlagMask) | digit] << bits;

            binVal += digit*power;
            power *= 10;
            val >>= Register.digitBits;
            bin = (bin-digit)/10;
            bits += Register.digitBits;
        } while (bits < this.bits);

        this.intBinaryVal = binVal;
        this.intVal = newVal;
    }

    get isntZero() {
        /* Returns 0 if the register is zero, 1 otherwise */

        return ((this.intVal & Register.bcdValueMask) ? 1 : 0);
    }

    get isZero() {
        /* Returns 1 if the register is zero, 0 otherwise */

        return ((this.intVal & Register.bcdValueMask) ? 0 : 1);
    }

    get isOdd() {
        /* Returns 1 if the register is an odd value, 0 otherwise */

        return this.intVal & 1;
    }

    get odd() {
        /* Returns the value of digit 0 from a register. This is useful and more
        efficient than getDigit() for the 2-digit even/odd registers */

        return this.intVal & this.digitMask;
    }

    set odd(value) {
        /* Sets the value of digit 0 in a register. This is useful for the
        2-digit even/odd registers. Recomputes parity for the digit */

        this.setDigit(0, value);
    }

    get isEven() {
        /* Returns 1 if the register is an even value, 0 otherwise */

        return 1 - (this.intVal & 1);
    }

    get even() {
        /* Returns the value of digit 1 from a register. This is useful and
        more efficient than getDigit() for the 2-digit even/odd registers.
        If a register has only one digit, returns zero */

        return (this.intVal >> Register.digitBits) & this.digitMask;
    }

    set even(value) {
        /* Sets the value of digit 1 in a register. This is useful for the
        2-digit even/odd registers. Recomputes parity for the digit. If the
        register has only one digit, does nothing */

        this.setDigit(1, value);
    }

    /**************************************/
    setMARCheck(msg) {
        /* Sets the Processor's check indicator for a MAR check condition. This
        in turn will cause a Check Stop in the Processor */

        this.envir.setIndicator(0, `reg${this.mnemonic}: ${msg}`);
    }

    /**************************************/
    clear() {
        /* Clears the register to zero with correct parity. Returns the new value */
        let newVal = 0;
        let d = 0;
        this.parityError = this.invalidBCD = false;

        this.updateLampGlow(0);
        do {
            newVal = (newVal << Register.digitBits) | Register.parityMask;
        } while (++d < this.digits);

        this.intBinaryVal = 0;
        this.intVal = newVal;
        return newVal;
    }

    /**************************************/
    incr(increment) {
        /* Increments the register by "increment", which must be in the range
        1-9. If this is a 5-digit register, it is assumed to be an address
        register, and the result will be modulo the system memory size.
        Otherwise, overflow is ignored.
        This routine is designed to minimize the number of digits changed */
        let carry = increment;
        let corr = 0;
        let d = 0;
        let digit = 0;
        let val = this.intVal;

        do {
            digit = val & Register.bcdMask;
            corr = Envir.bcdBinary[digit];
            if (digit != corr) {
                this.setMARCheck(`incr() invalid BCD digit ${digit}`);
                this.invalidBCD = true;
            }

            digit = corr + carry;
            if (digit <= 9) {
                carry = 0;
            } else {
                digit = digit-10;
                carry = 1;
            }

            this.setDigit(d, digit);
            val >>= Register.digitBits;
        } while (carry && ++d < this.digits);

        if (this.digits == 5) {
            if (this.intBinaryVal >= this.envir.memorySize) {   // addr overflow
                this.binaryValue = this.intBinaryVal % this.envir.memorySize;
            }
        }
    }

    /**************************************/
    decr(decrement) {
        /* Decrements the register by "decrement", which must be in the range
        1-9. If this is a 5-digit register, it is assumed to be an address
        register, and the result will be modulo the system memory size.
        Otherwise, underflow is ignored and the result will be in 10s-complement
        form. This routine is designed to minimize the number of digits changed */
        let borrow = decrement;
        let corr = 0;
        let d = 0;
        let digit = 0;
        let val = this.intVal;

        do {
            digit = val & Register.bcdMask;
            corr = Envir.bcdBinary[digit];
            if (digit != corr) {
                this.setMARCheck(`decr() invalid BCD digit ${digit}`);
                this.invalidBCD = true;
            }

            digit = corr - borrow;
            if (digit >= 0) {
                borrow = 0;
            } else {
                digit = digit+10;
                borrow = 1;
            }

            this.setDigit(d, digit);
            val >>= Register.digitBits;
        } while (borrow && ++d < this.digits);

        if (this.digits == 5) {
            if (this.intBinaryVal >= this.envir.memorySize) {   // addr underflow
                this.binaryValue = this.envir.memorySize - (100000 - this.intBinaryVal)%this.envir.memorySize;
            }
        }
    }

    /**************************************/
    adjust(increment) {
        /* Increments or decrements the register by "increment", which must be
        in the range -9 to +9 */

        if (increment < 0) {
            this.incr(increment);
        } else if (increment > 0) {
            this.decr(-increment);
        }
    }

    /**************************************/
    getDigit(d) {
        /* Returns the value of a digit in the register, 0 is low-order */

        return (d >= this.digits ? 0 :
                BitField.fieldIsolate(this.intVal, (d+1)*Register.digitBits-1, Register.digitBits));
    }

    /**************************************/
    getDigitFlag(d) {
        /* Returns the flag of a digit in the register, 0 is low-order */

        return (d >= this.digits ? 0 :
                BitField.fieldIsolate(this.intVal, (d+1)*Register.digitBits-2, 1));
    }

    /**************************************/
    setDigit(d, value) {
        /* Set a digit into the register, 0 is low-order. Returns the new register value */

        if (d < this.digits) {
            let digit = value & this.digitMask;
            let corr = Envir.oddParity5[digit];

            this.value = BitField.fieldInsert(this.intVal, (d+1)*Register.digitBits-1, Register.digitBits,
                     this.parity ? corr : digit);
            this.parityError = (corr != digit);         // do after this.value= since it checks parity, too
        }

        return this.intVal;
    }

    /**************************************/
    setDigitFlag(d, value) {
        /* Set flag of a digit in the register, 0 is low-order. Unconditionally
        recomputes parity for the digit. Returns the new register value */

        if (d < this.digits) {
            let digit = (this.getDigit(d) & Register.notFlagMask) | ((value & 1)*Register.flagMask);
            let corr = Envir.oddParity5[digit];

            this.value = BitField.fieldInsert(this.intVal, (d+1)*Register.digitBits-1, Register.digitBits, corr);
       }

        return this.intVal;
    }

    /**************************************/
    setDigitNoFlag(d, value) {
        /* Set a digit into the register without overwriting the flag in the
        register for that digit. 0 is the low-order digit. Unconditionally
        recomputes parity for the digit. Returns the new register value */

        if (d < this.digits) {
            let digit = (this.getDigit(d) & Register.flagMask) | (value & Register.bcdMask);
            let corr = Envir.oddParity5[digit];

            this.value = BitField.fieldInsert(this.intVal, (d+1)*Register.digitBits-1, Register.digitBits, corr);
       }

        return this.intVal;
    }

    /**************************************/
    complementDigit(d) {
        /* Replaces a digit in the register with its 9s complement. Unconditionally
        recomputes parity for the digit. Returns the new register value */

        if (d < this.digits) {
            const digit = this.getDigit(d);
            const corr = Envir.bcdBinary[digit];
            const comp = 9 - corr;
            digit = Envir.oddParity5[(digit & Register.parityFlagMask) | comp];
            this.value = BitField.fieldInsert(this.intVal, (d+1)*Register.digitBits-1, Register.digitBits, digit);
            if (digit != corr) {
                this.setMARCheck(`complementDigit(${d}) invalid BCD=${digit}, used ${corr}`);
            }
        }

        return this.intVal;
    }

    /**************************************/
    toBCDString() {
        /* Returns the BCD digits of the internal value formatted as hex digits */
        let bcd = 0;
        let d = 0;
        let shift = 0;
        let val = this.intVal;

        do {
            bcd |= (val & Register.bcdMask) << shift;
            shift += 4;
            val >>= Register.digitBits;
        } while (val && ++d < this.digits);

        return bcd.toString(16).toUpperCase().padStart(this.digits, "0");
    }

    /**************************************/
    updateLampGlow(beta=0) {
        /* Updates the lamp glow averages based on this.envir.eTime. Note that the
        glow is always aged by at least one clock tick. Beta is a bias in the
        range (0,1). For normal update, use 0; to freeze the current state, use 1.
        MUST NOT BE CALLED UNLESS this.visible IS TRUE */

        if (this.visible) {
            let eTime = this.envir.eTime;
            let delta = eTime - this.lastETime;
            if (delta < Envir.cycleTime) {
                delta = Math.max(delta, 0) + Envir.tickTime;
                eTime = this.lastETime + delta;
            }

            let alpha = Math.min(delta/FlipFlop.lampPersistence + beta, 1.0);
            let alpha1 = 1.0-alpha;
            let b = 0;
            let bit = 0;
            let v = this.intVal;

            while (v && b < this.bits) {
                bit = v & 1;
                this.glow[b] = this.glow[b]*alpha1 + bit*alpha;
                v >>= 1;
                ++b;
            }

            while (b < this.bits) {
                this.glow[b] *= alpha1;
                ++b;
            }

            this.lastETime = eTime;
        }
    }

} // class Register
