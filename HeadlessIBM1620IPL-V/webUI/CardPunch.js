/***********************************************************************
* retro-1620/webUI CardPunch.js
************************************************************************
* Copyright (c) 2022, Paul Kimpel.
* Licensed under the MIT License, see
*       http://www.opensource.org/licenses/mit-license.php
************************************************************************
* Card punch module for the 1622 Card Reader/Punch unit.
*
* Defines a card punch peripheral unit type.
*
************************************************************************
* 2023-01-29  P.Kimpel
*   Original version, from CardReader.js.
***********************************************************************/

export {CardPunch};

import {Envir} from "../emulator/Envir.js";
import {Register} from "../emulator/Register.js";
import {Timer} from "../emulator/Timer.js";
import {WaitSignal} from "../emulator/WaitSignal.js";
import {PanelButton} from "./PanelButton.js";
import {openPopup} from "./PopupUtil.js";

class CardPunch {

    // Static Properties

    static columns = 80;                // if you don't know what this means, you shouldn't be here
    static cardPunchTop = 458;          // initial top coordinate of CardPunch window above window bottom
    static idlePeriod = 60000;          // punch motor turnoff delay, ms (5 minutes)
    static idleStartupTime = 500;       // punch motor idle startup time, ms
    static windowHeight = 140;          // window innerHeight, pixels
    static windowWidth = 575;           // window innerWidth, pixels

    // Translate paper-tape code to ASCII.
    static xlatePTCodeToAlpha = Array(128);
    static xlatePTCodeToNumeric = Array(128);

    static {
        // Build the xlatePTCodeToAlpha/Numeric tables from Envir.xlatePTCodeToASCII.
        CardPunch.xlatePTCodeToNumeric.fill(null);
        CardPunch.xlatePTCodeToAlpha.fill(null);
        for (let char in Envir.xlateASCIIToPTCode) {
            const code = Envir.xlateASCIIToPTCode[char];
            CardPunch.xlatePTCodeToNumeric[code] = char;
            CardPunch.xlatePTCodeToAlpha[code] = char;
        }

        // Special/alternate codes.
        CardPunch.xlatePTCodeToNumeric[0b00011100] = " ";       // numeric blank
        CardPunch.xlatePTCodeToNumeric[0b01000000] = "]";       // flagged zero (-0)
        CardPunch.xlatePTCodeToNumeric[0b01011101] = "]";       // alternate for flagged zero (-0, 1622 only)
        CardPunch.xlatePTCodeToNumeric[0b01111010] = "!";       // alternate for flagged Record Mark

        CardPunch.xlatePTCodeToAlpha[0b01011101] = "]";         // alternate for flagged zero (-0, 1622 only)
        CardPunch.xlatePTCodeToAlpha[0b01111010] = "!";         // alternate for flagged Record Mark
    }


    // Public Instance Properties

    doc = null;                         // window document object
    window = null;                      // window object
    origin = null;                      // window origin for postMessage()
    innerHeight = 0;                    // window specified innerHeight

    selectStopSwitch = 0;               // Select Stop switch off (0), on (1)
    stackerBar = null;                  // output stacker meter bar
    stackerCount = 0;                   // cards in output stacker
    stackerFrame = null;                // output stacker iframe
    stacker = null;                     // output stacker card area
    timer = new Timer();                // delay management timer


    constructor(context) {
        /* Initializes the card punch component of the 1622 Card Reader/Punch
        device. "context" is an object passing other objects and callback
        functions from the global script:
            config is the SystemConfig object
            processor is the Processor object
        */
        let bufferReadyPoint = 0;
        let punchLatchPoint = 0;

        this.context = context;
        this.config = context.config;
        this.processor = context.processor;

        this.stackerLimit = this.config.getNode("Card.stackerPunch");

        // Calculate timing factors.
        this.cardsPerMinute = this.config.getNode("Card.cpmPunch");
        this.punchPeriod = 60000/this.cardsPerMinute;
        switch (this.cardsPerMinute) {
        case 250:
            bufferReadyPoint = 206;                     // time in cycle when buffer is ready (ms)
            punchLatchPoint = this.punchPeriod-15;      // time in cycle when latch point occurs (ms)
            break;
        default:
            bufferReadyPoint = 411;
            punchLatchPoint = this.punchPeriod-28;
            break;
        }

        this.punchLatchPeriod = this.punchPeriod/4;     // for 4-tooth punch latch
        this.bufferReadyDelay = this.punchPeriod - (punchLatchPoint - bufferReadyPoint);
                                                        // delay from latch point to card buffer ready

        this.boundStartBtnClick = this.startBtnClick.bind(this);
        this.boundStopBtnClick = this.stopBtnClick.bind(this);
        this.boundCheckResetBtnClick = this.checkResetBtnClick.bind(this);
        this.boundNPROSwitchAction = this.NPROSwitchAction.bind(this);
        this.boundSelectStopSwitchClick = this.selectStopSwitchClick.bind(this);
        this.boundMenuClick = this.menuClick.bind(this);
        this.boundReceiveMessage = this.receiveMessage.bind(this);

        this.waitForBuffer = new WaitSignal();
        this.waitForTransport = new WaitSignal();

        this.clear();
        let geometry = this.config.formatWindowGeometry("CardPunch");
        if (geometry.length) {
            [this.innerWidth, this.innerHeight, this.windowLeft, this.windowTop] =
                    this.config.getWindowGeometry("CardPunch");
        } else {
            this.innerWidth  = CardPunch.windowWidth;
            this.innerHeight = CardPunch.windowHeight;
            this.windowLeft =  0;
            this.windowTop =   screen.availHeight - CardPunch.windowHeight;
            geometry = `,left=${this.windowLeft},top=${this.windowTop}` +
                       `,innerWidth=${this.innerWidth},innerHeight=${this.innerHeight}`;
        }

        openPopup(window, "../webUI/CardPunch.html", "retro-1620.CardPunch",
                "location=no,scrollbars,resizable" + geometry,
                this, this.punchOnLoad);
    }

    /**************************************/
    clear() {
        /* Initializes (and if necessary, creates) the punch unit state */

        this.punchReady = false;        // status of PUNCH READY lamp
        this.transportReady = false;    // ready status: cards loaded and START or LOAD pressed
        this.bufferBusy = false;        // punch card buffer is full and ready to be punched
        this.punchCheck = false;        // true if a punch check has occurred
        this.punchCheckPending = false; // true if a punch check has been detected
        this.cardBuffer = "";           // card data received from Processor
        this.nextLatchPointStamp = 0;   // timestamp when the next physical punch can initiate
        this.lastUseStamp = 0;          // last timestamp that a physical punch cycle occurred
    }

    /**************************************/
    $$(id) {
        /* Returns a DOM element from its id property. Must not be called until
        punchOnLoad is called */

        return this.doc.getElementById(id);
    }

    /**************************************/
    setPunchReadyStatus() {
        /* Determines the punch-ready state of the card punch and the
        PUNCH READY lamp */
        const wasReady = this.punchReady;

        this.punchReady = this.transportReady && !this.punchCheck;
        if (this.punchReady && !wasReady) {
            this.$$("PunchReadyLamp").classList.add("annunciatorLit");
        } else if (wasReady && !this.punchReady) {
            this.$$("PunchReadyLamp").classList.remove("annunciatorLit");
        }
    }

    /**************************************/
    setTransportReady(ready) {
        /* Controls the ready state of the card punch supply hopper/transport */

        if (ready && !this.transportReady) {
            if (this.stackerCount < this.stackerLimit) {
                this.transportReady = true;
            }
        } else if (this.transportReady && !ready) {
            this.transportReady = false;
        }

        this.setPunchReadyStatus();
    }

    /**************************************/
    setPunchCheck(check) {
        /* Controls the punch-check state of the card punch and the PUNCH
        CHECK lamp */

        if (check && !this.punchCheck) {
            this.punchCheck = true;
            this.$$("PunchCheckLamp").classList.add("annunciatorLit");
            if (this.selectStopSwitch) {
                this.setTransportReady(false);
            }
        } else if (this.punchCheck && !check) {
            this.punchCheck = false;
            this.$$("PunchCheckLamp").classList.remove("annunciatorLit");
        }

        this.punchCheckPending = false;
        this.setPunchReadyStatus();
    }

    /**************************************/
    startBtnClick(ev) {
        /* Handle the click event for the START button */

        if (!this.transportReady) {
            this.setTransportReady(true);
            if (this.punchReady) {
                if (this.waitForTransport.requested) {
                    this.waitForTransport.signal(false);
                } else if (this.bufferBusy) {
                    this.initiateCardPunch();
                }
            }
        }
    }

    /**************************************/
    stopBtnClick(ev) {
        /* Handle the click event for the STOP button */

        if (this.transportReady) {
            this.setTransportReady(false);
        }
    }

    /**************************************/
    checkResetBtnClick(ev) {
        /* Handle the click event for the CHECK RESET button */

        if (this.punchCheck) {
            this.setPunchCheck(false);
        }
    }

    /**************************************/
    NPROSwitchAction(ev) {
        /* Handle the click events for the NPROSwitch. The punch must not be
        ready and the output supply hopper must be empty. The mousedown and
        mouse up events simply animate the button's appearance during a click */

        switch (ev.type) {
        case "mousedown":
            this.$$("NPROSwitch").classList.add("clicked");
            break;
        case "mouseup":
            this.$$("NPROSwitch").classList.remove("clicked");
            break;
        case "click":
            if (!this.transportReady) {
                this.setPunchCheck(false);
            }
            break;
        }
    }

    /**************************************/
    selectStopSwitchClick(ev) {
        /* Handle the click event for the SelectStopSwitch */

        this.selectStopSwitch = 1-this.selectStopSwitch;
        this.config.putNode("Card.selectStop", this.selectStopSwitch);
        this.$$("SelectStopSwitch").classList.toggle("nStop");
    }

    /**************************************/
    extractStacker() {
        /* Copies the text contents of the output stacker of the device, opens a
        new temporary window, and pastes that text into the window so it can be
        copied, printed, or saved by the user. All characters are ASCII according
        to the convention used by the 1620-Jr project */
        const title = "retro-1620 Card Punch Extract";

        const exportStacker = (ev) => {
            const doc = ev.target;
            const win = doc.defaultView;
            const content = doc.getElementById("Paper");

            doc.title = title;
            win.moveTo((screen.availWidth-win.outerWidth)/2, (screen.availHeight-win.outerHeight)/2);
            content.textContent = this.stacker.textContent;
        };

        openPopup(this.window, "./FramePaper.html", "",
                "scrollbars,resizable,width=660,height=500",
                this, exportStacker);
    }

    /**************************************/
    saveStacker() {
        /* Extracts the text of the CardPunch stacker area, converts it to a
        DataURL, and constructs a link to cause the URL to be "downloaded" and
        stored on the local device. All characters are ASCII according to the
        convention used by the 1620-Jr project */
        const title = "retro-1620 CardPunch Output";

        let text = this.stacker.textContent;
        if (!text.endsWith("\n")) {     // make sure there's a final new-line
            text = text + "\n";
        }

        const url = `data:text/plain,${encodeURIComponent(text)}`;
        const hiddenLink = this.doc.createElement("a");

        hiddenLink.setAttribute("download", title);
        hiddenLink.setAttribute("href", url);
        hiddenLink.click();
    }

    /**************************************/
    menuOpen() {
        /* Opens the CardPunch menu panel and wires up events */

        this.$$("StackerMenu").style.display = "block";
        this.$$("StackerMenu").addEventListener("click", this.boundMenuClick, false);
        this.$$("StackerPrintBtn").disabled = this.transportReady;
        this.$$("StackerSaveBtn").disabled = this.transportReady;
        this.$$("StackerClearBtn").disabled = this.transportReady;
    }

    /**************************************/
    menuClose() {
        /* Closes the CardPunch menu panel and disconnects events */

        this.$$("StackerMenu").removeEventListener("click", this.boundMenuClick, false);
        this.$$("StackerMenu").style.display = "none";
    }

    /**************************************/
    menuClick(ev) {
        /* Handles click for the menu icon and menu panel */

        switch (ev.target.id) {
        case "StackerMenuIcon":
            this.menuOpen();
            break;
        case "StackerExtractBtn":
            this.extractStacker();
            break;
        case "StackerPrintBtn":
            this.stackerFrame.contentWindow.print();
            break;
        case "StackerSaveBtn":
            this.saveStacker();
            break;
        case "StackerClearBtn":
            this.stacker.textContent = "";
            this.stackerCount = 0;
            this.stackerBar.value = 0;
            this.$$("StackerLamp").classList.remove("annunciatorLit");
            this.setPunchCheck(false);
            //-no break -- clear always closes the panel
        case "StackerCloseBtn":
            this.menuClose();
            break;
        }
    }

    /**************************************/
    receiveMessage(ev) {
        /* Handler for the window's onMessage event. At present, this is used
        only to receive a message from the CardReader containing the reader's
        screen geometry */

        if (ev.origin === this.origin && ev.data?.fcn === "CardReader.Geometry") {
            const geometry = ev.data.geometry;
            if (geometry) {
                this.window.moveTo(geometry.screenX, geometry.screenY - this.window.outerHeight);
            }
        }
    }

    /**************************************/
    beforeUnload(ev) {
        const msg = "Closing this window will make the device unusable.\n" +
                    "Suggest you stay on the page and minimize this window instead";

        ev.preventDefault();
        ev.returnValue = msg;
        return msg;
    }

    /**************************************/
    punchOnLoad(ev) {
        /* Initializes the punch window and user interface */

        this.doc = ev.target;           // now we can use this.$$()
        this.doc.title = "retro-1620 Card Punch";
        this.window = this.doc.defaultView;
        this.origin = `${this.window.location.protocol}//${this.window.location.host}`;
        this.setPunchReadyStatus();

        const panel = this.$$("ControlsDiv");
        this.stopBtn = new PanelButton(panel, null, null, "StopBtn", "STOP", "device yellowButton", "yellowButtonDown");
        this.startBtn = new PanelButton(panel, null, null, "StartBtn", "START", "device greenButton", "greenButtonDown");
        this.checkResetBtn = new PanelButton(panel, null, null, "CheckResetBtn", "CHECK<br>RESET", "device whiteButton", "whiteButtonDown");

        this.stackerBar = this.$$("StackerBar");
        this.stackerBar.value = 0;
        this.stackerBar.max = this.stackerLimit;
        this.stackerFrame = this.$$("StackerFrame");

        // Override the font size for the #Paper element inside the stackerFrame iframe.
        this.stacker = this.stackerFrame.contentDocument.getElementById("Paper");
        this.stacker.style.fontSize = "11px";
        this.stacker.style.lineHeight = "120%";

        this.selectStopSwitch = (this.config.getNode("Card.selectStop") ? 1 : 0);
        if (this.selectStopSwitch) {
            this.$$("SelectStopSwitch").classList.remove("nStop");
        } else {
            this.$$("SelectStopSwitch").classList.add("nStop");
        }


        this.window.addEventListener("beforeunload", this.beforeUnload);
        this.window.addEventListener("message", this.boundReceiveMessage);
        this.startBtn.addEventListener("click", this.boundStartBtnClick);
        this.stopBtn.addEventListener("click", this.boundStopBtnClick);
        this.checkResetBtn.addEventListener("click", this.boundCheckResetBtnClick);
        this.$$("NPROSwitch").addEventListener("click", this.boundNPROSwitchAction);
        this.$$("NPROSwitch").addEventListener("mousedown", this.boundNPROSwitchAction);
        this.$$("NPROSwitch").addEventListener("mouseup", this.boundNPROSwitchAction);
        this.$$("SelectStopSwitch").addEventListener("click", this.boundSelectStopSwitchClick);
        this.$$("StackerMenuIcon").addEventListener("click", this.boundMenuClick);

        this.setTransportReady(true);

        // Recalculate scaling and offsets after initial window resize.
        this.config.restoreWindowGeometry(this.window,
                this.innerWidth, this.innerHeight, this.windowLeft, this.windowTop);

        if (!this.config.getNode("persistentWindows")) {
            // Request the CardReader's screen geometry so we can position the punch's window.
            setTimeout(() => {
                const win = this.window.open("", "retro-1620.CardReader");
                if (win) {
                    win.postMessage({fcn: "CardPunch.RequestGeometry"}, this.origin);
                }
            }, 500);
        }
    }

    /**************************************/
    async initiateCardPunch() {
        /* Initiates the punching of the card from the card buffer */
        let now = performance.now();

        if (!this.transportReady) {
            if (await this.waitForTransport.request()) {
                return;                         // wait canceled
            }
        }

        // First, if the punch has been idle for more than one minute, the
        // motor will have timed out, so wait 500 ms for it to spin back up.
        if (now - this.lastUseStamp > CardPunch.idlePeriod) {
            await this.timer.delayFor(CardPunch.idleStartupTime);
            now += CardPunch.idleStartupTime;
        }

        // Next, compute time until the next clutch latch point occurs.
        if (this.nextLatchPointStamp < now) {
            // The next latch point has already passed, so compute a new one
            // based on where we are in the machine's cycle with respect to
            // the next latch point.
            const cyclePoint = now % this.punchLatchPeriod;
            this.nextLatchPointStamp = now + this.punchLatchPeriod - cyclePoint;
        }

        // Compute delay until the next cluth latch point and post-punch buffer ready.
        const delay = this.nextLatchPointStamp + this.bufferReadyDelay - now;
        this.lastUseStamp = this.nextLatchPointStamp;
        this.nextLatchPointStamp += this.punchLatchPeriod;  // earliest time next punch can occur

        // Punch the card image.
        this.stacker.appendChild(this.doc.createTextNode(this.cardBuffer.trimEnd() + "\n"));
        this.stacker.scrollIntoView(false);     // keep last line in view
        this.stackerBar.value = ++this.stackerCount;
        if (this.punchCheckPending) {
            this.setPunchCheck(true);           // leave buffer in ready state
        } else if (this.stackerCount >= this.stackerLimit) {
            this.setTransportReady(false);
            this.$$("StackerLamp").classList.add("annunciatorLit");
        }

        // Wait for punching to complete before resetting buffer ready.
        setTimeout(() => {
            this.cardBuffer = "";               // clear the internal card buffer
            this.bufferBusy = false;            // buffer is ready to receive more data
            this.waitForBuffer.signal(false);   // tell 'em it's ready
        }, delay);
    }

    /**************************************/
    dumpNumeric(ptCode) {
        /* Writes one digit to the card buffer. This should be used directly by
        Dump Numerically (DN, 35). Simply calls this.writeNumeric and returns
        its Promise result */

        return this.writeNumeric(ptCode);
    }

    /**************************************/
    async writeNumeric(ptCode) {
        /* Writes one character code to the card buffer. This should be used
        directly by Write Numerically (WN, 38) Returns 1 after the 80th
        character is received */
        let eob = 0;                    // end-of-block signal to Processor

        if (this.bufferBusy) {          // buffer not available to receive now
            if (await this.waitForBuffer.request()) {
                return 1;               // wait canceled
            }
        }

        const char = CardPunch.xlatePTCodeToNumeric[ptCode] ?? "?";
        if (char == "?") {
            this.punchCheckPending = true;
        }

        this.cardBuffer += char;
        if (this.cardBuffer.length >= CardPunch.columns) {
            this.bufferBusy = true;
            await this.initiateCardPunch();
            eob =  1;
        }

        return eob;
    }

    /**************************************/
    async writeAlpha(ptCode) {
        /* Writes one character code to the card buffer. This should be used
        directly by Write Alphanumerically (WA, 39). Returns 1 after the 80th
        character is received */
        let eob = 0;                    // end-of-block signal to Processor

        if (this.bufferBusy) {          // buffer not available to receive now
            if (await this.waitForBuffer.request()) {
                return 1;               // wait canceled
            }
        }

        const char = CardPunch.xlatePTCodeToAlpha[ptCode] ?? "?";
        if (char == "?") {
            this.punchCheckPending = true;
        }

        this.cardBuffer += char;
        if (this.cardBuffer.length >= CardPunch.columns) {
            this.bufferBusy = true;
            await this.initiateCardPunch();
            eob = 1;
        }

        return eob;
    }

    /**************************************/
    initiateWrite() {
        /* Called by Processor to initiate a write I/O. Not used with CardPunch */
    }

    /**************************************/
    release() {
        /* Called by Processor to initiate the device has been released.
        Not used by CardPunch */
    }

    /**************************************/
    manualRelease() {
        /* Called by Processor to indicate the device has been released manually */

        this.waitForBuffer.signal(true);
        this.waitForTransport.signal(true);
    }

    /**************************************/
    shutDown() {
        /* Shuts down the device */

        this.menuClose();
        this.startBtn.removeEventListener("click", this.boundStartBtnChange);
        this.stopBtn.removeEventListener("click", this.boundStopBtnChange);
        this.checkResetBtn.removeEventListener("click", this.boundCheckResetBtnClick);
        this.$$("NPROSwitch").removeEventListener("click", this.boundNPROSwitchAction);
        this.$$("NPROSwitch").removeEventListener("mousedown", this.boundNPROSwitchAction);
        this.$$("NPROSwitch").removeEventListener("mouseup", this.boundNPROSwitchAction);
        this.$$("SelectStopSwitch").removeEventListener("click", this.boundSelectStopSwitchClick);
        this.$$("StackerMenuIcon").removeEventListener("click", this.boundMenuClick);

        this.config.putWindowGeometry(this.window, "CardPunch");
        this.window.removeEventListener("message", this.boundReceiveMessage);
        this.window.removeEventListener("beforeunload", this.beforeUnload);
        this.window.close();
    }

} // end class CardPunch
