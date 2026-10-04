/***********************************************************************
* retro-1620/emulator FlipFlop.js
************************************************************************
* Copyright (c) 2022, Paul Kimpel.
* Licensed under the MIT License, see
*       http://www.opensource.org/licenses/mit-license.php
************************************************************************
* JavaScript class module for an internal processor flip-flop with lamp
* intensity averaging for incandescent bulbs.
************************************************************************
* 2022-07-19  P.Kimpel
*   Original version, from retro-g15 FlipFlop.js.
* 2023-01-19  P.Kimpel
*   Reformat to use newer JavaScript static and public field definitions.
***********************************************************************/

export {FlipFlop}

import {Envir} from "./Envir.js";


class FlipFlop {

    // Public Static Properties

    static lampPersistence =  17;       // persistence of incandescent bulb glow [ms]

    // Public Instance Properties

    lastETime = 0;                      // time flip-flop was last set
    intVal = 0;                         // binary value of flip-flop: read-only externally
    glow = 0;                           // average lamp glow value

    constructor(envir, visible) {
        /* Constructor for the generic FlipFlop class. "envir" is a reference to
        the object that maintains the emulation clock, which must support the
        property "eTime". That property reports the current emulation time in
        milliseconds. Emulation time is used to compute lamp glow decay and a
        time-weighted exponential average intensity.

        "visible" should be false if the register does not have a visible
        presence in the UI -- this will inhibit computing average lamp glow
        values for the register.

        Note that it is important to call envir.tick() in the caller to increment
        envir.eTime AFTER setting new values in registers and flip-flops. This
        allows the average intensity to be computed based on the amount of time
        a bit was actually in that state */

        this.visible = (visible ? true : false);
        this.envir = envir;             // local copy of clock object
    }

    // Public Instance Methods

    get value() {
        return this.intVal;
    }

    set value(value) {
        /* Set the value of the FF. Use this rather than setting the intVal
        member directly so that average lamp glow can be computed */

        this.updateLampGlow(0);
        this.intVal = (value ? 1 : 0);
    }

    /**************************************/
    flip() {
        /* Complement the value of the FF. Returns the new value */

        return this.value = 1-this.intVal;
    }

    /**************************************/
    updateLampGlow(beta=0) {
        /* Updates the average glow for the flip flop. Note that the glow is
        always aged by at least one clock tick. Beta is a bias in the
        range (0,1). For normal update, use 0; to freeze the current state, use 1 */

        if (this.visible) {
            let eTime = this.envir.eTime;
            let delta = eTime - this.lastETime;
            if (delta < Envir.cycleTime) {
                delta = Math.max(delta, 0) + Envir.tickTime;
                eTime = this.lastETime + delta;
            }

            let alpha = Math.min(delta/FlipFlop.lampPersistence + beta, 1.0);
            this.glow = this.glow*(1.0-alpha) + this.intVal*alpha;
            this.lastETime = eTime;
        }
    }

} // class FlipFlop
