import * as THREE from "./libs/three.module.js";
import { OrbitControls } from "./controls/OrbitControls.js";
import { BVHLoader } from "./loaders/BVHLoader.js";
import { Timeline } from "./libs/timeline.module.js";
import { load_timeline } from "./timeline_manager.js";
import { createSkeleton, createAnimation } from "./skeleton.js";
import { BVHExporter } from "./bvh_exporter.js";

class Editor {

    constructor() {
        this.clock = new THREE.Clock();
        this.loader = new BVHLoader();
        
        this.camera = null;
        this.controls = null;
        this.scene = null;
        this.renderer = null;
        this.state = false;  // defines how the animation starts (moving/static)

        this.mixer = null;
        this.skeletonHelper = null;
        
        this.points_geometry = null;
        this.landmarks_array = [];
        this.prev_time = this.iter = 0;

        this.names = [];

        this.init();
    	this.onDrawTimeline = null;
	    this.onDrawSettings = null;

    }
    
    init() {

        var scene3d = document.getElementById("scene");
        var mainBody = document.getElementById("mainBody");
        var canvas3D = document.getElementById("scene3D");

        var CANVAS_WIDTH = scene3d.clientWidth;
        var CANVAS_HEIGHT = scene3d.clientHeight;
        mainBody.classList.add("hidden"); // Once we optain the size, we hide it
        
        let scene = new THREE.Scene();
        scene.background = new THREE.Color(0xeeeeee);
        scene.add(new THREE.GridHelper(400, 10));
        
        let renderer = new THREE.WebGLRenderer({ canvas: canvas3D, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
        renderer.outputEncoding = THREE.sRGBEncoding;
        
        // camera
        let camera = new THREE.PerspectiveCamera(60, CANVAS_WIDTH / CANVAS_HEIGHT, 1, 1000);
        let controls = new OrbitControls(camera, renderer.domElement);
        controls.minDistance = 1;
        controls.maxDistance = 7;
        camera.position.set(0.5, 2, -3);
        controls.target.set(1.2, 1.5, 0);
        controls.update();  
        
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.controls = controls;

    	this.onDrawTimeline = null;//Timeline.draw;
    	this.onDrawSettings = null;

        //animate();
    }

    getState() {
        return this.state;
    }

    setState(value) {
        this.state = value;
    }

    loadInScene(project) {

        this.landmarks_array = project.landmarks;
        
        project.path = project.path || "models/bvh/victor.bvh";
        
        let skeleton = createSkeleton(this.landmarks_array);
        
        this.skeletonHelper = new THREE.SkeletonHelper(skeleton.bones[0]);
        this.skeletonHelper.skeleton = skeleton; // allow animation mixer to bind to THREE.SkeletonHelper directly
        
        const boneContainer = new THREE.Group();
        boneContainer.add(skeleton.bones[0]);
        
        this.scene.add(this.skeletonHelper);
        this.scene.add(boneContainer);
        
        var animation_clip = createAnimation(this.landmarks_array);
        
        // play animation
        this.mixer = new THREE.AnimationMixer(this.skeletonHelper);
        this.mixer.clipAction(animation_clip).setEffectiveWeight(1.0).play();
        this.mixer.update(this.clock.getDelta()); //do first iteration to update from T pose
        
        this.points_geometry = new THREE.BufferGeometry();
        
        const material = new THREE.PointsMaterial( { color: 0x880000 } );
        material.size = 0.025;
        
        const points = new THREE.Points( this.points_geometry, material );
        
        this.scene.add( points );
        
        BVHExporter.export(skeleton, animation_clip, this.landmarks_array.length);
        
        // play animation
        // mixer = new THREE.AnimationMixer(skeletonHelper);
        // mixer.clipAction(result.clip).setEffectiveWeight(1.0).play();
        // mixer.update(clock.getDelta()); //do first iteration to update from T pose
        
        project.prepareData(this.mixer, animation_clip, skeleton);
        this.names = project.names;
        
        this.animate();
    }
        
    animate() {
        
        requestAnimationFrame(this.animate.bind(this));
        
        const dt = this.clock.getDelta();
        
        if (this.mixer && this.state) {
            //console.log("Scene!");
            this.mixer.update(dt);

            if (this.onDrawTimeline)
                this.onDrawTimeline();
            if (this.drawSettings)
                this.drawSettings();
        }

        if (this.drawSettings)
            this.drawSettings();
    
        //New testing
        //if (points_geometry == undefined || landmarks_array == undefined) return;
        
        var curr_lm = this.landmarks_array[this.iter];
        var curr_time = Date.now();
        var et = (curr_time - this.prev_time);
        if (et > curr_lm.dt) {
            
            const vertices = [];
            
            for (let i = 0; i < curr_lm.PLM.length; i++) {
                const x = curr_lm.PLM[i].x;
                const y = curr_lm.PLM[i].y;
                const z = curr_lm.PLM[i].z;
                
                vertices.push( x, y, z );
            }
            
            this.points_geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
            
            this.prev_time = curr_time + curr_lm.dt;
            this.iter++;
            this.iter = this.iter % this.landmarks_array.length;
        }
    
        this.renderer.render(this.scene, this.camera);
    }

    resize(width, height) {
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    drawSettings() {

        const ctx = document.getElementById("skeleton").getContext("2d");
        const canvas = ctx.canvas;
        
        let scroll_y = 0; // pixels scrolled (it can cause to move the whole text to the top)
        let startx = 0; // starting pixel (it can cause to move the whole text to the left)

        let vertical_offset = 15; // top space
        let name_height = 25; // space between names
        let sidebar_width = ctx.width; // width
        let sidebar_height = ctx.height;
        let names = this.names;
        let scrollable_height = names.length * name_height;
        let current_scroll_in_pixels = 0;

        //compute the current y scrollable value
        if (sidebar_height < scrollable_height)
            scroll_y = -current_scroll_in_pixels; //TODO
        if (scroll_y) {
            ctx.beginPath();
            ctx.rect(0, vertical_offset, canvas.width, sidebar_height);
            ctx.clip();
        }

        //fill bone lines
        var w = canvas.width;
        ctx.globalAlpha = 0.1;
        for (var i = 0; i < names.length; ++i) {
            ctx.fillStyle = i % 2 == 0 ? "#2D2D2D" : "#2A2A2A";
            ctx.fillRect(0, scroll_y + vertical_offset + i * name_height, w, name_height);
        }

        //draw names of bones from list
        ctx.textAlign = "left";

        //estimated starting distance of timeline in the canvas
        var w = 60; //left space for names start
        var y = scroll_y + 0.5 + vertical_offset;

        if (names)
            for (var i = 0; i < names.length; ++i) {
                var bone = names[i];
                var [name, depth, is_selected, has_childs] = bone;

                //compute horizontal position
                var x = startx > w ? startx : w;
                x = x + (20 * depth);

                //draw an opening triangle
                if (has_childs) {
                    ctx.fillStyle = "#FFF";
                    ctx.beginPath();
                    ctx.moveTo(x - 35, y + name_height * 0.4);
                    ctx.lineTo(x - 25, y + name_height * 0.4);
                    ctx.lineTo(x - 30, y + name_height * 0.7);
                    ctx.fill();
                }

                //name
                ctx.fillStyle = "#AAA";
                ctx.font = '13px sans-serif';
                ctx.fillText(name, x - 20, y + name_height * 0.65);
                ctx.fillStyle = "#123";
                ctx.globalAlpha = 1;

                if (is_selected) {
                    ctx.fillStyle = "white";
                    ctx.globalCompositeOperation = "difference";
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(sidebar_width - 7, y);
                    ctx.lineTo(sidebar_width - 2, y + name_height * 0.5);
                    ctx.lineTo(sidebar_width - 7, y + name_height);
                    ctx.lineTo(0, y + name_height);
                    ctx.closePath();
                    ctx.fill();
                    ctx.globalCompositeOperation = "source-over";
                }

                y += name_height;
            }

        ctx.restore();
    }
};

export { Editor };