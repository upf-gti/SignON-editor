async function start_webcam () {
    // Webcam and MediaPipe Set-up
    const videoElement = document.getElementsByClassName('input_video')[0];
    const canvasElement = document.getElementById('output_video');
    const canvasCtx = canvasElement.getContext('2d');
    
    function onResults(results) {
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 5});
                drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 2});
            }
        }
        canvasCtx.restore();
    }
    
    const hands = new Hands({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }});
    hands.setOptions({
        maxNumHands: 2,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    hands.onResults(onResults);
    
    const webcamera = new Camera(videoElement, {
        onFrame: async () => {
                await hands.send({image: videoElement});
                var elem = document.getElementById('loading');
                elem.style.display = "none";
        },
        width: 1280,
        height: 720,
    });
    webcamera.start();
}

export { start_webcam };