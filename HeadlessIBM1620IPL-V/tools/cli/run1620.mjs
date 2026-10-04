#!/usr/bin/env node
/***********************************************************************
* retro-1620/tools/cli run1620.mjs
************************************************************************
* Headless CLI driver for the retro-1620 emulator core (emulator/*.js).
* Loads one or more card-image files (deck object code, IPL-V source,
* etc.) into a virtual card hopper, in the order given, boots from the
* card reader, and runs until the processor halts, check-stops, or a
* wall-clock timeout expires.
*
* Usage:
*   node tools/cli/run1620.mjs [options] <card-file> [<card-file> ...]
*
* Options:
*   --trace              Enable the emulator's instruction trace
*                         (processor.tracing = true; console.log output).
*   --switches 1,2,3,4    Set the given 1620 console Program Switches on
*                         before running (comma-separated list of 1-4).
*   --timeout <ms>        Wall-clock safety cap (default 30000).
*   --memory <digits>     Core memory size (default 40000).
*   --quiet               Don't echo typewriter/card-punch output live;
*                         only print the final summary.
*   --max-restarts <n>    Cap on auto-pressing START after a HALT
*                         (default 500) -- see below.
*   --trace-after <n>     Only turn on --trace once at least n cards have
*                         been read (default 0, i.e. immediately) -- lets
*                         you skip the noisy load-deck portion of a trace
*                         and capture only the actual program execution.
*   --real-time            Keep the emulator's normal real-1620-speed
*                         throttling (envir.throttle()) instead of the
*                         default, which disables it so runs complete as
*                         fast as the host CPU allows. There's no
*                         real hardware to stay in sync with here, so the
*                         default is unthrottled; pass this flag only if
*                         you specifically need to reproduce real-1620
*                         timing (e.g. investigating a timing-sensitive
*                         device interlock).
*
* Multi-phase 1620 boot decks (like the IPL-V load deck) conventionally
* HALT between phases and expect the operator to press START to
* continue; this driver does that automatically whenever it detects a
* HALT, until a restart makes no further progress (nothing read,
* printed, or punched) or --max-restarts is exhausted.
***********************************************************************/

import {readFileSync} from "node:fs";
import {Processor} from "../../emulator/Processor.js";
import {HeadlessCardReader} from "./HeadlessCardReader.mjs";
import {HeadlessTypewriter} from "./HeadlessTypewriter.mjs";
import {HeadlessCardPunch} from "./HeadlessCardPunch.mjs";

/**************************************/
function parseArgs(argv) {
    const opts = {
        trace: false,
        switches: [],
        timeout: 30000,
        memory: 40000,
        quiet: false,
        maxRestarts: 500,
        traceAfter: 0,
        traceDelay: 0,
        realTime: false,
        files: []
    };

    for (let x=0; x<argv.length; ++x) {
        const arg = argv[x];
        switch (arg) {
        case "--trace":
            opts.trace = true;
            break;
        case "--quiet":
            opts.quiet = true;
            break;
        case "--switches":
            opts.switches = argv[++x].split(",").map(Number);
            break;
        case "--timeout":
            opts.timeout = Number(argv[++x]);
            break;
        case "--memory":
            opts.memory = Number(argv[++x]);
            break;
        case "--max-restarts":
            opts.maxRestarts = Number(argv[++x]);
            break;
        case "--trace-after":
            opts.traceAfter = Number(argv[++x]);
            break;
        case "--trace-delay":
            opts.traceDelay = Number(argv[++x]);
            break;
        case "--real-time":
            opts.realTime = true;
            break;
        default:
            opts.files.push(arg);
            break;
        }
    }

    return opts;
}

/**************************************/
function loadHopper(files) {
    const hopper = [];

    for (const file of files) {
        const text = readFileSync(file, "latin1");
        const lines = text.split(/\r?\n/);
        if (lines.length && lines.at(-1) === "") {
            lines.pop();             // drop the trailing empty line from a final newline
        }

        lines.forEach((line, i) => {
            hopper.push(line);
            // Same character set the GUI card reader accepts (CardReader.invalidCharRex).
            const bad = line.match(/[^A-Z0-9 .)+$*\-/,(=@|}!"\]]/g);
            if (bad) {
                console.error(`WARNING: ${file}:${i+1}: invalid card character(s) ${[...new Set(bad)].map(c => JSON.stringify(c)).join(" ")} (the GUI card reader will choke)`);
            }
        });
    }

    return hopper;
}

/**************************************/
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**************************************/
async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.files.length == 0) {
        console.error("Usage: node tools/cli/run1620.mjs [options] <card-file> [<card-file> ...]");
        process.exitCode = 1;
        return;
    }

    process.on("unhandledRejection", err => {
        console.error("<Unhandled rejection in emulator run loop>", err);
    });

    const hopper = loadHopper(opts.files);
    console.error(`Loaded ${hopper.length} card(s) from ${opts.files.length} file(s).`);

    const context = {
        config: {
            getNode(name) {
                switch (name) {
                case "memorySize":         return opts.memory;
                case "indexRegisters":     return false;
                case "floatingPoint":      return false;
                case "binaryCapabilities": return false;
                default:                   return undefined;
                }
            }
        },
        controlPanel: {
            alert(msg) {
                console.error(`<ALERT> ${msg}`);
            }
        },
        devices: null                   // filled in below, before powerUp()
    };

    const processor = new Processor(context);
    if (!opts.realTime) {
        // No real hardware to stay in sync with here -- skip the
        // artificial delay envir.throttle() normally inserts to pace
        // execution to real-1620 speed, so runs complete as fast as the
        // host CPU allows instead of taking ~15s+ just to load the
        // interpreter's own ~700+ card deck.
        processor.envir.throttle = () => Promise.resolve();
    }

    const cardReader = new HeadlessCardReader(processor, hopper);
    const typewriter = new HeadlessTypewriter(!opts.quiet);
    const cardPunch = new HeadlessCardPunch(!opts.quiet);

    context.devices = {cardReader, typewriter, cardPunch};

    processor.powerUp();
    processor.tracing = opts.trace && opts.traceAfter <= 0 && opts.traceDelay <= 0;
    for (const sw of opts.switches) {
        processor[`program${sw}Switch`] = 1;
    }

    if (opts.switches.length) {
        console.error(`Program switches on: ${opts.switches.join(", ")}`);
    }

    if (opts.trace) {
        console.error("Instruction tracing enabled.");
    }

    processor.insert(true);         // boot from the card reader (LOAD key)

    const startTime = Date.now();
    const deadline = startTime + opts.timeout;
    let status = "timeout";
    let restarts = 0;
    let lastProgress = null;
    while (Date.now() < deadline) {
        if (opts.trace && !processor.tracing) {
            if (opts.traceAfter > 0 && cardReader.cardsRead >= opts.traceAfter) {
                processor.tracing = true;
                console.error(`<Tracing enabled after ${cardReader.cardsRead} card(s)>`);
            } else if (opts.traceDelay > 0 && Date.now() - startTime >= opts.traceDelay) {
                processor.tracing = true;
                console.error(`<Tracing enabled after ${opts.traceDelay}ms>`);
            }
        }

        if (processor.gateCHECK_STOP.value) {
            status = "check-stop";
            break;
        }

        if (processor.gateMANUAL.value && !processor.running) {
            // Multi-phase 1620 boot decks conventionally HALT between
            // phases (e.g. after the loader relocates itself/the next
            // phase) and expect the operator to press START to continue.
            // Auto-press START, up to a limit, until real output has
            // appeared or the run truly stops making progress.
            //
            // Before pressing it, wait for the state to *settle*: a
            // pending async device callback (e.g. a Typewriter Control op's
            // .then()) can still be queued to call this.run() on its own a
            // few ticks from now, even though gateMANUAL/running look idle
            // right now. Calling start() (-> run()) while that fires trips
            // Processor's own "Multiple instances of this.run() active"
            // check-stop. Require the idle state to hold for several
            // consecutive polls first.
            let settled = true;
            for (let i=0; i<30; ++i) {
                await sleep(25);
                if (!processor.gateMANUAL.value || processor.running || processor.gateCHECK_STOP.value) {
                    settled = false;
                    break;
                }
            }

            if (!settled) {
                continue;
            }

            // Output alone (even the source-listing dump produced while
            // still loading) doesn't mean the run is actually finished --
            // only stop restarting once a restart makes no further
            // progress at all (nothing read, printed, or punched), or the
            // restart budget is used up.
            const progress = `${cardReader.cardsRead}:${typewriter.buffer.length}:${cardPunch.cards.length}`;
            if (restarts > 0 && progress === lastProgress) {
                status = "halted";
                break;
            }

            if (restarts >= opts.maxRestarts) {
                status = "halted";
                break;
            }

            lastProgress = progress;
            ++restarts;
            console.error(`<HALT, auto-pressing START (${restarts}/${opts.maxRestarts})>`);
            processor.start();
        }

        await sleep(20);
    }

    console.error("");
    console.error(`--- run1620: ${status} ---`);
    console.error(`Cards read: ${cardReader.cardsRead} (${cardReader.hopper.length} remaining in hopper)`);
    console.error(`Cards punched: ${cardPunch.cards.length}`);
    if (status == "check-stop") {
        console.error("Processor entered CHECK STOP / MANUAL.");
    } else if (status == "timeout") {
        console.error(`No halt within ${opts.timeout}ms -- likely runaway/infinite loop.`);
    }

    if (opts.quiet) {
        if (typewriter.buffer) {
            console.log("--- Typewriter output ---");
            console.log(typewriter.buffer);
        }

        if (cardPunch.cards.length) {
            console.log("--- Punched cards ---");
            for (const card of cardPunch.cards) {
                console.log(card);
            }
        }
    }

    // Processor.run() re-invokes itself fire-and-forget from device
    // callbacks (see HeadlessCardReader.initiateRead()'s comment) and
    // envir.throttle() re-arms real setTimeout timers as it goes, so the
    // event loop never empties on its own once the machine is running --
    // without an explicit exit, node keeps going (and tracing/printing)
    // indefinitely past this point instead of stopping when we do.
    process.exit(status === "check-stop" ? 1 : 0);
}

main();
