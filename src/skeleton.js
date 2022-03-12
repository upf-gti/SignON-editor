import * as THREE from "./libs/three.module.js";
import * as MATH_UTILS from "./math.js";

var base_size = 1;

// Mediapipe landmark information (idx, name, prev landmark idx, x, y, z)
let LM_INFO = class LandmarksInfo {

    // The order is important! It's necessary later to keep track of previous quaternions
    static HIPS =                   new LandmarksInfo(33, "mixamorig_Hips",            -1,  0.0, 0.0, 0.0);
    static RIGHT_UP_LEG =           new LandmarksInfo(26, "mixamorig_RighUpLeg",        33,  base_size * 0.18, 0.0, 0.0 );
    static RIGHT_LEG =              new LandmarksInfo(28, "mixamorig_RightLeg",         26,  0.0, 0.0, base_size * 0.8 );
    static RIGHT_HEEL =             new LandmarksInfo(30, "mixamorig_RightFoot",        28,  0.0, 0.0, base_size * 0.8 );
    static RIGHT_FOOT_INDEX =       new LandmarksInfo(32, "mixamorig_RightToeBase",     30,  0.0, 0.0, base_size * 0.1 );
    static LEFT_UP_LEG =            new LandmarksInfo(25, "mixamorig_LeftUpLeg",        33, -base_size * 0.18, 0.0, 0.0 );
    static LEFT_LEG =               new LandmarksInfo(27, "mixamorig_LeftLeg",          25,  0.0, 0.0, base_size * 0.8 );
    static LEFT_HEEL =              new LandmarksInfo(29, "mixamorig_LeftFoot",         27,  0.0, 0.0, base_size * 0.8 );
    static LEFT_FOOT_INDEX =        new LandmarksInfo(31, "mixamorig_LeftToeBase",      29,  0.0, 0.0, base_size * 0.1 );

    static SPINE =                  new LandmarksInfo(35, "mixamorig_Spine",            33,  0.0, base_size * 0.18, 0.0 );
    static SPINE1 =                 new LandmarksInfo(36, "mixamorig_Spine1",           35,  0.0, 0.0, base_size * 0.18 );
    static SPINE2 =                 new LandmarksInfo(37, "mixamorig_Spine2",           36,  0.0, 0.0, base_size * 0.18 );
    static NECK =                   new LandmarksInfo(38, "mixamorig_Neck",             37,  0.0, 0.0, base_size * 0.18 );
    // static HEAD =                   new LandmarksInfo(0,  "mixamorig:Head",             38,  0.0, 0.0, base_size * 0.18 );
    // static MOUTH_MIDDLE =       new LandmarksInfo(34, "mouth_middle",           35,  0.0, 0.0, base_size * 0.18 );

    // static NOSE =               new LandmarksInfo(0, "nose",                0);
    // static LEFT_EYE_INNER =     new LandmarksInfo(1, "left_eye_inner",      0);
    // static LEFT_EYE =           new LandmarksInfo(2, "left_eye",            0);
    // static LEFT_EYE_OUTER =     new LandmarksInfo(3, "left_eye_outer",      0);
    // static RIGHT_EYE_INNER =    new LandmarksInfo(4, "right_eye_inner",     0);
    // static RIGHT_EYE =          new LandmarksInfo(5, "right_eye",           0);
    // static RIGHT_EYE_OUTER =    new LandmarksInfo(6, "right_eye_outer",     0);
    // static LEFT_EAR =           new LandmarksInfo(7, "left_ear",            0);
    // static RIGHT_EAR =          new LandmarksInfo(8, "right_ear",           0);
    // static LEFT_MOUTH =         new LandmarksInfo(9, "left_mouth",          34);
    // static RIGHT_MOUTH =        new LandmarksInfo(10, "right_mouth",        34);
    static RIGHT_SHOULDER =         new LandmarksInfo(12, "mixamorig_RightShoulder",    37,  0.0, 0.0, base_size * 0.18 );
    static RIGHT_ARM =              new LandmarksInfo(14, "mixamorig_RightArm",         12,  0.0, 0.1, base_size * 0.25 );
    static RIGHT_FORE_ARM =         new LandmarksInfo(16, "mixamorig_RightForeArm",     14,  0.0, 0.0, base_size * 0.52 );
    static RIGHT_PINKY =            new LandmarksInfo(18, "mixamorig_RightHand",        16,  0.0, 0.0, base_size * 0.48 );
    static LEFT_SHOULDER =          new LandmarksInfo(11, "mixamorig_LeftShoulder",     37,  0.0, 0.0, base_size * 0.18 );
    static LEFT_ARM =               new LandmarksInfo(13, "mixamorig_LeftArm",          11,  0.0, 0.1, base_size * 0.25 );
    static LEFT_FORE_ARM =          new LandmarksInfo(15, "mixamorig_LeftForeArm",      13,  0.0, 0.0, base_size * 0.52 );
    static LEFT_PINKY =             new LandmarksInfo(17, "mixamorig_LeftHand",         15,  0.0, 0.0, base_size * 0.48 );
    // static LEFT_INDEX =         new LandmarksInfo(19, "left_index",         0);
    // static RIGHT_INDEX =        new LandmarksInfo(20, "right_index",        0);
    // static LEFT_THUMB =         new LandmarksInfo(21, "left_thumb",         0);
    // static RIGHT_THUMB =        new LandmarksInfo(22, "right_thumb",        0);


    constructor(idx, name, prev_idx, x, y, z) {
        this.idx = idx;
        this.name = name;
        this.prev_idx = prev_idx;
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

// Based on mixamo skeleton
function createThreeJsSkeleton() {

    const bones = [];

    // used to store bone by landmark index, necessary to create hierarchy
    const temp_map = {};

    var lmInfoArray = Object.keys(LM_INFO);

    for (const lm_data in lmInfoArray) {

        var lm_info = LM_INFO[lmInfoArray[lm_data]];

        var bone = new THREE.Bone();
        bone.name = lm_info.name;
        bone.position.x = lm_info.x;
        bone.position.y = lm_info.y;
        bone.position.z = lm_info.z;

        temp_map[lm_info.idx] = bone;
        
        if (lm_info.prev_idx != -1) {
            
            if (temp_map[lm_info.prev_idx] != undefined) {
                temp_map[lm_info.prev_idx].add(bone);
            }
        }

        bones.push( bone );
    }

    return new THREE.Skeleton( bones );
}

function midLandmark(landmark1, landmark2, factor) {
    return {
        'x' : (landmark1.x * (1.0 - factor) + landmark2.x * factor),
        'y' : (landmark1.y * (1.0 - factor) + landmark2.y * factor),
        'z' : (landmark1.z * (1.0 - factor) + landmark2.z * factor),
        'visibility' : (landmark1.visibility * (1.0 - factor) + landmark2.visibility * factor),
    }
}

// Inject new landmarks for spine
function injectNewLandmarks(landmarks) {

    for (let i = 0; i < landmarks.length; ++i) {

        // Insert hips - 33
        var pelvis_r = landmarks[i].PLM[23];
        var pelvis_l = landmarks[i].PLM[24];
        landmarks[i].PLM.push(midLandmark(pelvis_r, pelvis_l, 0.5));

        // Insert mouth_middle - 34
        var mouth_r = landmarks[i].PLM[9];
        var mouth_l = landmarks[i].PLM[10];
        var mouth_mid = midLandmark(mouth_r, mouth_l, 0.5);
        landmarks[i].PLM.push(mouth_mid);

        // spine2 landmark
        var shoulder_r = landmarks[i].PLM[11];
        var shoulder_l = landmarks[i].PLM[12];
        var spine2 =  midLandmark(shoulder_r, shoulder_l, 0.5);

        // Hips and neck landmarks
        var hips = landmarks[i].PLM[33];

        var spine1 = midLandmark(hips, spine2, 2.0 / 3.0);

        // Insert spine - 35
        landmarks[i].PLM.push(midLandmark(hips, spine1, 0.5));

        // Insert spine1 - 36
        landmarks[i].PLM.push(spine1);

        // Insert spine2 - 37
        landmarks[i].PLM.push(spine2);

        // Insert neck - 38
        landmarks[i].PLM.push(midLandmark(mouth_mid, spine2, 0.5));
    }
}

function createSkeleton(landmarks) {

    var skeleton = createThreeJsSkeleton();

    injectNewLandmarks(landmarks);

    return skeleton;
}

function createAnimation(name, landmarks) {

    const tracks = [];

    var lmInfoArray = Object.keys(LM_INFO);

    const previous_quats = [];

    for (const lm_data in lmInfoArray) {

        const pos_values = [];
        const quat_values = [];

        const times = [];
        var time_accum = 0.0;

        var lm_info = LM_INFO[lmInfoArray[lm_data]];

        // Initialize first rotation
        previous_quats[lm_info.idx] = [];

        for (let i = 0; i < landmarks.length; ++i) {

            if (lm_info.prev_idx == -1) {

                pos_values.push(landmarks[i].PLM[lm_info.idx].x);
                pos_values.push(landmarks[i].PLM[lm_info.idx].y);
                pos_values.push(landmarks[i].PLM[lm_info.idx].z);

                var quat = new THREE.Quaternion();
                //quat.setFromAxisAngle(new THREE.Vector3(-1, 0, 0), Math.PI / 2.0)

                previous_quats[lm_info.idx].push(quat);

                quat_values.push(quat.x);
                quat_values.push(quat.y);
                quat_values.push(quat.z);
                quat_values.push(quat.w);
            } else {

                // pos_values.push(lm_info.x);
                // pos_values.push(lm_info.y);
                // pos_values.push(lm_info.z);

                var quat_info = MATH_UTILS.calc_rotation( landmarks[i].PLM[lm_info.prev_idx], landmarks[i].PLM[lm_info.idx], previous_quats[lm_info.prev_idx][i])

                previous_quats[lm_info.idx].push(quat_info.rotation);

                quat_values.push(quat_info.rotation_diff.x);
                quat_values.push(quat_info.rotation_diff.y);
                quat_values.push(quat_info.rotation_diff.z);
                quat_values.push(quat_info.rotation_diff.w);
            }

            times.push(time_accum);
            time_accum += landmarks[i].dt / 1000.0;
        }
        
        if (times.length > 0) {

            if (pos_values.length > 0) {
                const positions = new THREE.VectorKeyframeTrack('.bones[' + lm_info.name + '].position', times, pos_values);
                tracks.push(positions);
            }

            if (quat_values.length > 0) {
                const rotations = new THREE.QuaternionKeyframeTrack('.bones[' + lm_info.name + '].quaternion', times, quat_values);
                tracks.push(rotations);
            }
        }
    }

    // use -1 to automatically calculate
    // the length from the array of tracks
    const length = -1;

    return new THREE.AnimationClip(name || "sign_anim", length, tracks);
}

export { createSkeleton, createAnimation };