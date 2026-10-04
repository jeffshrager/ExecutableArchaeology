/***********************************************************************
* retro-1620/tools/cli HeadlessCardReader.mjs
************************************************************************
* A DOM-free stand-in for webUI/CardReader.js, for driving the emulator
* from Node. Holds an in-memory "hopper" of 80-column card-image lines
* and feeds them to the Processor one at a time via receiveCardColumn(),
* following the same column translate/pad/trim algorithm as the real
* CardReader.initiateTransfer(). Card-motion timing is not simulated --
* each read completes synchronously.
***********************************************************************/

export {HeadlessCardReader};

import {Envir} from "../../emulator/Envir.js";

class HeadlessCardReader {

    static columns = 80;

    // Translate ASCII card-image characters to paper-tape code, built the
    // same way as CardReader.xlateCardToPTCode.
    static xlateCardToPTCode = Array(128).fill(null);
    static {
        for (const char in Envir.xlateASCIIToPTCode) {
            HeadlessCardReader.xlateCardToPTCode[char] = Envir.xlateASCIIToPTCode[char];
        }
        HeadlessCardReader.xlateCardToPTCode["]"] = 0b01011101; // alternate for flagged zero (-0, 1622 only)
        HeadlessCardReader.xlateCardToPTCode["!"] = 0b01111010; // alternate for flagged Record Mark
    }

    constructor(processor, cardLines) {
        this.processor = processor;
        this.hopper = cardLines.slice();    // remaining card images, in order
        this.cardsRead = 0;
    }

    /**************************************/
    async initiateRead() {
        /* Called by the Processor (directly, or via enterLimbo's entry
        function) to request the next card. Feeds it through
        receiveCardColumn() -- no physical read delay is simulated, but
        this still yields once before doing so. Processor.run() calls this
        without awaiting it (fire-and-forget, same as the real CardReader),
        relying on that yield to let any in-flight run() invocation return
        and clear its "running" flag before this resumes and (via
        receiveCardColumn's last-column handling) may trigger another one;
        without it, two run() calls could end up active at once */
        await Promise.resolve();

        const p = this.processor;
        const line = this.hopper.shift();

        if (line === undefined) {
            p.setIndicator(9);          // LAST_CARD gate: hopper is empty
            return;
        }

        this.cardsRead++;

        const limit = HeadlessCardReader.columns-1;
        let lastChar = " ";              // pad character if card is short
        let length = line.length;
        if (limit < length) {
            lastChar = line.at(limit);
            length = limit;
        }

        let x = 0;
        while (x < length) {
            p.receiveCardColumn(HeadlessCardReader.xlateCardToPTCode[line[x]], false);
            ++x;
        }

        while (x < limit) {
            p.receiveCardColumn(Envir.ptSpaceCode, false);
            ++x;
        }

        if (this.hopper.length == 0) {
            p.setIndicator(9);          // this was the last card in the hopper
        }

        p.receiveCardColumn(HeadlessCardReader.xlateCardToPTCode[lastChar], true);
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
