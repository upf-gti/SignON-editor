const VideoUtils = {

    startTime: 0,
    endTime: null,
    markerHeight: 30,

    bind: async function(video, canvas) {

        canvas.addEventListener("mouseup", this.onMouse.bind(this));
        canvas.addEventListener("mousedown", this.onMouse.bind(this));
        canvas.addEventListener("mousemove", this.onMouse.bind(this));
        canvas.addEventListener("mouseleave", this.onMouse.bind(this));
        
        document.body.onkeydown = this.onKey.bind(this);

        video.onended = this.onVideoEnded.bind(this);
        video.loop = false; // Control loops manually

        this.video = video;
        this.width = canvas.width;
        this.height = canvas.height;
        this.ctx = canvas.getContext('2d');

        // Hacky fix: Duration is infinity if not setting a time..
        // MediaElement bug
        while(video.duration === Infinity) {
            await new Promise(r => setTimeout(r, 1000));
            video.currentTime = 10000000 * Math.random();
        }

        this.ratio = (video.duration/this.width) * 15;
        this.startTime = video.currentTime = 0;
        this.endTime = video.duration;    
        this.render();
        
        window.VU = this;

        this.animate();
    },

    onVideoEnded: function() {

        this.video.currentTime = this.startTime;
        this.video.play();
    },

    animate: function() {
        
        if(!this.video)
        return;

        requestAnimationFrame(this.animate.bind(this));
        this.update();
        this.render();
    },

    update: function() {

        if(this.video.paused)
        return;

        if(this.video.currentTime >= this.endTime)
            this.video.currentTime = this.startTime;
    },

    render: function() {

        // It needs a video bound
        if(!this.video)
        return;

        const ctx = this.ctx;
        ctx.save();
        ctx.clearRect(0, 0, this.width, this.height);

        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "#444";
        ctx.fillRect(0, this.height - this.markerHeight, this.width, this.height+2);

        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "#222";
        ctx.fillRect(this.timeToX(this.startTime), this.height - this.markerHeight, this.timeToX(this.endTime - this.startTime), this.height+2);

        // Min-Max time markers
        this.renderTimeMarker('start', this.startTime, { color: '#1E1', fillColor: null });
        this.renderTimeMarker('end', this.endTime, { color: '#E11', fillColor: null });
        this.renderTimeMarker('current', this.video.currentTime, { color: '#111', fillColor: '#AFD' });

        ctx.restore();
    },

    renderTimeMarker: function(name, time, options) {

        options = options || {};
        const ctx = this.ctx;
        const x = this.timeToX(time);
        const h0 = this.height - this.markerHeight - 5;
        const h = this.markerHeight;

        let mWidth = this.dragging == name ? 6 : 4;
        let markerColor = options.fillColor || '#333';

        ctx.strokeStyle = markerColor;
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

        ctx.fillStyle = options.color || '#111';
        ctx.beginPath();
        ctx.moveTo(x - 8, h0 - 1);
        ctx.lineTo(x + 8, h0 - 1);
        ctx.lineTo(x, h0 + 10);
        ctx.fill();

        ctx.fillStyle = markerColor;
        ctx.beginPath();
        ctx.moveTo(x - 6, h0);
        ctx.lineTo(x + 6, h0);
        ctx.lineTo(x, h0 + 8);
        ctx.fill();

        // Current time text
        if(name == 'current' || this.hovering == name) {
            let xPos = Math.max( Math.min( x - 17, this.width - 42), 5 );
            ctx.fillStyle = "#DDD";
            ctx.fillRect(xPos - 5, h0 - 25, 47, 15);
            ctx.fillStyle = "#222";
            ctx.font = "bold 16px Calibri";
            ctx.fillText(String(time.toFixed(3)), xPos, h0 - 12);
        }
    },

    onMouse: function(e)  {
        
        e.preventDefault();
        
        if(!this.ctx)
		return;

        // Process mouse
        var x = e.offsetX;
        var y = e.offsetY;

        if( e.type == "mouseup" || e.type == "mouseleave" || y < (this.height - this.markerHeight)) {
            this.dragging = false;
            this.hovering = false;
        }
        else if( e.type == "mousedown") {

            const t = this.xToTime(x);

            if(Math.abs( this.startTime - t) < this.ratio) {
                this.dragging = 'start';
            } else if(Math.abs( this.endTime - t) < this.ratio) {
                this.dragging = 'end';
            } else if(Math.abs( this.video.currentTime - t) < this.ratio) {
                this.dragging = 'current';
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
                    case 'current':
                        this.video.currentTime = t; 
                        break;
                }

                this.video.currentTime = t;//Math.min( this.endTime, Math.max( this.startTime, this.video.currentTime ) );
            }
            else {
                if(Math.abs( this.startTime - t) < this.ratio)
                    this.hovering = 'start';
                else if(Math.abs( this.endTime - t) < this.ratio)
                    this.hovering = 'end';
                else if(Math.abs( this.video.currentTime - t) < this.ratio)
                    this.hovering = 'current';
                else 
                    this.hovering = false;
            }
        }
    },

    onKey: function(e) {

        if(e.type == "keydown") {
            if(e.key == ' ') {
                e.preventDefault();
                this.video.paused ? this.video.play() : this.video.pause();
            }
        }
    },

    xToTime: function(x) {
        return (x / this.width) *  this.video.duration;
    },

    timeToX: function (time) {
        return (time / this.video.duration) *  this.width;
    },

    unbind: function(callback) {

        // Reset some stuff
        document.body.onkeydown = null;
        
        this.video.startTime = this.startTime;
        this.video.onended = function() {
            this.currentTime = this.startTime;
            this.play();
        };
            
        // this.video.onended = null;
        // this.video.loop = true;
        this.video.pause();    
        this.video.currentTime = this.startTime;

        if(callback)
            callback( this.startTime, this.endTime );

        this.video = null;
        this.width = null;
        this.height = null;
        this.ctx = null;

        this.ratio = null;
        this.startTime = null;
        this.endTime = null;   
    },

    // This is a version for trimming the video using
    // MediaRecorder: the video is not synced with the original trim
    // so by now don't trim and play only the right slice of video
    unbindAndTrim: function(callback) {

        // Reset some stuff
        document.body.onkeydown = null;
        this.video.onended = null;

        let durationInMs = (this.endTime - this.startTime) * 1000;
        let chunks = [];
        let recorder = new MediaRecorder(this.video.captureStream(), { mimeType: 'video/webm;codecs=vp8' });

        recorder.ondataavailable = (e) => {
            if(chunks.length)
            return;
            console.log("Data available");
            chunks.push( e.data );
            recorder.stop();
        };

        recorder.onstop = (e) => {

            let blob = new Blob(chunks, { "type": 'video/webm;codecs=vp8' });
            const url = URL.createObjectURL( blob );
            this.video.src = url;

            let video = this.video;

            video.addEventListener('loadeddata', async () => {
                while(video.duration === Infinity) {
                    await new Promise(r => setTimeout(r, 1000));
                    video.currentTime = 10000000*Math.random();
                }

                console.log( "Trimmed duration: " + video.duration );

                this.video.loop = true;
                this.video.pause();    
                this.video.currentTime = 0;

                if(callback)
                    callback( this.startTime, this.endTime );

                this.video = null;
                this.width = null;
                this.height = null;
                this.ctx = null;

                this.ratio = null;
                this.startTime = null;
                this.endTime = null;   
            });
        };

        console.log("Original duration: " + durationInMs/1000);
        this.video.currentTime = this.startTime;
        recorder.start( durationInMs + 0.06 );
        this.video.play();
        this.trimming = true;
        this.recorder = recorder;
    }
}

export { VideoUtils };