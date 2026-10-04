# Headless CLI driver (`run1620.mjs`)

A Node.js driver for the retro-1620 emulator core (`emulator/*.js`), for
running decks and debugging without a browser. The emulator's core
(`Processor.js` and its siblings) has no DOM dependencies; everything
DOM-coupled lives in `webUI/`. This tool supplies minimal headless
stand-ins for the three devices IPL-V work actually needs — card reader,
typewriter, card punch — and drives the processor directly.

## Usage

```
node tools/cli/run1620.mjs [options] <card-file> [<card-file> ...]
```

Each `<card-file>` is a plain-text card image: one physical card per line,
80 columns, in whatever text convention the rest of this repo's `.card`
and `.ipl` files use (digit strings for object decks, free-column source
for symbolic decks — see `software/IPL-V/README.txt`). Files are
concatenated, in the order given, into one virtual card-reader hopper —
this is how a multi-deck load (loader + source program + subroutines +
interpreter) gets assembled. For example, to boot the IPL-V interpreter
with a source program:

```
node tools/cli/run1620.mjs \
    software/IPL-V/Mod-3-4/IPL-V-Interpreter-Mod-3-4-Deck-1.card \
    software/IPL-V/Ackermann.ipl \
    software/IPL-V/IPL-V-Subroutines.card \
    software/IPL-V/Mod-3-4/IPL-V-Interpreter-Mod-3-4-Deck-2.card
```

## What it does

1. Reads and concatenates all the given files into one hopper.
2. Builds a minimal `context` (see below) and constructs a `Processor`
   with headless `cardReader`/`typewriter`/`cardPunch` devices.
3. Powers up, applies `--switches`/`--trace` as requested, then boots via
   `processor.insert(true)` (the LOAD key).
4. Polls until the processor halts, check-stops, or `--timeout` expires —
   see **Auto-restart on HALT** below for what happens while polling.
5. Prints a summary and, unless `--quiet`, echoes typewriter and card
   punch output live as it happens.
6. Calls `process.exit()` explicitly. `Processor.run()` re-invokes itself
   fire-and-forget from device callbacks, and the emulator's own
   throttling keeps re-arming real timers, so the event loop never empties
   on its own once the machine is running — without an explicit exit, node
   would keep tracing/printing indefinitely past the point this script is
   done with it.

## Options

| Option | Default | Effect |
|---|---|---|
| `--trace` | off | Turn on the emulator's own instruction trace (`processor.tracing = true`; each instruction is logged via `console.log('<TRACE> ...')`, coming straight from `emulator/Processor.js`). |
| `--trace-after <cards>` | 0 (immediate) | Delay enabling `--trace` until at least this many cards have been read. See **Why delay tracing?** below. |
| `--trace-delay <ms>` | 0 (immediate) | Delay enabling `--trace` until this many wall-clock milliseconds have elapsed since start. An alternative to `--trace-after` for phases that aren't gated by card count (e.g. the interpreter's own post-load initialization). If both this and `--trace-after` are given, whichever condition is met first turns tracing on. |
| `--switches 1,2,3,4` | none | Set the given 1620 console Program Switches on before running (comma-separated, any subset of 1-4). IPL-V's *own* trace/dump facility is gated by these switches (see **Program Switches**, below) — this is a separate, lighter-weight mechanism from `--trace`, and writes to the card punch, not the typewriter. |
| `--timeout <ms>` | 30000 | Wall-clock safety cap on the whole run. If the machine hasn't halted by then, the run is reported as `timeout` and the process exits anyway — useful since a bug can produce a genuinely unbounded loop. |
| `--memory <digits>` | 40000 | Core memory size, in digits (matches the `memorySize` config elsewhere in the app; max for a real 1620 is 60000). |
| `--max-restarts <n>` | 500 | Cap on how many times this driver will auto-press START in response to a HALT (see below) before giving up and reporting `halted` anyway. |
| `--quiet` | off | Don't echo typewriter/card-punch output live to stdout as it's produced; instead, print it all at the end under `--- Typewriter output ---` / `--- Punched cards ---` headers. Status/progress messages (`Loaded N card(s)...`, `<HALT ...>`, the final summary) always go to stderr regardless of this flag, so `--quiet` is really "buffer the *emulator's* output, not mine." |

Positional arguments (anything not matching a `--flag`) are treated as
card-image files, in the order given.

## Auto-restart on HALT

Multi-phase 1620 boot decks — including the IPL-V load deck — HALT between
phases: e.g. the loader may relocate itself or hand off to the next stage,
then stop and wait for the operator to press START to continue. This
driver detects a HALT (`processor.gateMANUAL.value` true and
`processor.running` false) and presses START (`processor.start()`)
automatically, repeatedly, until either:

- a restart makes **no further progress** at all — nothing newly read,
  printed, or punched compared to the previous restart — at which point
  the run is reported as `halted` (this is the normal, successful end of
  a run that actually finishes and stops), or
- `--max-restarts` is exhausted, also reported as `halted`.

Do **not** assume "some card-punch or typewriter output appeared" means
the run is finished — the load deck's own source-listing dump (from
`--switches 3`/`4`) produces plenty of card-punch output long before the
loaded program starts actually executing. This driver deliberately keeps
restarting through that; only a truly unchanged before/after snapshot
counts as done.

There's a subtlety in *when* it's safe to press START, documented in
comments in the source: a device callback that's still pending (e.g. a
Typewriter Control op whose `.then()` hasn't fired yet) can independently
call `this.run()` a few ticks after `gateMANUAL`/`running` already look
idle. Calling `start()` (which also calls `run()`) while that happens
trips `Processor`'s own "Multiple instances of `this.run()` active"
check-stop. The driver waits for the idle state to *hold* for several
consecutive polls (~750ms) before actually pressing START, to let any such
pending callback settle first.

## Why delay tracing? (`--trace-after` / `--trace-delay`)

A full `--trace` from cold boot is dominated, by orders of magnitude, by
the load deck itself and — worse — by the interpreter's own post-load
initialization (building its H2 available-space free-cell list by
visiting essentially every unused memory cell one at a time). For a
40000-digit memory that alone can produce tens of millions of trace lines
before the loaded program's own logic ever executes a single instruction.
`--trace-after <cards>` (gate on cards read) or `--trace-delay <ms>` (gate
on wall-clock time) let you skip past that and capture only the portion
you actually care about. In practice: `--trace-after <total card count>`
gets you past card *loading*, but the H2-list-building phase happens
*after* that and needs a `--trace-delay` on top (empirically, several
real seconds for a 40000-digit memory) if you want to see the interpreted
program's actual execution rather than more list-building.

## Program Switches

IPL-V has its own trace/dump facility, separate from the emulator's
`--trace`, controlled by the four Program Switches on the 1620 console —
in the emulator these are plain properties `processor.program1Switch`
through `program4Switch` (see `emulator/Processor.js`). This driver sets
them directly from `--switches`, with no UI involved. Per Paul Kimpel's
notes (see `software/IPL-V/Mod-3-4/README.txt`), their effects are (this
is inferred behavior, not from written documentation):

- **Switch 1** — per-instruction tracing, gated additionally by the Q
  digit of individual IPL-V instructions ("TRACE ALL ROUTINES" in a
  source program sets this up) — output goes to the card punch.
- **Switch 2** — global tracing, independent of any per-instruction Q
  digit.
- **Switch 3** — dumps a symbol table / linkage info for the J-subroutine
  primitives as they're loaded.
- **Switch 4** — dumps IPL-V source statements (plus assembled object
  code) to the card punch as they're loaded — this is the source-listing
  dump mentioned above.

All four write to the **card punch**, not the typewriter — use the
`cardPunch` output (or `--switches` with the default non-`--quiet` echo)
to see this trace, not `--trace`.

## The minimal `context` and headless devices

`Processor`'s constructor takes a `context` object; this driver supplies
the minimum it actually reads:

- `context.config.getNode(name)` — answers `"memorySize"` from
  `--memory`, and `false` for `"indexRegisters"`/`"floatingPoint"`/
  `"binaryCapabilities"` (none of the software here needs them).
- `context.controlPanel.alert(msg)` — logs to stderr; only called on an
  internal panic/invalid-state condition.
- `context.devices` — `HeadlessCardReader`, `HeadlessTypewriter`,
  `HeadlessCardPunch` (see the sibling `.mjs` files in this directory).
  These reuse the real `webUI/Typewriter.js`/`webUI/CardPunch.js`
  translation tables directly (importing those modules is safe — they
  have no DOM access at module load time, only inside methods/
  constructors this driver never calls) rather than duplicating that
  data, but replace the DOM-driven behavior (popup windows, physical
  timing delays) with in-memory buffering and immediate, synchronous(-ish)
  responses.

No other device (line printer, disk drive, paper tape) is supplied; a
deck that tries to use one will hit a runtime error (`undefined` device),
which is fine for IPL-V work but worth knowing if you point this at
something else.

## Known limitations / open issues

- Address `MAR Check: fetch() invalid memory address=...` and similar
  hard check-stops are real emulator-reported errors, not driver bugs —
  but see `software/IPL-V/Mod-3-4/README.txt` for the current state of
  the (still open) Ackermann recursion bug this tool was built to chase;
  some of what looks like "the deck is broken" may instead be a
  transcription error in a hand-built `.ipl` test file.
- There's no way yet to inject input mid-run (e.g. via the typewriter
  keyboard) — everything must come from the initial card hopper.
- The polling loop's ~750ms settle delay before each auto-restart, and the
  ~20ms base poll interval, add real wall-clock overhead on top of the
  emulator's own execution time — a run that needs many restarts will
  take noticeably longer under this driver than the emulator's raw
  execution time alone.
- By default this driver disables `envir.throttle()`'s real-1620-speed
  pacing (there's no real hardware to stay in sync with), so runs
  complete as fast as the host CPU allows — pass `--real-time` to restore
  the normal throttled timing if you're specifically investigating a
  timing-sensitive device interlock. Without `--real-time`, even the
  small `simple*.ipl` test programs (which still load the full ~700+
  card interpreter deck) drop from ~15-16s to ~3-4s wall-clock.
