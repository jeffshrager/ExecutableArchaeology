/***********************************************************************
* retro-1620/emulator Timer.js
************************************************************************
* Copyright (c) 2022, Paul Kimpel.
* Licensed under the MIT License, see
*       http://www.opensource.org/licenses/mit-license.php
************************************************************************
* Timer class that wraps the native JavaScript setTimeout() method with
* a Promise interface. Since most browsers will delay for a minimum of
* 4ms when a "nested" setTimeout() call is made, this object will return
* a resolved Promise when a delay less than 4ms is requested, resulting
* in a minmal delay -- a wait on the Promise resumes after a trip through
* the JavaScript event loop.
************************************************************************
* 2022-11-05  P.Kimpel
*   Original version, from retro-g15 Util.js.
* 2023-01-19  P.Kimpel
*   Reformat to use newer JavaScript static and public field definitions.
***********************************************************************/

export {Timer};

class Timer {

    // Static properties

    static minTimeout = 4;              // browsers will do setTimeout for at least 4ms

    // Public Instance Properties

    rejector = null;                    // saved reference to the Promise reject function
    timerHandle = 0;                    // setTimeout() cancel handle


    /**************************************/
    clear() {
        /* Clears the timer if it is set */

        if (this.timerHandle !== 0) {
            clearTimeout(this.timerHandle);
            this.rejector = null;
            this.timerHandle = 0;
        }
    }

    /**************************************/
    delayFor(delay, value) {
        /* Initiates the timer for "delay" milliseconds and returns a Promise that
        will resolve when the timer expires. The "value" parameter is optional and
        will become the value returned by the Promise */

        if (delay <= Timer.minTimeout) {
            return Promise.resolve(value);
        } else {
            return new Promise((resolve, reject) => {
                this.rejector = reject;
                this.timerHandle = setTimeout((retVal) => {
                    this.rejector = null;
                    this.timerHandle = 0;
                    resolve(retVal);
                }, delay, value);
            });
        }
    }

    /**************************************/
    delayUntil(then, value) {
        /* Initiates the timer for a delay until performance.now() reaches "then".
        "value" is the same as for delayFor(). Returns a Promise that resolves
        when the time is reached */

        return this.delayFor(then - performance.now(), value);
    }

    /**************************************/
    reject() {
        /* Clears the timer if it is set and rejects the Promise */

        if (this.timerHandle !== 0) {
            this.rejector();
            this.clear();
        }
    }

} // class Timer
