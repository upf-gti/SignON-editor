import * as THREE from "./libs/three.module.js";

let FLT_EPSILON =  1.192092896e-07;

Math.clamp = function (v, a, b) {
	return a > v ? a : b < v ? b : v;
};

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

function axis_dominant_v3_single(vec)
{
  var x = Math.abs(vec[0]);
  var y = Math.abs(vec[1]);
  var z = Math.abs(vec[2]);
  return ((x > y) ? ((x > z) ? 0 : 2) : ((y > z) ? 1 : 2));
}

function ortho_v3_v3(v)
{
  var axis = axis_dominant_v3_single(v);

  var out = new THREE.Vector3();

  switch (axis) {
    case 0:
      out.x = -v.y - v.z;
      out.y = v.x;
      out.z = v.x;
      break;
    case 1:
      out.x = v.y;
      out.y = -v.x - v.z;
      out.z = v.y;
      break;
    case 2:
      out.x = v.z;
      out.y = v.z;
      out.z = -v.x - v.y;
      break;
  }

  return out;
}

// https://github.com/wisaac407/blender/blob/326efb431971e668a41d9a331ccc3d11f9fd3e5f/source/blender/blenlib/intern/math_rotation.c#L839
function axis_angle_to_quat(axis, angle)
{
    var axis_length = axis.lengthSq();
    axis.normalize();

	if (axis_length != 0.0) {
		return axis_angle_normalized_to_quat(axis, angle);
	}
	else {
        return new THREE.Quaternion();
	}
}

// https://github.com/wisaac407/blender/blob/326efb431971e668a41d9a331ccc3d11f9fd3e5f/source/blender/blenlib/intern/math_rotation.c#L474
function rotation_difference_vec(v1, v2) {

    v1.normalize();
    v2.normalize();

    var axis = new THREE.Vector3();
    axis.crossVectors(v1, v2);

    var axis_length = axis.lengthSq();

    var axis_pre_norm = axis.clone();
    axis.normalize();

    if (axis_length > FLT_EPSILON) {

        var angle = angle_normalized_v3v3(v1, v2);
        //var angle = v1.angleTo(v2);

        // console.log("---------------------------------------------")
        // console.log("v1: " + v1.x + ", " + v1.y + ", " + v1.z);
        // console.log("v2: " + v2.x + ", " + v2.y + ", " + v2.z);
        // console.log("Axis: " + axis_pre_norm.x + ", " + axis_pre_norm.y + ", " + axis_pre_norm.z);
        // console.log("Angle: " + angle)
        // console.log("---------------------------------------------")

        return axis_angle_normalized_to_quat(axis, angle);
    }
      else {
        /* degenerate case */

        if (v1.dot(v2) > 0.0) {
          /* Same vectors, zero rotation... */
            return new THREE.Quaternion();
        }
        else {
          /* Colinear but opposed vectors, 180 rotation... */
          axis = ortho_v3_v3(v1);
          return axis_angle_to_quat(q, axis, Math.PI);
        }
      }
}

function calc_rotation(original_joint_dir, landmarks_dir, prev_rot) {

    // var lm1 = new THREE.Vector3(current_landmark.x, current_landmark.y, current_landmark.z)
    // var lm2 = new THREE.Vector3(child_landmark.x, child_landmark.y, child_landmark.z)

    // var pt_ini = new THREE.Vector3(lm1.x, lm1.y, lm1.z);
    
    // translate to current_landmark space
    // lm1.x = lm1.x - pt_ini.x;
    // lm1.y = lm1.y - pt_ini.y;
    // lm1.z = lm1.z - pt_ini.z;

    // lm2.x = lm2.x - pt_ini.x;
    // lm2.y = lm2.y - pt_ini.y;
    // lm2.z = lm2.z - pt_ini.z;

    // var y_up = new THREE.Vector3(0, 1, 0);
    // var y_down = new THREE.Vector3(0, -1, 0);

    // var direction = new THREE.Vector3().subVectors(child_landmark, current_landmark);

    // var rot_quat;

    // if (direction.y >= 0) {
    //     rot_quat = rotation_difference_vec(y_up, direction);
    // } else {
    //     rot_quat = rotation_difference_vec(y_down, direction);
    // }

    var rot_quat = rotation_difference_vec(original_joint_dir, landmarks_dir);

    // 
    var rot_quat_ajust = rotation_difference_quat(prev_rot, rot_quat)

    return { "rotation" : rot_quat, "rotation_diff" : rot_quat_ajust };
}

function calc_rotation_v1(current_landmark, child_landmark, prev_rot) {

  var lm1 = new THREE.Vector3(current_landmark.x, current_landmark.y, current_landmark.z)
  var lm2 = new THREE.Vector3(child_landmark.x, child_landmark.y, child_landmark.z)

  var pt_ini = new THREE.Vector3(lm1.x, lm1.y, lm1.z);
  
  // translate to current_landmark space
  lm1.x = lm1.x - pt_ini.x;
  //lm1.y = lm1.y - pt_ini.y;
  lm1.z = lm1.z - pt_ini.z;

  lm2.x = lm2.x - pt_ini.x;
  //lm2.y = lm2.y - pt_ini.y;
  lm2.z = lm2.z - pt_ini.z;

  var rot_quat;

  if (lm1.y < 0) {
    rot_quat = rotation_difference_vec(lm1, new THREE.Vector3().subVectors(lm2, lm1));
  } else {
    rot_quat = rotation_difference_vec(lm1, new THREE.Vector3().subVectors(lm1, lm2));
  }

  // 
  var rot_quat_ajust = rotation_difference_quat(prev_rot, rot_quat)

  return { "rotation" : rot_quat, "rotation_diff" : rot_quat_ajust };
}


export { calc_rotation, calc_rotation_v1 }