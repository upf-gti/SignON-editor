import * as THREE from "./libs/three.module.js";

const DOWNLOAD      = 0;
const LOCAL_STORAGE = 1;
const LOG           = 1;

const BVHExporter = {

    // Function to download data to a file
    download: function(data, filename, type) {
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
    },

    getTabs: function(level) {
        
        var tabs = "";
        for (var i = 0; i < level; ++i) {
            tabs += "\t";
        }
        return tabs;
    },

    exportBone: function(bone, level) {

        var isEndSite = bone.children.length == 0;

        var tabs = this.getTabs(level);
        var bvh = tabs;

        var exportPos = false;
        if (!(bone.parent instanceof THREE.Bone)) {
            bvh += "ROOT " + bone.name + "\n";
            exportPos = true;
        } else 
        if (isEndSite) {
            bvh += "End Site" + "\n";
        } else {
            bvh += "JOINT " + bone.name + "\n";
        }

        const position = this.skeletonHelper.getBoneByName( bone.name ).position;

        bvh += tabs + "{\n";
        bvh += tabs + "\tOFFSET "   + position.x.toFixed(6) +
                            " "     + position.y.toFixed(6) +
                            " "     + position.z.toFixed(6) + "\n";

        if (!isEndSite) {
            if (exportPos) {
                bvh += tabs + "\tCHANNELS 6 Xposition Yposition Zposition Xrotation Yrotation Zrotation\n";
            } else {
                bvh += tabs + "\tCHANNELS 3 Xrotation Yrotation Zrotation\n";
            }
        }

        for (var i = 0; i < bone.children.length; ++i) {
            bvh += this.exportBone(bone.children[i], level + 1);
        }

        bvh += tabs + "}\n";

        return bvh;
    },

    quatToEulerString: function(q) {
        var euler = new THREE.Euler();
        euler.setFromQuaternion(q);
        return THREE.Math.radToDeg(euler.x).toFixed(6) + " " + THREE.Math.radToDeg(euler.y).toFixed(6) + " " + THREE.Math.radToDeg(euler.z).toFixed(6) + " ";
    },

    posToString: function(p) {
        return p.x.toFixed(6) + " " + p.y.toFixed(6) + " " + p.z.toFixed(6) + " ";
    },

    export: function(mixer, skeletonHelper, clip, mode) {

        var bvh = "";
        const framerate = 1 / 30;
        const numFrames = 1 + Math.floor(clip.duration / framerate);

        this.skeletonHelper = skeletonHelper;

        bvh += "HIERARCHY\n";

        if (skeletonHelper.bones[0] == undefined) {
            console.error("Can not export skeleton with no bones");
            return;
        }

        bvh += this.exportBone(skeletonHelper.skeleton.bones[0], 0);
        
        bvh += "MOTION\n";
        bvh += "Frames: " + numFrames + "\n";
        bvh += "Frame Time: " + framerate + "\n";

        const interpolants = mixer._actions[0]._interpolants;

        const getBoneFrameData = (time, bone) => {

            var data = "";

            // End site
            if(!bone.children.length)
            return data;

            const tracks = clip.tracks.filter( t => t.name.split(".")[0] === bone.name );

            // No animation info            
            if(!tracks.length)
                data += this.quatToEulerString(bone.quaternion);
            else {
                for(var i = 0; i < tracks.length; ++i) {

                    const t = tracks[i];
                    const trackIndex = clip.tracks.indexOf( t );
                    const interpolant = interpolants[ trackIndex ];
                    const values = interpolant.evaluate(time);
    
                    const type = t.name.split(".")[1];
                    switch(type) {
                        case 'position':
                            const pos = new THREE.Vector3();
                            pos.fromArray(values.slice(0, 3));
                            data += this.posToString(pos);
                            break;
                        case 'quaternion':
                            const q = new THREE.Quaternion();
                            q.fromArray(values.slice(0, 4));
                            data += this.quatToEulerString(q);
                    }
                }
            }

            for (const b of bone.children)
                data += getBoneFrameData(time, b);

            return data;
        }

        for( var frameIdx = 0; frameIdx < numFrames; ++frameIdx ) {
            bvh += getBoneFrameData(frameIdx * framerate, skeletonHelper.skeleton.bones[0]);
            bvh += "\n";
        }

        switch(mode) {
            
            case LOCAL_STORAGE:
                window.localStorage.setItem('three_webgl_bvhpreview', bvh);
                break;
            case LOG:
                console.log(bvh);
                break;
            default:
                this.download(bvh, 'sign.bvh', 'text/plain');
                break;
        }

        this.skeletonHelper = null;
    },

    copyToLocalStorage: function(mixer, skeletonHelper, clip) {
        this.export(mixer, skeletonHelper, clip, LOCAL_STORAGE);
    }
};

export { BVHExporter }