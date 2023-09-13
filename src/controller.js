import * as THREE from 'three';
import {BehaviourManager} from './libs/BehaviourManager.js'
import {FacialExpr} from './libs/BehaviourRealizer.js'

class BMLController {

    constructor(editor, skinnedMeshes, morphTargetDictionary) {

        if(!editor)
        throw("No editor to attach Controller!");

        this.undoSteps = [];

        this.editor = editor;
        
        this.bmlManager = new BehaviourManager();
        // Update in first iteration
        this.mustUpdate = false; //true; 
        if(!editor.morphTargets)
            console.warn("No morph targets to attach Controller!");
        
        this.skinnedMeshes = skinnedMeshes;
        this.morphTargetDictionary = morphTargetDictionary;
        this.morphDictionary = editor.morphTargets;
        this.morphTargets = [];
        this.morphTargets.length = Object.keys(this.morphDictionary).length; 

    }

    begin(timeline) {
        
        this.bindEvents(timeline);
        
        // First update to get bones in place
        this.update(true, 0.0);

    }

    stop() {

    }

    bindEvents(timeline) {

        this.timeline = timeline || this.editor.activeTimeline;
        if(!timeline)
            return;

        let canvas = this.timeline.canvas;
        if(!canvas)
            canvas = this.editor.activeTimeline.canvas;

        canvas.onkeyup = (e) => {

            switch ( e.key ) {

                case 'z':
                    if(e.ctrlKey){

                        if(!this.undoSteps.length)
                            return;
                        
                        const step = this.undoSteps.pop();
                        for ( let i = 0; i < step.length; ++i){
                           //undo step
                        }
                        //update timeline
                        
                    }
                    break;
                case 'Delete':
                    this.timeline.deleteClip();
                    break;
            }

        };
    }

    update(state, dt) {

        //if(state) this.updateBlendShapes(dt);

    }

    updateBlendShapes( dt ) {
         // FacialExpr lexemes
         for (let k = 0; k < this.lexemes.length; k++) {
            let lexeme = this.lexemes[k];
            if (lexeme.transition) {
                lexeme.updateLexemesBSW(dt);
                // accumulate blendshape values
                for (let i = 0; i < lexeme.indicesLex.length; i++) {
                    for (let j = 0; j < lexeme.indicesLex[i].length; j++) {
                        let value = lexeme.currentLexBSW[i][j];
                        let index = lexeme.indicesLex[i][j];
                        this.morphTargets[index] += value; // denominator of biased average
                    }
                }
            }

            // remove lexeme if finished
            if (lexeme && !lexeme.transition) {
                this.lexemes.splice(k, 1);
                --k;
            }
        }
             
    }

    updateTracks(trackIdx) {

        let timeline = this.timeline || this.editor.activeTimeline;
        
        // if(timeline.onUpdateTracks( keyType ))
        // return; // Return if event handled

        // if(!timeline.clip_selected)
        // return;
        
        //convert each clip to BML json format
        let json = { faceLexeme: []};;

        for(let i = 0; i < timeline.animationClip.tracks.length; i++){
            let track = timeline.animationClip.tracks[i];
            for(let j = 0; j < track.clips.length; j++){
                let clip = track.clips[j];
                var data = ANIM.clipToJSON( clip );
                if(data)
                {
                    data[3].end = data[3].end || data[3].start + data[3].duration;
                    json.faceLexeme.push( data[3] );
                }
            }
        }    

        this.lexemes = [];
        //manage bml blocks sync
        this.bmlManager.newBlock(json, 0);
        let dt = 1.0/timeline.framerate;
        let times = [];
        let values = [];
        for(let time = 0; time < timeline.duration; time+= dt){
            this.morphTargets.fill(0);
            times.push(time);
            //update blendshapes weights based on lexemes
            this.updateBlendShapes(dt);
            let bs = [];
            this.morphTargets.map((x) => bs.push(x));
            values.push(bs);
            //update bml blocks sync
            this.bmlManager.update((type,faceData) => this.lexemes.push(new FacialExpr(faceData, false, this.morphTargets)), time);
        }
        let tracks = [];
        //convert blendshapes weights to animation clip
        for(let morph in this.morphDictionary){
            let i = this.morphDictionary[morph];
            let v = [];
            values.forEach(element => {
                v.push(element[i]);
            });

            for(let mesh of this.skinnedMeshes)
            {
                tracks.push(new THREE.NumberKeyframeTrack(mesh.name + '.morphTargetInfluences['+ morph +']', times, v));                
            }
        }
        this.editor.NMFclip = new THREE.AnimationClip("nmf", timeline.duration, tracks);
        console.log(this.editor.NMFclip )
        if(this.onUpdateTracks)
            this.onUpdateTracks();
        // let [name, trackIndex, keyFrameIndex] = timeline._lastKeyFramesSelected[0];
        // let track = timeline.getTrack(timeline._lastKeyFramesSelected[0]);

        // // Don't store info if we are using wrong mode for that track
        // if(keyType != track.type)
        // return;
       
       
       
       
        //     let start = track.dim * keyFrameIndex;
        //     let values = bone[ track.type ].toArray();
    
        //     if(!values)
        //         return;
    
        //     const idx = track.clip_idx;
        //     track.edited[ keyFrameIndex ] = true;

        //     // supports position and quaternion types
        //     for( let i = 0; i < values.length; ++i ) {
        //         this.editor.animationanimationClip.tracks[ idx ].values[ start + i ] = values[i];
        //     }

        //     // Update animation interpolants
        //     this.editor.updateAnimationAction( idx );
        //     timeline.onSetTime( timeline.current_time );

       

    }
    
    //on update values on gui inspector
    onGUI() {

        this.updateBlendShapes();
        this.updateTracks();
    }
    
};

export { BMLController };