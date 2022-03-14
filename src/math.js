import * as THREE from "./libs/three.module.js";

Math.clamp = function (v, a, b) {
	return a > v ? a : b < v ? b : v;
};
let FLT_EPSILON =  1.192092896e-07;
// Returns the shortest-path rotational difference between two quaternions
// from: https://github.com/blender/blender-addons/blob/master/rigify/rig_ui_template.py
function rotation_difference(quat1, quat2) {

    angle = math.acos(min(1,max(-1, quat1.dot(quat2)))) * 2;
    
    if (angle > pi) {
        angle = -angle + (2.0 * Math.PI);
    }

    return angle;
}

// from: https://github.com/dfelinto/blender/blob/master/source/blender/blenlib/intern/math_base_inline.c
function saasin(fac) {
    if (fac <= -1.0) {
        return -Math.Pi / 2.0;
    }
    else if (fac >= 1.0) {
        return Math.PI / 2.0;
    }
    else {
        return Math.asin(fac);
    }
}

// from https://github.com/martijnberger/blender/blob/master/source/blender/blenlib/intern/math_vector.c
function angle_normalized_v3v3(v1, v2) {

    /* this is the same as acos(dot_v3v3(v1, v2)), but more accurate */
    if (v1.dot(v2) < 0.0) {
        var vec = new THREE.Vector3();
        
        vec.x = -v2.x;
        vec.y = -v2.y;
        vec.z = -v2.z;
        
        return Math.PI - 2.0 * saasin(vec.distanceTo(v1) / 2.0);
    }
    else
        return 2.0 * saasin(v2.distanceTo(v1) / 2.0);
}

// from: https://github.com/dfelinto/blender/blob/master/source/blender/blenlib/intern/math_rotation.c
function axis_angle_normalized_to_quat(axis, angle)
{
    var phi = 0.5 * angle;
    var si = Math.sin(phi);
    var co = Math.cos(phi);

    var quat = new THREE.Quaternion();
    quat.w = co;
    quat.x = axis.x * si;
    quat.y = axis.y * si;
    quat.z = axis.z * si;

    return quat;
}

// from (rotation_between_quats_to_quat): 
// https://github.com/dfelinto/blender/blob/master/source/blender/blenlib/intern/math_rotation.c
function rotation_difference_quat(quat1, quat2)
{
    var tquat = new THREE.Quaternion().copy(quat1).conjugate();

    var val = 1.0 / tquat.dot(tquat);
    tquat.w *= val;
    tquat.x *= val;
    tquat.y *= val;
    tquat.z *= val;

    var quat = new THREE.Quaternion();
    return quat.multiplyQuaternions(tquat, quat2);
}

function rotation_difference_vec(v1, v2) {

    v1.normalize();
    v2.normalize();

    var axis = new THREE.Vector3();
    axis.crossVectors(v1, v2);
    axis.normalize();

    //if (normalize_v3(axis) > FLT_EPSILON) {

    var angle = angle_normalized_v3v3(v1, v2);
    //var angle = v1.angleTo(v2);

    return axis_angle_normalized_to_quat(axis, angle);
    //}
    //   else {
    //     /* degenerate case */

    //     if (dot_v3v3(v1, v2) > 0.0f) {
    //       /* Same vectors, zero rotation... */
    //       unit_qt(q);
    //     }
    //     else {
    //       /* Colinear but opposed vectors, 180 rotation... */
    //       ortho_v3_v3(axis, v1);
    //       axis_angle_to_quat(q, axis, (float)M_PI);
    //     }
    //   }
}

function calc_rotation(landmark1, landmark2, prev_rot) {
    
    var lm1 = new THREE.Vector3(landmark1.x, landmark1.y, landmark1.z)
    var lm2 = new THREE.Vector3(landmark2.x, landmark2.y, landmark2.z)

    var pt_ini = new THREE.Vector3(lm1.x, lm1.y, lm1.z);
    
    // translate to landmark1 space
    var up = new THREE.Vector3(0,-1,0);
    var vec = lm2 - lm1;
    /*lm1.x = lm1.x - pt_ini.x;
    lm1.y = lm1.y - pt_ini.y;
    lm1.z = lm1.z - pt_ini.z;

    lm2.x = lm2.x - pt_ini.x;
    lm2.y = -(lm2.y - pt_ini.y);
    lm2.z = lm2.z - pt_ini.z;*/

    var rot_quat;

    if (lm1.z >= 0) {
        rot_quat = rotation_difference_vec(up, new THREE.Vector3().subVectors(lm2, lm1));
    } else {
        rot_quat = rotation_difference_vec(up, new THREE.Vector3().subVectors(lm1, lm2));
    }

    // 
    var rot_quat_ajust = rotation_difference_quat(prev_rot, rot_quat)

    /*var lm1 = new THREE.Vector3(landmark1.x, landmark1.y, landmark1.z)
    var lm2 = new THREE.Vector3(landmark2.x, landmark2.y, landmark2.z)

    var pt_ini = new THREE.Vector3(lm1.x, lm1.y, lm1.z);
    
    // translate to landmark1 space
    lm1.x = lm1.x - pt_ini.x;
    lm1.y = -(lm1.y - pt_ini.y);
    //lm1.z = lm1.z - pt_ini.z;

    lm2.x = lm2.x - pt_ini.x;
    lm2.y = -(lm2.y - pt_ini.y);
    //lm2.z = lm2.z - pt_ini.z;

    var rot_quat;

    if (lm1.z >= 0) {
        rot_quat = rotation_difference_vec(lm1, new THREE.Vector3().subVectors(lm2, lm1));
    } else {
        rot_quat = rotation_difference_vec(lm1, new THREE.Vector3().subVectors(lm1, lm2));
    }

    // 
    var rot_quat_ajust = rotation_difference_quat(prev_rot, rot_quat)*/

    return { "rotation" : rot_quat, "rotation_diff" : rot_quat_ajust };
}

export { calc_rotation }