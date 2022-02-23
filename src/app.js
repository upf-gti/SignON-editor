import { MediaPipe } from "./mediapipe.js";
import { Project } from "./project.js";
import { Editor } from "./editor.js";
import { FileSystem } from "./libs/filesystem.js";

class App {

    constructor(){

        // Flags
        this.recording = false;
        
        this.mediaRecorder = null
        this.project = new Project();
        this.editor = new Editor();

        // Create the fileSystem and log the user
        this.FS = new FileSystem("signon", "signon", () => console.log("Auto login of guest user"));
    }

    init() {

        let that = this;

        MediaPipe.start();

        // prepare the device to capture the video
        if (navigator.mediaDevices) {
            console.log("getUserMedia supported.");

            let constraints = { video: true, audio: false };
            let chunks = [];

            navigator.mediaDevices.getUserMedia(constraints)
                .then(function (stream) {
                    let videoElement = document.getElementById("inputVideo");
                    that.mediaRecorder = new MediaRecorder(videoElement.srcObject);

                    that.mediaRecorder.onstop = function (e) {

                        let video = document.getElementById("recording");
                        video.addEventListener("play", function() {
                            let icon = w2ui.sidebar.get("play").icon;
                            if (icon == "fa fa-play") {
                                icon = "fa fa-pause";
                                that.editor.setState(true);
                                //this.currentTime = 2; //check later
                            }
                            else {
                                icon = "fa fa-play";
                                that.editor.setState(false);
                            }
                            w2ui.sidebar.update("play", {"icon": icon});
                        });
                        video.addEventListener("pause", function() {
                            let icon = w2ui.sidebar.get("play").icon;
                            if (icon == "fa fa-play") {
                                icon = "fa fa-pause";
                                that.editor.setState(true);
                            }
                            else {
                                icon = "fa fa-play";
                                that.editor.setState(false);
                            }
                            w2ui.sidebar.update("play", {"icon": icon});
                        });
                        video.setAttribute('controls', 'name');
                        video.controls = false;
                        video.loop = true;
                        
                        let blob = new Blob(chunks, { "type": "video/mp4; codecs=avc1" });
                        chunks = [];
                        let videoURL = URL.createObjectURL(blob);
                        video.src = videoURL;
                        console.log("Recording correctly saved");
                    }

                    that.mediaRecorder.ondataavailable = function (e) {
                        chunks.push(e.data);
                    }
                })
                .catch(function (err) {
                    console.error("The following error occurred: " + err);
                })
        }
        else {
            console.log("This app is not supported in your browser anymore");
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

        let that = this;
        
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
        capture.onclick = function () {
            
            if (!that.recording) {
                
                capture.innerText = "Stop";
                capture.style.backgroundColor = "lightcoral";
                capture.style.border = "solid #924242";

                videoCanvas.style.border = "solid #924242";
                
                // Start the capture
                that.project.landmarks = []; //reset array
                that.recording = true;
                that.mediaRecorder.start();
                console.log(that.mediaRecorder.state);
                console.log("Start recording");
            }
            else {
                // Show modal to redo or load the animation in the scene
                elem.style.display = "flex";
                
                // Stop the video recording
                that.recording = false;
                
                that.mediaRecorder.stop();
                console.log(that.mediaRecorder.state);
                console.log("Stop recording");
    
                // Correct first dt of landmarks
                that.project.landmarks[0].dt = 0;

                // Back to initial values
                capture.innerText = "Capture";
                capture.style.removeProperty("background-color");
                capture.style.removeProperty("border");
                videoCanvas.style.removeProperty("border");
            }
        };
    
        let redo = document.getElementById("redo_btn");
        redo.onclick = function () {
            
            elem.style.display = "none";
        };
    
        let loadData = document.getElementById("loadData_btn");
        loadData.onclick = function () {
            
            elem.style.display = "none";
    
            MediaPipe.stop();
            
            // Store the data in project, and store a bvh of it
            // TODO
    
            that.loadAnimation();
        };
    }

    fillLandmarks(data, _dt) 
    {
        for (let j = 0; j < data.poseLandmarks.length; ++j) {
            data.poseLandmarks[j].x = (data.poseLandmarks[j].x - 0.5);
            data.poseLandmarks[j].y = (1.0 - data.poseLandmarks[j].y) + 2;
            data.poseLandmarks[j].z = data.poseLandmarks[j].z * 0.5;
        }

        this.project.landmarks.push({RLM: data.rightHandLandmarks, LLM: data.leftHandLandmarks, FLM: data.faceLandmarks, PLM: data.poseLandmarks, dt: _dt});
    }

    loadAnimation() {
    
        let that = this;

        // Update header
        let capture = document.getElementById("capture_btn");
        capture.disabled = true;
        capture.style.display = "none";
        
        let stateBtn = document.getElementById("state_btn");
        stateBtn.style.display = "block";

        let uploadBtn = document.getElementById("upload_btn");
        uploadBtn.style.display = "block";
        uploadBtn.onclick = this.storeAnimation;
    
        // Reposition the canvas elements
        let videoDiv = document.getElementById("capture");
        videoDiv.classList.remove("expanded");
        let videoRec = document.getElementById("recording");
        videoRec.classList.remove("hidden");

        // let skeletonCanvas = document.getElementById("skeleton");
        // skeletonCanvas.width = skeletonCanvas.clientWidth;
        // skeletonCanvas.height = skeletonCanvas.clientHeight;
        // let settingsCanvas = document.getElementById("settings");
        // settingsCanvas.width = settingsCanvas.clientWidth;
        // settingsCanvas.height = settingsCanvas.clientHeight; 

        let timelineDiv = document.getElementById("timeline");
        timelineDiv.classList.remove("hidden");
    
        // Solve the aspect ratio problem of the video
        let videoCanvas = document.getElementById("outputVideo");
        let aspectRatio = videoDiv.width / videoDiv.height;
        videoRec.width  = videoDiv.width  = videoCanvas.width  = videoDiv.clientWidth;
        videoRec.height = videoDiv.height = videoCanvas.height = videoCanvas.width / aspectRatio;
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
            recording.requestVideoFrameCallback(updateFrame);
        };
        // Initially register the callback to be notified about the first frame.
        recording.requestVideoFrameCallback(updateFrame);
    
        let clipName = prompt("Please, enter the name of the sign performed and the language. (Example: Dog in Irish Sign Language --> dog_ISL)");
        recording.name = clipName;
    
        // Creates the scene and loads the animation
        this.editor.loadInScene(that.project);
    }

    async storeAnimation() {

        // CHECK THE INPUT FILE !!!!TODO!!!!
        let file = undefined;

        if (confirm("Have you finished editing your animation? Remember that uploading the animation to the database implies that it will be used in the synthesis of the 3D avatar used in SignON European project.")) {
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

            console.log("Upload Clicked");

            w2popup.close();

            // For now this is used in timeline_maanager
            // refactor!!
            window.storeAnimation = this.storeAnimation;
        }
    }

    onResize() {

        let canvasArea = document.getElementById("canvasarea");

        const CANVAS_WIDTH = canvasArea.clientWidth;
        const CANVAS_HEIGHT = canvasArea.clientHeight;

        // skeletonCanvas.width = skeletonCanvas.clientWidth;
        // skeletonCanvas.height = skeletonCanvas.clientHeight;
        // settingsCanvas.width = settingsCanvas.clientWidth;
        // settingsCanvas.height = settingsCanvas.clientHeight;
        // timelineCanvas.width = timelineCanvas.clientWidth;
        // timelineCanvas.height = timelineCanvas.clientHeight;

        app.editor.resize(CANVAS_WIDTH, CANVAS_HEIGHT);
    }

}

const app = new App();
app.init();

export { app };