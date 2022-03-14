import * as THREE from "./libs/three.module.js";
import * as MATH_UTILS from "./math.js";

var base_size = 1;

// Mediapipe landmark information (idx, name, prev landmark idx, x, y, z)
let LM_INFO = class LandmarksInfo {

    // The order is important! It's necessary later to keep track of previous quaternions
    static HIPS =                   new LandmarksInfo(33, "mixamorigHips",            -1,   0.0, 0.0, 0.0);                              //-1,  0.0, 0.0, 0.0);                                 
    static RIGHT_UP_LEG =           new LandmarksInfo(24, "mixamorigRightUpLeg",       33,  base_size * 0.18, -base_size * 0.1, 0.0 );   // 33,  base_size * 0.1, -base_size * 0.1, 0.0 );    
    static RIGHT_LEG =              new LandmarksInfo(26, "mixamorigRightLeg",         24,  0.0, -base_size * 0.5, 0.0 ); // 24,  base_size * 0.18, -base_size * 0.18, 0.0 );
    static RIGHT_HEEL =             new LandmarksInfo(28, "mixamorigRightFoot",        26,  0.0, -base_size * 0.8, 0.0 ); /// 26,  0.0, -base_size * 0.18, base_size * 0.8 ); 
    static RIGHT_FOOT_INDEX =       new LandmarksInfo(32, "mixamorigRightToeBase",     28,  0.0, -base_size * 0.18, -base_size * 0.1 ); /// 28,  0.0, -base_size * 0.18, base_size * 0.1 ); 
    static RIGHT_FOOT_INDEX_END =   new LandmarksInfo(76, "mixamorigRightToeEnd",      32,  0.0, -base_size * 0.18, -base_size * 0.1 );
    static LEFT_UP_LEG =            new LandmarksInfo(23, "mixamorigLeftUpLeg",        33,  -base_size * 0.18, -base_size * 0.1, 0.0 ); //// 33, -base_size * 0.1, -base_size * 0.1, 0.0 ); 
    static LEFT_LEG =               new LandmarksInfo(25, "mixamorigLeftLeg",          23,  0, -base_size * 0.5, 0.0 ); // 23, -base_size * 0.18, -base_size * 0.18, 0.0 );
    static LEFT_HEEL =              new LandmarksInfo(27, "mixamorigLeftFoot",         25,  0.0, -base_size * 0.8, 0.0); //// 25,  0.0, -base_size * 0.18, base_size * 0.8); 
    static LEFT_FOOT_INDEX =        new LandmarksInfo(31, "mixamorigLeftToeBase",      27,  0.0, -base_size * 0.18, -base_size * 0.1 ); /// 27,  0.0, -base_size * 0.18, base_size * 0.1 ); 
    static LEFT_FOOT_INDEX_END =    new LandmarksInfo(75, "mixamorigLeftToeEnd",       31,  0.0, -base_size * 0.18, -base_size * 0.1 );
    static SPINE =                  new LandmarksInfo(35, "mixamorigSpine",            33,  0.0, base_size * 0.18, 0.0 ); //            // 33,  0.0, base_size * 0.18, 0.0 ); //              
    static SPINE1 =                 new LandmarksInfo(36, "mixamorigSpine1",           35,  0.0, base_size * 0.18, 0.0 ); //            // 35,  0.0, 0.0, base_size * 0.18 ); //             
    static SPINE2 =                 new LandmarksInfo(37, "mixamorigSpine2",           36,  0.0, base_size * 0.18, 0.0 ); //            // 36,  0.0, 0.0, base_size * 0.18 ); //             
    static NECK =                   new LandmarksInfo(38, "mixamorigNeck",             37,  0.0, base_size * 0.18, 0.0 ); //            // 37,  0.0, 0.0, base_size * 0.18 ); //                 
    static HEAD =                   new LandmarksInfo(0,  "mixamorigHead",             38,  0.0, base_size * 0.18, 0.0 ); //            // 38,  0.0, 0.0, base_size * 0.18 ); //                     
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
    static RIGHT_SHOULDER =        new LandmarksInfo(73, "mixamorigRightShoulder",    37,  base_size * 0.1, base_size * 0.1, 0.0 );
    static RIGHT_ARM =             new LandmarksInfo(12, "mixamorigRightArm",         73,  base_size * 0.18, -base_size * 0.1, -base_size * 0.05 );
    static RIGHT_FORE_ARM =        new LandmarksInfo(14, "mixamorigRightForeArm",     12,  0.0, -base_size * 0.4, 0.0 );
    static RIGHT_HAND =            new LandmarksInfo(16, "mixamorigRightHand",        14,  0.0, -base_size * 0.4, 0.0 );
    static LEFT_SHOULDER =         new LandmarksInfo(74, "mixamorigLeftShoulder",     37,  -base_size * 0.1, base_size * 0.1, 0.0 );
    static LEFT_ARM =              new LandmarksInfo(11, "mixamorigLeftArm",          74,  -base_size * 0.18, -base_size * 0.1, -base_size * 0.05 );
    static LEFT_FORE_ARM =         new LandmarksInfo(13, "mixamorigLeftForeArm",      11,  0.0, -base_size * 0.4, 0.0 );
    static LEFT_HAND =             new LandmarksInfo(15, "mixamorigLeftHand",         13,  0.0, -base_size * 0.4, 0.0 );
    static LEFT_INDEX1 =            new LandmarksInfo(39, "mixamorigLeftHandIndex1",   15, 0.0, -base_size * 0.05, -base_size * 0.1);
    static LEFT_INDEX2 =            new LandmarksInfo(41, "mixamorigLeftHandIndex2",   39, 0.0, -base_size * 0.05, -base_size * 0.1);
    static LEFT_INDEX3 =            new LandmarksInfo(43, "mixamorigLeftHandIndex3",   41, 0.0, -base_size * 0.05, 0.0);
    static LEFT_INDEX4 =            new LandmarksInfo(21, "mixamorigLeftHandIndex4",   43, 0.0, -base_size * 0.05, 0.0);
    static RIGHT_INDEX1 =           new LandmarksInfo(40, "mixamorigRightHandIndex1",  16, 0.0, -base_size * 0.05, -base_size * 0.1);
    static RIGHT_INDEX2 =           new LandmarksInfo(42, "mixamorigRightHandIndex2",  40, 0.0, -base_size * 0.05, -base_size * 0.1);
    static RIGHT_INDEX3 =           new LandmarksInfo(44, "mixamorigRightHandIndex3",  42, 0.0, -base_size * 0.05, 0.0);
    static RIGHT_INDEX4 =           new LandmarksInfo(22, "mixamorigRightHandIndex2",  44, 0.0, -base_size * 0.05, 0.0);
    static LEFT_THUMB1 =            new LandmarksInfo(45, "mixamorigLeftHandThumb1",   15, 0.0, -base_size * 0.1, -0.05);
    static LEFT_THUMB2 =            new LandmarksInfo(47, "mixamorigLeftHandThumb2",   45, 0.0, -base_size * 0.05, 0.0);
    static LEFT_THUMB3 =            new LandmarksInfo(49, "mixamorigLeftHandThumb3",   47, 0.0, -base_size * 0.05, 0.0);
    static LEFT_THUMB4 =            new LandmarksInfo(19, "mixamorigLeftHandThumb4",   49, 0.0, -base_size * 0.05, 0.0);
    static RIGHT_THUMB1 =           new LandmarksInfo(46, "mixamorigRightHandThumb1",  16, 0.0, -base_size * 0.1, -0.05);
    static RIGHT_THUMB2 =           new LandmarksInfo(48, "mixamorigRightHandThumb2",  46, 0.0, -base_size * 0.05, 0.0);
    static RIGHT_THUMB3 =           new LandmarksInfo(50, "mixamorigRightHandThumb3",  48, 0.0, -base_size * 0.05, 0.0);
    static RIGHT_THUMB4 =           new LandmarksInfo(20, "mixamorigRightHandThumb4",  50, 0.0, -base_size * 0.05, 0.0);
    static LEFT_MIDDLE1 =           new LandmarksInfo(51, "mixamorigLeftHandMiddle1",  15, 0.0, -base_size * 0.1, 0.0);
    static LEFT_MIDDLE2 =           new LandmarksInfo(53, "mixamorigLeftHandMiddle2",  51, 0.0, -base_size * 0.05, 0.0);
    static LEFT_MIDDLE3 =           new LandmarksInfo(55, "mixamorigLeftHandMiddle3",  53, 0.0, -base_size * 0.05, 0.0);
    static LEFT_MIDDLE4 =           new LandmarksInfo(57, "mixamorigLeftHandMiddle4",  55, 0.0, -base_size * 0.05, 0.0);
    static RIGHT_MIDDLE1 =          new LandmarksInfo(52, "mixamorigRightHandMiddle1", 16, 0.0, -base_size * 0.1, 0.0);
    static RIGHT_MIDDLE2 =          new LandmarksInfo(54, "mixamorigRightHandMiddle2", 52, 0.0, -base_size * 0.05, 0.0);
    static RIGHT_MIDDLE3 =          new LandmarksInfo(56, "mixamorigRightHandMiddle3", 54, 0.0, -base_size * 0.05, 0.0);
    static RIGHT_MIDDLE4 =          new LandmarksInfo(58, "mixamorigRightHandMiddle4", 56, 0.0, -base_size * 0.05, 0.0);
    static LEFT_RING1 =             new LandmarksInfo(59, "mixamorigLeftHandRing1",    15, 0.0, -base_size * 0.1, 0.05);
    static LEFT_RING2 =             new LandmarksInfo(61, "mixamorigLeftHandRing2",    59, 0.0, -base_size * 0.05, 0.0);
    static LEFT_RING3 =             new LandmarksInfo(63, "mixamorigLeftHandRing3",    61, 0.0, -base_size * 0.05, 0.0);
    static LEFT_RING4 =             new LandmarksInfo(65, "mixamorigLeftHandRing4",    63, 0.0, -base_size * 0.05, 0.0);
    static RIGHT_RING1 =            new LandmarksInfo(60, "mixamorigRightHandRing1",   16, 0.0, -base_size * 0.1, 0.05);
    static RIGHT_RING2 =            new LandmarksInfo(62, "mixamorigRightHandRing2",   60, 0.0, -base_size * 0.05, 0.0);
    static RIGHT_RING3 =            new LandmarksInfo(64, "mixamorigRightHandRing3",   62, 0.0, -base_size * 0.05, 0.0);
    static RIGHT_RING4 =            new LandmarksInfo(66, "mixamorigRightHandRing4",   64, 0.0, -base_size * 0.05, 0.0);
    static LEFT_PINKY1 =            new LandmarksInfo(67, "mixamorigLeftHandPinky1",   15, 0.0, -base_size * 0.18, 0.1);
    static LEFT_PINKY2 =            new LandmarksInfo(69, "mixamorigLeftHandPinky2",   67, 0.0, -base_size * 0.05, 0.0);
    static LEFT_PINKY3 =            new LandmarksInfo(71, "mixamorigLeftHandPinky3",   69, 0.0, -base_size * 0.05, 0.0);
    static LEFT_PINKY4 =            new LandmarksInfo(17, "mixamorigLeftHandPinky4",   71, 0.0, -base_size * 0.05, 0.0);
    static RIGHT_PINKY1 =           new LandmarksInfo(68, "mixamorigRightHandPinky1",  16, 0.0, -base_size * 0.1, 0.1);
    static RIGHT_PINKY2 =           new LandmarksInfo(70, "mixamorigRightHandPinky2",  68, 0.0, -base_size * 0.05, 0.0);
    static RIGHT_PINKY3 =           new LandmarksInfo(72, "mixamorigRightHandPinky3",  70, 0.0, -base_size * 0.05, 0.0);
    static RIGHT_PINKY4 =           new LandmarksInfo(16, "mixamorigRightHandPinky4",  72, 0.0, -base_size * 0.05, 0.0);
    static HEAD_TOP_END =          new LandmarksInfo(39,  "mixamorigHeadTopEnd",      0,  0.0, base_size * 0.18, 0.0 );
                                                   
             

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
// Based on mixamo skeleton
function createThreeJSSkeleton(skeleton) {

    const bones = [];

    // used to store bone by landmark index, necessary to create hierarchy
    const temp_map = {};


    for (var i = 0; i<skeleton.length; i++) {

        var lm_info = skeleton[i];

        var bone = new THREE.Bone();
        bone.name = lm_info.name;
        bone.position.x = lm_info.pos[0];
        bone.position.y = lm_info.pos[1];
        bone.position.z = lm_info.pos[2];

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
function updateThreeJSSkeleton(skeleton) {


    var lmInfoArray = Object.keys(LM_INFO);

    for (const lm_data in lmInfoArray) {

        var lm_info = LM_INFO[lmInfoArray[lm_data]];

        for(var i = 0; i<skeleton.length;i++){
            if(lm_info.name == skeleton[i].name)
            {
                lm_info.x = skeleton[i].position.x;
                lm_info.y = skeleton[i].position.y;
                lm_info.z = skeleton[i].position.z;
                
                LM_INFO[lmInfoArray[lm_data]].x = lm_info.x;
                LM_INFO[lmInfoArray[lm_data]].y = lm_info.y;
                LM_INFO[lmInfoArray[lm_data]].z = lm_info.z;

                /*temp_map[lm_info.idx] = bone;
        
                if (lm_info.prev_idx != -1) {
                    
                    if (temp_map[lm_info.prev_idx] != undefined) {
                        temp_map[lm_info.prev_idx].add(bone);
                    }
                }

                bones.push( bone );*/
            }
        }
     
    }
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
        var hips = midLandmark(pelvis_r, pelvis_l, 0.5);
        hips.y += 0.18;
        landmarks[i].PLM.push(hips);

        // Insert mouth_middle - 34
        var mouth_r = landmarks[i].PLM[9];
        var mouth_l = landmarks[i].PLM[10];
        var mouth_mid = midLandmark(mouth_r, mouth_l, 0.5);
        landmarks[i].PLM.push(mouth_mid);

        // spine2 landmark - 37
        var arm_r = landmarks[i].PLM[11];
        var arm_l = landmarks[i].PLM[12];
        var spine2 =  midLandmark(arm_r, arm_l, 0.5);
        spine2.y -=0.18;

        // shoulders landmark - 73 74
        var shoulder_r =  midLandmark(arm_r, spine2, 0.5);
        shoulder_r.y = arm_r.y;
        var shoulder_l =  midLandmark(arm_l, spine2, 0.5);
        shoulder_l.y = arm_l.y;

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

        //Right hand
        if(landmarks[i].RLM){
            var thumb_r1 = landmarks[i].RLM[1];
            var thumb_r2 = landmarks[i].RLM[2];
            var thumb_r3 = landmarks[i].RLM[3];
            var thumb_r4 = landmarks[i].RLM[4];
                
            var index_r1 = landmarks[i].RLM[5];
            var index_r2 = landmarks[i].RLM[6];
            var index_r3 = landmarks[i].RLM[7];
            var index_r4 = landmarks[i].RLM[8];
            
            var middle_r1 = landmarks[i].RLM[9];
            var middle_r2 = landmarks[i].RLM[10];
            var middle_r3 = landmarks[i].RLM[11];
            var middle_r4 = landmarks[i].RLM[12];

            var ring_r1 = landmarks[i].RLM[13];
            var ring_r2 = landmarks[i].RLM[14];
            var ring_r3 = landmarks[i].RLM[15];
            var ring_r4 = landmarks[i].RLM[16];

            var pinky_r1 = landmarks[i].RLM[17];
            var pinky_r2 = landmarks[i].RLM[18];
            var pinky_r3 = landmarks[i].RLM[19];
            var pinky_r4 = landmarks[i].RLM[20];
        }
        else{
            var thumb_r4 = landmarks[i].PLM[22];
            var thumb_r2 = midLandmark(landmarks[i].PLM[14], thumb_r4, 0.5)
            var thumb_r1 = midLandmark(landmarks[i].PLM[14], thumb_r2, 0.5)
            var thumb_r3 = midLandmark(thumb_r4, thumb_r2, 0.5)

            var index_r4 = landmarks[i].PLM[20];
            var index_r2 = midLandmark(landmarks[i].PLM[14], index_r4, 0.5)
            var index_r1 = midLandmark(landmarks[i].PLM[14], index_r2, 0.5)
            var index_r3 = midLandmark(index_r4, index_r2, 0.5)          

            var pinky_r4 = landmarks[i].PLM[18];
            var pinky_r2 = midLandmark(landmarks[i].PLM[14], pinky_r4, 0.5)
            var pinky_r1 = midLandmark(landmarks[i].PLM[14], pinky_r2, 0.5)
            var pinky_r3 = midLandmark(pinky_r4, pinky_r2, 0.5);

            var middle_r4 = midLandmark(index_r4, pinky_r4, 0.25);
            var middle_r1 = midLandmark(index_r1, pinky_r1, 0.25);
            var middle_r2 = midLandmark(middle_r1, middle_r4, 0.25);
            var middle_r3 = midLandmark(middle_r1, middle_r4, 0.75);

            var ring_r4 = midLandmark(index_r4, pinky_r4, 0.75);
            var ring_r1 = midLandmark(index_r1, pinky_r1, 0.75);
            var ring_r2 = midLandmark(ring_r1, ring_r4, 0.25);
            var ring_r3 = midLandmark(ring_r1, middle_r4, 0.75);

        }
        //Left hand
        if(landmarks[i].LLM){
            var thumb_l1 = landmarks[i].LLM[1];
            var thumb_l2 = landmarks[i].LLM[2];
            var thumb_l3 = landmarks[i].LLM[3];
            var thumb_l4 = landmarks[i].LLM[4];
            
            var index_l1 = landmarks[i].LLM[5];
            var index_l2 = landmarks[i].LLM[6];
            var index_l3 = landmarks[i].LLM[7];
            var index_l4 = landmarks[i].LLM[8];
            
            var middle_l1 = landmarks[i].LLM[9];
            var middle_l2 = landmarks[i].LLM[10];
            var middle_l3 = landmarks[i].LLM[11];
            var middle_l4 = landmarks[i].LLM[12];

            var ring_l1 = landmarks[i].LLM[13];
            var ring_l2 = landmarks[i].LLM[14];
            var ring_l3 = landmarks[i].LLM[15];
            var ring_l4 = landmarks[i].LLM[16];

            var pinky_l1 = landmarks[i].LLM[17];
            var pinky_l2 = landmarks[i].LLM[18];
            var pinky_l3 = landmarks[i].LLM[19];
            var pinky_l4 = landmarks[i].LLM[20];
        }
        else{
            var thumb_l4 = landmarks[i].PLM[21];
            var thumb_l2 = midLandmark(landmarks[i].PLM[15], thumb_l4, 0.5)
            var thumb_l1 = midLandmark(landmarks[i].PLM[15], thumb_l2, 0.5)
            var thumb_l3 = midLandmark(thumb_l4, thumb_l2, 0.5)

            var index_l4 = landmarks[i].PLM[19];
            var index_l2 = midLandmark(landmarks[i].PLM[15], index_l4, 0.5)
            var index_l1 = midLandmark(landmarks[i].PLM[15], index_l2, 0.5)
            var index_l3 = midLandmark(index_l4, index_l2, 0.5)

            var pinky_l4 = landmarks[i].PLM[17];
            var pinky_l2 = midLandmark(landmarks[i].PLM[15], pinky_l4, 0.5)
            var pinky_l1 = midLandmark(landmarks[i].PLM[15], pinky_l2, 0.5)
            var pinky_l3 = midLandmark(pinky_l4, pinky_l2, 0.5);

            var middle_l4 = midLandmark(index_l4, pinky_l4, 0.25);
            var middle_l1 = midLandmark(index_l1, pinky_l1, 0.25);
            var middle_l2 = midLandmark(middle_l1, middle_l4, 0.25);
            var middle_l3 = midLandmark(middle_l1, middle_l4, 0.75);

            var ring_l4 = midLandmark(index_l4, pinky_l4, 0.75);
            var ring_l1 = midLandmark(index_l1, pinky_l1, 0.75);
            var ring_l2 = midLandmark(ring_l1, ring_l4, 0.25);
            var ring_l3 = midLandmark(ring_l1, middle_l4, 0.75);
        }
        
        // Insert thumb right 1 - 39
        landmarks[i].PLM.push(thumb_r1);
        // Insert thumb left 1 - 40
        landmarks[i].PLM.push(thumb_l1);
        // Insert thumb right 2 - 41
        landmarks[i].PLM.push(thumb_r2);
        // Insert thumb left 2 - 42
        landmarks[i].PLM.push(thumb_l2);
        // Insert thumb right 3 - 43
        landmarks[i].PLM.push(thumb_r3);
        // Insert thumb left 3 - 44
        landmarks[i].PLM.push(thumb_l3);
        // Insert thumb right 4 - 21
        landmarks[i].PLM[21] = thumb_r4;
        // Insert thumb right 4 - 22
        landmarks[i].PLM[22] = thumb_l4;
       
        // Insert index right 1 - 45
        landmarks[i].PLM.push(index_r1);
        // Insert index left 1 - 46
        landmarks[i].PLM.push(index_l1);
        // Insert index right 2 - 47
        landmarks[i].PLM.push(index_r2);
        // Insert index left 2 - 48
        landmarks[i].PLM.push(index_l2);
        // Insert index right 3 - 49
        landmarks[i].PLM.push(index_r3);
        // Insert index left 3 - 50
        landmarks[i].PLM.push(index_l3);
        // Insert index right 4 - 19
        landmarks[i].PLM[19] = index_r4;
        // Insert index right 4 - 20
        landmarks[i].PLM[20] = index_l4;
       
        // Insert middle right 1 - 51
        landmarks[i].PLM.push(middle_r1);
        // Insert middle left 1 - 52
        landmarks[i].PLM.push(middle_l1);
        // Insert middle right 2 - 53
        landmarks[i].PLM.push(middle_r2);
        // Insert middle left 2 - 54
        landmarks[i].PLM.push(middle_l2);
        // Insert middle right 3 - 55
        landmarks[i].PLM.push(middle_r3);
        // Insert middle left 3 - 56
        landmarks[i].PLM.push(middle_l3);
        // Insert middle right 4 - 57
        landmarks[i].PLM.push(middle_r4);
        // Insert middle right 4 - 58
        landmarks[i].PLM.push(middle_l4);
       
        // Insert ring right 1 - 59
        landmarks[i].PLM.push(ring_r1);
        // Insert ring left 1 - 60
        landmarks[i].PLM.push(ring_l1);
        // Insert ring right 2 - 61
        landmarks[i].PLM.push(ring_r2);
        // Insert ring left 2 - 62
        landmarks[i].PLM.push(ring_l2);
        // Insert ring right 3 - 63
        landmarks[i].PLM.push(ring_r3);
        // Insert ring left 3 - 64
        landmarks[i].PLM.push(ring_l3);
        // Insert ring right 4 - 65
        landmarks[i].PLM.push(ring_r4);
        // Insert ring right 4 - 66
        landmarks[i].PLM.push(ring_l4);
       
        // Insert pinky right 1 - 67
        landmarks[i].PLM.push(pinky_r1);
        // Insert pinky left 1 - 68
        landmarks[i].PLM.push(pinky_l1);
        // Insert pinky right 2 - 69
        landmarks[i].PLM.push(pinky_r2);
        // Insert pinky left 2 - 70
        landmarks[i].PLM.push(pinky_l2);
        // Insert pinky right 3 - 71
        landmarks[i].PLM.push(pinky_r3);
        // Insert pinky left 3 - 72
        landmarks[i].PLM.push(pinky_l3);
        // Insert pinky right 4 - 17
        landmarks[i].PLM[17] = pinky_r4;
        // Insert pinky right 4 - 18
        landmarks[i].PLM[18] = pinky_l4;


        // Insert right shoulder - 73
        landmarks[i].PLM.push(shoulder_r);
        // Insert left shoulder - 74
        landmarks[i].PLM.push(shoulder_l);

        // Insert right toe end - 75
        var toebase_r = landmarks[i].PLM[32];
        toebase_r.z-=1;
        landmarks[i].PLM.push(toebase_r);
        // Insert left toe end - 76
        var toebase_l = landmarks[i].PLM[31];
        toebase_l-=1;
        landmarks[i].PLM.push(toebase_l);
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
                /*let obj = new THREE.Object3D();
                obj.position = new THREE.Vector3(landmarks[i].PLM[lm_info.idx].x, landmarks[i].PLM[lm_info.idx].y, landmarks[i].PLM[lm_info.idx].z);

                pos_values.push(landmarks[i].PLM[lm_info.idx].x);
                pos_values.push(landmarks[i].PLM[lm_info.idx].y);
                pos_values.push(landmarks[i].PLM[lm_info.idx].z);

                var quat = obj.quaternion;
                previous_quats[lm_info.idx].push(quat);

                quat_values.push(quat.x);
                quat_values.push(quat.y);
                quat_values.push(quat.z);
                quat_values.push(quat.w);*/
                
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
                const positions = new THREE.VectorKeyframeTrack( lm_info.name + '.position', times, pos_values);
                tracks.push(positions);
            }

            if (quat_values.length > 0) {
                const rotations = new THREE.QuaternionKeyframeTrack( lm_info.name + '.quaternion', times, quat_values);
                tracks.push(rotations);
            }
        }
    }

    // use -1 to automatically calculate
    // the length from the array of tracks
    const length = -1;

    return new THREE.AnimationClip(name || "sign_anim", length, tracks);
}

export { createSkeleton, createAnimation, createThreeJSSkeleton, updateThreeJSSkeleton };
