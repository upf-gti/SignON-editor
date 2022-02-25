import * as THREE from "three";
import { TransformControls } from './libs/TransformControls.js';

class Gizmo {

    constructor(editor) {

        if(!editor)
        throw("No editor to attach Gizmo!");

        let transform = new TransformControls( editor.camera, editor.renderer.domElement );
        transform.addEventListener( 'change', editor.render );

        transform.addEventListener( 'dragging-changed', function (event) {
            editor.controls.enabled = !event.value;
        });

        let scene = editor.scene;
        scene.add( transform );

        this.mesh = new THREE.Mesh();
        scene.add( this.mesh );
        transform.attach( this.mesh );

        this.camera = editor.camera;
        this.transform = transform;
		this.raycaster = new THREE.Raycaster();
		this.raycaster.params.Points.threshold = 5;
        this.selectedBone = null;
        this.bonePoints = null;
    }

    setSkeletonHelper(skeleton) {
        
        this.skeletonHelper = skeleton;
        this.bindEvents();
    }

    bindEvents() {

        if(!this.skeletonHelper)
            throw("No skeleton");

        let that = this;

        document.addEventListener( 'pointerdown', function(e) {

            if(e.button != 0 || !that.bonePoints)
            return;

            const pointer = new THREE.Vector2(( e.clientX / window.innerWidth ) * 2 - 1, -( e.clientY / window.innerHeight ) * 2 + 1);
            that.raycaster.setFromCamera(pointer, that.camera);
            const intersections = that.raycaster.intersectObject( that.bonePoints );
            if(!intersections.length)
                return;

            const intersection = intersections.length > 0 ? intersections[ 0 ] : null;

            if(intersection) {
                that.selectedBone = intersection.index;
                console.log( that.skeletonHelper.bones[selectedBone] );
            }
        });

        window.addEventListener( 'keydown', function (e) {

            // TODO: Change this - its depracated -
            switch ( e.keyCode ) {

                case 81: // Q
                    transform.setSpace( transform.space === 'local' ? 'world' : 'local' );
                    break;

                case 16: // Shift
                    transform.setTranslationSnap( 100 );
                    transform.setRotationSnap( THREE.MathUtils.degToRad( 15 ) );
                    break;

                case 87: // W
                    transform.setMode( 'translate' );
                    break;

                case 69: // E
                    transform.setMode( 'rotate' );
                    break;

                case 187:
                case 107: // +, =, num+
                    transform.setSize( transform.size + 0.1 );
                    break;

                case 189:
                case 109: // -, _, num-
                    transform.setSize( Math.max( transform.size - 0.1, 0.1 ) );
                    break;

                case 88: // X
                    transform.showX = ! transform.showX;
                    break;

                case 89: // Y
                    transform.showY = ! transform.showY;
                    break;

                case 90: // Z
                    transform.showZ = ! transform.showZ;
                    break;

                case 32: // Spacebar
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    // mixer.togglePause();
                    break;
            }

        });

        window.addEventListener( 'keyup', function ( event ) {

            switch ( event.keyCode ) {

                case 16: // Shift
                    transform.setTranslationSnap( null );
                    transform.setRotationSnap( null );
                    break;
            }
        });
    }

    update(dt) {

        if(this.selectedBone == null)
        return;

        let bone = this.skeletonHelper.bones[this.selectedBone];
        let tempVec = new THREE.Vector3();
        bone.getWorldPosition(tempVec);

        let quat = new THREE.Quaternion();
        bone.getWorldQuaternion(quat);

        this.mesh.position.fromArray(tempVec.toArray());
        this.mesh.rotation.setFromQuaternion(quat);

        this.updateBones(dt);
    }

    updateBones(dt) {

        if(!this.bonePoints)
            return;

        let vertices = [];

        for(let bone of this.skeletonHelper.bones) {
            let tempVec = new THREE.Vector3();
            bone.getWorldPosition(tempVec);
            vertices.push( tempVec );
        }

        this.bonePoints.geometry.setFromPoints(vertices);
        this.bonePoints.geometry.computeBoundingSphere();
    }

};

export { Gizmo };