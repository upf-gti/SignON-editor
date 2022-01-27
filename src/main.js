import { start_webcam, onStop } from "./pointsDet.js";
import { Project } from "./project.js";
import { loadInScene, setState, animate } from "./3Dview.js";
import { FileSystem } from "./libs/filesystem.js";


//init globals
var mediaRecorder = null, recording = false;
//Create the fileSystem and log the user
var FS = new FileSystem("signon", "signon", () => console.log("Auto login of guest user"));
//create the project object
var project = new Project();

//switch on the webcam (MediaPipe stuff)
start_webcam();

//prepare the device to capture the video
if (navigator.mediaDevices) {
    console.log("getUserMedia supported.");

    var constraints = { video: true, audio: false };
    var chunks = [];

    navigator.mediaDevices.getUserMedia(constraints)
        .then(function (stream) {
            var videoElement = document.getElementById("input_video");
            mediaRecorder = new MediaRecorder(videoElement.srcObject);

            mediaRecorder.onstop = function (e) {

                var video = document.getElementById("recorded");
                video.addEventListener("play", function() {
                    var icon = w2ui.sidebar.get("play").icon;
                    if (icon == "fa fa-play") {
                        icon = "fa fa-pause";
                        setState(true);
                        //this.currentTime = 2; //check later
                    }
                    else {
                        icon = "fa fa-play";
                        setState(false);
                    }
                    w2ui.sidebar.update("play", {"icon": icon});
                });
                video.addEventListener("pause", function() {
                    var icon = w2ui.sidebar.get("play").icon;
                    if (icon == "fa fa-play") {
                        icon = "fa fa-pause";
                        setState(true);
                    }
                    else {
                        icon = "fa fa-play";
                        setState(false);
                    }
                    w2ui.sidebar.update("play", {"icon": icon});
                });
                video.setAttribute('controls', 'controlslist', 'name', '');
                video.controls = true;
                video.controlsList = 'download nofullscreen';
                video.disablePictureInPicture = true;
                video.autoplay = false;
                video.loop = true;
                
                var blob = new Blob(chunks, { "type": "video/mp4; codecs=avc1" });
                chunks = [];
                var videoURL = URL.createObjectURL(blob);
                video.src = videoURL;
                console.log("Recording correctly saved");
            }

            mediaRecorder.ondataavailable = function (e) {
                chunks.push(e.data);
            }
        })
        .catch(function (err) {
            console.log("The following error occurred: " + err);
        })
}
else {
    console.log("This app is not supported in your browser anymore");
}

//init the header
init_header();


// ---------------------------------------------------------------------------------------------------------------- //


function fillLandmarks(data, _dt) 
{
    for (var j = 0; j < data.poseLandmarks.length; ++j) {
        data.poseLandmarks[j].x = (data.poseLandmarks[j].x - 0.5);
        data.poseLandmarks[j].y = (1.0 - data.poseLandmarks[j].y) + 2;
        data.poseLandmarks[j].z = data.poseLandmarks[j].z * 0.5;
    }

    project.landmarks.push({RLM: data.rightHandLandmarks, LLM: data.leftHandLandmarks, FLM: data.faceLandmarks, PLM: data.poseLandmarks, dt: _dt});
}


function init_header() { //improve the header (use w2ui)
    // Sliders Set-up
    /* EL INPUT */
    var DeteConfidence = document.querySelector("#minDetectionConfidence");
    var TrackConfidence = document.querySelector("#minTrackingConfidence");
    var w1 = parseInt(window.getComputedStyle(DeteConfidence, null).getPropertyValue("width"));
    var w2 = parseInt(window.getComputedStyle(TrackConfidence, null).getPropertyValue("width"));

    /* LA ETIQUETA */
    var etq_dete = document.querySelector("#dete_card");
    var etq_track = document.querySelector("#track_card");
    /* el valor de la etiqueta (el tooltip) */
    etq_dete.innerHTML = DeteConfidence.value;
    etq_track.innerHTML = TrackConfidence.value;

    /* calcula la posición inicial de la etiqueta (el tooltip) */
    var inputMin_dete = DeteConfidence.getAttribute("min");
    var inputMax_dete = DeteConfidence.getAttribute("max");
    var inputMin_track = TrackConfidence.getAttribute("min");
    var inputMax_track = TrackConfidence.getAttribute("max");

    var pxls_dete = w1 / 100;
    var k_dete = (inputMax_dete - inputMin_dete) / 100;
    var pxls_track = w2 / 100;
    var k_track = (inputMax_track - inputMin_track) / 100;

    var valorCalculado_dete = ((DeteConfidence.value - inputMin_dete) / k_dete) * pxls_dete;
    etq_dete.style.left = (valorCalculado_dete + 7) + "px";
    var valorCalculado_track = ((TrackConfidence.value - inputMin_track) / k_track) * pxls_track;
    etq_track.style.left = (valorCalculado_track + 7) + "px";

    DeteConfidence.addEventListener("input", function () {
        /* cambia el valor de la etiqueta (el tooltip) */
        etq_dete.innerHTML = this.value;
        /* cambia la posición de la etiqueta (el tooltip) */
        var nuevoValorCalculado = ((this.value - inputMin_dete) / k_dete) * pxls_dete;
        etq_dete.style.left = (nuevoValorCalculado + 7) + "px";
    }, false);
    TrackConfidence.addEventListener("input", function () {
        /* cambia el valor de la etiqueta (el tooltip) */
        etq_track.innerHTML = this.value;
        /* cambia la posición de la etiqueta (el tooltip) */
        var nuevoValorCalculado = ((this.value - inputMin_track) / k_track) * pxls_track;
        etq_track.style.left = (nuevoValorCalculado + 7) + "px";
    }, false);

    //adjust canvas
    var video_canvas = document.getElementById("output_video");
    video_canvas.style.width = video_canvas.style.clientHeight / video_canvas.height * video_canvas.width;

    //configurate buttons
    var elem = document.getElementById("endOfCapture");

    var capture = document.getElementById("capture_btn");
    capture.onclick = function () {
        if (this.children[0].innerText == "Capture") {
            this.children[0].innerText = "Stop";
            this.style.backgroundColor = "lightcoral";
            this.style.border = "solid #924242";
            
            //start the capture
            project.landmarks = []; //reset array
            recording = true;
            mediaRecorder.start();
            console.log(mediaRecorder.state);
            console.log("Start recording");
        }
        else {
            //show modal to redo or load the animation in the scene
            elem.style.display = "flex";
            
            //stop the video recording
            recording = false;
            mediaRecorder.stop();
            console.log(mediaRecorder.state);
            console.log("Stop recording");

            //correct first dt of landmarks
            project.landmarks[0].dt = 0;
        }
    };

    var redo = document.getElementById("redo_btn");
    redo.onclick = function () {
        elem.style.display = "none";

        //clear data????

        //back to initial values
        capture.children[0].innerText = "Capture"
        capture.style.removeProperty("background-color");
        capture.style.removeProperty("border");
    };

    var loadData = document.getElementById("loadData_btn");
    loadData.onclick = function () {
        elem.style.display = "none";

        //stop MediaPipe
        onStop();
        
        //store the data in project, and store a bvh of it
        //TODO

        //display message that animation doesn't represent the video (remove later)
        var elem_scene = document.getElementById("scene");
        var dateSpan = document.createElement("span")
        dateSpan.innerHTML = "Currenlty under Development to syncronize video and animation";
        dateSpan.style.position = "absolute";
        dateSpan.style.top = "20px";
        dateSpan.style.font = "icon";
        dateSpan.style.fontSize = "larger";
        elem_scene.appendChild(dateSpan);

        loadAnimation();
    };
};

function loadAnimation() {
    
    //deactivates the button
    var capture = document.getElementById("capture_btn");
    capture.disabled = true;
    capture.children[0].innerText = "Captured";
    capture.style.removeProperty("background-color");
    capture.style.removeProperty("border");

    var elements = document.getElementsByClassName("expanded");
    var expanded_length = elements.length;
    for (var i = 0; i < expanded_length; i++) {
        elements[0].classList.remove("expanded");
    }
    //uncover timeline and scene windows
    var scene_elem = document.getElementById("scene");
    scene_elem.classList.remove("hidden");
    var timeline_elem = document.getElementById("timeline");
    timeline_elem.classList.remove("hidden");

    //solve the aspect ratio problem with the camera video
    var elem = document.getElementById("capture");
    var canv = document.getElementById("output_video");
    if (canv.clientHeight > elem.clientHeight) {
        var ar_elem = elem.clientWidth / elem.clientHeight;
        canv.height = elem.clientHeight * 0.99;
        canv.width = ar_elem * canv.height;
    }

    //display recorded video
    //show the recorded video element instead of the canvas
    var recording = document.getElementById("recorded");
    recording.style.display = "flex";
    recording.src = "models/bvh/victor.mp4";
    recording.width = canv.width;
    recording.height = canv.height;
    const updateCanvas = (now, metadata) => {
        // Do something with the frame.
        console.log(now, metadata);
        const canvasElement = document.getElementById("output_video");
        const canvasCtx = canvasElement.getContext("2d");

        //let frame = metadata.presentedFrames % project.landmarks; //maybe use project.duration, but first we need to take the animation from the video
        let landmarks = project.landmarks;//[frame];

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
        
        animate();

        // Re-register the callback to be notified about the next frame.
        recording.requestVideoFrameCallback(updateCanvas);
    };
    // Initially register the callback to be notified about the first frame.
    recording.requestVideoFrameCallback(updateCanvas);

    //make the scene canvas same as video
    var scene3d = document.getElementById("scene3d");
    scene3d.width = recording.clientWidth;
    scene3d.height = recording.clientHeight;

    var clipName = prompt("Please, enter the name of the sign performed and the language. (Example: Dog in Irish Sign Language --> dog_ISL)");
    recording.name = clipName;

    //creates the scene and loads the animation
    loadInScene(project);
};


export { project, FS, recording, fillLandmarks };