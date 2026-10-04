/***********************************************************************
* retro-1620/tools/cli HeadlessCardPunch.mjs
************************************************************************
* A DOM-free stand-in for webUI/CardPunch.js. Reuses that module's
* static ptCode-to-character tables (pure data, no DOM access at import
* time -- see CardPunch.js) to decode Write Numeric/Alpha output onto an
* 80-column card buffer, but collects completed cards in memory / echoes
* them to stdout instead of driving a browser stacker display. This is
* the device IPL-V's own Program-Switch-gated trace facility writes to.
***********************************************************************/

export {HeadlessCardPunch};

import {CardPunch} from "../../webUI/CardPunch.js";

class HeadlessCardPunch {

    static columns = 80;

    constructor(echo=true) {
        this.echo = echo;
        this.cards = [];             // completed punched cards, in order
        this.cardBuffer = "";        // card currently being punched
    }

    /**************************************/
    finishCard() {
        this.cards.push(this.cardBuffer);
        if (this.echo) {
            process.stdout.write(this.cardBuffer + "\n");
        }

        this.cardBuffer = "";
    }

    /**************************************/
    async dumpNumeric(ptCode) {
        /* Writes one digit to the card buffer, as Dump Numerically (DN, 35) would */
        return this.writeNumeric(ptCode);
    }

    /**************************************/
    async writeNumeric(ptCode) {
        /* Writes one character code to the card buffer, as Write Numerically
        (WN, 38) would. Returns 1 after the 80th character is received */
        await Promise.resolve();
        const char = CardPunch.xlatePTCodeToNumeric[ptCode] ?? "?";

        this.cardBuffer += char;
        if (this.cardBuffer.length >= HeadlessCardPunch.columns) {
            this.finishCard();
            return 1;
        }

        return 0;
    }

    /**************************************/
    async writeAlpha(ptCode) {
        /* Writes one character code to the card buffer, as Write
        Alphanumerically (WA, 39) would. Returns 1 after the 80th character
        is received */
        await Promise.resolve();
        const char = CardPunch.xlatePTCodeToAlpha[ptCode] ?? "?";

        this.cardBuffer += char;
        if (this.cardBuffer.length >= HeadlessCardPunch.columns) {
            this.finishCard();
            return 1;
        }

        return 0;
    }

    /**************************************/
    initiateWrite() {
        /* Called by Processor to initiate a write I/O. Not used with CardPunch */
    }

    /**************************************/
    release() {
        /* Called by Processor to indicate the device has been released. Not used */
    }

    /**************************************/
    manualRelease() {
        /* Called by Processor to indicate the device has been released manually */
    }
}
