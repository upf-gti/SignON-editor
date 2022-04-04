const VideoUtils = {

    startTime: 0,
    endTime: null,
    markerHeight: 50,

    bind: function(video, canvas) {

        canvas.addEventListener("mouseup", this.onMouse.bind(this));
        canvas.addEventListener("mousedown", this.onMouse.bind(this));
        canvas.addEventListener("mousemove", this.onMouse.bind(this));
        canvas.addEventListener("mouseleave", this.onMouse.bind(this));

        this.video = video;
        this.width = canvas.width;
        this.height = canvas.height;
        this.ctx = canvas.getContext('2d');

        // Hacky fix: Duration is infinity if not setting a time..
        setTimeout( () => {
            this.ratio = (video.duration/this.width) * 15;
            this.endTime = video.duration;    
            this.render();
        }, 100 );

        window.VU = this;
    },

    render: function() {

        const ctx = this.ctx;
        ctx.save();
        ctx.clearRect(0, 0, this.width, this.height);

        ctx.globalAlpha = 0.2;
        ctx.fillStyle = "#444";
        ctx.fillRect(0, this.height - this.markerHeight, this.width, this.height);

        // Min-Max time markers
        this.renderTimeMarker('start', this.startTime);
        this.renderTimeMarker('end', this.endTime);

        ctx.restore();
    },

    renderTimeMarker: function(name, time) {

        const ctx = this.ctx;
        const x = this.timeToX(time);
        const h0 = this.height - this.markerHeight - 5;
        const h = this.markerHeight;

        let mWidth = this.dragging == name ? 6 : 4;

        ctx.strokeStyle = "#AFD";
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#FFF";
        ctx.fillRect( x - mWidth * 0.5, h0, mWidth, h0 + h);
        if(this.hovering == name) {
            ctx.globalAlpha = 0.2;
            ctx.fillRect( x - mWidth, h0, mWidth * 2, h0 + h);
            ctx.globalAlpha = 0.5;
        }
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(x, h0);
        ctx.lineTo(x, h0 + h);
        ctx.stroke();

        ctx.fillStyle = "#AFD";
        ctx.beginPath();
        ctx.moveTo(x - 6, h0);
        ctx.lineTo(x + 6, h0);
        ctx.lineTo(x, h0 + 8);
        ctx.fill();

        // Current time text
        let xPos = Math.max( Math.min( x - 12, this.width - 30), 5 );
    	ctx.fillText(String(time.toFixed(3)), xPos, h0 - 5);
    },

    onMouse: function(e)  {
        
        e.preventDefault();
        
        if(!this.ctx)
		return;

        // Process mouse
        var x = e.offsetX;
        var y = e.offsetY;

        // Out of range
        if(y < (this.height - this.markerHeight))
        return;

        if( e.type == "mouseup" || e.type == "mouseleave" ) {
            this.dragging = false;
            this.hovering = false;
        }
        else if( e.type == "mousedown") {

            const t = this.xToTime(x);

            if(Math.abs( this.startTime - t) < this.ratio) {
                this.dragging = 'start';
            } else if(Math.abs( this.endTime - t) < this.ratio) {
                this.dragging = 'end';
            }
        }
        else if( e.type == "mousemove") {

            const t = this.xToTime(x);

            const hoverStart = t < (this.endTime - this.ratio * 2);
            const hoverEnd = t > (this.startTime + this.ratio * 2);

            if(this.dragging) {
                switch(this.dragging) {
                    case 'start':
                        if(hoverStart)
                            this.startTime = t; 
                        break;
                    case 'end':
                        if(hoverEnd)
                            this.endTime = t; 
                        break;
                }
            }
            else {
                this.hovering = hoverStart ? 'start' : hoverEnd ? 'end' : false;
            }
        }

        this.render();
    },

    xToTime: function(x) {
        return (x / this.width) *  this.video.duration;
    },

    timeToX: function (time) {
        return (time / this.video.duration) *  this.width;
    }
}

export { VideoUtils };