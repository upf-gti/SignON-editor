import "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js";

import { UTILS } from "./utils.js"

const MediaPipe = {

    loaded: false,
    currentTime: 0,
    previousTime: 0,
    landmarks: [],

    async start( live, onload, onresults ) {

        UTILS.makeLoading("Loading MediaPipe...");

        this.live = live;
        this.landmarks = [];
        this.onload = onload;
        this.onresults = onresults;
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

            if(this.live){
                // Mirror canvas
                canvasCtx.translate(canvasElement.width, 0);
                canvasCtx.scale(-1, 1);    
                // -------------
            }

            canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
            let recording = window.globals.app.isRecording();
            if(!recording) {
                canvasCtx.globalCompositeOperation = 'source-over';
            
                // const image = document.getElementById("source");
                // canvasCtx.globalAlpha = 0.6;
                // canvasCtx.drawImage(image, 0, 0, canvasElement.width, canvasElement.height);
                // canvasCtx.globalAlpha = 1;
                drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                                {color: '#00FF00', lineWidth: 4});
                drawLandmarks(canvasCtx, results.poseLandmarks,
                                {color: '#FF0000', lineWidth: 2});
                // drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_TESSELATION,
                //                 {color: '#C0C0C070', lineWidth: 1});
                drawConnectors(canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS,
                                {color: '#CC0000', lineWidth: 5});
                drawLandmarks(canvasCtx, results.leftHandLandmarks,
                                {color: '#00FF00', lineWidth: 2});
                drawConnectors(canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS,
                                {color: '#00CC00', lineWidth: 5});
                drawLandmarks(canvasCtx, results.rightHandLandmarks,
                                {color: '#FF0000', lineWidth: 2});
                               
            }
            canvasCtx.restore();
            if(this.onresults)
                this.onresults(results, recording);

        }).bind(this));

        if(live) {
            const webcamera = new Camera(videoElement, {
                onFrame: async () => {
                    await holistic.send({image: videoElement});
    
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
            videoElement.requestVideoFrameCallback( this.sendVideo.bind(this, holistic, videoElement) );  
        }
    },

    async sendVideo(holistic, videoElement){
        await holistic.send({image: videoElement});
        videoElement.requestVideoFrameCallback(this.sendVideo.bind(this, holistic, videoElement));

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
       // $feed.srcObject = null;
    },

    onStartRecording() {
        this.landmarks = [];
    },

    onStopRecording() {
        
        // Correct first dt of landmarks
        this.landmarks[0].dt = 0;
    },

    fillLandmarks(data, dt) {

        if(!data || data.poseLandmarks == undefined) {
            console.warn( "no landmark data at time " + dt/1000.0 );
            return;
        }
        const { poseLandmarks } = data;
        let distance = (poseLandmarks[23].visibility + poseLandmarks[24].visibility)*0.5;
        let leftHand = (poseLandmarks[15].visibility + poseLandmarks[17].visibility + poseLandmarks[19].visibility)/3;
        let rightHand = (poseLandmarks[16].visibility + poseLandmarks[18].visibility + poseLandmarks[20].visibility)/3;
      
        this.landmarks.push({"RLM": data.rightHandLandmarks, "LLM": data.leftHandLandmarks, "FLM": data.faceLandmarks, "PLM": data.poseLandmarks, "dt": dt, distanceToCamera: distance, rightHandVisibility: rightHand, leftHandVisibility: leftHand});
    }
}

export { MediaPipe };