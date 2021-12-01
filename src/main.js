import { start_webcam } from './pointsDet.js';
import { Project } from './project.js';
import { loadInScene } from './3Dview.js';
import { FileSystem } from './libs/filesystem.js';


//Create the fileSystem and log the user
var FS = new FileSystem("signon", "signon", () => console.log("Wellcome user"));
//create the project object
var project = new Project();
var mediaRecorder = null;

//switch on the webcam
start_webcam();
//prepare the device to capture the video
if (navigator.mediaDevices) {
    console.log('getUserMedia supported.');

    var constraints = { video: true, audio: false };
    var chunks = [];

    navigator.mediaDevices.getUserMedia(constraints)
        .then(function (stream) {
            var videoElement = document.getElementsByClassName('input_video')[0];
            mediaRecorder = new MediaRecorder(videoElement.srcObject);

            mediaRecorder.onstop = function (e) {

                var clipName = prompt('Enter a name for your sound clip');

                var video = document.getElementById('recorded');
                video.setAttribute('controls', 'controlslist', 'name', '');
                video.controls = true;
                video.controlsList = 'nodownload nofullscreen';
                video.disablePictureInPicture = true;
                video.autoplay = false;
                video.loop = true;
                video.name = clipName;

                var blob = new Blob(chunks, { 'type': 'video/mp4; codecs=avc1' });
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
            console.log('The following error occurred: ' + err);
        })
}
else {
    console.log('This app is not supported in your browser anymore');
}
//init the header
init_header();

// function previewFile() {
//     const file = document.getElementById("testInput").files[0];
//     const reader = new FileReader();

//     reader.addEventListener("load", function () {
//         loadAnimation();
//         load_animation(project, reader.result);
//         project.path = reader.result;
//     }, false);

//     if (file) {
//       reader.readAsDataURL(file);
//     }
// }

// ---------------------------------------------------------------------------------------------------------------- //

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
    var inputMin_dete = DeteConfidence.getAttribute('min');
    var inputMax_dete = DeteConfidence.getAttribute('max');
    var inputMin_track = TrackConfidence.getAttribute('min');
    var inputMax_track = TrackConfidence.getAttribute('max');

    var pxls_dete = w1 / 100;
    var k_dete = (inputMax_dete - inputMin_dete) / 100;
    var pxls_track = w2 / 100;
    var k_track = (inputMax_track - inputMin_track) / 100;

    var valorCalculado_dete = ((DeteConfidence.value - inputMin_dete) / k_dete) * pxls_dete;
    etq_dete.style.left = (valorCalculado_dete + 7) + "px";
    var valorCalculado_track = ((TrackConfidence.value - inputMin_track) / k_track) * pxls_track;
    etq_track.style.left = (valorCalculado_track + 7) + "px";

    DeteConfidence.addEventListener('input', function () {
        /* cambia el valor de la etiqueta (el tooltip) */
        etq_dete.innerHTML = this.value;
        /* cambia la posición de la etiqueta (el tooltip) */
        var nuevoValorCalculado = ((this.value - inputMin_dete) / k_dete) * pxls_dete;
        etq_dete.style.left = (nuevoValorCalculado + 7) + "px";
    }, false);
    TrackConfidence.addEventListener('input', function () {
        /* cambia el valor de la etiqueta (el tooltip) */
        etq_track.innerHTML = this.value;
        /* cambia la posición de la etiqueta (el tooltip) */
        var nuevoValorCalculado = ((this.value - inputMin_track) / k_track) * pxls_track;
        etq_track.style.left = (nuevoValorCalculado + 7) + "px";
    }, false);

    //adjust canvas
    var video_canvas = document.getElementById('output_video');
    video_canvas.style.width = video_canvas.style.clientHeight / video_canvas.height * video_canvas.width;

function init_header() { //improve the header (use w2ui)

    //configurate buttons
    var elem = document.getElementById('endOfCapture');

    var capture = document.getElementById('capture_btn');
    capture.onclick = function () {

        if (this.children[0].innerText == "Capture") {
            this.children[0].innerText = "Stop";
            this.style.backgroundColor = "lightcoral";
            this.style.border = "solid #924242";
            //start the capture
            mediaRecorder.start();
            console.log(mediaRecorder.state);
            console.log("Start recording");
        }
        else {
            //show modal to redo or load the animation in the scene
            elem.style.display = "flex";
            //stop the video recording
            mediaRecorder.stop();
            console.log(mediaRecorder.state);
            console.log("Stop recording");
        }
    };

    var redo = document.getElementById('redo_btn');
    redo.onclick = function () {
        elem.style.display = "none";

        //clear data????

        //back to initial values
        capture.children[0].innerText = "Capture"
        capture.style.removeProperty("background-color");
        capture.style.removeProperty("border");
    };

    var loadData = document.getElementById('loadData_btn');
    loadData.onclick = function () {
        elem.style.display = "none";
        
        //display recorded video
        var video = document.getElementById('recorded');
        video.style.display = 'block';

        //store the data in project, and store a bvh of it
        //TODO

        //display message that animation doesnt represent the video (remove later)
        var elem_scene = document.getElementById("scene");
        var dateSpan = document.createElement('span')
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
    var capture = document.getElementById('capture_btn');
    capture.disabled = true;
    capture.children[0].innerText = "Captured";
    capture.style.removeProperty("background-color");
    capture.style.removeProperty("border");

    var elements = document.getElementsByClassName('expanded');
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

    //show the recorded video element instead of the canvas
    var recording = document.getElementById("recorded");
    recording.width = canv.width;
    recording.height = canv.height;
    canv.style.display = "none";

    //mirror canvas video
    // var canvasCtx = canv.getContext('2d');
    // canvasCtx.translate(canv.width, 0);
    // canvasCtx.scale(-1, 1);

    //make the scene canvas same as video
    var scene3d = document.getElementById("scene3d");
    scene3d.width = recording.clientWidth;
    scene3d.height = recording.clientHeight;

    //creates the scene and loads the animation
    loadInScene(project);
};


export { project, FS };