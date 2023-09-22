import { BehaviourPlanner, BehaviourManager, Blink, FacialExpr, FacialEmotion, GazeManager, Gaze, HeadBML, Lipsync, Text2LipInterface, T2LTABLES, LocationBodyArm, HandShapeRealizer, ExtfidirPalmor, CircularMotion, DirectedMotion, FingerPlay, WristMotion, HandConstellation, ShoulderRaise, ShoulderHunch, BodyMovement, findIndexOfBone, getTwistQuaternion } from './BML.js';
import * as THREE  from 'three';
import { GeometricArmIK } from './IKSolver.js';
//@ECA controller


//States
CharacterController.prototype.WAITING = 0;
CharacterController.prototype.PROCESSING = 1;
CharacterController.prototype.SPEAKING = 2;
CharacterController.prototype.LISTENING = 3;

window.SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;

function CharacterController(o) {

    this.time = 0;
    this.character = o.character;
    this.characterConfig = o.characterConfig;

    if (typeof BehaviourManager !== 'undefined') {
        this.BehaviourManager = new BehaviourManager();
    }else {
        console.error("Manager not included");
    }

    if (typeof BehaviourPlanner !== 'undefined') {
        this.BehaviourPlanner = new BehaviourPlanner();
        this.BehaviourPlanner.BehaviourManager = this.BehaviourManager;
    } else {
        console.error("Planner not included");
    }

    if (typeof FacialController !== 'undefined') {
        this.facialController = new FacialController(o);
    } else {
        console.error("FacialController module not found");
    }

    if ( typeof(BodyController) !== 'undefined'){ 
        this.bodyController = new BodyController( this.character, this.characterConfig );
    } 
}

CharacterController.prototype.start = function (o) {
    this.pendingResources = [];

    if ( this.facialController ){ this.facialController.start(o); }
}

CharacterController.prototype.reset = function ( keepEmotion = false ) {
    this.pendingResources.length = 0;

    if ( this.facialController ){ this.facialController.reset( keepEmotion ); }

    if (this.BehaviourPlanner){ this.BehaviourPlanner.reset(); }

    if (this.BehaviourManager){ this.BehaviourManager.reset(); }

    if (this.bodyController){ this.bodyController.reset(); }

    this.endSpeakingTime = -1;
    this.speaking = false;

}

CharacterController.prototype.update = function (dt, et) {
    let newBlock = null;
    this.time = et;

    if ( this.facialController ){ this.facialController.update(dt); }

    if (this.bodyController){ this.bodyController.update(dt) }

    if (this.BehaviourPlanner){ newBlock = this.BehaviourPlanner.update(dt); }

    if (this.BehaviourManager){ this.BehaviourManager.update(this.processBML.bind(this), et); }

    if ( newBlock ){ this.BehaviourManager.newBlock(newBlock, et); }

    // lipsync stuff????
    if ( this.facialController ){
        if (this.BehaviourManager.lgStack.length && this.BehaviourManager.time <= this.BehaviourManager.lgStack[this.BehaviourManager.lgStack.length - 1].endGlobalTime) {
            this.endSpeakingTime = this.BehaviourManager.lgStack[this.BehaviourManager.lgStack.length - 1].endGlobalTime + 1
            this.speaking = true;
        }
        else if (this.endSpeakingTime > -1 && this.BehaviourManager.time <= this.endSpeakingTime || this.facialController.lipsyncModule.working) {
            this.speaking = true;
        }
        else {
            this.endSpeakingTime = -1;
            this.speaking = false;
        }
    }

}

// Process message
// Messages can come from inner processes. "fromWS" indicates if a reply to the server is required in BMLManager.js
CharacterController.prototype.processMsg = function (data, fromWS) {

    // Update to remove aborted blocks
    if (!this.BehaviourManager)
        return;

    this.BehaviourManager.update(this.processBML.bind(this), this.time);

    // Add new block to stack
    //this.BehaviourManager.newBlock(msg, thiscene.time);
    if(typeof(data) == "string")
        data = JSON.parse(data);
    if (data.type == "behaviours") data = data.data;

    // Add new blocks to stack
    let msg = {};

    if (data.constructor == Array) {
        // start and end times of whole message
        let end = -1000000;
        let start = 1000000;

        for (let i = 0; i < data.length; i++) {

            if (data[i].type == "info")
                continue;

            // data based on duration. Fix timings from increments to timestamps
            if (!data[i].end && data[i].duration) {
                data[i].end = data[i].start + data[i].duration;
                if (data[i].attackPeak) data[i].attackPeak += data[i].start;
                if (data[i].ready) data[i].ready += data[i].start;
                if (data[i].strokeStart) data[i].strokeStart += data[i].start;
                if (data[i].stroke) data[i].stroke += data[i].start;
                if (data[i].strokeEnd) data[i].strokeEnd += data[i].start;
                if (data[i].relax) data[i].relax += data[i].start;
            }

            // include data of type into msg
            if (!msg[data[i].type]) {
                msg[data[i].type] = [];
            }
            msg[data[i].type].push(data[i]);

            // update start-end of msg
            if (data[i].end > end) end = data[i].end;
            if (data[i].start < start) start = data[i].start;
        }

        msg.start = start;
        msg.end = end;

        if (!msg.composition)
            msg.composition = "MERGE";

        if ( msg.speech ) {
            msg.control = this.SPEAKING;
        }

        // Process block
        // manages transitions if necessary
        if (this.BehaviourPlanner) {
            this.BehaviourPlanner.newBlock(msg);
        }
        // add blocks to stacks
        this.BehaviourManager.newBlock(msg, this.time);
    }

    else if (data.constructor == Object) {
        msg = data;
        if ( (data.type == "state" || data.type == "control") && data.parameters) {
            msg.control = this[data.parameters.state.toUpperCase()];
        }
        else if (data.type == "info")
            return;

        if ( msg.speech ) {
            msg.control = this.SPEAKING;
        }
        // Process block
        // manages transitions if necessary
        if (this.BehaviourPlanner) {
            this.BehaviourPlanner.newBlock(msg);
        }
        // add blocks to stacks
        this.BehaviourManager.newBlock(msg, this.time);
     }

    if (fromWS)
        msg.fromWS = fromWS;

    // Client id -> should be characterId?
    if (msg.clientId && !this.ws.id) {
        this.ws.id = msg.clientId;
        console.log("Client ID: ", msg.clientId);
        return;
    }

    // Load audio files
    if (msg.lg) {
        let hasToLoad = this.loadAudio(msg);
        if (hasToLoad) {
            this.pendingResources.push(msg);
            console.log("Needs to preload audio files.");
            return;
        }
    }

    if (!msg) {
        console.error("An undefined msg has been received.", msg);
        return;
    }

    // Update to remove aborted blocks
    if (!this.BehaviourManager)
        return;

    this.BehaviourManager.update(this.processBML.bind(this), this.time);

    if (!msg) {
        console.error("An undefined block has been created due to the update of BMLManager.", msg);
        return;
    }
}

// Process message
CharacterController.prototype.processBML = function (key, bml) {

    if ( ( !this.facialController && key != "gesture" ) || ( !this.bodyController && key == "gesture" ) )
        return;

    let thatFacial = this.facialController;

    switch (key) {
        case "blink":
            thatFacial.newBlink(bml);
            break;
        case "gaze":
            thatFacial.newGaze(bml, !!bml.shift); // !!shift make it bool (just in case)
            break;
        case "gazeShift":
            thatFacial.newGaze(bml, true);
            break;
        case "head":
            thatFacial.newHeadBML(bml);
            break;
        case "headDirectionShift":
            thatFacial.headDirectionShift(bml);
            break;
        case "face":
            thatFacial.newFA(bml, !!bml.shift); // !!shift make it bool (just in case)
            break;
        case "faceLexeme":
            thatFacial.newFA(bml, !!bml.shift); // !!shift make it bool (just in case)
            break;
        case "faceFACS":
            thatFacial.newFA(bml, false);
            break;
        case "faceEmotion":
            thatFacial.newFA(bml, !!bml.shift); // !!shift make it bool (just in case)
            break;
        case "faceVA":
            thatFacial.newFA(bml, !!bml.shift); // !!shift make it bool (just in case)
            break;
        case "faceShift":
            thatFacial.newFA(bml, true);
            break;
        case "speech":
            if (bml.phT)
                bml.phT = new Float32Array(Object.values(bml.phT));
            thatFacial.newTextToLip(bml);
            break;
        case "gesture":
            this.bodyController.newGesture( bml );
            break;
        case "animation":
            // TODO
            break;
        case "lg":
            thatFacial.newLipsync( bml );
            break;
    }
}

// Preloads audios to avoid loading time when added to BML stacks
CharacterController.prototype.loadAudio = function (block) {
    let output = false;
    if (block.lg.constructor === Array) {
        for (let i = 0; i < block.lg.length; i++) {
        if (!block.lg[i].audio) {
            block.lg[i].audio = new Audio();
            block.lg[i].audio.src = block.lg[i].url;
            output = true;
        }
        }
    }
    else {
        if (!block.lg.audio) {
            block.lg.audio = new Audio();
            block.lg.audio.src = block.lg.url;
            output = true;
        }
    }

    return output;
}
//@FacialController


function FacialController(config = null) {
    
    // define some properties
    this.headNode = "mixamorig_Head";
    this.neckNode = "mixamorig_Neck";
    this.lookAt = "target";
    this.lookAtEyes = "eyesTarget";
    this.lookAtHead = "headTarget";
    this.lookAtNeck = "neckTarget";

    this._gazePositions = {
        "RIGHT": new THREE.Vector3(-30, 2, 100), "LEFT": new THREE.Vector3(30, 2, 100),
        "UP": new THREE.Vector3(0, 20, 100), "DOWN": new THREE.Vector3(0, -20, 100),
        "UPRIGHT": new THREE.Vector3(-30, 20, 100), "UPLEFT": new THREE.Vector3(30, 20, 100),
        "DOWNRIGHT": new THREE.Vector3(-30, -20, 100), "DOWNLEFT": new THREE.Vector3(30, -20, 100),
        "FRONT": new THREE.Vector3(0, 2, 100), "CAMERA": new THREE.Vector3(0, 2, 100)
    };

    this.squintBSName = "Squint";
    this.eyelidsBSName = "Blink";
    this.smileBSName = "Smile";
    this.sadBSName = "Sad";
    this.kissBSName = "MouthWhistle";
    this.lipsPressedBSName = "Jaw_Up";
    this.lowerLipINBSName = "LowerLipIn";
    this.lowerLipDownBSName = "LowerLipDown";
    this.mouthNarrowBSName = "MouthNarrow";
    this.mouthOpenBSName = "MouthOpen";
    this.tongueBSName = "Tongue";

    this.browsDownBSName = "BrowsDown";
    this.browsInnerUpBSName = "BrowsIn";
    this.browsUpBSName = "BrowsUp";

    this._morphDeformers = {};
    this.lipsyncModule = new Lipsync();

    // if we have the state passed, then we restore the state
    if (config)
        this.configure(config);
}


FacialController.prototype.configure = function (o) {

    if (o.character)
        this.character = o.character;
    if (o.headNode)
        this.headNode = o.headNode;
    if (o.lookAt)
        this.lookAt = o.lookAt;
    if (o.lookAtEyes)
        this.lookAtEyes = o.lookAtEyes;
    if (o.lookAtHead)
        this.lookAtHead = o.lookAtHead;
    if (o.lookAtNeck)
        this.lookAtNeck = o.lookAtNeck;
    if (o.gazePositions)
        this._gazePositions = o.gazePositions;
    if (o.morphTargets)
        this._morphDeformers = o.morphTargets;

}

FacialController.prototype.start = function (morphTargets) {
   
    if (!morphTargets) {
        // Get morph targets
        morphTargets = {
            Body: this.character.getObjectByName("BodyMesh") || this.character.getObjectByName("Body"),
            Eyelashes: this.character.getObjectByName("Eyelashes")
        }
    }

    this._facialBSAcc = {};
    this._facialBSFinal = {};

    this._morphDeformers = { "Body": morphTargets.Body, "Eyelashes": morphTargets.Eyelashes };
    this._facialBS = {};
    this._eyeLidsBS = [];
    this._squintBS = [];

    if (morphTargets) {
        for (let part in this._morphDeformers) {

            let eyelidsIdx = [];
            let squintIdx = [];
            this._facialBS[part] = this._morphDeformers[part].morphTargetInfluences.slice(); // clone array
            this._facialBSAcc[part] = this._morphDeformers[part].morphTargetInfluences.slice(); // clone array;
            this._facialBSFinal[part] = this._morphDeformers[part].morphTargetInfluences.slice(); // clone array;

            let BSnames = Object.keys(this._morphDeformers[part].morphTargetDictionary);

            for (let i = 0; i < BSnames.length; ++i) {
                let name = BSnames[i].replaceAll("mesh_morph_", "");

                // Eyelashes things
                if (name.toLocaleLowerCase().includes(this.eyelidsBSName.toLocaleLowerCase())) // get blendshape indices of eyelids
                    eyelidsIdx.push(this._morphDeformers[part].morphTargetDictionary[name]);

                if (name.toLocaleLowerCase().includes(this.squintBSName.toLocaleLowerCase())) // get blendshape indices of squint
                    squintIdx.push(this._morphDeformers[part].morphTargetDictionary[name]);

            }
            this._eyeLidsBS.push(eyelidsIdx);
            this._squintBS.push(squintIdx);

        }
    }

    if (!this._morphDeformers) {
        console.error("Morph deformer not found");
        return;
    }

    this.resetFace();

    this._FacialLexemes = [];
    this.FA = new FacialEmotion(this._facialBS);

    // Gaze
    // Get head bone node
    if (!this.headNode)
        console.error("Head bone node not found with id: ");
    else if (!this._gazePositions["HEAD"]) {
        let headNode = this.character.getObjectByName(this.headNode)
        this._gazePositions["HEAD"] = headNode.getWorldPosition(new THREE.Vector3());
    }

    // Get lookAt nodes  
    let lookAtEyesNode = this.character.eyesTarget;
    let lookAtNeckNode = this.character.neckTarget;
    let lookAtHeadNode = this.character.headTarget;

    if (!this.lookAtEyes)
        console.error("LookAt Eyes not found");
    else if (!this._gazePositions["EYESTARGET"])
        this._gazePositions["EYESTARGET"] = lookAtEyesNode.getWorldPosition(new THREE.Vector3());

    if (!this.lookAtHead)
        console.error("LookAt Head not found");
    else if (!this._gazePositions["HEADTARGET"])
        this._gazePositions["HEADTARGET"] = lookAtHeadNode.getWorldPosition(new THREE.Vector3());

    if (!this.lookAtNeck)
        console.error("LookAt Neck not found");
    else if (!this._gazePositions["NECKTARGET"])
        this._gazePositions["NECKTARGET"] = lookAtNeckNode.getWorldPosition(new THREE.Vector3());

    // Gaze manager
    this.gazeManager = new GazeManager(lookAtNeckNode, lookAtHeadNode, lookAtEyesNode, this._gazePositions);

    this.headBML = []; //null;

    this.autoBlink = new Blink();
}

FacialController.prototype.reset = function ( keepEmotion = false ) {

    this.resetFace(); // blendshapes to 0

    if (this.textToLip) { this.textToLip.cleanQueueSentences(); }
    if (this.lipsyncModule) { this.lipsyncModule.stop(); }

    this._FacialLexemes.length = 0;
    if ( !keepEmotion ){ this.FA.reset(); } 

    this.gazeManager.reset();
    this.headBML.length = 0;
}

FacialController.prototype.resetFace = function () {
    
    for (let part in this._facialBS) {
        for (let i = 0; i < this._facialBS[part].length; i++) {
            this._facialBS[part][i] = 0;
            this._facialBSAcc[part][i] = 0;
            this._facialBSFinal[part][i] = 0;
            this._morphDeformers[part].morphTargetInfluences[i] = 0;
        }
    }
}

//example of one method called for ever update event
FacialController.prototype.update = function (dt) {

    // Update facial expression
    this.faceUpdate(dt);

    let lookAtEyes = this.character.eyesTarget.getWorldPosition(new THREE.Vector3());
    let lookAtHead = this.character.headTarget.getWorldPosition(new THREE.Vector3());
    let lookAtNeck = this.character.headTarget.getWorldPosition(new THREE.Vector3());
    
    this.character.getObjectByName("mixamorig_Neck").lookAt(lookAtNeck);
    this.character.getObjectByName("mixamorig_Head").lookAt(lookAtHead);
    
    // HEAD (nod, shake, tilt, tiltleft, tiltright, forward, backward)
    let headQuat = this.character.getObjectByName("mixamorig_Head").quaternion; // Not a copy, but a reference
    let neckQuat = this.character.getObjectByName("mixamorig_Neck").quaternion; // Not a copy, but a reference
    for( let i = 0; i< this.headBML.length; ++i){
        let head = this.headBML[i];
        if( !head.transition ){
            this.headBML.splice(i,1);
            --i;
            continue;
        }
        head.update(dt);
        if(head.lexeme == "FORWARD" || head.lexeme == "BACKWARD") {
            neckQuat.multiply( head.currentStrokeQuat );
            headQuat.multiply( head.currentStrokeQuat.invert() );
            head.currentStrokeQuat.invert(); // inverting quats is cheap
        } 
        else
            headQuat.multiply( head.currentStrokeQuat );
    }
    
    this.character.getObjectByName("mixamorig_LeftEye").lookAt(lookAtEyes);
    this.character.getObjectByName("mixamorig_RightEye").lookAt(lookAtEyes);
    
}

// Update facial expressions
FacialController.prototype.faceUpdate = function (dt) {
    
    let keys = Object.keys(this._facialBSAcc);
    // for each part (body, eyelashes), reset accumulators for biased average
    for (let i = 0; i < keys.length; ++i) {
        this._facialBSAcc[keys[i]].fill(0);
        this._facialBSFinal[keys[i]].fill(0);
    }

    // Text to lip
    if (this.textToLip && this.textToLip.getCompactState() == 0) { // when getCompactState==0 lipsync is working, not paused and has sentences to process
        this.textToLip.update(dt);
        let t2lBSW = this.textToLip.getBSW(); // reference, not a copy
        for (let i = 0; i < this.textToLipBSMapping.length; i++) {
            let mapping = this.textToLipBSMapping[i];
            let value = Math.min(1, Math.max(-1, t2lBSW[mapping[1]] * mapping[2]));
            let index = mapping[0];
            // for this model, some blendshapes need to be negative
            this._facialBSAcc["Body"][index] += Math.abs(value); // denominator of biased average
            this._facialBSFinal["Body"][index] += value * Math.abs(value); // numerator of biased average
        }
    }

    // lipsync
    if (this.lipsyncModule && this.lipsyncModule.working) // audio to lip
    {
        this.lipsyncModule.update(dt);
        let facialLexemes = this.lipsyncModule.BSW;
        if (facialLexemes) {

            let smooth = 0.66;
            let BSAcc = this._facialBSAcc["Body"];
            let BSFin = this._facialBSFinal["Body"];
            let BS = this._morphDeformers["Body"].morphTargetInfluences; // for smoothing purposes
            let morphDict = this._morphDeformers["Body"].morphTargetDictionary;
            // search every morphTarget to find the proper ones
            let names = Object.keys(morphDict);
            for (let i = 0; i < names.length; i++) {

                let name = names[i];
                let bsIdx = morphDict[name];
                let value = 0;
                if (name.includes(this.mouthOpenBSName))
                    value = (1 - smooth) * BS[bsIdx] + smooth * facialLexemes[2];

                if (name.includes(this.lowerLipINBSName))
                    value = (1 - smooth) * BS[bsIdx] + smooth * facialLexemes[1];

                if (name.includes(this.lowerLipDownBSName))
                    value = (1 - smooth) * BS[bsIdx] + smooth * facialLexemes[1];

                if (name.includes(this.mouthNarrowBSName))
                    value = (1 - smooth) * BS[bsIdx] + smooth * facialLexemes[0] * 0.5;

                if (name.includes(this.lipsPressedBSName))
                    value = (1 - smooth) * BS[bsIdx] + smooth * facialLexemes[1];

                BSAcc[bsIdx] += Math.abs(value); // denominator of biased average
                BSFin[bsIdx] += value * Math.abs(value); // numerator of biased average

            }
        }
    }

    //FacialEmotion ValAro/Emotions
    this.FA.updateVABSW(dt);

    for (let j = 0; j < this.FA.currentVABSW.length; j++) {
        let value = this.FA.currentVABSW[j];
        this._facialBSAcc["Body"][j] += Math.abs(value); // denominator of biased average
        this._facialBSFinal["Body"][j] += value * Math.abs(value); // numerator of biased average
    }

    // FacialExpr lexemes
    for (let k = 0; k < this._FacialLexemes.length; k++) {
        let lexeme = this._FacialLexemes[k];
        if (lexeme.transition) {
            lexeme.updateLexemesBSW(dt);
            // accumulate blendshape values
            for (let i = 0; i < lexeme.indicesLex.length; i++) {
                for (let j = 0; j < lexeme.indicesLex[i].length; j++) {
                    let value = lexeme.currentLexBSW[i][j];
                    let index = lexeme.indicesLex[i][j];
                    this._facialBSAcc["Body"][index] += Math.abs(value); // denominator of biased average
                    this._facialBSFinal["Body"][index] += value * Math.abs(value); // numerator of biased average
                }
            }
        }

        // remove lexeme if finished
        if (!lexeme.transition) {
            this._FacialLexemes.splice(k, 1);
            --k;
        }
    }

    // Gaze
    if (this.gazeManager){
        let weights = this.gazeManager.update(dt);

        // eyelids update
        for(let i = 0; i< this._eyeLidsBS[0].length; i++){         
            this._facialBSAcc[ "Body" ][ this._eyeLidsBS[0][i] ] += Math.abs(weights.eyelids);
            this._facialBSFinal[ "Body" ][ this._eyeLidsBS[0][i] ] += weights.eyelids * Math.abs(weights.eyelids);
        }
        // squint update
        for(let i = 0; i< this._squintBS[0].length; i++){         
            this._facialBSAcc[ "Body" ][ this._squintBS[0][i] ] += Math.abs(weights.squint);
            this._facialBSFinal[ "Body" ][ this._squintBS[0][i] ] += weights.squint * Math.abs(weights.squint);
        }
    }


    // Second pass, compute mean (division)
    // result = ( val1 * |val1|/|sumVals| ) + ( val2 * |val2|/|sumVals| ) + ...
    // copy blendshape arrays back to real arrays and compute biased average  
    let target = this._facialBS["Body"];
    let numerator = this._facialBSFinal["Body"];
    let acc = this._facialBSAcc["Body"];
    for (let i = 0; i < target.length; ++i) {
        if (acc[i] < 0.0001) { target[i] = 0; }
        else { target[i] = numerator[i] / acc[i]; }
    }

    // --- UPDATE POST BIASED AVERAGE --- 
    // this._facialBS has all the valid values

    // Eye blink
    if (!this.autoBlink.between) {
        this.autoBlink.update(dt, this._facialBS["Body"][this._eyeLidsBS[0][0]], this._facialBS["Body"][this._eyeLidsBS[0][1]]);
        this._facialBS["Body"][this._eyeLidsBS[0][0]] = this.autoBlink.weights[0];
        this._facialBS["Body"][this._eyeLidsBS[0][1]] = this.autoBlink.weights[1];
    }

    // fix eyelashes after all facial is done
    for (let i = 0; i < this._eyeLidsBS[0].length; i++) {
        this._facialBS["Eyelashes"][this._eyeLidsBS[1][i]] = this._facialBS["Body"][this._eyeLidsBS[0][i]];
    }
    for (let i = 0; i < this._squintBS[0].length; i++) {
        this._facialBS["Eyelashes"][this._squintBS[1][i]] = this._facialBS["Body"][this._squintBS[0][i]];
    }

    // "Render" final facial (body && eyelashes) blendshapes
    // copy blendshape arrays back to real arrays 
    for (let part in this._morphDeformers) {
        let target = this._morphDeformers[part].morphTargetInfluences;
        let source = this._facialBS[part];
        for (let i = 0; i < target.length; ++i) {
            target[i] = source[i];
        }
    }
}


// ----------------------- TEXT TO LIP --------------------
// Create a Text to Lip mouthing
FacialController.prototype.newTextToLip = function (bml) {
    
    if (!this.textToLip) { // setup

        this.textToLip = new Text2LipInterface();
        this.textToLip.start(); // keep started but idle
        this.textToLipBSMapping = []; // array of [ MeshBSIndex, T2Lindex, factor ]

        let BS = Object.keys(this._morphDeformers["Body"].morphTargetDictionary);
        let t2lBSWMap = T2LTABLES.BlendshapeMapping;

        // determine which blendshapes exist and map them to text2lip output
        for(let i = 0; i<BS.length; i++) {
            if(BS[i].includes("Midmouth_Left"))         this.textToLipBSMapping.push([ i, t2lBSWMap.kiss, 0.4 ]);
            if(BS[i].includes("Midmouth_Right"))        this.textToLipBSMapping.push([ i, t2lBSWMap.kiss, 0.4 ]);
            if(BS[i].includes("MouthNarrow_Left"))      this.textToLipBSMapping.push([ i, t2lBSWMap.kiss, 1.0 ]);
            if(BS[i].includes("MouthNarrow_Right"))     this.textToLipBSMapping.push([ i, t2lBSWMap.kiss, 1.0 ]);
            
            if (BS[i].includes("MouthDown"))            this.textToLipBSMapping.push([i, t2lBSWMap.upperLipClosed, 0.4]);
            if (BS[i].includes("UpperLipOut"))          this.textToLipBSMapping.push([i, t2lBSWMap.upperLipClosed, -1.5]);
            if (BS[i].includes("UpperLipUp_Left"))      this.textToLipBSMapping.push([i, t2lBSWMap.upperLipClosed, -0.3]);
            if (BS[i].includes("UpperLipUp_Right"))     this.textToLipBSMapping.push([i, t2lBSWMap.upperLipClosed, -0.3]);

            if (BS[i].includes("LowerLipDown_Left"))    this.textToLipBSMapping.push([i, t2lBSWMap.lowerLipClosed, -0.8]);
            if (BS[i].includes("LowerLipDown_Right"))   this.textToLipBSMapping.push([i, t2lBSWMap.lowerLipClosed, -0.8]);
            if (BS[i].includes("LowerLipIn"))           this.textToLipBSMapping.push([i, t2lBSWMap.lowerLipClosed, 1.0]);

            if (BS[i].includes("MouthOpen"))            this.textToLipBSMapping.push([i, t2lBSWMap.jawOpen, 1.0]);

            if (BS[i].includes("TongueBackUp"))         this.textToLipBSMapping.push([i, t2lBSWMap.tongueBackUp, 1.0]);
            if (BS[i].includes("TongueUp"))             this.textToLipBSMapping.push([i, t2lBSWMap.tongueFrontUp, 1.0]);
            if (BS[i].includes("TongueOut"))            this.textToLipBSMapping.push([i, t2lBSWMap.tongueOut, 1.0]);
        }
    }

    let text = bml.text;
    if ( text[ text.length - 1 ] != "." ){ text += "."; } 
    this.textToLip.cleanQueueSentences();
    this.textToLip.pushSentence(bml.text, bml); // use info object as options container also  
}


// --------------------- lipsync --------------------------------
// Create a Text to Lip mouthing
FacialController.prototype.newLipsync = function (bml) {
    
    if (!this.lipsyncModule)
        return;

    if (bml.audio)
        this.lipsyncModule.loadBlob(bml.audio);
    else if (bml.url)
        this.lipsyncModule.loadSample(bml.url);
}


// --------------------- FACIAL EXPRESSIONS ---------------------
// BML
// <face or faceShift start attackPeak relax* end* valaro
// <faceLexeme start attackPeak relax* end* lexeme amount
// <faceFacs not implemented>
// lexeme  [OBLIQUE_BROWS, RAISE_BROWS,
//      RAISE_LEFT_BROW, RAISE_RIGHT_BROW,LOWER_BROWS, LOWER_LEFT_BROW,
//      LOWER_RIGHT_BROW, LOWER_MOUTH_CORNERS,
//      LOWER_LEFT_MOUTH_CORNER,
//      LOWER_RIGHT_MOUTH_CORNER,
//      RAISE_MOUTH_CORNERS,
//      RAISE_RIGHT_MOUTH_CORNER,
//      RAISE_LEFT_MOUTH_CORNER, OPEN_MOUTH,
//      OPEN_LIPS, WIDEN_EYES, CLOSE_EYES]
//
// face/faceShift can contain several sons of type faceLexeme without sync attr
// valaro Range [-1, 1]

// Declare new facial expression
FacialController.prototype.newFA = function (faceData, shift) {
    
    // Use BSW of the agent
    for (let morph in this._facialBS) {
        for (let i = 0; i < this._facialBS[morph].length; i++) {
            this._facialBS[morph][i] = this._morphDeformers[morph].morphTargetInfluences[i];
        }
    }
    if (faceData.emotion || faceData.valaro) {
        this.FA.initFaceValAro(faceData, shift, this._facialBS); // new FacialExpr (faceData, shift, this._facialBS);
    }
    else if (faceData.lexeme) {
        this._FacialLexemes.push(new FacialExpr(faceData, shift, this._facialBS));
    }

}

// --------------------- BLINK ---------------------
FacialController.prototype.newBlink = function ( bml ){
    this.autoBlink.blink();
}

// --------------------- GAZE ---------------------
// BML
// <gaze or gazeShift start ready* relax* end influence target influence offsetAngle offsetDirection>
// influence [EYES, HEAD, NECK, SHOULDER, WAIST, WHOLE, ...]
// offsetAngle relative to target
// offsetDirection (of offsetAngle) [RIGHT, LEFT, UP, DOWN, UPRIGHT, UPLEFT, DOWNLEFT, DOWNRIGHT]
// target [CAMERA, RIGHT, LEFT, UP, DOWN, UPRIGHT, UPLEFT, DOWNLEFT, DOWNRIGHT]

// "HEAD" position is added on Start

FacialController.prototype.newGaze = function (gazeData, shift, gazePositions = null) {

    // TODO: recicle gaze in gazeManager
    let keys = Object.keys(this._facialBS);
    let blinkW = this._facialBS[keys[0]][0]
    let eyelidsW = this._facialBS[keys[0]][this._eyeLidsBS[0][0]]
    let squintW = this._facialBS[keys[0]][this._squintBS[0][0]]
    gazeData.eyelidsWeight = eyelidsW;
    gazeData.squintWeight = squintW;
    gazeData.blinkWeight = blinkW;

    this.gazeManager.newGaze(gazeData, shift, gazePositions, !!gazeData.headOnly);

}

// BML
// <headDirectionShift start end target>
// Uses gazeBML
FacialController.prototype.headDirectionShift = function (headData, cmdId) {
    
    headData.end = headData.end || 2.0;
    headData.influence = "HEAD";
    this.newGaze(headData, true, null, true);
}

// --------------------- HEAD ---------------------
// BML
// <head start ready strokeStart stroke strokeEnd relax end lexeme repetition amount>
// lexeme [NOD, SHAKE, TILT, TILTLEFT, TILTRIGHT, FORWARD, BACKWARD]
// repetition cancels stroke attr
// amount how intense is the head nod? 0 to 1
// New head behavior
FacialController.prototype.newHeadBML = function (headData) {
    
    let node = headData.lexeme == "FORWARD" || headData.lexeme == "BACKWARD" ? this.neckNode : this.headNode;
    let bone = this.character.getObjectByName(node);
    if (bone) {
        this.headBML.push(new HeadBML(headData, bone, bone.quaternion.clone()));
    }
}





// characterConfig is modified by bodyController
class BodyController{
    
    constructor( character, characterConfig ){
        this.character = character;

        // get skeleton
        let skeleton = this.skeleton = null;
        character.traverse( o => {
            if ( o.isSkinnedMesh ) {
                skeleton = this.skeleton = o.skeleton;
            }
        } );

        this.computeConfig( characterConfig );

        // -------------- All modules --------------
        this.right = this._createArm( false );
        this.left = this._createArm( true );
        this.handConstellation = new HandConstellation( this.config.boneMap, this.skeleton, this.config.handLocationsR, this.config.handLocationsL );
        this.bodyMovement = new BodyMovement( this.config, this.skeleton );

        this.dominant = this.right;
        this.nonDominant = this.left;

        this._tempQ_0 = new THREE.Quaternion();
        this._tempV3_0 = new THREE.Vector3();

    }

    computeConfig( jsonConfig ){
        // reference, not a copy. All changes also affect the incoming characterConfig
        this.config = jsonConfig.bodyController; 


        /** BoneMap */
        // name to index map. If model changes, only this map (and ik) names need to be changed
        for ( let p in this.config.boneMap ){
            this.config.boneMap[ p ] = findIndexOfBone( this.skeleton, this.config.boneMap[ p ] );            
        }

        /** Main Avatar Axes */
        if ( this.config.axes ){ 
            for( let i = 0; i < this.config.axes.length; ++i ){ // probably axes are a simple js object {x:0,y:0,z:0}. Convert it to threejs
                this.config.axes[i] = new THREE.Vector3(  this.config.axes[i].x, this.config.axes[i].y, this.config.axes[i].z ); 
            }
        } else{ 
            // compute axes in MESH coordinates using the the Bind pose ( TPose mandatory )
            // MESH coordinates: the same in which the actual vertices are located, without any rigging or any matrix applied
            this.config.axes = [ new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3() ]; // x,y,z
            let boneMap = this.config.boneMap;
            this.skeleton.bones[ boneMap.Hips ].updateWorldMatrix( true, true ); // parents and children also
    
            let a = (new THREE.Vector3()).setFromMatrixPosition( this.skeleton.boneInverses[ boneMap.LShoulder ].clone().invert() );
            let b = (new THREE.Vector3()).setFromMatrixPosition( this.skeleton.boneInverses[ boneMap.RShoulder ].clone().invert() );
            this.config.axes[0].subVectors( a, b ).normalize(); // x
    
            a = a.setFromMatrixPosition( this.skeleton.boneInverses[ boneMap.BelowStomach ].clone().invert() );
            b = b.setFromMatrixPosition( this.skeleton.boneInverses[ boneMap.Hips ].clone().invert() );
            this.config.axes[1].subVectors( a, b ).normalize(); // y
            
            this.config.axes[2].crossVectors( this.config.axes[0], this.config.axes[1] ).normalize(); // z = cross( x, y )
            this.config.axes[1].crossVectors( this.config.axes[2], this.config.axes[0] ).normalize(); // y = cross( z, x )
        }

        /** Body and Hand Locations */
        // create location point objects and attach them to bones
        function locationToObjects( table, skeleton, symmetry = false ){
            let result = {};
            for( let name in table ){
                let l = table[ name ];
                
                let idx = findIndexOfBone( skeleton, symmetry ? l[0].replace( "Right", "Left" ) : l[0] );
                if ( idx < 0 ){ continue; }
                
                let o = new THREE.Object3D();
                // let o = new THREE.Mesh( new THREE.SphereGeometry(0.3,16,16), new THREE.MeshStandardMaterial( { color: Math.random()*0xffffff }) );
                o.position.copy( l[1] ).applyMatrix4( skeleton.boneInverses[ idx ] ); // from mesh space to bone local space
                
                // check direction of distance vector 
                if ( l[2] ){
                    let m3 = new THREE.Matrix3();
                    m3.setFromMatrix4( skeleton.boneInverses[ idx ] );
                    o.direction = (new THREE.Vector3()).copy( l[2] ).applyMatrix3( m3 );
                }
                // o.position.copy( l[1] );
                // if ( symmetry ){ o.position.x *= -1; }
                o.name = name;
                skeleton.bones[ idx ].add( o );
                result[ name ] = o;
            }
            return result;   
        }
        this.config.bodyLocations = locationToObjects( this.config.bodyLocations, this.skeleton, false );
        this.config.handLocationsL = locationToObjects( this.config.handLocationsL ? this.config.handLocationsL : this.config.handLocationsR, this.skeleton, this.config.handLocationsL ? false : true ); // assume symmetric mesh/skeleton
        this.config.handLocationsR = locationToObjects( this.config.handLocationsR, this.skeleton, false ); // since this.config is being overwrite, generate left before right

        // finger axes do no need any change

    }
    _createArm( isLeftHand = false ){
        return {
            loc: new LocationBodyArm( this.config, this.skeleton, isLeftHand ),
            locMotions: [],
            extfidirPalmor: new ExtfidirPalmor( this.config, this.skeleton, isLeftHand ),
            wristMotion: new WristMotion( this.config, this.skeleton, isLeftHand ),
            handshape: new HandShapeRealizer( this.config, this.skeleton, isLeftHand ),
            fingerplay: new FingerPlay(),
            shoulderRaise: new ShoulderRaise( this.config, this.skeleton, isLeftHand ),
            shoulderHunch: new ShoulderHunch( this.config, this.skeleton, isLeftHand ),

            needsUpdate: false,
            ikSolver: new GeometricArmIK( this.skeleton, this.config, isLeftHand ),
            locUpdatePoint: new THREE.Vector3(0,0,0),
            _tempWristQuat: new THREE.Quaternion(0,0,0,1), // stores computed extfidir + palmor before any arm movement applied. Necessary for locBody + handConstellation

        };
    }

    _resetArm( arm ){
        arm.loc.reset();
        arm.locMotions = [];
        arm.wristMotion.reset();
        arm.handshape.reset();
        arm.fingerplay.reset();
        arm.shoulderRaise.reset();
        arm.shoulderHunch.reset();
        arm.locUpdatePoint.set(0,0,0);
        arm.needsUpdate = false;

        arm.extfidirPalmor.reset();

    }
    
    reset(){

        this.handConstellation.reset();
        this._resetArm( this.right );
        this._resetArm( this.left );

        this.newGesture( { type: "gesture", start: 0, end: 0.1, locationBodyArm: "neutral", hand: "right", distance: 0.065, displace: "r", displaceDistance: 0.025, shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, locationBodyArm: "neutral", hand: "left",  distance: 0.04, displace: "l", displaceDistance: 0.025, shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, handshape: "flat", thumbshape: "touch", hand: "both", shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, palmor: "l", hand: "right", shift: true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, palmor: "r", hand: "left", shift: true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, extfidir: "dl", hand: "right", mode: "local", shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, extfidir: "dr", hand: "left", mode: "local", shift:true } );

    }

    setDominantHand( isRightHandDominant ){
        if( isRightHandDominant ){ this.dominant = this.right; this.nonDominant = this.left; }
        else{ this.dominant = this.left; this.nonDominant = this.right; }
    }

    _updateLocationMotions( dt, arm ){
        let computeFlag = false;

        let motions = arm.locMotions;
        let resultOffset = arm.locUpdatePoint;
        resultOffset.set(0,0,0);

        // check if any motion is active and update it
        for ( let i = 0; i < motions.length; ++i ){
            if ( motions[i].transition ){
                computeFlag = true;
                resultOffset.add( motions[i].update( dt ) );
            }else{
                motions.splice(i, 1); // removed motion that has already ended
                i--;
            }
        }
        return computeFlag; 
    }

    _updateArm( dt, arm ){
        let bones = this.skeleton.bones;

        // reset shoulder, arm, elbow. This way location body, motion and location hand can be safely computed
        bones[ arm.loc.idx ].quaternion.set(0,0,0,1);
        bones[ arm.loc.idx + 1 ].quaternion.set(0,0,0,1);
        bones[ arm.loc.idx + 2 ].quaternion.set(0,0,0,1);

        // overwrite finger rotations
        arm.fingerplay.update(dt); // motion, prepare offsets
        arm.handshape.update( dt, arm.fingerplay.curBends );
      
        // wrist point and twist
        arm.extfidirPalmor.update(dt);

        // wristmotion. ADD rotation to wrist
        arm.wristMotion.update(dt); // wrist - add rotation

        // backup the current wrist quaternion, before any arm rotation is applied
        arm._tempWristQuat.copy( arm.extfidirPalmor.wristBone.quaternion );

        // update arm posture world positions but do not commit results to the bones, yet.
        arm.loc.update( dt );
        let motionsRequireUpdated = this._updateLocationMotions( dt, arm );
        
        arm.shoulderRaise.update( dt );
        arm.shoulderHunch.update( dt );

        arm.needsUpdate = motionsRequireUpdated | arm.fingerplay.transition | arm.handshape.transition | arm.wristMotion.transition | arm.extfidirPalmor.transition | arm.loc.transition | arm.shoulderRaise.transition | arm.shoulderHunch.transition;
    }

    update( dt ){
        if ( !this.bodyMovement.transition && !this.right.needsUpdate && !this.left.needsUpdate && !this.handConstellation.transition ){ return; }
        
        this.bodyMovement.update( dt );

        this._updateArm( dt, this.right );
        this._updateArm( dt, this.left );
        
        if ( this.handConstellation.transition ){ 
            // 2 iks, one for body positioning and a second for hand constellation + motion
            // if only points in hand were used in handConstellation, the first ik could be removed. But forearm-elbow-upperarm locations require 2 iks

            // compute locBody and fix wrist quaternion (forearm twist correction should not be required. Disable it and do less computations)
            // using loc.cur.p, without the loc.cur.offset. Compute handConstellation with raw locBody
            this.right.ikSolver.reachTarget( this.right.loc.cur.p, this.right.loc.cur.e, this.right.shoulderRaise.curAngle, this.right.shoulderHunch.curAngle, false ); //ik without aesthetics. Aesthetics might modify 
            this.left.ikSolver.reachTarget( this.left.loc.cur.p, this.left.loc.cur.e, this.left.shoulderRaise.curAngle, this.left.shoulderHunch.curAngle, false );
            this._fixWristForearmQuaternions( this.right, true );
            this._fixWristForearmQuaternions( this.left, true );

            // handconstellation update, add motions and ik
            this.handConstellation.update( dt );
            this.right.locUpdatePoint.add( this.handConstellation.curOffsetR ); // HandConstellation + motions
            this.left.locUpdatePoint.add( this.handConstellation.curOffsetL ); // HandConstellation + motions
        }

        // if only location body and motions. Do only 1 ik per arm
        this.right.locUpdatePoint.add( this.right.loc.cur.p );
        this.right.locUpdatePoint.add( this.right.loc.cur.offset );
        this.right.ikSolver.reachTarget( this.right.locUpdatePoint, this.right.loc.cur.e, this.right.shoulderRaise.curAngle, this.right.shoulderHunch.curAngle, true ); // ik + aesthetics

        this.left.locUpdatePoint.add( this.left.loc.cur.p );
        this.left.locUpdatePoint.add( this.left.loc.cur.offset );
        this.left.ikSolver.reachTarget( this.left.locUpdatePoint, this.left.loc.cur.e, this.left.shoulderRaise.curAngle, this.left.shoulderHunch.curAngle, true ); // ik + aesthetics
    
        this._fixWristForearmQuaternions( this.right, false );   
        this._fixWristForearmQuaternions( this.left, false );  
        
    }

    _fixWristForearmQuaternions( arm, fixWristOnly = false ){
        let q = this._tempQ_0;
        let bones = this.skeleton.bones;

        // copy back the original wrist quaternion, when no arm rotations were applied
        arm.extfidirPalmor.wristBone.quaternion.copy( arm._tempWristQuat );  

        // wrist did not know about arm quaternions. Compensate them
        q.copy( bones[ arm.loc.idx ].quaternion );
        q.multiply( bones[ arm.loc.idx + 1 ].quaternion );
        q.multiply( bones[ arm.loc.idx + 2 ].quaternion );
        q.invert();
        arm.extfidirPalmor.wristBone.quaternion.premultiply( q );  
        
        if ( fixWristOnly ){ return } // whether to correct forearm twisting also
        
        // Doing the previous wrist fix introduces some extra twist correction. Forearm twist should adjust to palmor + twist correction. The following operations combine both
        // get wrist twist quaternion
        getTwistQuaternion( arm.extfidirPalmor.wristBone.quaternion, arm.extfidirPalmor.twistAxisWrist, q );

        // from wrist twist quaternion, compute twist angle and apply it to the forearm. Correct this extra quaternion for the wrist also
        let angle = Math.acos( q.w ) * 2;
        // angle = Math.max( 0, Math.min( Math.PI * 0.6, angle ) );
        angle = ( Math.sin( angle - Math.PI * 0.5 ) * 0.35 + 0.35 ) * angle; // limit angle to avoid overtwisting of elbow
        angle *= ( arm.extfidirPalmor.twistAxisForearm.x * q.x + arm.extfidirPalmor.twistAxisForearm.y * q.y + arm.extfidirPalmor.twistAxisForearm.z * q.z ) < 0 ? -1 : 1; // is the axis of rotation inverted ?
        q.setFromAxisAngle( arm.extfidirPalmor.twistAxisForearm, angle);
        arm.extfidirPalmor.forearmBone.quaternion.multiply( q ); // forearm
        arm.extfidirPalmor.wristBone.quaternion.premultiply( q.invert() ); // wrist did not know about this twist, undo it

    }

    _newGestureArm( bml, arm, symmetry = 0x00 ){
        if ( bml.locationBodyArm ){ // when location change, cut directed and circular motions
            arm.loc.newGestureBML( bml, symmetry, arm.locUpdatePoint );
            arm.locMotions = [];
            this.handConstellation.cancelArm( arm == this.right ? 'R' : 'L' );
        }
        if ( bml.motion ){
            let m = null;
            if ( bml.motion == "fingerplay"){ m = arm.fingerplay; }
            else if ( bml.motion == "wrist"){ m = arm.wristMotion; }
            else if ( bml.motion == "directed"){ m = new DirectedMotion(); arm.locMotions.push(m); }
            else if ( bml.motion == "circular"){ m = new CircularMotion(); arm.locMotions.push(m); }
            
            if( m ){ 
                m.newGestureBML( bml, symmetry );
            }
        }
        if ( bml.palmor || bml.extfidir ){
            arm.extfidirPalmor.newGestureBML( bml, symmetry );
        }
        if ( bml.handshape ){
            arm.handshape.newGestureBML( bml, symmetry );
        } 
        if ( bml.shoulderRaise ){
            arm.shoulderRaise.newGestureBML( bml, symmetry );
        }
        if ( bml.shoulderHunch ){
            arm.shoulderHunch.newGestureBML( bml, symmetry );
        }

        arm.needsUpdate = true;
    }

    /**
    * lrSym: (optional) bool - perform a symmetric movement. Symmetry will be applied to non-dominant hand only
    * udSym: (optional) bool - perform a symmetric movement. Symmetry will be applied to non-dominant hand only
    * ioSym: (optional) bool - perform a symmetric movement. Symmetry will be applied to non-dominant hand only
    * hand: (optional) "right", "left", "both". Default right
    * shift: (optional) bool - make this the default position. Motions not affected
    */
    newGesture( bml ){

        bml.start = bml.start || 0;
        bml.end = bml.end || bml.relax || bml.attackPeak || (bml.start + 1);
        bml.attackPeak = bml.attackPeak || ( ( bml.end - bml.start ) * 0.25 + bml.start );
        bml.relax = bml.relax || ( (bml.end - bml.attackPeak) * 0.5 + bml.attackPeak );

        // symmetry: bit0 = lr, bit1 = ud, bit2 = io
        let symmetryFlags = ( !!bml.lrSym );
        symmetryFlags |= ( ( !!bml.udSym ) << 1 );
        symmetryFlags |= ( ( !!bml.ioSym ) << 2 );

        if ( bml.config ){
            let c = bml.config;
            if ( c.dominant ){ this.setDominantHand( c.dominant == "right" ); }
            //...
        }

        if ( bml.handConstellation ){
            this.handConstellation.newGestureBML( bml, this.dominant == this.right ? 'R' : 'L' );
        }

        if ( bml.bodyMovement ){
            this.bodyMovement.newGestureBML( bml );
        }

        switch ( bml.hand ){
            case "right" :             
                this._newGestureArm( bml, this.right, ( this.dominant == this.right ) ? 0x00 : symmetryFlags ); 
                break;
            case "left" : 
                this._newGestureArm( bml, this.left, ( this.dominant == this.left ) ? 0x00 : symmetryFlags ); 
                break;
            case "both" : 
                this._newGestureArm( bml, this.dominant, 0x00 ); 
                this._newGestureArm( bml, this.nonDominant, symmetryFlags ); 
                break;
            case "nonDom" : 
                this._newGestureArm( bml, this.nonDominant, symmetryFlags ); 
                break;
            case "dom": 
            default:
                this._newGestureArm( bml, this.dominant, 0x00 ); 
                break;
        }

    }


}

export { CharacterController, FacialController, BodyController} 