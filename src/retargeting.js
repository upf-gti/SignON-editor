import * as THREE from "./libs/three.module.js";

let base_size = 1;

class AnimationRetargeting {
    constructor() {
        this.rskeleton = [];
        this.map_idx = [];
        this.map_names = {};
        // Mediapipe landmark information (idx, name, prev landmark idx, x, y, z)
        this.LM_INFO = class LandmarksInfo {

            // The order is important! It's necessary later to keep track of previous quaternions
            static HIPS =                   new LandmarksInfo(33, "mixamorigHips",             -1, ["RIGHT_UP_LEG", "LEFT_UP_LEG"], new THREE.Vector3(-0.000564472924452275,1.3796685934066772,-95.22978973388672));
            static RIGHT_UP_LEG =           new LandmarksInfo(24, "mixamorigRightUpLeg",       33, ["RIGHT_LEG"],                   new THREE.Vector3());
            static RIGHT_LEG =              new LandmarksInfo(26, "mixamorigRightLeg",         24, ["RIGHT_HEEL"],                  new THREE.Vector3());
            static RIGHT_HEEL =             new LandmarksInfo(28, "mixamorigRightFoot",        26, ["RIGHT_FOOT_INDEX"],            new THREE.Vector3());
            static RIGHT_FOOT_INDEX =       new LandmarksInfo(32, "mixamorigRightToeBase",     28, ["RIGHT_FOOT_INDEX_END"],        new THREE.Vector3());
            static RIGHT_FOOT_INDEX_END =   new LandmarksInfo(76, "mixamorigRightToe_End",     32, [],                              new THREE.Vector3());
            static LEFT_UP_LEG =            new LandmarksInfo(23, "mixamorigLeftUpLeg",        33, ["LEFT_LEG"],                    new THREE.Vector3());
            static LEFT_LEG =               new LandmarksInfo(25, "mixamorigLeftLeg",          23, ["LEFT_HEEL"],                   new THREE.Vector3());
            static LEFT_HEEL =              new LandmarksInfo(27, "mixamorigLeftFoot",         25, ["LEFT_FOOT_INDEX"],             new THREE.Vector3());
            static LEFT_FOOT_INDEX =        new LandmarksInfo(31, "mixamorigLeftToeBase",      27, ["LEFT_FOOT_INDEX_END"],         new THREE.Vector3());
            static LEFT_FOOT_INDEX_END =    new LandmarksInfo(75, "mixamorigLeftToe_End",      31, [],                              new THREE.Vector3());
            static SPINE =                  new LandmarksInfo(35, "mixamorigSpine",            33, ["SPINE1"],                      new THREE.Vector3());
            static SPINE1 =                 new LandmarksInfo(36, "mixamorigSpine1",           35, ["SPINE2"],                      new THREE.Vector3());
            static SPINE2 =                 new LandmarksInfo(37, "mixamorigSpine2",           36, ["NECK"],                        new THREE.Vector3());
            static NECK =                   new LandmarksInfo(38, "mixamorigNeck",             37, ["HEAD"],                        new THREE.Vector3());
            static HEAD =                   new LandmarksInfo(0,  "mixamorigHead",             38, [],                              new THREE.Vector3());
            // static MOUTH_MIDDLE =       new LandmarksInfo(34, "mouth_middle",           35,  0.0, 0.0, base_size * 0.18 );

            // static NOSE =               new LandmarksInfo(0, "nose",                0);
            // static LEFT_EYE_INNER =     new LandmarksInfo(1, "left_eye_inner",      0);
            //static LEFT_EYE =              new LandmarksInfo(2, "mixamorigLeftEye",            0,  -base_size * 0.18, 0.0, -base_size * 0.18);
            // static LEFT_EYE_OUTER =     new LandmarksInfo(3, "left_eye_outer",      0);
            // static RIGHT_EYE_INNER =    new LandmarksInfo(4, "right_eye_inner",     0);
            //static RIGHT_EYE =             new LandmarksInfo(5, "mixamorigRigthEye",           0,   base_size * 0.18, 0.0, -base_size * 0.18);
            // static RIGHT_EYE_OUTER =    new LandmarksInfo(6, "right_eye_outer",     0);
            // static LEFT_EAR =           new LandmarksInfo(7, "left_ear",            0);
            // static RIGHT_EAR =          new LandmarksInfo(8, "right_ear",           0);
            // static LEFT_MOUTH =         new LandmarksInfo(9, "left_mouth",          34);
            // static RIGHT_MOUTH =        new LandmarksInfo(10, "right_mouth",        34);
            static RIGHT_SHOULDER =        new LandmarksInfo(73, "mixamorigRightShoulder",     37, [], new THREE.Vector3());
            static RIGHT_ARM =             new LandmarksInfo(12, "mixamorigRightArm",          73, [], new THREE.Vector3());
            static RIGHT_FORE_ARM =        new LandmarksInfo(14, "mixamorigRightForeArm",      12, [], new THREE.Vector3());
            static RIGHT_HAND =            new LandmarksInfo(16, "mixamorigRightHand",         14, [], new THREE.Vector3());
            static LEFT_SHOULDER =         new LandmarksInfo(74, "mixamorigLeftShoulder",      37, [], new THREE.Vector3());
            static LEFT_ARM =              new LandmarksInfo(11, "mixamorigLeftArm",           74, [], new THREE.Vector3());
            static LEFT_FORE_ARM =         new LandmarksInfo(13, "mixamorigLeftForeArm",       11, [], new THREE.Vector3());
            static LEFT_HAND =             new LandmarksInfo(15, "mixamorigLeftHand",          13, [], new THREE.Vector3());
            static LEFT_INDEX1 =            new LandmarksInfo(39, "mixamorigLeftHandIndex1",   15, [], new THREE.Vector3());
            static LEFT_INDEX2 =            new LandmarksInfo(41, "mixamorigLeftHandIndex2",   39, [], new THREE.Vector3());
            static LEFT_INDEX3 =            new LandmarksInfo(43, "mixamorigLeftHandIndex3",   41, [], new THREE.Vector3());
            static LEFT_INDEX4 =            new LandmarksInfo(21, "mixamorigLeftHandIndex4",   43, [], new THREE.Vector3());
            static RIGHT_INDEX1 =           new LandmarksInfo(40, "mixamorigRightHandIndex1",  16, [], new THREE.Vector3());
            static RIGHT_INDEX2 =           new LandmarksInfo(42, "mixamorigRightHandIndex2",  40, [], new THREE.Vector3());
            static RIGHT_INDEX3 =           new LandmarksInfo(44, "mixamorigRightHandIndex3",  42, [], new THREE.Vector3());
            static RIGHT_INDEX4 =           new LandmarksInfo(22, "mixamorigRightHandIndex4",  44, [], new THREE.Vector3());
            static LEFT_THUMB1 =            new LandmarksInfo(45, "mixamorigLeftHandThumb1",   15, [], new THREE.Vector3());
            static LEFT_THUMB2 =            new LandmarksInfo(47, "mixamorigLeftHandThumb2",   45, [], new THREE.Vector3());
            static LEFT_THUMB3 =            new LandmarksInfo(49, "mixamorigLeftHandThumb3",   47, [], new THREE.Vector3());
            static LEFT_THUMB4 =            new LandmarksInfo(19, "mixamorigLeftHandThumb4",   49, [], new THREE.Vector3());
            static RIGHT_THUMB1 =           new LandmarksInfo(46, "mixamorigRightHandThumb1",  16, [], new THREE.Vector3());
            static RIGHT_THUMB2 =           new LandmarksInfo(48, "mixamorigRightHandThumb2",  46, [], new THREE.Vector3());
            static RIGHT_THUMB3 =           new LandmarksInfo(50, "mixamorigRightHandThumb3",  48, [], new THREE.Vector3());
            static RIGHT_THUMB4 =           new LandmarksInfo(20, "mixamorigRightHandThumb4",  50, [], new THREE.Vector3());
            static LEFT_MIDDLE1 =           new LandmarksInfo(51, "mixamorigLeftHandMiddle1",  15, [], new THREE.Vector3());
            static LEFT_MIDDLE2 =           new LandmarksInfo(53, "mixamorigLeftHandMiddle2",  51, [], new THREE.Vector3());
            static LEFT_MIDDLE3 =           new LandmarksInfo(55, "mixamorigLeftHandMiddle3",  53, [], new THREE.Vector3());
            static LEFT_MIDDLE4 =           new LandmarksInfo(57, "mixamorigLeftHandMiddle4",  55, [], new THREE.Vector3());
            static RIGHT_MIDDLE1 =          new LandmarksInfo(52, "mixamorigRightHandMiddle1", 16, [], new THREE.Vector3());
            static RIGHT_MIDDLE2 =          new LandmarksInfo(54, "mixamorigRightHandMiddle2", 52, [], new THREE.Vector3());
            static RIGHT_MIDDLE3 =          new LandmarksInfo(56, "mixamorigRightHandMiddle3", 54, [], new THREE.Vector3());
            static RIGHT_MIDDLE4 =          new LandmarksInfo(58, "mixamorigRightHandMiddle4", 56, [], new THREE.Vector3());
            static LEFT_RING1 =             new LandmarksInfo(59, "mixamorigLeftHandRing1",    15, [], new THREE.Vector3());
            static LEFT_RING2 =             new LandmarksInfo(61, "mixamorigLeftHandRing2",    59, [], new THREE.Vector3());
            static LEFT_RING3 =             new LandmarksInfo(63, "mixamorigLeftHandRing3",    61, [], new THREE.Vector3());
            static LEFT_RING4 =             new LandmarksInfo(65, "mixamorigLeftHandRing4",    63, [], new THREE.Vector3());
            static RIGHT_RING1 =            new LandmarksInfo(60, "mixamorigRightHandRing1",   16, [], new THREE.Vector3());
            static RIGHT_RING2 =            new LandmarksInfo(62, "mixamorigRightHandRing2",   60, [], new THREE.Vector3());
            static RIGHT_RING3 =            new LandmarksInfo(64, "mixamorigRightHandRing3",   62, [], new THREE.Vector3());
            static RIGHT_RING4 =            new LandmarksInfo(66, "mixamorigRightHandRing4",   64, [], new THREE.Vector3());
            static LEFT_PINKY1 =            new LandmarksInfo(67, "mixamorigLeftHandPinky1",   15, [], new THREE.Vector3());
            static LEFT_PINKY2 =            new LandmarksInfo(69, "mixamorigLeftHandPinky2",   67, [], new THREE.Vector3());
            static LEFT_PINKY3 =            new LandmarksInfo(71, "mixamorigLeftHandPinky3",   69, [], new THREE.Vector3());
            static LEFT_PINKY4 =            new LandmarksInfo(17, "mixamorigLeftHandPinky4",   71, [], new THREE.Vector3());
            static RIGHT_PINKY1 =           new LandmarksInfo(68, "mixamorigRightHandPinky1",  16, [], new THREE.Vector3());
            static RIGHT_PINKY2 =           new LandmarksInfo(70, "mixamorigRightHandPinky2",  68, [], new THREE.Vector3());
            static RIGHT_PINKY3 =           new LandmarksInfo(72, "mixamorigRightHandPinky3",  70, [], new THREE.Vector3());
            static RIGHT_PINKY4 =           new LandmarksInfo(16, "mixamorigRightHandPinky4",  72, [], new THREE.Vector3());
            static HEAD_TOP_END =           new LandmarksInfo(39, "mixamorigHeadTop_End",       0, [], new THREE.Vector3());

            constructor(idx, name, parent_idx, children_names, position) {
                this.idx = idx;
                this.name = name;
                this.parent_idx = parent_idx;
                this.children_names = children_names;
            }
        }
    }
}

AnimationRetargeting.prototype.createSkeletonFromJSON = function(filepath = "data/defaultSkeleton.json", callback){
    $.getJSON( filepath, function( data ) {
        let bones = [];
        for(let i = 0; i < data.length; i++){
            let object = data[i].object;
            if(object.type != "Bone") continue;
            let bone = new THREE.Bone();
            bone.name = object.name;
            bone.matrix.fromArray( object.matrix );
            bone.position.setFromMatrixPosition(bone.matrix);
            bone.quaternion.fromArray(bone.matrix.getRotation());
            bone.scale.fromArray(bone.matrix.getScale());
            bone.layers.mask = object.layers;
            if(object.parent!=null) bone.parent = bones[object.parent]
            bone.updateWorldMatrix();
            bones.push(bone);
        }
        let skeleton = new THREE.Skeleton( bones );
        if(callback) callback(skeleton);
    })
}

// Based on mixamo skeleton
AnimationRetargeting.prototype.createSkeleton = function() {

    const bones = [];

    // used to store bone by landmark index, necessary to create hierarchy
    const temp_map = {};

    let lmInfoArray = Object.keys(this.LM_INFO);

    for (const lm_data in lmInfoArray) {

        let lm_info = this.LM_INFO[lmInfoArray[lm_data]];

        let bone = new THREE.Bone();
        bone.name = lm_info.name;

        bone.position.x = lm_info.position.x;
        bone.position.y = lm_info.position.y;
        bone.position.z = lm_info.position.z;

        bone.quaternion.x = lm_info.rotation.x;
        bone.quaternion.y = lm_info.rotation.y;
        bone.quaternion.z = lm_info.rotation.z;
        bone.quaternion.w = lm_info.rotation.w;
        bone.matrixWorldNeedsUpdate = true
        temp_map[lm_info.idx] = bone;

        if (lm_info.parent_idx != -1) {

            if (temp_map[lm_info.parent_idx] != undefined) {
                temp_map[lm_info.parent_idx].add(bone);
            }
        }

        bones.push( bone );
    }

    return new THREE.Skeleton( bones );
}

AnimationRetargeting.prototype.updateSkeleton = function(skeleton) {

    let lmInfoArray = Object.keys(this.LM_INFO);  

    for (const lm_data in lmInfoArray) {

        let lm_info = this.LM_INFO[lmInfoArray[lm_data]];
        for(let i = 0; i<skeleton.length;i++){
            let name = skeleton[i].name.replaceAll(/[-_.:]/g,"").toUpperCase();
            this.LM_INFO[lmInfoArray[lm_data]].idx = -1;
            if(lm_info.name.replaceAll(/[-_.:]/g,"").toUpperCase() == name)
            {
                this.LM_INFO[lmInfoArray[lm_data]].name = skeleton[i].name;
                this.LM_INFO[lmInfoArray[lm_data]].position = skeleton[i].position.clone();
                this.LM_INFO[lmInfoArray[lm_data]].rotation = new THREE.Quaternion()//skeleton[i].quaternion.clone();
                this.LM_INFO[lmInfoArray[lm_data]].idx = i;
                this.rskeleton.push(this.LM_INFO[lmInfoArray[lm_data]]);
                break;
                /*temp_map[lm_info.idx] = bone;

                if (lm_info.parent_idx != -1) {

                    if (temp_map[lm_info.parent_idx] != undefined) {
                        temp_map[lm_info.parent_idx].add(bone);
                    }
                }

                bones.push( bone );*/
            }
        }


    }
}

AnimationRetargeting.prototype.automap = function(bones){
    
    for(let i = 0; i<bones.length;i++){
        let name = bones[i].name.replaceAll(/[-_.:]/g,"").toUpperCase();
        for (let s = 0; s<this.rskeleton.length; s++) {
            if(this.rskeleton[s].name.replaceAll(/[-_.:]/g,"").toUpperCase() == name)
            {
                this.rskeleton[s].map = i;
                this.map_idx.push({
                    "from_name" : this.rskeleton[s].name,
                    "from_idx": this.rskeleton[s].idx,
                    "to_name" : bones[i].name,
                    "to_idx" : i
                })
                this.map_names[this.rskeleton[s].name] = bones[i].name;
                break;
            }
        }

    }
}

AnimationRetargeting.prototype.renameAnimationBones = function(anim, bones)
{
    let new_anim = anim.clone();
    let tracks = [];
				
    for(let i = 0; i < new_anim.tracks.length; i++){
        let name = new_anim.tracks[i].name;
        
        name = name.replaceAll(".position", "").replaceAll('.quaternion', "").replaceAll(".scale", "");
        new_anim.tracks[i].name = new_anim.tracks[i].name.replaceAll(name, this.map_names[name]);
        if(name.includes(".quaternion"))
            tracks.push(new_anim.tracks[i])
    }
    new_anim.tracks = tracks;
    return new_anim;
}


AnimationRetargeting.prototype.getBindPose = function(skeleton, updateWorld = false) {
    let bones = [];
    let map = {};

    for(let i = 0; i<skeleton.bones.length; i++) {
        map[skeleton.bones[i].name] = i;
    }

    for(let i = 0; i<skeleton.bones.length; i++) {
        let bone = new THREE.Bone();
        bone.name = skeleton.bones[i].name;
        let parent = skeleton.bones[i].parent;
        bone.parent = (parent)? bones[map[parent.name]] : null;
        // If no parent bone, The inverse is enough
        let bindMatInverse = skeleton.boneInverses[i];
        let mat = new THREE.Matrix4();
        mat.fromArray(bindMatInverse);
        mat = bindMatInverse.clone();
        mat.elements = new Float32Array(mat.elements);
        mat.invert(); 	// Child Bone UN-Inverted

        // if parent exists, keep it parent inverted since thats how it exists in gltf
        // BUT invert the child bone then multiple to get local space matrix.
        // parent_worldspace_mat4_invert * child_worldspace_mat4 = child_localspace_mat4
        //  child_worldspace_mat4 = parent_worldspace_mat4 *child_localspace_mat4
        if (parent && !parent.name.toUpperCase().includes("ARMATURE")) { 
            let pBindMatInverse = skeleton.boneInverses[map[parent.name]];
            let pmat = new THREE.Matrix4();
            pmat.fromArray(pBindMatInverse); // Parent Bone Inverted
            pmat = pBindMatInverse.clone();
            pmat.elements = new Float32Array(pmat.elements);
            mat.multiplyMatrices(pmat,mat);	
        } 
        else if(parent && parent.name.toUpperCase().includes("ARMATURE"))
        {
            bone.parent = parent;
        }

        bone.matrix.copy(mat)

        //Assign local position
        let pos = new THREE.Vector3();
        pos.setFromMatrixPosition(mat);
        bone.position.copy(pos);
        bone.position.round2zero();
        //Assign local rotation
        let matAux = mat.clone();
        mat = new THREE.Matrix4();
        mat.copy(matAux);

        let rot = new THREE.Quaternion().fromArray(mat.getRotationNormalized(new Float32Array(4)));
        bone.quaternion.copy(rot.normalize());
        
        //Assign local scale
        let scale = new THREE.Vector3().fromArray(mat.getScale());
        bone.scale.copy(scale)//scale.multiplyScalar(0.5) );

        bone.updateMatrixWorld();
              
        bones.push( bone );
    }
    // Compute the model Local & World Transform Bind Pose
    // THREE will compute the inverse matrix bind pose on its own when bones are given to THREE.Skeleton

    let b, p;
    for( b of bones ) {
        //------------------------------------------
        // Compute its world space transform based on parent's ws transform.
        b.world = {
            pos : new THREE.Vector3(),
            rot : new THREE.Quaternion(),
            scl : new THREE.Vector3()
        }
       if( b.parent != null && !b.parent.name.toUpperCase().includes("ARMATURE")){
            p = bones[ map[b.parent.name] ];
            
            //------------------------------------------
            // POSITION - parent.position + ( parent.rotation * ( parent.scale * child.position ) )
            let v = new THREE.Vector3();
            v.multiplyVectors( p.world.scl, b.position ); // parent.scale * child.position;
			v.applyQuaternion( p.world.rot ); //Vec3.transform_quat( v, tp.rot, v );
			b.world.pos.addVectors( p.world.pos, v ); // Vec3.add( tp.pos, v, this.pos );

			//------------------------------------------
			// SCALE - parent.scale * child.scale
			b.world.scl.multiplyVectors( p.world.scl, b.scale );

			//------------------------------------------
			// ROTATION - parent.rotation * child.rotation
			//this.rot.from_mul( tp.rot, tc.rot );
            b.world.rot.multiplyQuaternions(p.world.rot, b.quaternion)

           /* b.world.pos.addVectors(p.wolrd.pos, b.position);
            b.world.rot.addQuaternions(p.wolrd.pos, b.position);
            b.world.scl.addVectors(p.wolrd.pos, b.position);
            b.world.from_add( p.world, b.local );*/
        } else if (b.parent) {
            b.world.pos.copy(b.parent.position)  ;
            b.world.scl.copy(b.parent.scale)  ;
            b.world.rot.copy(b.quaternion)  ;
        } else {
            b.world.pos.copy(b.position)  ;
            b.world.scl.copy(b.scale)  ;
            b.world.rot.copy(b.quaternion)  ;
        }
     
    }
    if(updateWorld){
        for( b of bones ){
           
            b.updateMatrix();
            b.updateWorldMatrix();
            b.getWorldPosition(b.world.pos); 
            b.getWorldQuaternion(b.world.rot); 
        }
    }
    return bones;
}

//Transform source and target bones rotations into world space
AnimationRetargeting.prototype.retargetAnimation = function(src_tbones, tgt_tbones, src, tgt, onlyY) {

    for (let i = 0; i < this.map_idx.length; i++) {
        let s_idx = this.map_idx[i].from_idx;
        let t_idx = this.map_idx[i].to_idx;
        
        //Bind pose
        let src_bind = src_tbones.bones ? src_tbones.bones[s_idx] : src_tbones[s_idx];
        let tgt_bind = tgt_tbones.bones ? tgt_tbones.bones[t_idx] : tgt_tbones[t_idx];
        //Pose
        let src_pose = src.bones ? src.bones[s_idx] :src[s_idx];
        let tgt_pose = tgt.bones ? tgt.bones[t_idx] :tgt[t_idx];

        let src_bind_world = new THREE.Quaternion();
        //src_bind.getWorldQuaternion(src_bind_world); //World space bone rot
        src_bind_world = src_bind.world.rot; //World space bone rot

        let tgt_bind_world = new THREE.Quaternion();
        //tgt_bind.getWorldQuaternion(tgt_bind_world); //World space bone rot
        tgt_bind_world = tgt_bind.world.rot;

        let src_parent_bind_rot = new THREE.Quaternion();
        if(!src_bind.parent)
            src_parent_bind_rot.copy(src_bind_world);
        else if(src_bind.parent.name == "" || src_bind.parent.name.toUpperCase().includes("ARMATURE"))
            src_parent_bind_rot = src_bind.parent.quaternion.clone();
        else
            src_parent_bind_rot = src_bind.parent.world.rot.clone(); //src_bind.parent.getWorldQuaternion(src_parent_bind_rot); //World space parent bone rot

        let tgt_parent_bind_rot = new THREE.Quaternion();
        if(!tgt_bind.parent)
            tgt_parent_bind_rot.copy(tgt_bind_world);
        if(tgt_bind.parent.name == "" || tgt_bind.parent.name.toUpperCase().includes("ARMATURE"))
            tgt_parent_bind_rot = tgt_parent_bind_rot//tgt_bind.parent.quaternion.clone();
        else
            tgt_parent_bind_rot = tgt_bind.parent.world.rot.clone(); //tgt_bind.parent.getWorldQuaternion(tgt_parent_bind_rot); //World space parent bone rot

        //Model space difference between tposes
        let convert = src_bind_world.clone();
        convert.invert().multiply(tgt_bind_world);

        //Isolate each bone change in Model space tpose
        //Using Tpose model space of the parent, but local rotation of the bone
        let diff = new THREE.Quaternion();
        diff.multiplyQuaternions( src_parent_bind_rot, src_pose.quaternion); //diff between bind pose and animated pose

        //shift the src bone rotation into the target's bone using the tpose difference
        //orientation stuff
        if(diff.dot(src_bind_world) < 0)
        {
            convert.x *= -1;
            convert.y *= -1;
            convert.z *= -1;
            convert.w *= -1;
        }
        let tgt_bind_inv = tgt_parent_bind_rot.clone();
        diff.multiply(convert).premultiply(tgt_bind_inv.invert());
        //diff.multiply(convert).premultiply(tgt_bind_inv.invert());
        tgt_pose.quaternion.copy(diff);
        //tgt_pose.updateMatrix()
        if(tgt_pose.name.includes("Hips")) {
            let src_bind_world_pos = new THREE.Vector3();
            src_bind.getWorldPosition(src_bind_world_pos);//World space bone pos

            let src_pose_world_pos = new THREE.Vector3();
            src_pose.getWorldPosition(src_pose_world_pos);//World space bone pos

            /*let tgt_bind_world_pos = new THREE.Vector3();
            tgt_bind.getWorldPosition(tgt_bind_world_pos);//World space bone pos*/
            let tgt_bind_world_pos = tgt_bind.world.pos.clone();

            let tgt_pose_world_pos = new THREE.Vector3();
            tgt_pose.getWorldPosition(tgt_pose_world_pos);//World space bone pos 
            //let tgt_pose_world_pos = tgt_pose.world.pos.clone()

            let a = src_bind_world_pos.clone().round2zero();
            let b = tgt_bind_world_pos.clone().round2zero();
            b.x = (Math.abs(a.x)<= 1e-4) ? 0 : b.x/a.x;
            b.y = (Math.abs(a.y)<= 1e-4) ? 0 : b.y/a.y;
            b.z = (Math.abs(a.z)<= 1e-4) ? 0 : b.z/a.z;

            let pos = new THREE.Vector3();
            pos.subVectors(src_pose_world_pos, src_bind_world_pos);
            //pos.multiply(b);
            pos.add(tgt_bind_world_pos);
            
            if(onlyY)//// Only Move Up and Down --> Can be a flag (parameter)
            {
                pos.x = tgt_bind_world_pos.x;
                pos.z = tgt_bind_world_pos.z;
            }
            tgt_pose.position.set(pos.x, pos.y, pos.z);
        }
    }
}

class PlayAnimation {
    constructor(animation, map = null) {
        this.time = 0;
        this.tracks = null;
        this.times = null;
        this.animation = animation;
    }
}

PlayAnimation.prototype.animateSkeleton = function(skeleton, dt)
{
    this.time+=dt;
    if(this.time>this.animation.duration) 
        this.time = 0;
    //Find frames
    for(let i = 0; i < this.animation.tracks.length; i++){
        let track = this.animation.tracks[i];
        let info = track.name.split(".");
        let name = info[0];
        let type = info[1];
        for(let s = 0; s < skeleton.length; s++){
            if(skeleton[s].name != name) continue;
            switch(type){
                case "position":
                    let pos = new THREE.Vector3().fromArray(track.createInterpolant().evaluate(this.time));
                    skeleton[s].position.copy(pos);
                    break;
                case "quaternion":
                    let quat = new THREE.Quaternion().fromArray(track.createInterpolant().evaluate(this.time));
                    skeleton[s].quaternion.copy(quat);
                    break;
            }
            skeleton[s].updateWorldMatrix();
        }        
    }
    //Interpolate
    return skeleton;
}
// ------------------------------------------ THREE MATH functions ------------------------------------------//

//When values are very small, like less then 0.000001, just make it zero.
THREE.Vector3.round2zero = THREE.Vector3.prototype.round2zero = function( out=null ){
    out = out || this;
    if(Math.abs(out.x) <= 1e-4) out.x = 0;
    if(Math.abs(out.y) <= 1e-4) out.y = 0;
    if(Math.abs(out.z) <= 1e-4) out.z = 0;
    return out;
}

THREE.Vector3.exports = THREE.Vector3;

// Returns a quaternion representing the rotational component of a transformation matrix. If a matrix is built with
// fromRotationTranslation, the returned quaternion will be the same as the quaternion originally supplied
THREE.Matrix4.getRotation = THREE.Matrix4.prototype.getRotation = function ( out=null ){
    // Algorithm taken from http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/index.htm
    let trace	= this.elements[0] + this.elements[5] + this.elements[10],
        S		= 0;

    out = out || [0,0,0,1];
    if(trace > 0){
        S = Math.sqrt(trace + 1.0) * 2;
        out[3] = 0.25 * S;
        out[0] = (this.elements[6] - this.elements[9]) / S;
        out[1] = (this.elements[8] - this.elements[2]) / S; 
        out[2] = (this.elements[1] - this.elements[4]) / S; 
    }else if( (this.elements[0] > this.elements[5]) & (this.elements[0] > this.elements[10]) ){ 
        S = Math.sqrt(1.0 + this.elements[0] - this.elements[5] - this.elements[10]) * 2;
        out[3] = (this.elements[6] - this.elements[9]) / S;
        out[0] = 0.25 * S;
        out[1] = (this.elements[1] + this.elements[4]) / S; 
        out[2] = (this.elements[8] + this.elements[2]) / S; 
    }else if(this.elements[5] > this.elements[10]){ 
        S = Math.sqrt(1.0 + this.elements[5] - this.elements[0] - this.elements[10]) * 2;
        out[3] = (this.elements[8] - this.elements[2]) / S;
        out[0] = (this.elements[1] + this.elements[4]) / S; 
        out[1] = 0.25 * S;
        out[2] = (this.elements[6] + this.elements[9]) / S; 
    }else{ 
        S = Math.sqrt(1.0 + this.elements[10] - this.elements[0] - this.elements[5]) * 2;
        out[3] = (this.elements[1] - this.elements[4]) / S;
        out[0] = (this.elements[8] + this.elements[2]) / S;
        out[1] = (this.elements[6] + this.elements[9]) / S;
        out[2] = 0.25 * S;
    }
    return out;
}

THREE.Matrix4.getRotationNormalized = THREE.Matrix4.prototype.getRotationNormalized = function( out=null ){
    let rotation = this.getRotation(out);
    let len =  rotation[0]**2 + rotation[1]**2 + rotation[2]**2 + rotation[3]**2;
    if(len > 0){
        len = 1 / Math.sqrt( len );
        rotation[0] = rotation[0] * len;
        rotation[1] = rotation[1] * len;
        rotation[2] = rotation[2] * len;
        rotation[3] = rotation[3] * len;
    }
    return rotation;
}

THREE.Matrix4.getScale = THREE.Matrix4.prototype.getScale = function( out=null ){
    out = out || [0,0,0];
    let m11 = this.elements[0],
        m12 = this.elements[1],
        m13 = this.elements[2],
        m21 = this.elements[4],
        m22 = this.elements[5],
        m23 = this.elements[6],
        m31 = this.elements[8],
        m32 = this.elements[9],
        m33 = this.elements[10];
    out[0] = Math.sqrt(m11 * m11 + m12 * m12 + m13 * m13);
    out[1] = Math.sqrt(m21 * m21 + m22 * m22 + m23 * m23);
    out[2] = Math.sqrt(m31 * m31 + m32 * m32 + m33 * m33);
    return out;
}

THREE.Matrix4.scale = THREE.Matrix4.prototype.scale = function(x,y,z){
    this.elements[1] *= x;
    this.elements[2] *= x;
    this.elements[3] *= x;
    this.elements[4] *= y;
    this.elements[5] *= y;
    this.elements[6] *= y;
    this.elements[7] *= y;
    this.elements[8] *= z;
    this.elements[9] *= z;
    this.elements[10] *= z;
    this.elements[11] *= z;
}

THREE.Matrix4.exports = THREE.Matrix4;


export { THREE, AnimationRetargeting, PlayAnimation }