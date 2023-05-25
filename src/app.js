import { MediaPipe } from "./mediapipe.js";
import { Editor } from "./editor.js";
import { VideoUtils } from "./video.js";
import { FileSystem } from "./libs/filesystem.js";

const appMode = {LIVE:0, VIDEO:1};
class App {

    constructor() {

        // Helpers
        this.recording = false;
        this.startTime = 0;
        this.duration = 0;

        this.mediaRecorder = null
        this.chunks = [];
        this.captureMode = null;
        this.editor = new Editor(this);

        // Create the fileSystem and log the user
        this.FS = new FileSystem("signon", "signon", () => console.log("Auto login of guest user"));

    	window.globals = {
            "app": this
        };
    }

    init( settings ) {

        let that = this;
        settings = settings || {};

        const mode = settings.mode ?? 'capture';

        switch(mode) {
            case 'capture': 
                this.captureMode = appMode.LIVE;
                this.onBeginCapture();
                break;
            case 'bvh': 
                this.onLoadAnimation( settings.data );
                break;
            case 'video': 
                this.captureMode = appMode.VIDEO;
                this.onLoadVideo( settings.data );
                break;
        }

        window.addEventListener("resize", this.onResize.bind(this));
    }

    isRecording() {
        return this.recording;
    }

    setIsRecording( value ) {
        this.recording = value;
    }

    onBeginEdition() {

        // Update header
        let capture = document.getElementById("capture_btn");
        capture.disabled = true;
        capture.style.display = "none";

        let redo = document.getElementById("redo_btn");
        if(redo){
            redo.disabled = true;
            redo.style.display = "none";
        } 
            

        let trimBtn = document.getElementById("trim_btn");
        trimBtn.disabled = true;
        trimBtn.style.display = "none";

        let stateBtn = document.getElementById("state_btn");
        stateBtn.style.display = "block";
        let stopBtn = document.getElementById("stop_btn");
        stopBtn.style.display = "block";

        // let captureInfo = document.getElementById("capture-info");
        // captureInfo.classList.add("hidden");

        let timelineDiv = document.getElementById("timeline");
        timelineDiv.classList.remove("hidden");
    }

    onBeginCapture() {
        
        // Run mediapipe to extract landmarks
        if(!MediaPipe.loaded)
        MediaPipe.start( true, () => {
            $('#loading').fadeOut();
        }, this.editor.gui.updateCaptureGUI.bind(this.editor.gui) );

        // Show video
        let video = document.getElementById("recording");
        $("#capture").removeClass("hidden")

        video.addEventListener('loadedmetadata', async function () {
            while(video.duration === Infinity) {
                await new Promise(r => setTimeout(r, 1000));
                video.currentTime = 10000000*Math.random();
            }
            video.currentTime = video.startTime > 0 ? video.startTime : 0;
        });

        this.mediaDevicesSupported(video, this, ()=> {     

        }, (err) => {
            if(!err)
                err = "This app is not supported in your browser";
            console.error(err);
        });

        this.setEvents(true);
    }

    onLoadAnimation( animation ) {
    
        this.onBeginEdition();

        const name = animation.name;
        this.editor.clipName = name;
        this.editor.loadAnimation( animation );
    }

    onLoadVideo( videoFile ) {

        this.setEvents();

        let url = "";
        if(typeof(videoFile) == 'string' && videoFile.includes("blob:"))
            url = videoFile;
        else
            url = URL.createObjectURL(videoFile);
        const that = this;

        let videoElement = document.getElementById("inputVideo");
        videoElement.src = url;
        let video = document.getElementById("recording");
        video.src = url; 
        let videoCanvas = document.getElementById("outputVideo");
        let stream = videoCanvas.captureStream()
        this.mediaRecorder = new MediaRecorder(stream);

        this.mediaRecorder.onstop = function (e) {

            video.addEventListener("play", function() {});
            video.addEventListener("pause", function() {});
            video.setAttribute('controls', 'name');
            video.controls = false;
            video.loop = true;
            //that.chunks[0] = that.chunks[0].slice(1,that.chunks[0].size, "video/mp4; codecs=avc1");
            //that.chunks.shift();
            let blob = new Blob(that.chunks, { "type": "video/mp4; codecs=avc1" });
            let videoURL = URL.createObjectURL(blob);
            video.src = videoURL;
            console.log("Recording correctly saved");
        }

        this.mediaRecorder.ondataavailable = function (e) {
            that.chunks.push(e.data);
        }

        MediaPipe.start( false, () => {
            $('#loading').fadeOut();
        }, this.editor.gui.updateCaptureGUI.bind(this.editor.gui) );
    }

    onRecordLandmarks(startTime, endTime) {
    
        let that = this;
        
        this.onBeginEdition();
    
        // Reposition the canvas elements
        let videoDiv = document.getElementById("capture");
        videoDiv.classList.remove("expanded");
        let videoRec = document.getElementById("recording");
        videoRec.classList.remove("hidden");
        videoRec.style.width = "100%";
        videoRec.style.height = "100%";
        

        videoRec.style.cssText+= "transform: rotateY(0deg);\
        -webkit-transform:rotateY(0deg); /* Safari and Chrome */\
        -moz-transform:rotateY(0deg); /* Firefox */"
    
        // Solve the aspect ratio problem of the video
        let videoCanvas = document.getElementById("outputVideo");
        let aspectRatio = videoDiv.width / videoDiv.height;
        videoRec.width  = videoDiv.width  = videoCanvas.width  = videoDiv.clientWidth;
        videoRec.height = videoDiv.height = videoCanvas.height = videoCanvas.width / aspectRatio;

        $(videoDiv).draggable({containment: "#canvasarea"}).resizable({ aspectRatio: true, containment: "#canvasarea"});

        const updateFrame = (now, metadata) => {
            
            // Do something with the frame.
            const canvasElement = document.getElementById("outputVideo");
            const canvasCtx = canvasElement.getContext("2d");
    
            //let frame = metadata.presentedFrames % MediaPipe.landmarks;
            let landmarks = MediaPipe.landmarks; //[frame];
    
            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
            drawConnectors(canvasCtx, landmarks.PLM, POSE_CONNECTIONS,
                            {color: '#00FF00', lineWidth: 4});
            drawLandmarks(canvasCtx, landmarks.PLM,
                            {color: '#FF0000', lineWidth: 2});
            canvasCtx.restore();
            
            // Re-register the callback to be notified about the next frame.
            videoRec.requestVideoFrameCallback(updateFrame);
        };
        // Initially register the callback to be notified about the first frame.
        videoRec.requestVideoFrameCallback(updateFrame);

        // Creates the scene and loads the animation
        this.editor.trimTimes = [startTime, endTime];
        this.editor.buildAnimation( MediaPipe.landmarks );
        
        const name = "Unnamed";
        this.editor.clipName = name;
        this.editor.updateGUI();
        this.editor.gui.hiddeCaptureArea();
    }

    setEvents(live) {

        // Adjust video canvas
        let captureDiv = document.getElementById("capture");
        $(captureDiv).removeClass("hidden");
        let videoCanvas = document.getElementById("outputVideo");
        let videoElement = document.getElementById("inputVideo");
        let h = captureDiv.clientHeight * 0.8;
        let aspectRatio = videoCanvas.width / videoCanvas.height;
        videoCanvas.height = captureDiv.height = videoCanvas.style.height = h;
        videoCanvas.width = captureDiv.width = videoCanvas.style.width = h * aspectRatio;

        // configurate buttons
        let elem = document.getElementById("endOfCapture");
    
        let capture = document.getElementById("capture_btn");
        capture.onclick = () => {
            
            if (!this.recording) {
                
                if(!live) {
                    videoElement.currentTime = 0;
                    videoElement.loop = false;
                    videoElement.onended = () => {
                        capture.click();
                    }
                }

                capture.innerHTML = " <i class='fa fa-stop' style= 'margin:5px; font-size:initial;'></i>"//"Stop" + " <i class='bi bi-stop-fill'></i>"
                // capture.style.backgroundColor = "lightcoral";
                // capture.style.border = "solid #924242";
                capture.classList.add("stop");
               // videoCanvas.style.border = "solid var(--global-color-highlight)";
                videoCanvas.classList.add("border-animation");
                // Start the capture
                this.recording = true;
                setTimeout(()=> {
                    MediaPipe.onStartRecording();
                    this.mediaRecorder.start();
                    this.startTime = Date.now();
                    console.log("Start recording");
                }, 100);
                
            }
            else {

                if(!live) {
                    videoElement.onended = undefined;
                    videoElement.loop = true;
                }

                
                // Stop the video recording
                this.recording = false;
                
                console.log("Stop recording");
                // Back to initial values
                //capture.innerHTML = " <i class='bi bi-record-circle' style= 'margin:5px; font-size:initial;'></i> Start recording";
                // capture.style.removeProperty("background-color");
                // capture.style.removeProperty("border");
                //videoCanvas.style.removeProperty("border");
                this.mediaRecorder.stop();
                
                videoCanvas.classList.remove("border-animation");
                capture.classList.remove("stop");

                
                if(MediaPipe.landmarks.length) {
                    
                    MediaPipe.onStopRecording();
                    let endTime = Date.now();
                    this.duration = endTime - this.startTime;
                    // Show modal to redo or load the animation in the scene
                    //elem.style.display = "flex";
                    elem.style.display = "none";
                    setTimeout(()=>{
                        MediaPipe.stop();
                        this.processVideo(live);
                    }, 100);
                    
                }
            }
        };
    
        let redo = document.getElementById("redo_btn");
        redo.onclick = () => elem.style.display = "none";
    
        let trimData = document.getElementById("trimData_btn");
        trimData.onclick = () => {
            elem.style.display = "none";
            MediaPipe.stop();
            this.processVideo();
        };

        let loadData = document.getElementById("loadData_btn");
        loadData.onclick = () => {
            elem.style.display = "none";
            MediaPipe.stop();
            this.onRecordLandmarks(0, null);
        };

        // let trimBtn = document.getElementById("trim_btn");
        // trimBtn.onclick = () => {
        //     VideoUtils.unbind( (start, end) => this.onRecordLandmarks(start, end) );
        // };
    }
    
    async processVideo(live) {
                
        // Update header
        let capture = document.getElementById("capture_btn");
        capture.style.display = "none";
        capture.disabled = true;
        
        // TRIM VIDEO - be sure that only the sign is recorded
        let canvas = document.getElementById("outputVideo");
        let video = document.getElementById("recording");
        video.classList.remove("hidden");
        video.style.width = canvas.width + "px";
        video.style.height = canvas.height + "px";

        if(live === undefined || !live){
            video.style.cssText+= "transform: rotateY(0deg);\
                            -webkit-transform:rotateY(0deg); /* Safari and Chrome */\
                            -moz-transform:rotateY(0deg); /* Firefox */"
        }
        await VideoUtils.bind(video, canvas);
        

        let trimBtn = document.getElementById("trim_btn");
        trimBtn.style.display = "block";
        let redoBtn = document.getElementById("redo_btn");
        redoBtn.style.display = "block";
    }

    mediaDevicesSupported(video, scope, callback, on_error) {
        
        // prepare the device to capture the video
        if (navigator.mediaDevices) {
            console.log("UserMedia supported");
                       
            

            navigator.mediaDevices.enumerateDevices()
            .then(function(devices) {
                let deviceId = null;
                for (const deviceInfo of devices) {
                    if(deviceInfo.kind === 'videoinput') {
                        deviceId = deviceInfo.deviceId;
                        break;
                    }
                };
                let constraints = { "video": true, "audio": false };
                navigator.mediaDevices.getUserMedia(constraints)
                .then( (stream) => {

                    let videoElement = document.getElementById("inputVideo");
                    
                    if(!videoElement.srcObject)
                        videoElement.srcObject = stream;
                        
                    scope.mediaRecorder = new MediaRecorder(videoElement.srcObject);

                    scope.mediaRecorder.onstop = function (e) {

                        video.addEventListener("play", function() {});
                        video.addEventListener("pause", function() {});
                        video.setAttribute('controls', 'name');
                        video.controls = false;
                        video.loop = true;
                        
                        let blob = new Blob(scope.chunks, { "type": "video/mp4; codecs=avc1" });
                        let videoURL = URL.createObjectURL(blob);
                        video.src = videoURL;
                        console.log("Recording correctly saved");
                    }

                    scope.mediaRecorder.ondataavailable = function (e) {
                        scope.chunks.push(e.data);
                    }
                    if(callback)
                        callback();
                })
                .catch(function (err) {
                    console.error("The following error occurred: " + err);
                    if(err == "NotReadableError: Could not start video source")
                        alert("Camera error: Make sure your webcam is not used in another application.")
                    if(on_error)
                        on_error(err);
                });
                
            })
            .catch(function(err) {
             console.log(err.name + ": " + err.message);
            });
            
        }
        else {
            if(on_error)
                on_error();
        }
    }

    async storeAnimation() {

        const innerStore = (async function() {

            // CHECK THE INPUT FILE !!!!TODO!!!!
            let file = undefined;

            if (!confirm("Have you finished editing your animation? Remember that uploading the animation to the database implies that it will be used in the synthesis of the 3D avatar used in SignON European project."))
            return;

            // Check if are files loaded
            if (!file) {
                console.log("Not BVH found.");
                return;
            }

            // Log the user
            await this.FS.login();

            // folder, data, filename, metadata
            await this.FS.uploadData("animations", file, file.name || "noName", "");

            // Log out the user
            this.FS.logout();

            // For now this is used in timeline_maanager
            // refactor!!
            window.storeAnimation = this.storeAnimation;
            
        }).bind(this);

        if( this.editor.clipName === "Unnamed" ) {
            LiteGUI.prompt( "Please, enter the name of the sign performed and the language. (Example: Dog in Irish Sign Language --> dog_ISL)", async (name) => {

                this.editor.clipName = name;
                await innerStore();

            }, { title: "Sign Name", width: 350 } );
        }
    }

    onResize() {

        let canvasArea = document.getElementById("canvasarea");

        const CANVAS_WIDTH = canvasArea.clientWidth;
        const CANVAS_HEIGHT = canvasArea.clientHeight;

        const timelineCanvas = document.getElementById("timelineCanvas");
        timelineCanvas.width = CANVAS_WIDTH;

        this.editor.resize(CANVAS_WIDTH, CANVAS_HEIGHT);
    }
}

export { App };