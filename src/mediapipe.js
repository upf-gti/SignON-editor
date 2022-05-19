import { app } from "./app.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js" ;
const MediaPipe = {

    currentTime: 0,
    previousTime: 0,

    start: async function(mode)
    {
        // Webcam and MediaPipe Set-up
        const videoElement = document.getElementById("inputVideo");
        const canvasElement = document.getElementById("outputVideo");
        const canvasCtx = canvasElement.getContext("2d");

        const holistic = new Holistic({locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
        }});

        holistic.setOptions({
            modelComplexity: 2,
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

            if (app.isRecording()) // store MediaPipe data
            {
                this.currentTime = Date.now();
                var dt = this.currentTime - this.previousTime;
                // console.log(dt);
                app.fillLandmarks(results, dt);
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

        switch(mode){
            case "live":
                const webcamera = new Camera(videoElement, {
                    onFrame: async () => {
                        await faceMesh.send({image: videoElement});
                        $('#loading').fadeOut();
                    },
                    width: 1280,
                    height: 720
                });
        
                webcamera.start();
                break;
            case "local":
                videoElement.play();
                videoElement.controls = true;
                videoElement.loop = true;
                videoElement.requestVideoFrameCallback( this.sendVideo.bind(this,faceMesh, videoElement) );  
                break;
        }
        
    },
    sendVideo: async function(faceMesh,videoElement){
        await faceMesh.send({image: videoElement});
        $('#loading').fadeOut();
        videoElement.requestVideoFrameCallback(this.sendVideo.bind(this, faceMesh, videoElement))
    },
    // camera.stop() does not exist, therefore solved using jQuery, we can replace the methods with appropriate JavaScript methods
    stop: function()
    {
        // get reference of the video element the Camera is constructed on
        let $feed = $("#inputVideo")[0];

        // reset feed source 
        $feed.pause();
        if(!$feed.srcObject)
            $feed.srcObject = $feed.captureStream();
        $feed.srcObject.getTracks().forEach(a => a.stop());
        $feed.srcObject = null;
    }
}

export { MediaPipe };