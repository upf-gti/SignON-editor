import "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js" ;

import { UTILS } from "./utils.js"

const MediaPipe = {

    loaded: false,
    currentTime: 0,
    previousTime: 0,
    landmarks: [],

    async start( live, onload ) {

        UTILS.makeLoading("Loading MediaPipe...");

        this.landmarks = [];
        this.onload = onload;

        // Webcam and MediaPipe Set-up
        const videoElement = document.getElementById("inputVideo");
        const canvasElement = document.getElementById("outputVideo");
        const canvasCtx = canvasElement.getContext("2d");

        const holistic = new Holistic({locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
        }});

        holistic.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: true,
            smoothSegmentation: true,
            refineFaceLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        const faceMesh = new FaceMesh({locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }});
        
        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        faceMesh.onResults((function(results) {

            if (window.globals.app.isRecording()) // store MediaPipe data
            {
                this.currentTime = Date.now();
                var dt = this.currentTime - this.previousTime;
                // console.log(dt);
                this.fillLandmarks(results, dt);
                this.previousTime = this.currentTime;
            }

            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            //canvasCtx.drawImage(results.segmentationMask, 0, 0, canvasElement.width, canvasElement.height); //not needed
            
            // Only overwrite existing pixels.
            canvasCtx.globalCompositeOperation = 'source-in';
            canvasCtx.fillStyle = '#00FF00';
            canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);

            // Only overwrite missing pixels.
            canvasCtx.globalCompositeOperation = 'destination-atop';

            // Mirror canvas
            canvasCtx.translate(canvasElement.width, 0);
            canvasCtx.scale(-1, 1);    
            // -------------

            canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

            canvasCtx.globalCompositeOperation = 'source-over';
            if (results.multiFaceLandmarks) {
                for (const landmarks of results.multiFaceLandmarks) {
                  drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION,
                                 {color: '#C0C0C070', lineWidth: 1});
                  drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, {color: '#FF3030'});
                  drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYEBROW, {color: '#FF3030'});
                  drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_IRIS, {color: '#FF3030'});
                  drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, {color: '#30FF30'});
                  drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYEBROW, {color: '#30FF30'});
                  drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_IRIS, {color: '#30FF30'});
                  drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, {color: '#E0E0E0'});
                  drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, {color: '#E0E0E0'});
                  drawConnectors(canvasCtx, landmarks, [[473,477]], {color: '#30FF30'});
                  drawConnectors(canvasCtx, landmarks, [[468,472]], {color: '#FF3030'});
                }
              }
            canvasCtx.restore();

        }).bind(this));

        holistic.onResults((function(results) {

            if (window.globals.app.isRecording()) // store MediaPipe data
            {
                this.currentTime = Date.now();
                var dt = this.currentTime - this.previousTime;
                this.fillLandmarks(results, dt);
                this.previousTime = this.currentTime;
            }

            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            // Only overwrite existing pixels.
            canvasCtx.globalCompositeOperation = 'source-in';
            canvasCtx.fillStyle = '#00FF00';
            canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);

            // Only overwrite missing pixels.
            canvasCtx.globalCompositeOperation = 'destination-atop';

            // Mirror canvas
            canvasCtx.translate(canvasElement.width, 0);
            canvasCtx.scale(-1, 1);    
            // -------------

            canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

            canvasCtx.globalCompositeOperation = 'source-over';
            drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                            {color: '#00FF00', lineWidth: 4});
            drawLandmarks(canvasCtx, results.poseLandmarks,
                            {color: '#FF0000', lineWidth: 2});
            drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_TESSELATION,
                            {color: '#C0C0C070', lineWidth: 1});
            drawConnectors(canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS,
                            {color: '#CC0000', lineWidth: 5});
            drawLandmarks(canvasCtx, results.leftHandLandmarks,
                            {color: '#00FF00', lineWidth: 2});
            drawConnectors(canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS,
                            {color: '#00CC00', lineWidth: 5});
            drawLandmarks(canvasCtx, results.rightHandLandmarks,
                            {color: '#FF0000', lineWidth: 2});
            canvasCtx.restore();

        }).bind(this));

        if(live) {
            const webcamera = new Camera(videoElement, {
                onFrame: async () => {
                    //await holistic.send({image: videoElement});
                    await faceMesh.send({image: videoElement});	

                    if(!this.loaded) {
                        this.loaded = true;
                        if(this.onload) this.onload();
                    }
                },
                width: 1280,
                height: 720
            });
    
            webcamera.start();
        } else {
            videoElement.play();
            videoElement.controls = true;
            videoElement.loop = true;
            videoElement.requestVideoFrameCallback( this.sendVideo.bind(this,faceMesh, videoElement) );  	
            // videoElement.requestVideoFrameCallback( this.sendVideo.bind(this, holistic, videoElement) );  
        }
    },

    // async sendVideo(holistic, videoElement){
    //     await holistic.send({image: videoElement});
    //     videoElement.requestVideoFrameCallback(this.sendVideo.bind(this, holistic, videoElement));
    sendVideo: async function(faceMesh,videoElement){	
        await faceMesh.send({image: videoElement});	
        videoElement.requestVideoFrameCallback(this.sendVideo.bind(this, faceMesh, videoElement));
        
        if(!this.loaded) {
            this.loaded = true;
            if(this.onload) this.onload();
        }
    },

    // camera.stop() does not exist, therefore solved using jQuery, we can replace the methods with appropriate JavaScript methods
    stop() {
        
        // get reference of the video element the Camera is constructed on
        let $feed = $("#inputVideo")[0];

        // reset feed source 
        $feed.pause();
        if(!$feed.srcObject)
            $feed.srcObject = $feed.captureStream();
        $feed.srcObject.getTracks().forEach(a => a.stop());
        $feed.srcObject = null;
    },

    onStartRecording() {
        this.landmarks = [];
    },

    onStopRecording() {
        
        // Correct first dt of landmarks
        this.landmarks[0].dt = 0;
    },

    fillLandmarks(data, dt) {

        if(!data || data.poseLandmarks == undefined && data.multiFaceLandmarks == undefined) {
            console.warn( "no landmark data at time " + dt/1000.0 );
            return;
        }
        if(data.poseLandmarks)
            for (let j = 0; j < data.poseLandmarks.length; ++j) {
                data.poseLandmarks[j].x = (data.poseLandmarks[j].x - 0.5);
                data.poseLandmarks[j].y = (1.0 - data.poseLandmarks[j].y) + 2;
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
        if(data.multiFaceLandmarks)
        {
            data.faceLandmarks = data.multiFaceLandmarks[0];
            for (let j = 0; j < data.faceLandmarks.length; ++j) {
            
                data.faceLandmarks[j].x = (data.faceLandmarks[j].x - 0.5);
                data.faceLandmarks[j].y = (1.0 - data.faceLandmarks[j].y)+1 ;
                data.faceLandmarks[j].z = -data.faceLandmarks[j].z * 0.5;
            }
        }
        this.landmarks.push({"RLM": data.rightHandLandmarks, "LLM": data.leftHandLandmarks, "FLM": data.faceLandmarks, "PLM": data.poseLandmarks, "dt": dt});
    }
}

export { MediaPipe };