import { MediaPipe } from "./mediapipe.js";
import { Project } from "./project.js";
import { Editor } from "./editor.js";
import { VideoUtils } from "./video.js";
import { FileSystem } from "./libs/filesystem.js";
import * as THREE from "./libs/three.module.js";

class App {

    constructor(){

        // Helpers
        this.recording = false;
        this.startTime = 0;
        this.duration = 0;

        this.mediaRecorder = null
        this.chunks = [];
        this.project = new Project();
        this.editor = new Editor(this);

        // Create the fileSystem and log the user
        this.FS = new FileSystem("signon", "signon", () => console.log("Auto login of guest user"));

        window.app = this;
    }
    selectMode() {
        let buttons = document.getElementById("startOfCapture");
        buttons.style.display = "block";

        let live = document.getElementById("live_btn");
        live.onclick = () => { 
            this.init("live");
            buttons.style.display = "none"
        };

        let local = document.getElementById("local_btn");
        local.onclick = () => { 
            this.init("local");
            buttons.style.display = "none"
        };
    }
    init(mode) {

        let that = this;

        

        let video = document.getElementById("recording");

        video.addEventListener('loadedmetadata', async function () {
            while(video.duration === Infinity) {
                await new Promise(r => setTimeout(r, 1000));
                video.currentTime = 10000000*Math.random();
            }
            video.currentTime = 0;
            video.startTime = 0;
        });
        switch(mode){
            case "live":
                MediaPipe.start(mode);
                // prepare the device to capture the video
                if (navigator.mediaDevices) {
                    console.log("getUserMedia supported.");

                    let constraints = { video: true, audio: false };

                    navigator.mediaDevices.getUserMedia(constraints)
                        .then(function (stream) {
                            let videoElement = document.getElementById("inputVideo");
                            that.mediaRecorder = new MediaRecorder(videoElement.srcObject);

                            that.mediaRecorder.onstop = function (e) {

                                video.addEventListener("play", function() {
                                
                                });
                                video.addEventListener("pause", function() {
                                    
                                });
                                video.setAttribute('controls', 'name');
                                video.controls = false;
                                video.loop = true;
                                
                                let blob = new Blob(that.chunks, { "type": "video/mp4; codecs=avc1" });
                                let videoURL = URL.createObjectURL(blob);
                                video.src = videoURL;
                                console.log("Recording correctly saved");
                            }

                            that.mediaRecorder.ondataavailable = function (e) {
                                console.log(e.data);
                                that.chunks.push(e.data);
                            }
                           
                        })
                        .catch(function (err) {
                            console.error("The following error occurred: " + err);
                        })
                }
                else {
                    console.log("This app is not supported in your browser anymore");
                }
                break;
            case "local":
                let input = document.getElementById("file");
                input.onchange = () => {
                    const file = document.getElementById('file').files[0];

                    const url = URL.createObjectURL(file);

                    let videoElement = document.getElementById("inputVideo");
                    videoElement.src = url;
                    video.src = url; 
                    that.mediaRecorder = new MediaRecorder(videoElement.captureStream());

                    that.mediaRecorder.onstop = function (e) {

                        video.addEventListener("play", function() {
                        
                        });
                        video.addEventListener("pause", function() {
                            
                        });
                        video.setAttribute('controls', 'name');
                        video.controls = false;
                        video.loop = true;
                        
                        let blob = new Blob(that.chunks, { "type": "video/mp4; codecs=avc1" });
                        let videoURL = URL.createObjectURL(blob);
                        video.src = videoURL;
                        console.log("Recording correctly saved");
                    }

                    that.mediaRecorder.ondataavailable = function (e) {
                        console.log(e.data);
                        that.chunks.push(e.data);
                    }
                    MediaPipe.start(mode);
                }
                input.click();
                break;
        }
        

        this.setEvents();

        window.addEventListener("resize", this.onResize);
    }
    
    isRecording() {
        return this.recording;
    }

    setIsRecording( value ) {
        this.recording = value;
    }

    setEvents() {

        // adjust video canvas
        let captureDiv = document.getElementById("capture");
        let videoCanvas = document.getElementById("outputVideo");
        let h = captureDiv.clientHeight * 0.8;
        let aspectRatio = videoCanvas.width / videoCanvas.height;
        videoCanvas.height = captureDiv.height = videoCanvas.style.height = h;
        videoCanvas.width = captureDiv.width = videoCanvas.style.width = h * aspectRatio;

        // configurate buttons
        let elem = document.getElementById("endOfCapture");
    
        let capture = document.getElementById("capture_btn");
        capture.onclick = () => {
            
            if (!this.recording) {
                
                capture.innerHTML = "Stop" + " <i class='bi bi-stop-fill'></i>"
                capture.style.backgroundColor = "lightcoral";
                capture.style.border = "solid #924242";

                videoCanvas.style.border = "solid #924242";
                
                // Start the capture
                this.project.landmarks = []; //reset array
                this.recording = true;
                this.mediaRecorder.start();
                this.startTime = Date.now();
                console.log(this.mediaRecorder.state);
                console.log("Start recording");
            }
            else {
                // Show modal to redo or load the animation in the scene
                elem.style.display = "flex";
                
                // Stop the video recording
                this.recording = false;
                
                this.mediaRecorder.stop();
                let endTime = Date.now();
                this.duration = endTime - this.startTime;
                console.log(this.mediaRecorder.state);
                console.log("Stop recording");
    
                // Correct first dt of landmarks
                this.project.landmarks[0].dt = 0;

                // Back to initial values
                capture.innerHTML = "Capture" + " <i class='bi bi-record2'></i>"
                capture.style.removeProperty("background-color");
                capture.style.removeProperty("border");
                videoCanvas.style.removeProperty("border");
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
            this.loadAnimation(0, null);
        };

        let trimBtn = document.getElementById("trim_btn");
        trimBtn.onclick = () => {
            VideoUtils.unbind( (start, end) => this.loadAnimation(start, end) );
        };
    }
    
    async processVideo() {
                
        // Update header
        let capture = document.getElementById("capture_btn");
        capture.disabled = true;
        capture.style.display = "none";

        let trimBtn = document.getElementById("trim_btn");
        trimBtn.style.display = "block";

        // TRIM VIDEO - be sure that only the sign is recorded
        let canvas = document.getElementById("outputVideo");
        let video = document.getElementById("recording");
        video.classList.remove("hidden");
        video.style.width = canvas.width + "px";
        video.style.height = canvas.height + "px";

        await VideoUtils.bind(video, canvas);
    }

    fillLandmarks(data, dt) {

        if(!data) {
            console.warn( "no landmark data at time " + dt/1000.0 );
            return;
        }

        var point = new THREE.Vector3();
        var up = new THREE.Vector3(0, 1, 0);
        if(data.poseLandmarks)
        {
            for (let j = 0; j < data.poseLandmarks.length; ++j) {
                
                data.poseLandmarks[j].x = (data.poseLandmarks[j].x - 0.5);
                data.poseLandmarks[j].y = (1.0 - data.poseLandmarks[j].y) + 1.5;
                data.poseLandmarks[j].z = -data.poseLandmarks[j].z * 0.5;
            }
            if(data.rightHandLandmarks)
                for (let j = 0; j < data.rightHandLandmarks.length; ++j) {
                    data.rightHandLandmarks[j].z = -data.rightHandLandmarks[j].z * 0.5;
                }
            if(data.leftHandLandmarks)
                for (let j = 0; j < data.leftHandLandmarks.length; ++j) {
                    data.leftHandLandmarks[j].z = -data.leftHandLandmarks[j].z * 0.5;
                }
           
        }
        /*for (let j = 0; j < data.faceLandmarks.length; ++j) {
        
            data.faceLandmarks[j].x = (data.faceLandmarks[j].x - 0.5);
            data.faceLandmarks[j].y = (1.0 - data.faceLandmarks[j].y)+1 ;
            data.faceLandmarks[j].z = -data.faceLandmarks[j].z * 0.5;
        }*/
        if(data.multiFaceLandmarks)
        {
            data.faceLandmarks = data.multiFaceLandmarks[0];
            for (let j = 0; j < data.faceLandmarks.length; ++j) {
            
                data.faceLandmarks[j].x = (data.faceLandmarks[j].x - 0.5);
                data.faceLandmarks[j].y = (1.0 - data.faceLandmarks[j].y)+1 ;
                data.faceLandmarks[j].z = -data.faceLandmarks[j].z * 0.5;
            }
        }
        /*point.applyAxisAngle(up, Math.PI);
        
        data.poseLandmarks[j].x = point.x;
        data.poseLandmarks[j].y = point.y;
        data.poseLandmarks[j].z = point.z;*/
        
        /*for (let j = 0; j < data.ea.length; ++j) {
            data.ea[j].y = - data.ea[j].y;
        }*/
        this.project.landmarks.push({"FLM": data.faceLandmarks,"dt": dt});

    }

    loadAnimation(startTime, endTime) {
    
        let that = this;
        
        // Update header
        let capture = document.getElementById("capture_btn");
        capture.disabled = true;
        capture.style.display = "none";

        let trimBtn = document.getElementById("trim_btn");
        trimBtn.disabled = true;
        trimBtn.style.display = "none";

        let stateBtn = document.getElementById("state_btn");
        stateBtn.style.display = "block";
        let stopBtn = document.getElementById("stop_btn");
        stopBtn.style.display = "block";
    
        // Reposition the canvas elements
        let videoDiv = document.getElementById("capture");
        videoDiv.classList.remove("expanded");
        let videoRec = document.getElementById("recording");
        videoRec.classList.remove("hidden");
        videoRec.style.width = "100%";
        videoRec.style.height = "100%";

        let timelineDiv = document.getElementById("timeline");
        timelineDiv.classList.remove("hidden");
    
        // Solve the aspect ratio problem of the video
        let videoCanvas = document.getElementById("outputVideo");
        let aspectRatio = videoDiv.width / videoDiv.height;
        videoRec.width  = videoDiv.width  = videoCanvas.width  = videoDiv.clientWidth;
        videoRec.height = videoDiv.height = videoCanvas.height = videoCanvas.width / aspectRatio;

        $(videoDiv).draggable({containment: "#canvasarea"}).resizable({ aspectRatio: true, containment: "#canvasarea"});

        // videoRec.src = "models/bvh/victor.mp4";

        const updateFrame = (now, metadata) => {
            
            // Do something with the frame.
            const canvasElement = document.getElementById("outputVideo");
            const canvasCtx = canvasElement.getContext("2d");
    
            //let frame = metadata.presentedFrames % project.landmarks; //maybe use project.duration, but first we need to take the animation from the video
            let landmarks = that.project.landmarks; //[frame];
    
            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
            drawConnectors(canvasCtx, landmarks.PLM, POSE_CONNECTIONS,
                            {color: '#00FF00', lineWidth: 4});
            drawLandmarks(canvasCtx, landmarks.PLM,
                            {color: '#FF0000', lineWidth: 2});
            // drawConnectors(canvasCtx, landmarks.FLM, FACEMESH_TESSELATION,
            //                 {color: '#C0C0C070', lineWidth: 1});
            // drawConnectors(canvasCtx, landmarks.LLM, HAND_CONNECTIONS,
            //                 {color: '#CC0000', lineWidth: 5});
            // drawLandmarks(canvasCtx, landmarks.LLM,
            //                 {color: '#00FF00', lineWidth: 2});
            // drawConnectors(canvasCtx, landmarks.RLM, HAND_CONNECTIONS,
            //                 {color: '#00CC00', lineWidth: 5});
            // drawLandmarks(canvasCtx, landmarks.RLM,
            //                 {color: '#FF0000', lineWidth: 2});
            canvasCtx.restore();
            
            //animate();
    
            // Re-register the callback to be notified about the next frame.
            videoRec.requestVideoFrameCallback(updateFrame);
        };
        // Initially register the callback to be notified about the first frame.
        videoRec.requestVideoFrameCallback(updateFrame);

        // Make a prompt but since we have to load the model, do it meanwhile 
        // and set the name later 
        LiteGUI.prompt( "Please, enter the name of the sign performed and the language. (Example: Dog in Irish Sign Language --> dog_ISL)", (name) => {

            name = name || "Unnamed";
            videoRec.name = name;
            this.project.clipName = name;
            this.editor.updateGUI();

        }, { title: "Editor", width: 350 } );

        // Creates the scene and loads the animation
        this.project.trimTimes = [startTime, endTime];
        this.editor.loadInScene(this.project);
    }

    async storeAnimation() {

        // CHECK THE INPUT FILE !!!!TODO!!!!
        let file = undefined;

        if (!confirm("Have you finished editing your animation? Remember that uploading the animation to the database implies that it will be used in the synthesis of the 3D avatar used in SignON European project."))
        return;
        
        // Check if are files loaded
        if (!file) {
            w2popup.close();
            console.log("Not BVH found.");
            return;
        }

        // Log the user
        await this.FS.login();

        // folder, data, filename, metadata
        await this.FS.uploadData("animations", file, file.name || "noName", "");

        // Log out the user
        this.FS.logout();

        w2popup.close();

        // For now this is used in timeline_maanager
        // refactor!!
        window.storeAnimation = this.storeAnimation;
    }

    onResize() {

        let canvasArea = document.getElementById("canvasarea");

        const CANVAS_WIDTH = canvasArea.clientWidth;
        const CANVAS_HEIGHT = canvasArea.clientHeight;

        const timelineCanvas = document.getElementById("timelineCanvas");
        timelineCanvas.width = CANVAS_WIDTH;

        app.editor.resize(CANVAS_WIDTH, CANVAS_HEIGHT);
    }

}

const app = new App();
app.selectMode();
//app.init();

export { app };