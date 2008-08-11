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

        this.max = {};
        
        this.scrollBar.setStyle({
            height: this.scrollBar.getHeight() - this.parent.options.scrollBarPadding.top - this.parent.options.scrollBarPadding.bottom + "px" 
        });
        
        // Get the maximum scrolling positions for the element
        this.max.element = { 
            x: this.element.scrollWidth - this.element.getWidth(),
            y: this.element.scrollHeight - this.element.getHeight()
        };
        
        // Get the maximum moving positions for the scrollbar
        this.max.scrollbar = {
            y: this.scrollBar.getHeight() - this.scrollWidget.getHeight() - this.parent.options.widgetOffsets.top - this.parent.options.widgetOffsets.bottom
        };
        
        this.updateScrollWidget();
        
        if (this.parent.options.zoomable) {
            this.wrapper.style.display = "none";
        }
    },
    
    setupWrapper: function() {
        this.wrapper = new Element("div");
        
        if (this.parent.options.zoomable) {
            this.wrapper.id = this.element.id;
            this.element.id = null;
            this.element.style.display = "block";
            
            for (var p in this.element.getStyles()) {
                if (p.indexOf("background") != -1 || p.indexOf("border") != -1) {
                    var styles = {}; styles[p] = this.element.getStyle(p);
                    var removeStyles = {}; removeStyles[p] = "0px";
                
                    if (p != "backgroundPosition") {
                        this.wrapper.setStyle(styles);
                        this.element.setStyle(removeStyles);
                    }
                }
            }
        }

        this.wrapper.setStyle({
            position: "relative",
            width: this.element.getWidth() + "px",
            height: this.element.getHeight() + "px"
        });
                
        // use the correct margins for wrapper and remove them from the element
        for (var p in this.element.getStyles()) {
            if (p.indexOf("margin") != -1) {
                var styles = {}; styles[p] = this.element.getStyle(p);
                var removeStyles = {}; removeStyles[p] = "0";
                
                this.wrapper.setStyle(styles);
                this.element.setStyle(removeStyles);
            }
        }
        
        this.element.parentNode.insertBefore(this.wrapper, this.element);
        this.wrapper.appendChild(this.element);
        
        this.element.setStyle({ overflow: "hidden" });
    },
    
    setupScrollBar: function() {
        // construct the scroll bar and inject it into the dom
        this.scrollBar = this.parent.options.scrollBar.cloneNode(true);
        this.scrollBar.show();
        
        this.scrollWidget = this.parent.options.scrollWidget.cloneNode(true);
        this.scrollWidget.show();

        this.scrollBar.appendChild(this.scrollWidget);
        this.wrapper.appendChild(this.scrollBar);
        
        if (this.element.scrollHeight - this.element.getHeight() <= 0) {
            this.scrollBar.hide();
        } else {
            ["paddingLeft", "paddingRight", "paddingTop", "paddingBottom"].each(function (p) {
                this.element.style[p] = parseInt(this.element.getStyle(p)) + this.parent.options.padding[p.substring(7).toLowerCase()] + "px";            
            }.bind(this));
            
            this.element.style.width = parseInt(this.element.getStyle("width")) - this.parent.options.padding.right - this.parent.options.padding.left + "px";
        }
        
        // obtain the page to whole scrollable area ratio
        this.pageRatio = this.element.getHeight() / this.element.scrollHeight;
        
        this.scrollBar.observe("click", this.scrollBarClick.bindAsEventListener(this));
        
        // setup scroll widget (if no height set, then calculate height)
        if (this.scrollWidget.getHeight() == 0)
            this.scrollWidget.setStyle({ height: this.scrollBar.getHeight() * this.pageRatio + "px" });
            
        this.scrollWidget.setStyle({ height: this.scrollWidget.getHeight() - this.parent.options.widgetOffsets.top - this.parent.options.widgetOffsets.bottom + "px"});
        
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
        
        $(document.body).onselectstart = function () { return false; }
        $(document.body).onmousedown   = function () { return false; }
    },
    
    scrollWidgetDragging: function(event) {
        if (!this.dragging) return;
        
        var scrollToPosition = (event.pageY - this.scrollBar.cumulativeOffset()[1] - this.startScrollOffset) * 
            (this.max.element.y / this.max.scrollbar.y);
        
        this.scrollTo(scrollToPosition);
    },
    
    scrollWidgetStopDrag: function(event) {
        this.startScrollOffset = null;
        this.dragging = false;
        
        $(document.body).onselectstart = function () { return true; }
        $(document.body).onmousedown   = function () { return true; }
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
        if (event.keyCode == 38 || event.keyCode == 40) {
            this.keyScrollAmount = this.parent.options.keyScrollAmount;
            this.keyScrollAmount = (event.keyCode == 40) ? this.keyScrollAmount : -this.keyScrollAmount;

            this.keyScrollUpdate();
            
            this.keyScrollUpdater = new PeriodicalExecuter(this.keyScrollUpdate.bindAsEventListener(this), 0.1);   
        }
    },
    
    keyScrollUpdate: function(event) {
        this.scroll(this.keyScrollAmount);
    },
    
    keyScrollStop: function(event) {
        if (event.keyCode == 38 || event.keyCode == 40) {
            if (this.keyScrollUpdater) this.keyScrollUpdater.stop();
            this.keyScrollAmount = 0;
        }
    },
    
    updateScrollWidget: function() {        
        this.scrollRatio = this.element.scrollTop / this.max.element.y;
        
        this.scrollWidget.setStyle({
            top: this.scrollRatio * this.max.scrollbar.y + this.parent.options.widgetOffsets.top + "px"
        });
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
    // used to integrate with HTML zoomer
    zoomable: true  
};

// if scrollbar height is set, then use that
// if scroll widget height is set, then use that, else make widget the same ratio as the element to scroll height