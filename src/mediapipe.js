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
            // drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
            //                 {color: '#00FF00', lineWidth: 4});
            // drawLandmarks(canvasCtx, results.poseLandmarks,
            //                 {color: '#FF0000', lineWidth: 2});
            // // drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_TESSELATION,
            // //                 {color: '#C0C0C070', lineWidth: 1});
            // drawConnectors(canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS,
            //                 {color: '#CC0000', lineWidth: 5});
            // drawLandmarks(canvasCtx, results.leftHandLandmarks,
            //                 {color: '#00FF00', lineWidth: 2});
            // drawConnectors(canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS,
            //                 {color: '#00CC00', lineWidth: 5});
            // drawLandmarks(canvasCtx, results.rightHandLandmarks,
                            // {color: '#FF0000', lineWidth: 2});
            canvasCtx.restore();

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

        if(!data || data.poseLandmarks == undefined) {
            console.warn( "no landmark data at time " + dt/1000.0 );
            return;
        }

        // for (let j = 0; j < data.poseLandmarks.length; ++j) {
        //     data.poseLandmarks[j].x = (data.poseLandmarks[j].x - 0.5);
        //     data.poseLandmarks[j].y = (1.0 - data.poseLandmarks[j].y) + 2;
        //     data.poseLandmarks[j].z = -data.poseLandmarks[j].z * 0.5;
        // }
        // if(data.rightHandLandmarks)
        //     for (let j = 0; j < data.rightHandLandmarks.length; ++j) {
        //         data.rightHandLandmarks[j].z = -data.rightHandLandmarks[j].z * 0.5;
        //     }
        // if(data.leftHandLandmarks)
        //     for (let j = 0; j < data.leftHandLandmarks.length; ++j) {
        //         data.leftHandLandmarks[j].z = -data.leftHandLandmarks[j].z * 0.5;
        //     }

        this.landmarks.push({"RLM": data.rightHandLandmarks, "LLM": data.leftHandLandmarks, "FLM": data.faceLandmarks, "PLM": data.poseLandmarks, "dt": dt});
    }
}

export { MediaPipe };