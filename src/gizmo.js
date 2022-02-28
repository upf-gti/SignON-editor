import * as THREE from "three";
import { ShaderChunk } from "./utils.js";
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

        this.initialSize = transform.size;

        let scene = editor.scene;
        scene.add( transform );

        this.mesh = new THREE.Mesh();
        scene.add( this.mesh );
        transform.attach( this.mesh );

        this.camera = editor.camera;
        this.scene = scene;
        this.transform = transform;
		this.raycaster = null;
        this.selectedBone = null;
        this.bonePoints = null;
        this.editor = editor;

        // Update in first iteration
        this.mustUpdate = true; 
    }

    begin(skeletonHelper) {
        
        this.skeletonHelper = skeletonHelper;

        // point cloud for bones
        const pointsShaderMaterial = new THREE.ShaderMaterial( {
            uniforms: {
                color: { value: new THREE.Color( 0xffffff ) },
                pointTexture: { value: new THREE.TextureLoader().load( 'data/disc.png' ) },
                alphaTest: { value: 0.9 }
            },
            vertexShader: ShaderChunk["Point"].vertexshader,
            fragmentShader: ShaderChunk["Point"].fragmentshader
        });

        const geometry = new THREE.BufferGeometry();

        let vertices = [];

        for(let bone of skeletonHelper.bones) {
            let tempVec = new THREE.Vector3();
            bone.getWorldPosition(tempVec);
            vertices.push( tempVec );
        }

        this.selectedBone = vertices.length ? 0 : null;

        geometry.setFromPoints(vertices);
        
        const positionAttribute = geometry.getAttribute( 'position' );
        const colors = [];
        const sizes = [];
        const color = new THREE.Color(0.9, 0.9, 0.3);

        for ( let i = 0, l = positionAttribute.count; i < l; i ++ ) {
            color.toArray( colors, i * 3 );
            sizes[i] = 0.5;
        }

        geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
        geometry.setAttribute( 'size', new THREE.Float32BufferAttribute( sizes, 1 ) );
        this.bonePoints = new THREE.Points( geometry, pointsShaderMaterial );
        this.scene.add( this.bonePoints );

        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Points.threshold = 0.05;

        this.bindEvents();

        // First update to get bones in place
        this.update(true, 0.0);
    }

    bindEvents() {

        if(!this.skeletonHelper)
            throw("No skeleton");

        let that = this;
        let transform = this.transform;

        const canvasArea = document.getElementById("canvasarea");

        canvasArea.addEventListener( 'pointerdown', function(e) {

            if(e.button != 0 || !that.bonePoints)
            return;

            const pointer = new THREE.Vector2(( e.offsetX / canvasArea.clientWidth ) * 2 - 1, -( e.offsetY / canvasArea.clientHeight ) * 2 + 1);
            that.raycaster.setFromCamera(pointer, that.camera);
            const intersections = that.raycaster.intersectObject( that.bonePoints );
            if(!intersections.length)
                return;

            const intersection = intersections.length > 0 ? intersections[ 0 ] : null;

            if(intersection) {
                that.selectedBone = intersection.index;
                that.mustUpdate = true;
                that.editor.gui.updateSidePanel(null, that.skeletonHelper.bones[that.selectedBone].name);
                // console.log( that.skeletonHelper.bones[that.selectedBone].name );
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

    update(state, dt) {

        if(state) this.updateBones(dt);

        if(this.selectedBone == null || !this.mustUpdate)
        return;

        let bone = this.skeletonHelper.bones[this.selectedBone];
        let tempVec = new THREE.Vector3();
        bone.getWorldPosition(tempVec);

        let quat = new THREE.Quaternion();
        bone.getWorldQuaternion(quat);

        this.mesh.position.fromArray(tempVec.toArray());
        this.mesh.rotation.setFromQuaternion(quat);

        this.mustUpdate = false; 
    }

    updateBones( dt ) {

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

    setBone( name ) {

        let bone = this.skeletonHelper.skeleton.getBoneByName(name);
        if(!bone) {
            console.warn("No bone with name " + name);
            return;
        }

        const boneId = this.skeletonHelper.bones.findIndex((bone) => bone.name == name);
        if(boneId > -1)
            this.selectedBone = boneId;
    }

    setMode( mode ) {
        this.transform.setMode( mode );
    }

};

export { Gizmo };