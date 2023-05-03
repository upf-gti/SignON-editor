import * as THREE from "three";
import { CompareThreshold } from "../utils.js"
import { BVHLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/BVHLoader.js';

// Overwrite/add methods

THREE.SkeletonHelper.prototype.getBoneByName = function( name ) {

    for ( let i = 0, il = this.bones.length; i < il; i ++ ) {
        const bone = this.bones[ i ];
        if ( bone.name === name ) {
            return bone;
        }
    }
    return undefined;
}

THREE.KeyframeTrack.prototype.optimize = function( threshold = 0.0025 ) {
	// times or values may be shared with other tracks, so overwriting is unsafe
	const times = THREE.AnimationUtils.arraySlice( this.times ),
	values = THREE.AnimationUtils.arraySlice( this.values ),
	stride = this.getValueSize(),
	smoothInterpolation = this.getInterpolation() === THREE.InterpolateSmooth,
	lastIndex = times.length - 1;
	let writeIndex = 1;
	let cmpFunction = CompareThreshold;

	for ( let i = 1; i < lastIndex; ++ i ) {

		let keep = false;
		const time = times[ i ];
		const timeNext = times[ i + 1 ];

		// remove adjacent keyframes scheduled at the same time

		if ( time !== timeNext && ( i !== 1 || time !== times[ 0 ] ) ) {
			if ( ! smoothInterpolation ) {

				// remove unnecessary keyframes same as their neighbors
				const offset = i * stride,
					offsetP = offset - stride,
					offsetN = offset + stride;

				for ( let j = 0; j !== stride; ++ j ) {
					if( cmpFunction(
						values[ offset + j ], 
						values[ offsetP + j ], 
						values[ offsetN + j ],
						threshold))
					{
						keep = true;
						break;
					}
				}
			} else {
				keep = true;
			}
		}

		// in-place compaction
		if ( keep ) {
			if ( i !== writeIndex ) {
				times[ writeIndex ] = times[ i ];
				const readOffset = i * stride,
					writeOffset = writeIndex * stride;
				for ( let j = 0; j !== stride; ++ j ) {
					values[ writeOffset + j ] = values[ readOffset + j ];
				}
			}
			++ writeIndex;
		}
	}

	// flush last keyframe (compaction looks ahead)
	if ( lastIndex > 0 ) {
		times[ writeIndex ] = times[ lastIndex ];
		for ( let readOffset = lastIndex * stride, writeOffset = writeIndex * stride, j = 0; j !== stride; ++ j ) {
			values[ writeOffset + j ] = values[ readOffset + j ];
		}
		++ writeIndex;
	}

	if ( writeIndex !== times.length ) {

		this.times = THREE.AnimationUtils.arraySlice( times, 0, writeIndex );
		this.values = THREE.AnimationUtils.arraySlice( values, 0, writeIndex * stride );
	} else {

		this.times = times;
		this.values = values;
	}

	return this;
}

Inspector.prototype.addSlider = function(name, value, options)
{
	options = this.processOptions(options);

	if(options.min === undefined)
		options.min = 0;

	if(options.max === undefined)
		options.max = 1;

	if(options.step === undefined)
		options.step = 0.01;

	if(options.precision === undefined)
		options.precision = 3;

	var that = this;
	if(value === undefined || value === null)
		value = 0;
	this.values[name] = value;

	var element = this.createWidget(name,"<span class='inputfield full'>\
				<input tabIndex='"+this.tab_index+"' style='font-weight: bolder; color: white; display: none; position: absolute; z-index: 1000; margin-left: 6px; margin-top: -3px;' class='slider-text fixed' value='"+value+"' /><span class='slider-container'></span></span>", options);

	var slider_container = element.querySelector(".slider-container");

	var slider = new LiteGUI.Slider(value,options);
	slider_container.appendChild(slider.root);

	slider.root.addEventListener('dblclick', function(e) {
		
		text_input.value = parseFloat(text_input.value).toFixed(3);
		text_input.style.display = "block";
		text_input.focus();
	});

	//Text change -> update slider
	var skip_change = false; //used to avoid recursive loops
	var text_input = element.querySelector(".slider-text");
	text_input.addEventListener('change', function(e) {
		if(skip_change)
			return;
		var v = parseFloat( this.value ).toFixed(options.precision);
		value = v;
		slider.setValue( v );
		Inspector.onWidgetChange.call( that,element,name,v, options );
	});

	text_input.addEventListener('keyup', function(e) {

		if(e.keyCode == 27){
			text_input.style.display = "none";
		}
		
	});

	text_input.addEventListener('blur', function(e) {

		text_input.style.display = "none";
		
	});

	//Slider change -> update Text
	slider.onChange = function(value) {
		text_input.value = value;
		text_input.style.display = "none";
		Inspector.onWidgetChange.call( that, element, name, value, options);
	};

	this.append(element,options);

	element.setValue = function(v,skip_event) { 
		if(v === undefined)
			return;

		value = v;
		slider.setValue(parseFloat( v ),skip_event);
	};
	element.getValue = function() { 
		return value;
	};

	this.processElement(element, options);
	return element;
}

LiteGUI.SliderList = [];

function Slider(value, options)
{
	options = options || {};
	var canvas = document.createElement("canvas");
	canvas.className = "slider " + (options.extraclass ? options.extraclass : "");

	canvas.width = 300;
	canvas.height = 22; 	

	this.root = canvas;
	var that = this;
	this.value = value;
	this.defValue = value;

	this.ready = true;

	LiteGUI.SliderList.push( this );

	this.setValue = function(value, skip_event)
	{
		if(!value)
		value = this.value;

		if(options.integer)
			value = parseInt(value);
		else
			value = parseFloat(value);

		var ctx = canvas.getContext("2d");
		var min = options.min || 0.0;
		var max = options.max || 1.0;
		if(value < min) value = min;
		else if(value > max) value = max;
		var range = max - min;
		var norm = (value - min) / range;
		ctx.clearRect(0,0,canvas.width,canvas.height);
		ctx.fillStyle = "#5f88c9";
		ctx.fillRect(0,0, canvas.width * norm, canvas.height);

		ctx.fillStyle = "#EEE";
		ctx.font = "13px Arial";

		var text = value.toFixed(options.precision);
		ctx.fillText(text, canvas.width - 16 - text.length * 8, 15);

		if(value != this.value)
		{
			this.value = value;
			if(!skip_event)
			{
				LiteGUI.trigger(this.root, "change", value );
				if(this.onChange)
					this.onChange( value );
			}
		}
	}

	function setFromX(x)
	{
		var width = canvas.getClientRects()[0].width;
		var norm = x / width;
		var min = options.min || 0.0;
		var max = options.max || 1.0;
		var range = max - min;
		that.setValue( range * norm + min );
	}

	var doc_binded = null;

	canvas.oncontextmenu = () => { return false; };

	canvas.addEventListener("mousedown", function(e) {

		doc_binded = canvas.ownerDocument;
		// right click
		if(e.button === 2) {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			doc_binded.addEventListener("mouseup", onMouseUp );
			that.setValue(that.defValue);
		} else {
			var mouseX, mouseY;
			if(e.offsetX) { mouseX = e.offsetX; mouseY = e.offsetY; }
			else if(e.layerX) { mouseX = e.layerX; mouseY = e.layerY; }	
			setFromX(mouseX);
			doc_binded.addEventListener("mousemove", onMouseMove );
			doc_binded.addEventListener("mouseup", onMouseUp );
			doc_binded.body.style.cursor = "none";
		}
	});

	function onMouseMove(e)
	{
		var rect = canvas.getClientRects()[0];
		var x = e.x === undefined ? e.pageX : e.x;
		var mouseX = x - rect.left;
		setFromX(mouseX);
		e.preventDefault();
		return false;
	}

	function onMouseUp(e)
	{
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
		
		var doc = doc_binded || document;
		doc_binded = null;
		doc.removeEventListener("mousemove", onMouseMove );
		doc.removeEventListener("mouseup", onMouseUp );
		doc.body.style.cursor = "default";

		return false;
	}

	this.setValue(value);
}

LiteGUI.Slider = Slider;


/**
* Widget to edit an enumeration using a combobox
* @method addCombo
* @param {string} name 
* @param {*} value 
* @param {Object} options, here is a list for this widget (check createWidget for a list of generic options):
* - values: a list with all the possible values, it could be an array, or an object, in case of an object, the key is the string to show, the value is the value to assign
* - disabled: true to disable
* - callback: function to call once an items is clicked
* @return {HTMLElement} the widget in the form of the DOM element that contains it
**/
Inspector.prototype.addCombo = function(name, value, options)
{
	options = this.processOptions(options);

	//value = value || "";
	var that = this;
	this.values[name] = value;
	
	this.tab_index++;

	var element = this.createWidget(name,"<span class='inputfield full inputcombo "+(options.disabled?"disabled":"")+"'></span>", options);
	element.options = options;

	var values = options.values || [];
	if(values.constructor === Function)
		values = options.values();

	/*
	if(!values)
		values = [];

	var index = 0;
	for(var i in values)
	{
		var item_value = values[i];
		var item_index = values.constructor === Array ? index : i;
		var item_title = values.constructor === Array ? item_value : i;
		if(item_value && item_value.title)
			item_title = item_value.title;
		code += "<option value='"+item_index+"' "+( item_value == value ? " selected":"")+" data-index='"+item_index+"'>" + item_title + "</option>";
		index++;
	}
	*/

	var code = "<select tabIndex='"+this.tab_index+"' "+(options.disabled?"disabled":"")+ " class='"+(options.disabled?"disabled":"")+"'></select>";
	element.querySelector("span.inputcombo").innerHTML = code;
	setValues(values, false, options.thumbnail);
	
	var stop_event = false; //used internally

	var select = element.querySelector(".wcontent select");
	select.addEventListener("change", function(e) { 
		var index = e.target.value;
		value = values[index];
		if(stop_event)
			return;
		Inspector.onWidgetChange.call( that,element,name,value, options );
	});

	element.getValue = function()
	{
		return value;		
	}

	element.setValue = function(v, skip_event) { 
		if(v === undefined)
			return;
		value = v;
		var select = element.querySelector("select");
		var items = select.querySelectorAll("option");
		var index =  -1;
		if(values.constructor === Array)
			index = values.indexOf(v);
		else
		{
			//search the element index in the values
			var j = 0;
			for(var i in values)
			{
				if(values[j] == v)
				{
					index = j;
					break;
				}
				else
					j++;
			}
		}

		if(index == -1)
			return;
			
		stop_event = skip_event;

		for(var i in items)
		{
			var item = items[i];
			if(!item || !item.dataset) //weird bug
				continue;
			if( parseFloat(item.dataset["index"]) == index )
			{
				item.setAttribute("selected", true);
				select.selectedIndex = index;
			}
			else
				item.removeAttribute("selected");
		}
		
		stop_event = false;
	};

	function setValues(v, selected, thumbnail){
		if(!v)
			v = [];
		values = v;
		if(selected)
			value = selected;
		var code = "";
		var index = 0;
		for(var i in values)
		{
			var item_value = values[i];
			var item_index = values.constructor === Array ? index : i;
			var item_title = values.constructor === Array ? item_value : i;
			var item_thumbnail = 'data/imgs/thumbnails/' + item_value.toLowerCase() + '.PNG"';
			if(item_value && item_value.title)
				item_title = item_value.title;
			code += "<option value='"+item_index+"' "+( item_value == value ? " selected":"")+" data-index='"+item_index+"'" + (thumbnail?" data-thumbnail='"+ item_thumbnail + "'":"")+">" + item_title + "</option>";
			index++;
		}
		element.querySelector("select").innerHTML = code;
	}
	
	element.setOptionValues = setValues;

	function custom_template(obj){
		var data = $(obj.element).data();
		var text = $(obj.element).text();
		if(data && data['thumbnail']){
			let img_src = data['thumbnail'];
			let template = $("<div style= 'display: flex;flex-direction: column;justify-content: center;align-items: center;'><img src=\"" + img_src + "\" style=\"width: calc(100% - 32px);height: auto;padding: 5px;\"/><p >" + text + "</p></div>");
			return template;
		}
	}

	if(options.thumbnail)
	{

		var optionsT = {
			'templateSelection': custom_template,
			'templateResult': custom_template,
		}
		$(select).select2(optionsT);
		$('.select2-container--default .select2-selection--single').css({'height': '220px'});
		$('.select2-selection__arrow').append('<i class="fa-solid fa-chevron-down" style="width:15px; height:15px"></i>')
		
		select.hidden = true;
		$(select).on('select2:select',(e) => {
			if(!options.callback) 
				return;
			var index = e.target.value;
			var v = values[index];
			options.callback(v);
		});
	}
	
	this.append(element,options);
	this.processElement(element, options);
	return element;
}

Inspector.prototype.addImageButton = function(name, value, options) 
{
	
	let content = null;

	if(options.image) {

		switch(options.type) {
			case 'image': 
				content = "<img src='" + options.image +"' style='opacity:0.75; max-width: 100px; height:auto'></img>";
				
				break;
			default: 
				content = "<i class='bi bi-" + options.image +"'></i>";
	
		}
	}

	// const btn = document.createElement('button');
	// btn.title = name;
	// btn.className = "litebutton";
	// btn.style = 'z-index: 2; position: absolute; right: 15px; font-size: 1.25em; width:25px; height: 25px';
	// btn.style.marginTop = 30 + "px";
	// btn.appendChild(content);
	// this.append(btn);

	this.addButton(name, content, options);
	// if(options.callback)
	// 	btn.addEventListener("click", options.callback.bind(this) );
	
}

/*
	reads a string array (lines) from a BVHE file
	and outputs a skeleton structure including motion data

	returns thee root node:
	{ name: '', channels: [], children: [] }
*/
BVHLoader.prototype.parseExtended = function(text) {

	function readBvh( lines ) {

		// read model structure
		let boneRoot = null;
		const bonesList = []; // collects flat array of all bones

		let bs = null;
		let firstLine = nextLine( lines );

		if ( firstLine == 'HIERARCHY' ) {

			boneRoot = readNode( lines, nextLine( lines ), bonesList );
			firstLine = nextLine( lines )

		}

		if ( firstLine == 'BLENDSHAPES' )	{
			//console.error( 'THREE.BVHLoader: HIERARCHY expected.' );
			const bsList = []; // collects flat array of all blendshapes
			bs = readBlendshape( lines, nextLine( lines ), bsList );
			
		}
		

		// read motion data

		if ( nextLine( lines ) !== 'MOTION' ) {

			console.error( 'THREE.BVHLoader: MOTION expected.' );

		}

		// number of frames

		let tokens = nextLine( lines ).split( /[\s]+/ );
		const numFrames = parseInt( tokens[ 1 ] );

		if ( isNaN( numFrames ) ) {

			console.error( 'THREE.BVHLoader: Failed to read number of frames.' );

		}

		// frame time

		tokens = nextLine( lines ).split( /[\s]+/ );
		const frameTime = parseFloat( tokens[ 2 ] );

		if ( isNaN( frameTime ) ) {

			console.error( 'THREE.BVHLoader: Failed to read frame time.' );

		}

		// read frame data line by line /**CHANGE IT TO SUPPORT BLENDSHAPES ANIMATION */

		for ( let i = 0; i < numFrames; i ++ ) {

			tokens = nextLine( lines ).split( /[\s]+/ );
			if(boneRoot)
				readFrameBoneData( tokens, i * frameTime, boneRoot );
			readFrameBSData( tokens, i * frameTime, bs );

		}

		return {bones: bonesList, blendshapes: bs};
	}

	/*
		Recursively reads data from a single frame into the bone hierarchy.
		The passed bone hierarchy has to be structured in the same order as the BVH file.
		keyframe data is stored in bone.frames.

		- data: splitted string array (frame values), values are shift()ed so
		this should be empty after parsing the whole hierarchy.
		- frameTime: playback time for this keyframe.
		- bone: the bone to read frame data from.
	*/
	function readFrameBoneData( data, frameTime, bone ) {

		// end sites have no motion data

		if ( bone.type === 'ENDSITE' ) return;

		// add keyframe

		const keyframe = {
			time: frameTime,
			position: new Vector3(),
			rotation: new Quaternion()
		};

		bone.frames.push( keyframe );

		const quat = new Quaternion();

		const vx = new Vector3( 1, 0, 0 );
		const vy = new Vector3( 0, 1, 0 );
		const vz = new Vector3( 0, 0, 1 );

		// parse values for each channel in node

		for ( let i = 0; i < bone.channels.length; i ++ ) {

			switch ( bone.channels[ i ] ) {

				case 'Xposition':
					keyframe.position.x = parseFloat( data.shift().trim() );
					break;
				case 'Yposition':
					keyframe.position.y = parseFloat( data.shift().trim() );
					break;
				case 'Zposition':
					keyframe.position.z = parseFloat( data.shift().trim() );
					break;
				case 'Xrotation':
					quat.setFromAxisAngle( vx, parseFloat( data.shift().trim() ) * Math.PI / 180 );
					keyframe.rotation.multiply( quat );
					break;
				case 'Yrotation':
					quat.setFromAxisAngle( vy, parseFloat( data.shift().trim() ) * Math.PI / 180 );
					keyframe.rotation.multiply( quat );
					break;
				case 'Zrotation':
					quat.setFromAxisAngle( vz, parseFloat( data.shift().trim() ) * Math.PI / 180 );
					keyframe.rotation.multiply( quat );
					break;
				default:
					console.warn( 'THREE.BVHLoader: Invalid channel type.' );

			}

		}

		// parse child nodes

		for ( let i = 0; i < bone.children.length; i ++ ) {

			readFrameBoneData( data, frameTime, bone.children[ i ] );

		}

	}

	/*
		Recursively reads data from a single frame into the bone hierarchy.
		The passed bone hierarchy has to be structured in the same order as the BVH file.
		keyframe data is stored in bone.frames.

		- data: splitted string array (frame values), values are shift()ed so
		this should be empty after parsing the whole hierarchy.
		- frameTime: playback time for this keyframe.
		- bs: blendshapes array to read frame data from.
	*/
	function readFrameBSData( data, frameTime, bs ) {

		for( let i = 0; i < bs.length; i++ ) {
			// add keyframe

			const keyframe = {
				time: frameTime,
				weight: 0
			};

			bs[i].frames.push( keyframe );
			// parse values in node
			keyframe.weight = parseFloat( data.shift().trim() );
		}

	}

	/*
		Recursively parses the HIERACHY section of the BVH file

		- lines: all lines of the file. lines are consumed as we go along.
		- firstline: line containing the node type and name e.g. 'JOINT hip'
		- list: collects a flat list of nodes

		returns: a BVH node including children
	*/
	function readNode( lines, firstline, list ) {

		const node = { name: '', type: '', frames: [] };
		list.push( node );

		// parse node type and name

		let tokens = firstline.split( /[\s]+/ );

		if ( tokens[ 0 ].toUpperCase() === 'END' && tokens[ 1 ].toUpperCase() === 'SITE' ) {

			node.type = 'ENDSITE';
			node.name = 'ENDSITE'; // bvh end sites have no name

		} else {

			node.name = tokens[ 1 ];
			node.type = tokens[ 0 ].toUpperCase();

		}

		if ( nextLine( lines ) !== '{' ) {

			console.error( 'THREE.BVHLoader: Expected opening { after type & name' );

		}

		// parse OFFSET

		tokens = nextLine( lines ).split( /[\s]+/ );

		if ( tokens[ 0 ] !== 'OFFSET' ) {

			console.error( 'THREE.BVHLoader: Expected OFFSET but got: ' + tokens[ 0 ] );

		}

		if ( tokens.length !== 4 ) {

			console.error( 'THREE.BVHLoader: Invalid number of values for OFFSET.' );

		}

		const offset = new Vector3(
			parseFloat( tokens[ 1 ] ),
			parseFloat( tokens[ 2 ] ),
			parseFloat( tokens[ 3 ] )
		);

		if ( isNaN( offset.x ) || isNaN( offset.y ) || isNaN( offset.z ) ) {

			console.error( 'THREE.BVHLoader: Invalid values of OFFSET.' );

		}

		node.offset = offset;

		// parse CHANNELS definitions

		if ( node.type !== 'ENDSITE' ) {

			tokens = nextLine( lines ).split( /[\s]+/ );

			if ( tokens[ 0 ] !== 'CHANNELS' ) {

				console.error( 'THREE.BVHLoader: Expected CHANNELS definition.' );

			}

			const numChannels = parseInt( tokens[ 1 ] );
			node.channels = tokens.splice( 2, numChannels );
			node.children = [];

		}

		// read children

		while ( true ) {

			const line = nextLine( lines );

			if ( line === '}' ) {

				return node;

			} else {

				node.children.push( readNode( lines, line, list ) );

			}

		}

	}

	/*
		Recursively parses the BLENDSHAPES section of the BVH file

		- lines: all lines of the file. lines are consumed as we go along.
		- firstline: line containing the blendshape name e.g. 'Blink_Left' and the skinning meshes names that have this morph target
		- list: collects a flat list of blendshapes

		returns: a BVH node including children
	*/
	function readBlendshape( lines, line, list ) {

		while ( true ) {
			let line = nextLine( lines );

			if ( line === '{' ) continue;
			if ( line === '}' ) return list;

			let node = { name: '', meshes: [], frames: [] };
			list.push( node );

			// parse node type and name

			let tokens = line.split( /[\s]+/ );

			node.name = tokens[ 0 ];

			for(let i = 1; i < tokens.length; i++){

				node.meshes.push(tokens[ i ]);

			}
			

		}
		
	}

	/*
		recursively converts the internal bvh node structure to a Bone hierarchy

		source: the bvh root node
		list: pass an empty array, collects a flat list of all converted THREE.Bones

		returns the root Bone
	*/
	function toTHREEBone( source, list ) {

		const bone = new Bone();
		list.push( bone );

		bone.position.add( source.offset );
		bone.name = source.name;

		if ( source.type !== 'ENDSITE' ) {

			for ( let i = 0; i < source.children.length; i ++ ) {

				bone.add( toTHREEBone( source.children[ i ], list ) );

			}

		}

		return bone;

	}

	/*
		builds a AnimationClip from the keyframe data saved in each bone.

		bone: bvh root node

		returns: a AnimationClip containing position and quaternion tracks
	*/
	function toTHREEAnimation( bones, blendshapes ) {

		const boneTracks = [];

		// create a position and quaternion animation track for each node

		for ( let i = 0; i < bones.length; i ++ ) {

			const bone = bones[ i ];

			if ( bone.type === 'ENDSITE' )
				continue;

			// track data

			const times = [];
			const positions = [];
			const rotations = [];

			for ( let j = 0; j < bone.frames.length; j ++ ) {

				const frame = bone.frames[ j ];

				times.push( frame.time );

				// the animation system animates the position property,
				// so we have to add the joint offset to all values

				positions.push( frame.position.x + bone.offset.x );
				positions.push( frame.position.y + bone.offset.y );
				positions.push( frame.position.z + bone.offset.z );

				rotations.push( frame.rotation.x );
				rotations.push( frame.rotation.y );
				rotations.push( frame.rotation.z );
				rotations.push( frame.rotation.w );

			}

			if ( scope.animateBonePositions ) {

				boneTracks.push( new VectorKeyframeTrack( bone.name + '.position', times, positions ) );

			}

			if ( scope.animateBoneRotations ) {

				boneTracks.push( new QuaternionKeyframeTrack( bone.name + '.quaternion', times, rotations ) );

			}

		}

		const bsTracks = [];
		for ( let i = 0; i < blendshapes.length; i ++ ) {

			const bs = blendshapes[ i ];
			// track data

			const times = [];
			const weights = [];

			for ( let j = 0; j < bs.frames.length; j ++ ) {
				const frame = bs.frames[ j ];

				times.push( frame.time );

				// the animation system animates the morphInfluences property,
				// so we have to add the blendhsape weight to all values

				weights.push( frame.weight );
			}
			
			if( bs.meshes.length ) {

				for( let b = 0; b < bs.meshes.length; b++) {
					
					bsTracks.push( new THREE.NumberKeyframeTrack( bs.meshes[b] + '.morphTargetInfluences[' + bs.name + ']', times, weights ) );
				}
			}
			else {

				bsTracks.push( new THREE.NumberKeyframeTrack( 'Body' + '.morphTargetInfluences[' + bs.name + ']', times, weights ) );
			}	
			
		}
		return { skeletonClip: new THREE.AnimationClip( 'bsAnimation', - 1, bsTracks ), blendshapesClip: new THREE.AnimationClip( 'bsAnimation', - 1, bsTracks )};

	}

	/*
		returns the next non-empty line in lines
	*/
	function nextLine( lines ) {

		let line;
		// skip empty lines
		while ( ( line = lines.shift().trim() ).length === 0 ) { }

		return line;

	}

	const scope = this;

	const lines = text.split( /[\r\n]+/g );

	const {bones, blendshapes} = readBvh( lines );

	const threeBones = [];
	if(bones.length)
		toTHREEBone( bones[ 0 ], threeBones );

	const {skeletonClip, blendshapesClip } = toTHREEAnimation( bones, blendshapes );

	return {
		skeletonAnim: {
			skeleton: skeletonClip.length ? new THREE.Skeleton( threeBones ) : null,
			clip: skeletonClip
		},
		blendshapesAnim: {
			clip: blendshapesClip
		}
	};
		
}