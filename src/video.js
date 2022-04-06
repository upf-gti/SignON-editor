const VideoUtils = {

    startTime: 0,
    endTime: null,
    markerHeight: 40,

    bind: function(video, canvas) {

        canvas.addEventListener("mouseup", this.onMouse.bind(this));
        canvas.addEventListener("mousedown", this.onMouse.bind(this));
        canvas.addEventListener("mousemove", this.onMouse.bind(this));
        canvas.addEventListener("mouseleave", this.onMouse.bind(this));
        
        document.body.addEventListener('keydown', this.onKey.bind(this));

        video.addEventListener('ended', this.onVideoEnded.bind(this), false);
        video.loop = false; // Control loops manually

        this.video = video;
        this.width = canvas.width;
        this.height = canvas.height;
        this.ctx = canvas.getContext('2d');

        // Hacky fix: Duration is infinity if not setting a time..
        if(video.duration == Infinity) {
            video.currentTime = Number.MAX_SAFE_INTEGER;
            // video.play();
            // video.currentTime = 0;
            // video.pause();
        }

        this.ratio = (video.duration/this.width) * 15;
        this.endTime = video.duration;    
        this.render();
        
        window.VU = this;

        this.animate();
    },

    onVideoEnded: function() {

        if(this.trimming){
            this.onTrimRecordEnds();
        }else{
            this.video.currentTime = this.startTime;
            this.video.play();
        }
    },

    animate: function() {
        
        if(!this.video)
        return;

        requestAnimationFrame(this.animate.bind(this));
        this.update();
        this.render();
    },

    update: function() {

        // MediaElement bug
        if(this.video.duration == Infinity){
            this.video.currentTime = Number.MAX_SAFE_INTEGER;
            this.endTime = this.video.duration;
        }

        if(this.video.paused)
        return;

        if(this.video.currentTime >= this.endTime) {
            if(this.trimming){
                this.onTrimRecordEnds();
            }

            this.video.currentTime = this.startTime;
        }
    },

    render: function() {

        // It needs a video bound
        if(!this.video)
        return;

        const ctx = this.ctx;
        ctx.save();
        ctx.clearRect(0, 0, this.width, this.height);

        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#444";
        ctx.fillRect(0, this.height - this.markerHeight, this.width, this.height+2);

        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#222";
        ctx.fillRect(this.timeToX(this.startTime), this.height - this.markerHeight, this.timeToX(this.endTime - this.startTime), this.height+2);

        // Min-Max time markers
        this.renderTimeMarker('start', this.startTime);
        this.renderTimeMarker('end', this.endTime);
        this.renderTimeMarker('current', this.video.currentTime);

        ctx.restore();
    },

    renderTimeMarker: function(name, time) {

        const ctx = this.ctx;
        const x = this.timeToX(time);
        const h0 = this.height - this.markerHeight - 5;
        const h = this.markerHeight;

        let mWidth = this.dragging == name ? 6 : 4;
        let markerColor = name == 'current' ? "#AFD" : "#333";

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

        ctx.fillStyle = "#111";
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

                this.video.currentTime = Math.min( this.endTime, Math.max( this.startTime, this.video.currentTime ) );
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

    onTrimRecordEnds: function() {
        this.recorder.stop();
        this.trimming = false;
    },

    trim: function(callback) {

        // Reset some stuff
        document.body.removeEventListener('keydown', this.onKey.bind(this));
        this.video.removeEventListener('ended', this.onVideoEnded.bind(this));

        // Use start and end time to trim the video and return a new blob/video
        let durationInMs = (this.endTime - this.startTime) * 1000;
        let chunks = [];
        let recorder = new MediaRecorder(this.video.captureStream());

        recorder.ondataavailable = (e) => {
            // We only want the first chunk
            if(chunks.length)
            return;
            console.log("data available");
            chunks.push( e.data );
        };

        recorder.onstop = (e) => {

            let blob = new Blob(chunks, { "type": "video/mp4; codecs=avc1" });
            const url = URL.createObjectURL( blob );
            this.video.loop = true;
            this.video.pause();    
            this.video.currentTime = 0;
            this.video.src = url;

            if(callback)
                callback( this.startTime, this.endTime );
        };

        console.log(durationInMs/1000);
        this.video.currentTime = this.startTime;
        recorder.start();
        this.video.play();
        this.trimming = true;
        this.recorder = recorder;
    }
}

export { VideoUtils };