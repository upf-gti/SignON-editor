import { app } from "./app.js";

const MediaPipe = {

    currentTime: 0,
    previousTime: 0,

    start: async function()
    {
        // Webcam and MediaPipe Set-up
        const videoElement = document.getElementById("input_video");
        const canvasElement = document.getElementById("output_video");
        const canvasCtx = canvasElement.getContext("2d");

        // mirror canvas video
        canvasCtx.translate(canvasElement.width, 0);
        canvasCtx.scale(-1, 1);

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

        const webcamera = new Camera(videoElement, {
            onFrame: async () => {
                await holistic.send({image: videoElement});
                var elem = document.getElementById("loading");
                elem.style.display = "none";
            },
            width: 1280,
            height: 720
        });

        webcamera.start();
    },

    // camera.stop() does not exist, therefore solved using jQuery, we can replace the methods with appropriate JavaScript methods
    stop: function()
    {
        // get reference of the video element the Camera is constructed on
        let $feed = $("#input_video")[0];

        // reset feed source 
        $feed.pause();
        $feed.srcObject.getTracks().forEach(a => a.stop());
        $feed.srcObject = null;
    }
}

export { MediaPipe };