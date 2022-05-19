import * as THREE from "./libs/three.module.js";

// Function to download data to a file
function download(data, filename, type) {
    var file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
                url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);  
        }, 0); 
    }
}

function rad_to_deg(radians)
{
  var pi = Math.PI;
  return radians * (180/pi);
}

function get_tabs(level) {
    
    var tabs = "";
    for (var i = 0; i < level; ++i) {
        tabs += "\t";
    }
    return tabs;
}

function export_bone(bone, level) {

    var end_site = bone.children.length == 0;

    var tabs = get_tabs(level);
    var bvh = tabs;

    var export_pos = false;
    if (!(bone.parent instanceof THREE.Bone)) {
        bvh += "ROOT " + bone.name + "\n";
        export_pos = true;
    } else 
    if (end_site) {
        bvh += "End Site" + "\n";
    } else {
        bvh += "JOINT " + bone.name + "\n";
    }

    bvh += tabs + "{\n";

    bvh += tabs + "\tOFFSET " + bone.position.x.toFixed(6) +
                          " " + bone.position.y.toFixed(6) +
                          " " + bone.position.z.toFixed(6) + "\n";

    if (!end_site) {
        if (export_pos) {
            bvh += tabs + "\tCHANNELS 6 Xposition Yposition Zposition Xrotation Yrotation Zrotation\n";
        } else {
            bvh += tabs + "\tCHANNELS 3 Xrotation Yrotation Zrotation\n";
        }
    }

    for (var i = 0; i < bone.children.length; ++i) {
        bvh += export_bone(bone.children[i], level + 1);
    }

    bvh += tabs + "}\n";

    return bvh;
}

function export_bvh(skeleton, animation_clip, frames_length) {

    var bvh = "";

    bvh += "HIERARCHY\n";

    if (skeleton.bones[0] == undefined) {
        console.error("Can not export skeleton with no bones");
        return;
    }

    bvh += export_bone(skeleton.bones[0], 0);
    
    bvh += "MOTION\n";
    bvh += "Frames: " + frames_length + "\n";
    bvh += "Frame Time: " + (1.0 / 60.0) + "\n";

    for (var frame_idx = 0; frame_idx < frames_length; ++frame_idx) {

        var bone_idx = 0;
        for (var track_idx = 0; track_idx < animation_clip.tracks.length; track_idx++) {

            // End site nodes do not have channels
            if (skeleton.bones[bone_idx].children.length == 0) {
                bone_idx++;
                continue;
            }

            // Only export position for root node
            if (track_idx == 0) {
                // Positions
                var positions = animation_clip.tracks[track_idx];
                var x = positions.values[frame_idx * 3 + 0];
                var y = positions.values[frame_idx * 3 + 1];
                var z = positions.values[frame_idx * 3 + 2];
                
                bvh += x.toFixed(6) + " " + y.toFixed(6) + " " + z.toFixed(6) + " ";

                track_idx++;
            }

            // Quaternions
            var quaternions = animation_clip.tracks[track_idx];
            var x = quaternions.values[frame_idx * 4 + 0]
            var y = quaternions.values[frame_idx * 4 + 1]
            var z = quaternions.values[frame_idx * 4 + 2]
            var w = quaternions.values[frame_idx * 4 + 3]

            var euler = new THREE.Euler();
            euler.setFromQuaternion(new THREE.Quaternion(x, y, z, w));

            bvh += rad_to_deg(euler.x).toFixed(6) + " " + rad_to_deg(euler.y).toFixed(6) + " " + rad_to_deg(euler.z).toFixed(6) + " ";

            bone_idx++;
        }

        bvh += "\n";
    }

    //download(bvh, 'sign.bvh', 'text/plain');
}

export { export_bvh }