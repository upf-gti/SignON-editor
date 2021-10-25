import { start_webcam } from './pointsDet.js';
import { Project } from './project.js';
import { load_animation } from './3Dview.js';
import { createButton } from './utils.js';


//create the project object
var project = new Project();
//init the header
init_header();
//switch on the webcam
start_webcam();


// ---------------------------------------------------------------------------------------------------------------- //

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

    //configurate button
    var capture = document.getElementsByClassName('button')[0];
    capture.onclick = function () {

        if (this.children[0].innerText == "Capture") {
            this.children[0].innerText = "Stop";
            this.style.backgroundColor = "lightcoral";
            this.style.border = "solid #924242";
            //start the capture
            //TODO
        }
        else {
            this.children[0].innerText = "Capture";
            //once it is done, store the data in project, and store a bvh of it
            //TODO

            //create a button that will load the animation in the scene
            var element = document.getElementById('capture');
            var button = document.createElement("BUTTON");
            button.innerHTML = "Convert captured data<br/>into a 3D Animation";
            button.className = "btn";
            button.style.position = "absolute";
            button.style.display = "flex";
            button.style.alignItems = "center";
            button.style.fontSize = "30px";
            button.addEventListener("click", loadAnimation); //sets the new webpage composition
            element.appendChild(button);

            //deactivates the button
            this.onclick = null;
            this.children[0].style.color = "black";
            this.style.backgroundColor = "#333";
            this.style.border = "solid #333";
        }
    };
};

function loadAnimation() {
    var elements = document.getElementsByClassName('expanded');
    var expanded_length = elements.length;
    for (var i = 0; i < expanded_length; i++) {
        elements[0].classList.remove("expanded");
    }
    var scene_elem = document.getElementById("scene");
    scene_elem.classList.remove("hidden");
    var timeline_elem = document.getElementById("timeline");
    timeline_elem.classList.remove("hidden");
    
    //solve the aspect ratio problem with the camera video
    var elem = document.getElementById("capture");
    var canv = document.getElementById("output_video");
    if (canv.height > elem.clientHeight) {
        canv.height = elem.clientHeight * 0.95;
        var ar_elem = elem.clientWidth / elem.clientHeight;
        canv.width = ar_elem * canv.height;
    }

    //make the scene canvas same as video
    //TODO

    //creates and loads the scene and the animation
    load_animation(project);
    this.style.display = "none"; //hide the button
};


export { project };