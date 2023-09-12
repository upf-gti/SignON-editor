import "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js";

// Mediapipe face blendshapes
import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0';

import * as THREE from 'three'
import { UTILS } from "./utils.js"

const MediaPipe = {

    loaded: false,
    currentTime: 0,
    previousTime: 0,
    bsCurrentTime: 0,
    bsPreviousTime: 0,
    landmarks: [],
    blendshapes : [],
    async start( live, onload, onResults ) {

        UTILS.makeLoading("Loading MediaPipe...");

        this.live = live;
        this.landmarks = [];
        this.blendshapes = [];
        this.onload = onload;
        this.onResults = onResults;
        // Webcam and MediaPipe Set-up
        const videoElement = document.getElementById("inputVideo");
        const canvasElement = document.getElementById("outputVideo");
        const canvasCtx = canvasElement.getContext("2d");
        MediaPipe.stop();
        //Holistic 
        if(!this.holistic) {

            this.holistic = await new Holistic({locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
            }});
    
            this.holistic.setOptions({
                modelComplexity: 1,
                smoothLandmarks: true,
                enableSegmentation: true,
                smoothSegmentation: true,
                refineFaceLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
        }
        else {
            this.holistic.reset();
        }
        this.holistic.onResults(((results) => {

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
                    {color: '#1a2025', lineWidth: 4}); //'#00FF00'
                drawLandmarks(canvasCtx, results.poseLandmarks,
                                {color: '#1a2025',fillColor: 'rgba(255, 255, 255, 1)', lineWidth: 2}); //'#00FF00'
                // drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_TESSELATION,
                //                 {color: '#C0C0C070', lineWidth: 1});
                drawConnectors(canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS,
                                {color: '#1a2025', lineWidth: 4}); //#CC0000
                drawLandmarks(canvasCtx, results.leftHandLandmarks,
                                {color: '#1a2025',fillColor: 'rgba(58, 161, 156, 1)', lineWidth: 2}); //'#00FF00'
                drawConnectors(canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS,
                                {color: '#1a2025', lineWidth: 4}); //#00CC00
                drawLandmarks(canvasCtx, results.rightHandLandmarks,
                                {color: '#1a2025',fillColor: 'rgba(196, 113, 35, 1)', lineWidth: 2});
                                        
            }
            canvasCtx.restore();
            if(this.onResults)
                this.onResults({landmarksResults: results}, recording);

        }).bind(this));

        // Face blendshapes
        if(!this.faceLandmarker) {

            const filesetResolver = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
            );
    
            this.faceLandmarker = await FaceLandmarker.createFromOptions( filesetResolver, {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                    delegate: 'GPU'
                },
                outputFaceBlendshapes: true,
                outputFacialTransformationMatrixes: true,
                runningMode: 'VIDEO',
                numFaces: 1
            } );
        }

        this.loaded = false;
        if(live) {
            this.startWebcam(videoElement, this, () => videoElement.play());
            // if(!this.webcamera) {

            //     this.webcamera = new Camera(videoElement, {
            //         onFrame: async () => {
            //             await this.holistic.send({image: videoElement});

            //             if(!this.loaded) {
            //                 this.loaded = true;
            //                 if(this.onload) this.onload();
            //             }

            //             const faceResults = this.faceLandmarker.detectForVideo(videoElement, Date.now() );
            //             if(faceResults)
            //                 this.onFaceResults(faceResults);
            //         },
            //         width: 1280,
            //         height: 720
            //     });
            // }
            // else{
            //     this.loaded = false;
            // }
    
            // this.webcamera.start();
        } else {
            // if(this.webcamera) {
            //     this.webcamera.stop();
            //     this.loaded = false;
            // }
        }
        videoElement.play();
        videoElement.controls = true;
        videoElement.loop = true;
        videoElement.requestVideoFrameCallback( this.sendVideo.bind(this, this.holistic, videoElement) );  
    },

    async sendVideo(holistic, videoElement){
        await holistic.send({image: videoElement});
         const faceResults = this.faceLandmarker.detectForVideo(videoElement, Date.now() );
                    if(faceResults)
                        this.onFaceResults(faceResults);
        videoElement.requestVideoFrameCallback(this.sendVideo.bind(this, holistic, videoElement));

        if(!this.loaded) {
            this.loaded = true;
            if(this.onload) this.onload();
        }
    },

    onFaceResults(results) {
        
        let faceBlendshapes = null;
        if (window.globals.app.isRecording()) // store MediaPipe data
        {
            this.bsCurrentTime = Date.now();
            var dt = this.bsCurrentTime - this.bsPreviousTime;
            faceBlendshapes = this.fillBlendshapes(results, dt, true);
            this.bsPreviousTime = this.bsCurrentTime;
            
        }
        else {
            faceBlendshapes = this.fillBlendshapes(results);
        }

        this.onResults({blendshapesResults: faceBlendshapes}, window.globals.app.isRecording())
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
        this.blendshapes = [];
    },

    onStopRecording() {
        
        // Correct first dt of landmarks
        this.landmarks[0].dt = 0;
        this.blendshapes[0].dt = 0;
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
    },

 
    fillBlendshapes(data, dt = 0, fill = false) {
        const transform = new THREE.Object3D();
        let blends = {};
        if ( data.faceBlendshapes.length > 0  ) {

            const faceBlendshapes = data.faceBlendshapes[ 0 ].categories;
            for ( const blendshape of faceBlendshapes ) {

                const name =  blendshape.categoryName.charAt(0).toUpperCase() + blendshape.categoryName.slice(1);
                blends[name] = blendshape.score;

            }
            
            if(blends["LeftEyeYaw"] == null);
            {
                blends["LeftEyeYaw"] = (blends["EyeLookOutLeft"] - blends["EyeLookInLeft"])/2;
                blends["RightEyeYaw"] = - (blends["EyeLookOutRight"] - blends["EyeLookInRight"])/2;
                blends["LeftEyePitch"] = (blends["EyeLookDownLeft"] - blends["EyeLookUpLeft"])/2;
                blends["RightEyePitch"] = (blends["EyeLookDownRight"] - blends["EyeLookUpRight"])/2;
            }

        }

        if ( data.facialTransformationMatrixes.length > 0 ) {

            const facialTransformationMatrixes = data.facialTransformationMatrixes[ 0 ].data;

            transform.matrix.fromArray( facialTransformationMatrixes );
            transform.matrix.decompose( transform.position, transform.quaternion, transform.scale );

            blends["HeadYaw"] = - transform.rotation.y;
            blends["HeadPitch"] = - transform.rotation.x;
            blends["HeadRoll"] = - transform.rotation.z;
        }

        if(fill) {
            blends.dt = dt;
            this.blendshapes.push(blends)
        }

        return blends;
    },

    startWebcam(video, scope, callback, on_error) {
                
        // prepare the device to capture the video
        if (navigator.mediaDevices) {
            console.log("UserMedia supported");
                    
            

            navigator.mediaDevices.enumerateDevices()
            .then(function(devices) {
                let deviceId = null;
                for (const deviceInfo of devices) {
                    if(deviceInfo.kind === 'videoinput') {
                        deviceId = deviceInfo.deviceId;
                        break;
                    }
                };
                let constraints = { "video": true, "audio": false, width: 1280, height: 720 };
                navigator.mediaDevices.getUserMedia(constraints)
                .then( (stream) => {

                    let videoElement = document.getElementById("inputVideo");
                    
                    if(!videoElement.srcObject)
                        videoElement.srcObject = stream;
                    // videoElement.width = "1280px";
                    // videoElement.height = "720px";
                    scope.mediaRecorder = new MediaRecorder(videoElement.srcObject);

                    scope.mediaRecorder.onstop = function (e) {

                        video.addEventListener("play", function() {});
                        video.addEventListener("pause", function() {});
                        video.setAttribute('controls', 'name');
                        video.controls = false;
                        video.loop = true;
                        
                        let blob = new Blob(scope.chunks, { "type": "video/mp4; codecs=avc1" });
                        let videoURL = URL.createObjectURL(blob);
                        video.src = videoURL;
                        console.log("Recording correctly saved");
                    }

                    scope.mediaRecorder.ondataavailable = function (e) {
                        scope.chunks.push(e.data);
                    }
                    if(callback)
                        callback();
                })
                .catch(function (err) {
                    console.error("The following error occurred: " + err);
                    if(err == "NotReadableError: Could not start video source")
                        alert("Camera error: Make sure your webcam is not used in another application.")
                    if(on_error)
                        on_error(err);
                });
                
            })
            .catch(function(err) {
            console.log(err.name + ": " + err.message);
            });
            
        }
        else {
            if(on_error)
                on_error();
        }
    }

}

export { MediaPipe };