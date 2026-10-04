/***********************************************************************
* retro-1620/webUI PanelButton.js
************************************************************************
* Copyright (c) 2022, Paul Kimpel.
* Licensed under the MIT License, see
*       http://www.opensource.org/licenses/mit-license.php
************************************************************************
* JavaScript class module for large panel buttons. The button will
* subtly highlight when it is clicked and released. The click event can
* be captured either by calling this.addEventListener or by registering
* an event handler that captures events on the DOM element.
************************************************************************
* 2022-11-16  P.Kimpel
*   Original version, from ColoredLamp.js.
***********************************************************************/

export {PanelButton}

class PanelButton {

    // Static class properties

    static topCaptionClass = "coloredLampTopCaption";
    static bottomCaptionClass = "coloredLampBottomCaption";


    constructor(parent, x, y, id, caption, upClass, downClass) {
        /* Parameters:
            parent      the DOM container element for this button object.
            x & y       coordinates of the button within its containing element.
            id          the DOM id for the button object.
            caption     text to be displayed on the button.
            upClass     CSS class name for the button in its normal state (up).
            downClass   CSS class name for the button in its clicked state (down) */

        this.topCaptionDiv = null;          // optional top caption element
        this.bottomCaptionDiv = null;       // optional bottom caption element
        this.buttonUpClass = upClass;       // css styling for an "off" button
        this.buttonDownClass = downClass;   // css styling for an "on" button
        this.buttonDown = false;            // button is currently down

        // visible DOM element
        this.element = document.createElement("button");
        this.element.id = id;
        this.element.className = upClass;
        this.element.innerHTML = caption;
        if (x !== null) {
            this.element.style.left = x.toString() + "px";
        }
        if (y !== null) {
            this.element.style.top = y.toString() + "px";
        }

        if (parent) {
            parent.appendChild(this.element);
        }

        this.element.addEventListener("mousedown", (ev) => {
            this.setButtonDown();
        }, false);
        this.element.addEventListener("mouseup", (ev) => {
            this.setButtonUp();
        }, false);
        this.element.addEventListener("mouseout", (ev) => {
            this.checkButtonDrag();
        }, false);
    }

    /**************************************/
    addEventListener(eventName, handler, options) {
        /* Sets an event handler on the button element */

        this.element.addEventListener(eventName, handler, options);
    }

    /**************************************/
    removeEventListener(eventName, handler, options) {
        /* Removes an event handler from the button element */

        this.element.removeEventListener(eventName, handler, options);
    }

    /**************************************/
    setButtonDown() {
        /* Sets the styling on the button to make it appear "down" */

        this.element.classList.add(this.buttonDownClass);
        this.buttonDown = true;
    }

    /**************************************/
    setButtonUp() {
        /* Removes the styling on the button that makes it appear "down" */

        this.element.classList.remove(this.buttonDownClass);
        this.buttonDown = false;
    }

    /**************************************/
    checkButtonDrag() {
        /* Handler for the mouseout event. If the user moves the pointer outside
        the boundaries of the button while holding down the button and then
        releases it, the button will not get the mouseup event, and the click
        doesn't happen. We check whether we're halfway through a click, and if
        so, remove the button-down appearance */

        if (this.buttonDown) {
            this.setButtonUp();
        }
    }

    /**************************************/
    setCaption(caption, atBottom) {
        /* Establishes an optional caption at the top or bottom of a single lamp.
        Returns the caption element */
        let e = (atBottom ? this.bottomCaptionDiv : this.topCaptionDiv);

        if (e) {
            e.textContent = caption;
        } else {
            e = document.createElement("div");
            if (atBottom) {
                this.bottomCaptionDiv = e;
                e.className = PanelButton.bottomCaptionClass;
            } else {
                this.topCaptionDiv = e;
                e.className = PanelButton.topCaptionClass;
            }
            e.appendChild(document.createTextNode(caption));
            this.element.appendChild(e);
        }
        return e;
    }

} // class PanelButton
