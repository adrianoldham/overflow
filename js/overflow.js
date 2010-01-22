var Overflow = Class.create({
    initialize: function(selector, options) {
        this.options = Object.extend(Object.extend({ }, Overflow.DefaultOptions), options || { });
                
        this.setupScrollables(selector);
    },

    setupScrollables: function(selector) {
        this.scrollables = [];

        // find all scrollables that have an overflow set to auto or scroll
        $$(selector).each(function(scrollable) {
            if (scrollable.getStyle("overflow") != "visible") {
                this.scrollables.push(new Overflow.Scrollable(scrollable, this));
            }
        }.bind(this));
    },
    
    recalculateHeight: function() {
        this.scrollables.each(function(scrollable) {
            scrollable.recalculateHeight(null, true);
        }.bind(this));
    }
});

Overflow.Scrollable = Class.create({
    initialize: function(element, parent) {
        this.element = element;
        this.parent = parent;
        
        this.setup();
    },
    
    setup: function() {
        // setup wrapper element (needed so that scrollbar can be positioned relatively)
        this.setupWrapper();
        this.setupScrollBar();

        this.updateScrollWidget();
        
        if (this.parent.options.zoomable) {
            this.wrapper.style.display = "none";
        }
        
        this.setupButtons();
        
        // Perform the focus check (initial setup and focus)
        this.setupFocusCheck();
        
        this.memoryHideElement(this.hiddenElements);
    },
    
    // This will focus on the given element
    focusOn: function(element) {
        var elementOffset = element.cumulativeOffset();
        var overflowOffset = this.element.cumulativeOffset();
        
        this.scrollTo(elementOffset.top - overflowOffset.top);
    },
    
    setupFocusCheck: function() {
        // Find the focus check elements, and do an initial focus class check
        this.focusCheckElements = this.element.select(this.parent.options.focusCheckSelector);
        
        this.focusCheckElements.each(function(focusCheckElement) {
            if (focusCheckElement.hasClassName(this.parent.options.focusCheckClass)) {
                this.focusOn(focusCheckElement);
            }
            
            // Observe custom event for firing the focus checker (outside of overflow)
            focusCheckElement.observe("overflow:focus", function(event) {
                this.focusOn(event.target);            
            }.bindAsEventListener(this));
        }.bind(this));
    },
    
    setupWrapper: function() {
        var element = this.element;
        this.hiddenElements = this.memoryShowElement(element);
        
        this.wrapper = new Element("div");
        
        if (this.parent.options.zoomable) {
            this.wrapper.id = this.element.id;
            this.element.id = null;
            this.element.style.display = "block";

            var styles = ["background", "backgroundColor", "backgroundImage", "backgroundRepeat", "backgroundPosition",
                          "border", "borderBottom", "borderBottomColor", "borderBottomStyle", "borderBottomWidth",
                          "borderColor", "borderLeft", "borderLeftColor", "borderLeftStyle", "borderLeftWidth",
                          "borderRight", "borderRightColor", "borderRightStyle", "borderRightWidth",
                          "borderTop", "borderTopColor", "borderTopStyle", "borderTopWidth"];
            
            styles.each(function(style) {
                var value = this.element.getStyle(style);
                
                if (value != null && value != "") {
                    this.wrapper.style[style] = value;
                }
            }.bind(this));
            
            this.element.setStyle({
                background: "none",
                border: "none"
            });
        }

        this.wrapper.setStyle({
            position: "relative",
            width: this.element.getWidth() + "px",
            height: this.element.getHeight() + "px"
        });
                
        // use the correct margins for wrapper and remove them from the element
        $A(["marginLeft", "marginRight", "marginBottom", "marginTop"]).each(function(p) {
            var styles = {}; styles[p] = this.element.getStyle(p);
            var removeStyles = {}; removeStyles[p] = "0";
            
            this.wrapper.setStyle(styles);
            this.element.setStyle(removeStyles);            
        }.bind(this));
        
        this.element.parentNode.insertBefore(this.wrapper, this.element);
        this.wrapper.appendChild(this.element);
        
        this.element.setStyle({ overflow: "hidden" });
    },
    
    setupButtons: function() {
        this.upButton = this.scrollBar.getElementsBySelector("." + this.parent.options.upButtonClass).first();
        this.downButton = this.scrollBar.getElementsBySelector("." + this.parent.options.downButtonClass).first();
        
        if (this.upButton) {
            this.upButton.observe("mousedown", this.keyScrollStart.bindAsEventListener(this));
            this.upButton.observe("mouseup", this.keyScrollStop.bindAsEventListener(this));
            this.upButton.style.cursor = "pointer";
        }
        
        if (this.downButton) {
            this.downButton.observe("mousedown", this.keyScrollStart.bindAsEventListener(this));
            this.downButton.observe("mouseup", this.keyScrollStop.bindAsEventListener(this));
            this.downButton.style.cursor = "pointer";
        }
    },
    
    memoryShowElement: function(element) {
        var hidden = [];
        while (true) {
            if (element == null) break;

            if (element.style && element.style.display == "none") {
                hidden.push(element);
                element.show();
            }
            element = $(element.parentNode);
        }
        return hidden;
    },
    
    memoryHideElement: function(hidden) {
        hidden.each(function (el) {
            el.hide();
        });
    },
    
    recalculateHeight: function(calculateWidth, resizeWidget) {
        var element = this.element;
        var hidden = this.memoryShowElement(element);
        
        if (this.originalPadding == null) this.originalPadding = {};

        if (this.element.scrollHeight - this.element.getHeight() <= 0) {
            this.scrollBar.hide();
            
            ["paddingLeft", "paddingRight", "paddingTop", "paddingBottom"].each(function (p) {
                if (this.originalPadding[p] == null) return;
                this.element.style[p] = this.originalPadding[p] + "px";            
            }.bind(this));
            
            if (this.originalWidth) this.element.style.width = this.originalWidth + "px";
        } else {
            this.scrollBar.show();            

            ["paddingLeft", "paddingRight", "paddingTop", "paddingBottom"].each(function (p) {
                if (this.originalPadding[p] == null) this.originalPadding[p] = parseInt(this.element.getStyle(p));
                this.element.style[p] = this.originalPadding[p] + this.parent.options.padding[p.substring(7).toLowerCase()] + "px";            
            }.bind(this));

            if (this.originalWidth == null) this.originalWidth = parseInt(this.element.getStyle("width"));
            this.element.style.width = this.originalWidth - this.parent.options.padding.right - this.parent.options.padding.left + "px";
        }
        
        // obtain the page to whole scrollable area ratio
        this.pageRatio = this.element.getHeight() / this.element.scrollHeight;
        
        var widgetHidden = this.memoryShowElement(this.scrollWidget);
        
        // setup scroll widget (if no height set, then calculate height)
        if (this.resizableWidget)
            this.scrollWidget.setStyle({ height: this.scrollBar.getHeight() * this.pageRatio + "px" });
        
        this.scrollWidget.setStyle({ height: this.scrollWidget.getHeight() - this.parent.options.widgetOffsets.top - this.parent.options.widgetOffsets.bottom + "px"});
        
        this.memoryHideElement(widgetHidden);
        
        this.max = {};
        
        // Get the maximum scrolling positions for the element
        this.max.element = { 
            x: this.element.scrollWidth - this.element.getWidth(),
            y: this.element.scrollHeight - this.element.getHeight()
        };
        
        // Get the maximum moving positions for the scrollbar
        this.max.scrollbar = {
            y: this.scrollBar.getHeight() - this.scrollWidget.getHeight() - this.parent.options.widgetOffsets.top - this.parent.options.widgetOffsets.bottom
        };
        
        if (this.element.scrollTop > this.max.element.y) this.element.scrollTop = this.max.element.y;
        this.updateScrollWidget();
        
        this.memoryHideElement(hidden);
    },
    
    setupScrollBar: function() {
        // construct the scroll bar and inject it into the dom
        if (this.parent.options.scrollBar == null) {
            var scrollBarTop = new Element("div", { 'class': this.parent.options.scrollBarTopClass });
            var scrollBarBottom = new Element("div", { 'class': this.parent.options.scrollBarBottomClass });

            var upButton = new Element("div", { 'class': this.parent.options.upButtonClass });
            var downButton = new Element("div", { 'class': this.parent.options.downButtonClass });
            
            this.scrollBar = new Element("div", { 'class': this.parent.options.scrollBarClass });
            
            this.scrollBar.appendChild(upButton);
            this.scrollBar.appendChild(downButton);

            this.scrollBar.appendChild(scrollBarTop);
            this.scrollBar.appendChild(scrollBarBottom);
        } else {
            this.scrollBar = this.parent.options.scrollBar.cloneNode(true);            
            this.scrollBar.show();
        }
        
        if (this.parent.options.scrollWidget == null) {
            var scrollWidgetTop = new Element("div", { 'class': this.parent.options.scrollWidgetTopClass });
            var scrollWidgetBottom = new Element("div", { 'class': this.parent.options.scrollWidgetBottomClass });
            
            this.scrollWidget = new Element("div", { 'class': this.parent.options.scrollWidgetClass });
            
            this.scrollWidget.appendChild(scrollWidgetTop);
            this.scrollWidget.appendChild(scrollWidgetBottom);
        } else {
            this.scrollWidget = this.parent.options.scrollWidget.cloneNode(true);
            this.scrollWidget.show();
        }
        
        var height = this.scrollWidget.getStyle("height");
        
        this.resizableWidget = (height == null || height == "" || height == "0px");

        this.scrollBar.appendChild(this.scrollWidget);
        this.wrapper.appendChild(this.scrollBar);
        
        var hidden = this.memoryShowElement(this.scrollWidget);
        
        this.scrollBar.setStyle({
            height: this.scrollBar.getHeight() - this.parent.options.scrollBarPadding.top - this.parent.options.scrollBarPadding.bottom + "px" 
        });
        
        this.memoryHideElement(hidden);
        
        this.recalculateHeight(true);
        this.scrollBar.observe("click", this.scrollBarClick.bindAsEventListener(this));
        
        this.scrollWidget.observe("mousedown", this.scrollWidgetStartDrag.bindAsEventListener(this));
        $(document).observe("mousemove", this.scrollWidgetDragging.bindAsEventListener(this));
        $(document).observe("mouseup", this.scrollWidgetStopDrag.bindAsEventListener(this));
        
        this.wrapper.observe("mousewheel", this.scrollWheel.bind(this));
        this.wrapper.observe("DOMMouseScroll", this.scrollWheel.bind(this));
        
        $(document).observe("keydown", this.keyScrollStart.bindAsEventListener(this));
        $(document).observe("keyup", this.keyScrollStop.bindAsEventListener(this));
    },
    
    scrollTo: function(position) {
        this.element.scrollTop = position;
        
        // clamp the scrolling
        if (this.element.scrollTop < 0) this.element.scrollTop = 0;
        if (this.element.scrollTop > this.max.element.y) this.element.scrollTop = this.max.element.y;
        
        this.updateScrollWidget();
    },
    
    scroll: function(amount) {
        this.scrollTo(this.element.scrollTop + amount);
    },
    
    scrollBarClick: function(event) {
        if (event.target != this.scrollBar) return;
        
        var widgetY = this.scrollWidget.cumulativeOffset()[1];
        
        // if clicked on scroll widget, then ignore
        if (event.pageY > widgetY && event.pageY <= widgetY + this.scrollWidget.getHeight()) return;
        
        if (event.pageY > widgetY) {
            this.scroll(this.element.getHeight());
        } else {
            this.scroll(-this.element.getHeight());
        }
    },
    
    scrollWidgetStartDrag: function(event) {
        this.startScrollOffset = event.pageY - this.scrollWidget.cumulativeOffset()[1];
        this.dragging = true;
        
        $(document.body).onselectstart = function () { return false; };
        $(document.body).onmousedown   = function () { return false; };
    },
    
    scrollWidgetDragging: function(event) {
        if (!this.dragging) return;
        
        var scrollToPosition = (event.pageY - this.scrollBar.cumulativeOffset()[1] - this.startScrollOffset - this.parent.options.widgetOffsets.top) * 
            (this.max.element.y / this.max.scrollbar.y);
        
        this.scrollTo(scrollToPosition);
    },
    
    scrollWidgetStopDrag: function(event) {
        this.startScrollOffset = null;
        this.dragging = false;
        
        $(document.body).onselectstart = function () { return true; };
        $(document.body).onmousedown   = function () { return true; };
    },
    
    scrollWheel: function(event) {
        var delta = 0;
        
        if (!event) event = window.event;
        
        if (event.wheelDelta) {
            delta = event.wheelDelta / 120;
            if (window.opera) delta = -delta;
        } else if (event.detail) {
            delta = -event.detail / 3;
        }

        if (delta) this.scroll(delta * -this.parent.options.scrollWheelSensitivity);

        if (event.preventDefault) event.preventDefault();
        event.returnValue = false;  
    },
    
    keyScrollStart: function(event) {
        if (event.keyCode == 38 || event.keyCode == 40 || event.target == this.upButton || event.target == this.downButton) {
            this.keyScrollAmount = this.parent.options.keyScrollAmount;
            this.keyScrollAmount = (event.keyCode == 40 || event.target == this.downButton) ? this.keyScrollAmount : -this.keyScrollAmount;

            this.keyScrollUpdate();
            
            this.keyScrollUpdater = new PeriodicalExecuter(this.keyScrollUpdate.bindAsEventListener(this), 0.1);   
        }
    },
    
    keyScrollUpdate: function(event) {
        this.scroll(this.keyScrollAmount);
    },
    
    keyScrollStop: function(event) {
        if (event.keyCode == 38 || event.keyCode == 40 || event.target == this.upButton || event.target == this.downButton) {
            if (this.keyScrollUpdater) this.keyScrollUpdater.stop();
            this.keyScrollAmount = 0;
        }
    },
    
    updateScrollWidget: function() {        
        this.scrollRatio = this.element.scrollTop / this.max.element.y;
        
        var temp = this.scrollRatio * this.max.scrollbar.y + this.parent.options.widgetOffsets.top;
        if (isNaN(temp)) temp = 0;
        
        this.scrollWidget.style.top = temp + "px";
    }
});

Overflow.DefaultOptions = {
    scrollBar: null,
    scrollWidget: null,
    widgetOffsets: { top: 0, bottom: 0 },
    scrollBarPadding: { top: 0, bottom: 0 },
    scrollWheelSensitivity: 10,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
    keyScrollAmount: 20,
    upButtonClass: "scroll-button-up",
    downButtonClass: "scroll-button-down",
    scrollBarClass: "scroll-bar",
    scrollBarTopClass: "scroll-bar-top",
    scrollBarBottomClass: "scroll-bar-bottom",
    scrollWidgetClass: "scroll-widget",
    scrollWidgetTopClass: "scroll-widget-top",
    scrollWidgetBottomClass: "scroll-widget-bottom",
    // used to integrate with HTML zoomer
    zoomable: false,
    
    // This selector defines which elements inside the
    // overflow should be used to check for focus
    // (so we can scroll to it if it's focused)
    focusCheckSelector: "",
    focusCheckClass: "focus" // If the element found with the above focusCheckSelector has this class, then it means its focused
};

// if scrollbar height is set, then use that
// if scroll widget height is set, then use that, else make widget the same ratio as the element to scroll height