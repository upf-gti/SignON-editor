import { MediaPipe } from "./mediapipe.js";
import { Editor } from "./editor.js";
import { VideoUtils } from "./video.js";
import { FileSystem } from "./libs/filesystem.js";
import { UTILS } from "./utils.js";


class App {
    
    constructor() {
        
        // Helpers
        this.recording = false;
        this.startTime = 0;
        this.duration = 0;

        this.mediaRecorder = null
        this.chunks = [];
       
        // Create the fileSystem and log the user
        this.FS = new FileSystem("signon", "signon", () => console.log("Auto login of guest user"));

    	window.globals = {
            "app": this
        };
    }

    init( settings ) {

        settings = settings || {};
        // if(settings.projectType == "keyframes") {
        //     const dialog = new LX.Dialog( "Select input", p => {
        //         p.addFile("From disk", (data) => { 
        //             const extension = UTILS.getExtension(data.name);
		// 	        let mode = extension.includes('bvh') ? 'bvh' : 'video';
                    
        //             switch(mode) {
        //                 case 'bvh': 
        //                     this.onLoadAnimation( data );
        //                     break;
        //                 case 'video': 
        //                     this.captureMode = appMode.VIDEO;
        //                     this.onLoadVideo( data );
        //                     break;
        //             }
        //             dialog.close()
        //             window.addEventListener("resize", this.onResize.bind(this));
        //          }, {read: false} );

              
        //         p.addButton(null, "Capture", () => {
        //             this.captureMode = appMode.LIVE;
        //             this.onBeginCapture();
        //             dialog.close()
        //             window.addEventListener("resize", this.onResize.bind(this));
        //         });
        //     }, {modal:true})
        // }
        
        const mode = settings.mode ?? 'script';

        switch(mode) {
            case 'capture': 
                this.editor = new Editor(this, mode);
                this.onBeginCapture();
                break;
            case 'bvh': 
                this.editor = new Editor(this, "script");
                this.onLoadAnimation( settings.data );
                break;
            case 'video': case "mp4": case "wav": 
                this.video = settings.data;
                this.editor = new Editor(this, "video");
                this.onLoadVideo( settings.data );
                break;
            default:
                this.editor = new Editor(this, mode);
                this.onBMLProject( settings.data );
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

    //Start mediapipe recording 
    onBeginCapture() {
        this.mediaRecorder = null;
        const on_error = (err) => {
            LX.prompt("Can not access to the camera. Do you want to load a video instead?", "Camera problem", (v)=> {
                
                this.editor.mode = this.editor.eModes.keyframes;
                let input = document.getElementById("video-input");
                input.value = "";
                input.click();
            }, {input: false, on_cancel: () => window.location.reload()})
        } 
        
        // Run mediapipe to extract landmarks
        // if(!MediaPipe.loaded)
        let that = this;
                
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
                let constraints = { "video": true, "audio": false, width: 1280, height: 720 };
                navigator.mediaDevices.getUserMedia(constraints)
                .then( (stream) => {

                    let videoElement = document.getElementById("inputVideo");
                    
                    if(!videoElement.srcObject)
                        videoElement.srcObject = stream;
                    // videoElement.width = "1280px";
                    // videoElement.height = "720px";
                    that.mediaRecorder = new MediaRecorder(videoElement.srcObject);
                    that.chunks = [];
                    let videoCanvas = document.getElementById("outputVideo");

                    videoElement.addEventListener( "loadedmetadata", function (e) {
                        console.log(this.videoWidth)
                        console.log(this.videoHeight);
                        
                        let aspect = this.videoWidth/this.videoHeight;

                        let height = 802;
                        let width = height*aspect;

                        videoCanvas.width  = width;
                        videoCanvas.height = height;
                    }, false );

                    that.mediaRecorder.onstop = function (e) {

                        video.addEventListener("play", function() {});
                        video.addEventListener("pause", function() {});
                        video.setAttribute('controls', 'name');
                        video.controls = false;
                        video.loop = true;
                        
                        let blob = new Blob(that.chunks, { "type": "video/mp4; codecs=avc1" });
                        let videoURL = URL.createObjectURL(blob);
                        video.src = videoURL;
                        console.log("Recording correctly saved");
                    }

                    that.mediaRecorder.ondataavailable = function (e) {
                        that.chunks.push(e.data);
                    }
                    videoElement.play()
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
                on_error();
                console.log(err.name + ": " + err.message);
            });
            
        }
        else {
            if(on_error)
                on_error();
        }
    
            MediaPipe.start( true, () => {
                this.setEvents(true);
                $('#loading').fadeOut();
                // let videoElement = document.getElementById("inputVideo");
                // this.mediaRecorder = new MediaRecorder(videoElement.srcObject);

                // this.mediaRecorder.onstop =  (e) => {

                //     video.addEventListener("play", function() {});
                //     video.addEventListener("pause", function() {});
                //     video.setAttribute('controls', 'name');
                //     video.controls = false;
                //     video.loop = true;
                    
                //     let blob = new Blob(this.chunks, { "type": "video/mp4; codecs=avc1" });
                //     let videoURL = URL.createObjectURL(blob);
                //     video.src = videoURL;
                //     console.log("Recording correctly saved");
                // }

                // this.mediaRecorder.ondataavailable =  (e) => {
                //     this.chunks.push(e.data);
                // }
            }, this.editor.gui.updateCaptureGUI.bind(this.editor.gui));

            // Show video
            let video = document.getElementById("recording");
            // $("#capture").removeClass("hidden");

            // video.addEventListener('loadedmetadata', async function () {
            //     while(video.duration === Infinity) {
            //         await new Promise(r => setTimeout(r, 1000));
            //         video.currentTime = 10000000*Math.random();
            //     }
            //     video.currentTime = video.startTime > 0 ? video.startTime : 0;
            // });

            
    }

    onBeginEdition() {

        this.editor.startEdition();
        // // Update header
        // let capture = document.getElementById("capture_btn");
        // capture.disabled = true;
        // capture.style.display = "none";

        // let redo = document.getElementById("redo_btn");
        // if(redo){
        //     redo.disabled = true;
        //     redo.style.display = "none";
        // } 
            
        // this.editor.gui.updateMenubar();
        // let trimBtn = document.getElementById("trim_btn");
        // trimBtn.disabled = true;
        // trimBtn.style.display = "none";

        // let stateBtn = document.getElementById("state_btn");
        // stateBtn.style.display = "block";
        // let stopBtn = document.getElementById("stop_btn");
        // stopBtn.style.display = "block";

        // let captureInfo = document.getElementById("capture-info");
        // captureInfo.classList.add("hidden");

        // let timelineDiv = document.getElementById("timeline");
        // timelineDiv.classList.remove("hidden");
    }


    onLoadAnimation( animation ) {
    
        this.editor.startEdition();// this.onBeginEdition();

        const name = animation.name;
        this.editor.clipName = name;
        this.editor.loadAnimation( animation );
    }

    onLoadVideo( videoFile ) {
        this.mediaRecorder = null;
        this.editor.gui.captureMode = this.mode;
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
        
        
        videoElement.addEventListener( "loadedmetadata", function (e) {
            let videoCanvas = document.getElementById("outputVideo");
            let stream = videoCanvas.captureStream();

            console.log(this.videoWidth)
            console.log(this.videoHeight);
            
            let aspect = this.videoWidth/this.videoHeight;

            let height = 802;
            let width = height*aspect;

            videoCanvas.width  = width;
            videoCanvas.height = height;

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
        }, false );

        

        MediaPipe.start( false, () => {
            $('#loading').fadeOut();
        }, this.editor.gui.updateCaptureGUI.bind(this.editor.gui) );
    }

    onRecordLandmarks(startTime, endTime) {

        let videoRec = document.getElementById("recording");

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
        this.editor.buildAnimation( {landmarks: MediaPipe.landmarks, blendshapes: MediaPipe.blendshapes} );

        const name = "Unnamed";
        this.editor.clipName = name;

    }

    onBMLProject(dataFile) {
        
        if(dataFile)
        {
            const fr = new FileReader();

            
                fr.readAsText( dataFile );
                fr.onload = e => { 
                    let anim = JSON.parse(e.currentTarget.result);
                    this.editor.clipName = anim.name;
                    this.editor.loadModel(anim);    
                };
    
        }
        else {
            const name = "bml based";
            this.editor.clipName = name;
            this.editor.loadModel();    
        }

        // this.editor.loadAnimation( animation );
    }

    setEvents(live) {

        // Adjust video canvas
        let captureDiv = document.getElementById("capture");
        $(captureDiv).removeClass("hidden");
        let videoCanvas = document.getElementById("outputVideo");
        let videoElement = document.getElementById("inputVideo");
        let h = videoElement.videoHeight || videoCanvas.height;
        let w = videoElement.videoWidth || videoCanvas.width;
        // let aspectRatio = w / h;
        // h = captureDiv.clientHeight * 0.8;
        // videoCanvas.height = captureDiv.height = h;
        // videoCanvas.width = captureDiv.width = h * aspectRatio;

        // configurate buttons
        let elem = document.getElementById("endOfCapture");
    
        let capture = document.getElementById("capture_btn");
        capture.onclick = () => {
            
            if (!this.recording) {
                
                videoElement.loop = false;
                if(!live) {
                    videoElement.currentTime = 0;
                    videoElement.onended = () => {
                        capture.click();
                    }
                }

                capture.innerHTML = " <i class='fa fa-stop' style= 'margin:5px; font-size:initial;'></i>"//"Stop" + " <i class='bi bi-stop-fill'></i>"
                document.getElementById("select-mode").innerHTML = "";
                capture.classList.add("stop");
                videoCanvas.classList.add("active");
                // Start the capture
                this.recording = true;
                setTimeout(()=> {
                    MediaPipe.onStartRecording();
                    if(this.mediaRecorder)
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
                if(this.mediaRecorder)
                    this.mediaRecorder.stop();
                
                videoCanvas.classList.remove("active");  

                if(MediaPipe.landmarks.length) {
                    
                    MediaPipe.onStopRecording();
                    let endTime = Date.now();
                    this.duration = endTime - this.startTime;
                    // Show modal to redo or load the animation in the scene
                    elem.style.display = "none";
                    setTimeout(()=>{
                        MediaPipe.stop();
                        this.processVideo(live, {blendshapesResults: MediaPipe.blendshapes, landmarksResults: MediaPipe.landmarks});
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

    
    }
    
    async processVideo(live, results) {
                
        // Update header
        let capture = document.getElementById("capture_btn");
        capture.style.display = "none";
        capture.disabled = true;
        capture.classList.remove("stop");
        
        // TRIM VIDEO - be sure that only the sign is recorded
        let canvas = document.getElementById("outputVideo");

        let video = document.getElementById("recording");
        video.classList.remove("hidden");
        video.style.width = canvas.width + "px";
        video.style.height = canvas.height + "px";
        video.width = canvas.width;
        video.height = canvas.height;
        if(live === undefined || !live){
            video.style.cssText+= "transform: rotateY(0deg);\
                            -webkit-transform:rotateY(0deg); /* Safari and Chrome */\
                            -moz-transform:rotateY(0deg); /* Firefox */"
        }
        await VideoUtils.bind(video, canvas);
        VideoUtils.onSetTime = this.editor.updateCaptureDataTime.bind(this.editor, results);

        let trimBtn = document.getElementById("trim_btn");
        trimBtn.style.display = "block";
        let redoBtn = document.getElementById("redo_btn");
        redoBtn.style.display = "block";
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

        // let canvasArea = document.getElementById("canvasarea");

        // const CANVAS_WIDTH = canvasArea.clientWidth;
        // const CANVAS_HEIGHT = canvasArea.clientHeight;

        // const timelineCanvas = document.getElementById("timelineCanvas");
        // timelineCanvas.width = CANVAS_WIDTH;

        this.editor.resize();
    }
}

export { App };