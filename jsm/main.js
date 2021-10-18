import { start_webcam } from './pointsDet.js';
import { init_scene, load_animation } from './3Dview.js';


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

var pxls_dete = w1/100;
var k_dete = (inputMax_dete - inputMin_dete)/100;
var pxls_track = w2/100;
var k_track = (inputMax_track - inputMin_track)/100;

var valorCalculado_dete = ((DeteConfidence.value - inputMin_dete)/k_dete)*pxls_dete;
etq_dete.style.left =  (valorCalculado_dete + 7) + "px";
var valorCalculado_track = ((TrackConfidence.value - inputMin_track)/k_track)*pxls_track;
etq_track.style.left =  (valorCalculado_track + 7) + "px";

DeteConfidence.addEventListener('input', function(){
	/* cambia el valor de la etiqueta (el tooltip) */
	etq_dete.innerHTML = this.value;
	/* cambia la posición de la etiqueta (el tooltip) */
	var nuevoValorCalculado = ((this.value - inputMin_dete)/k_dete)*pxls_dete;
	etq_dete.style.left = (nuevoValorCalculado + 7) + "px";
}, false);
TrackConfidence.addEventListener('input', function(){
	/* cambia el valor de la etiqueta (el tooltip) */
	etq_track.innerHTML = this.value;
	/* cambia la posición de la etiqueta (el tooltip) */
	var nuevoValorCalculado = ((this.value - inputMin_track)/k_track)*pxls_track;
	etq_track.style.left = (nuevoValorCalculado + 7) + "px";
}, false);

//configurate button
var capture = document.getElementsByClassName('button')[0];
capture.onclick = function () {

    //start the capture

    //once it is done, store the data in project, and store a bvh of it

    //then create a button in the 3D scene to load the animation, this button will call the load_animation function
    //load the bvh in the scene
    load_animation( project );
    this.onclick = null;
};


//create the project object
var project = {
    captured_data: [],
    bvh_name: '',
    bones: [], // list of joints with a hierarchy value
    mixer: undefined, //?
    duration: undefined,
    max_keyframes: 0,
}


//switch of the webcam
start_webcam();
//create and init the 3D scene
init_scene();

// ... 

//editing stuff

//call a function (with a button for instance) to store the bvh with the label in our database



export { project };