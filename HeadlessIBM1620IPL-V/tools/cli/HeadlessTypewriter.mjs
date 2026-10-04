/***********************************************************************
* retro-1620/tools/cli HeadlessTypewriter.mjs
************************************************************************
* A DOM-free stand-in for webUI/Typewriter.js. Reuses that module's
* static character-glyph tables (pure data, no DOM access at import
* time -- see Typewriter.js) to decode Write/Dump Numeric and Write
* Alpha output, but buffers it in memory / echoes to stdout instead of
* driving a browser textarea. Typing-element timing is not simulated.
***********************************************************************/

export {HeadlessTypewriter};

import {Envir} from "../../emulator/Envir.js";
import {Register} from "../../emulator/Register.js";
import {Typewriter} from "../../webUI/Typewriter.js";

class HeadlessTypewriter {

    constructor(echo=true) {
        this.echo = echo;
        this.buffer = "";
    }

    /**************************************/
    print(text) {
        this.buffer += text;
        if (this.echo) {
            process.stdout.write(text);
        }
    }

    /**************************************/
    async dumpNumeric(code) {
        /* Writes one digit, as Dump Numerically (DN, 35) would */
        await Promise.resolve();
        const digit = code & Register.digitMask;

        this.print(Typewriter.numericGlyphs[digit & Register.bcdMask] ?? "?");
        return 0;
    }

    /**************************************/
    async writeAlpha(digitPair) {
        /* Writes one even/odd digit pair, as Write Alphanumerically (WA, 39) would */
        await Promise.resolve();
        const even = (digitPair >> Register.digitBits) & Register.digitMask;
        const odd = digitPair & Register.digitMask;
        const code = (even & Register.bcdMask)*16 + (odd & Register.bcdMask);

        this.print(Typewriter.alphaGlyphs[code] ?? "?");
        return 0;
    }

    /**************************************/
    async writeNumeric(code) {
        /* Writes one digit, as Write Numerically (WN, 38) would, suppressing
        the same undigit codes the real Typewriter suppresses */
        await Promise.resolve();
        const digit = code & Register.digitMask;

        if (digit & Register.flagMask) {
            switch (digit & Register.bcdMask) {
            case Envir.numRecMark:
            case Envir.numBlank:
            case Envir.numGroupMark:
                return 0;        // don't output these chars at all unless DN op
            }
        }

        this.print(Typewriter.numericGlyphs[digit & Register.bcdMask] ?? "?");
        return 0;
    }

    /**************************************/
    async control(code) {
        /* Performs the typewriter control functions Processor expects a
        Promise back from. Processor calls this without awaiting it
        (this.ioDevice.control(...).then(...)), the same way it calls the
        real Typewriter.control(), which takes tens of ms to resolve
        (character/carriage-return timing). Resolving near-instantly here
        can let two such fire-and-forget chains overlap in ways the real,
        slower device never would, tripping Processor's "Multiple
        instances of this.run() active" guard -- so impose a real delay at
        least as long as the real device's slowest control interlock
        (Typewriter.returnInterlock/indexInterlock = 124ms) to keep them
        naturally serialized. A shorter delay (previously 5ms) works most
        of the time but is not reliable -- confirmed by a deterministic
        reproduction (simple2.ipl consistently hit the race at the exact
        same point in loading with a 5ms delay). */
        await new Promise(resolve => setTimeout(resolve, 130));

        switch (code & Register.bcdMask) {
        case 1:          // output a space
            this.print(" ");
            break;
        case 2:          // return typing element
        case 4:          // index platen one line
            this.print("\n");
            break;
        case 8:          // tabulate
            this.print("\t");
            break;
        }

        return 0;
    }

    /**************************************/
    initiateWrite() {
        /* Called by Processor to prepare the device for output. No timing to simulate */
    }

    /**************************************/
    initiateRead() {
        /* Called by Processor for typewriter-keyboard input. Not used headlessly */
    }

    /**************************************/
    release() {
        /* Called by Processor to indicate the device has been released. Not used */
    }

    /**************************************/
    manualRelease() {
        /* Called by Processor to indicate the device has been released manually. Not used */
    }
}
