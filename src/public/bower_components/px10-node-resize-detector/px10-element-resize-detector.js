(function () {

    "use strict";
    function fromStaticToRelative(node){
        if (node){
            var computedStyle = getComputedStyle(node);
            if (computedStyle && computedStyle.position == 'static'){
                node.style.position = 'relative';
            }
        }
    }

    var prototype = {
        /**
         * `target` If this element is used inside other elements set this property to {{}} otherwise do not set
         *  this property.
         *
         * @property target
         * @type object
         * @default undefined
         *
         */
        target: undefined,
        _defaultView:undefined,
        _handler:undefined,
        _handlerInstalled:false,
        ready: function () {
            if (!this.target){
                this.target = this.$.detector.parentNode.host.parentNode;
                // todo: We should just make it a requirement to make the Element to be monitored to be relative.
                if (this.target) {
                    fromStaticToRelative(this.target);
                    this.style.position='absolute';
                }
            }
        },
        _dispatch:function(){
            this.fire("resize", undefined, this, true, false);
        },
        attached:function(){
            this._handler = this._dispatch.bind(this);
            var detector = this.$.detector;
            var contentDocument;
            // IE throws exception when this element is a child of a regular dom element. Once the data
            // is set its ok.
            try{
                contentDocument = detector.contentDocument
            }catch(error){
            }

            if (!contentDocument){
                this.async(function(){
                    detector.data = 'about:blank';
                });
            }else{
                this.loaded(detector.contentDocument.defaultView);
            }
        },
        detached:function(){
            if (this._defaultView && this._handler){
                this._defaultView.removeEventListener('resize', this._handler);
            }
        },
        loaded:function(event){
            if (event.target) {
                this._defaultView = event.target.contentDocument.defaultView;
            }else{
                this._defaultView=event;
            }
            if (this._defaultView && this._handler && !this._handlerInstalled){
                this._defaultView.addEventListener('resize', this._handler);
                this._handlerInstalled=true;
            }
        }
    };

    Polymer(prototype);
})();
