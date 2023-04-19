"use strict";

//ANIMATE by Javi Agenjo (@tamat) 2018 and modifyed by Eva Valls (2021) to define Agent Behaviors through the time
//************************************
//This file contains the code necessary to define BEHAVIORS (verbal and non-verbal) based on BML standard (Project, Tracks and Clips definitions)
//All the editor features are in timelineEditor.js (TIMELINE_EDITOR)

(function(global){

var ANIM = global.ANIM = {};

var DEG2RAD = 0.0174532925;
var RAD2DEG = 57.295779578552306;

ANIM.REF_CLIP = 100;

ANIM.LEFT = 1;
ANIM.CENTER = 2;
ANIM.RIGHT = 3;

//inputs
ANIM.LEFT_BUTTON = 1;
ANIM.RIGHT_BUTTON = 2;
ANIM.MIDDLE_BUTTON = 4;

ANIM.clip_types = [];

//blend modes
ANIM.NORMAL = 0;
ANIM.SCREEN = 1;
ANIM.OVERLAY = 2;
ANIM.MULTIPLY = 3;
ANIM.DARKEN = 4;
ANIM.HARD_LIGHT = 5;
ANIM.SOFT_LIGHT = 6;
ANIM.BLEND_MODES = ["Normal","Screen","Overlay","Multiply","Darken","Hard Light","Soft Light"];
ANIM.blend_to_operation = {
	0: "source-over",
	1: "screen",
	2: "overlay",
	3: "multiply",
	4: "darken",
	5: "hard-light",
	6: "soft-light"
};

//clip types
ANIM.MISSING_CLIP = -1; //used when after loading a clip the type is not found in the system
ANIM.SPEECH = 0;
ANIM.AUDIO = 1;
ANIM.FACELEXEME = 2;
ANIM.FACEFACS = 3;
ANIM.FACEEMOTION = 4;
ANIM.GAZE = 5;
ANIM.GESTURE = 6;
ANIM.HEAD = 7;
ANIM.HEADDIRECTION = 8;
ANIM.POSTURE = 9;
ANIM.LOCOMOTION = 10;

ANIM.CUSTOM = 11;

ANIM.clip_types = [ SpeechClip, AudioClip, FaceLexemeClip, FaceFACSClip, FaceEmotionClip, GazeClip, GestureClip, HeadClip, HeadDirectionShiftClip, PostureClip] ;
ANIM.track_types = {"Speech": [ SpeechClip, AudioClip], "FaceShift": [FaceLexemeClip/*, FaceFACSClip*/], "Face": [FaceLexemeClip, FaceFACSClip, FaceEmotionClip], "Gaze": [GazeClip],"GazeShift": [GazeClip], "Gesture":[GestureClip], "Head": [HeadClip],"HeadDirectionShift": [HeadDirectionShiftClip], "Posture": [PostureClip], "PostureShift": [PostureClip] };
ANIM.registerClipType = function(ctor)
{
	var name = ctor.name;
	ANIM.clip_types[ ctor.id ] = ctor;
	for(var i in BaseClip.prototype)
		ctor.prototype[i] = BaseClip.prototype[i];
	ANIM[ name ] = ctor;
}

// PROJECT ****************************************************
//a project contains tracks, a track contains clips, and a clip could contain frames
function Project()
{
	this.name = "unnamed";

	//timing
	this.mode = ANIM.PAUSED;
	this.current_time = 0;
	this.duration = 60;
	this.framerate = 30;
	this.volume = 1;
	this.type = ANIM.CANVAS2D;
	this.allow_seeking = true;

	//canvas
	this.size = [1280,720]; //project res

	//tracks: similar to layers
	this.tracks = []; //all tracks
	this.markers = []; //time markers

	//scripts
	this.includes = []; //urls to js files that must be imported
	this.scripts = {}; //scripts that could be used in this project
	this.globals = {}; //container to store global vars between clips
	this.texts = {}; //generic container for text data

	//external
	this.fonts = []; //fonts that must be loaded from Google Fonts

	this.clip_types = []; //list of all available clip types

	this.clear();

	Project.instance = this;
}

ANIM.Project = Project;

Project.prototype.add = function(track)
{
	if(track.constructor !== ANIM.Track)
		throw("only tracks allowed to be added to project");
	this.tracks.push( track );
	track._project = this;
	return track;
}

Project.prototype.getTrack = function( id )
{
	if(id.constructor === String)
	{
		for(var i = 0; i < this.tracks.length; ++i )
			if( this.tracks[i].name == id )
				return this.tracks[i];
		return null;
	}
	return this.tracks[ Number(id) ];
}


Project.prototype.clear = function( skip_default_tracks )
{
	this.current_time = 0;

	this.globals = {};
	this.tracks.length = 0;
	this.markers.length = 0;

	this.includes = [];
	this.scripts = {};
	this.fonts = [];
}


Project.prototype.load = function( url, on_complete )
{
	var that = this;
	fetch(url)
	.then(function(response) {
		if(response.status == 404)
		{
			if(on_complete)
				on_complete(null);
		}
		else
		  return response.json();
	}).then( function(data){
		if(data)
			that.fromJSON(data, on_complete);
	});/*.catch(function(err){
		console.error( "error loading project: " + err );
	});
	*/
}

Project.prototype.toJSON = function()
{
	var json = {};

	json.name = this.name;

	json.current_time = this.current_time;
	json.duration = this.duration;
	json.framerate = this.framerate;
	json.size = this.size;
	json.markers = this.markers;
	json.texts = this.texts;

	json.includes = this.includes;
	json.scripts = [];
	for(var i in this.scripts)
	{
		var script = this.scripts[i];
		json.scripts.push({ name: script.name, code: script.code });
	}



	json.tracks = [];
	for(var i = 0; i < this.tracks.length; ++i)
		json.tracks.push( this.tracks[i].toJSON() );

	json.fonts = this.fonts;

	return json;
}

Project.prototype.fromJSON = function(json, callback)
{

	this.current_time = json.current_time || 0;
	this.duration = json.duration;
	this.framerate = json.framerate;
	this.size = json.size;

	this.tracks.length = 0;
	this.markers = json.markers || [];
		if(callback)
			callback();
	}

//when coding clips from external scripts, you need a way to ensure clip classes hasnt been modifyed
Project.prototype.checkClips = function()
{
	for(var j = 0; j < this.tracks.length; ++j)
	{
		var track = this.tracks[j];
		for(var i = 0; i < this.clips.length; ++i)
		{
			var clip = this.clips;
			var ctor_class = ANIM.clip_types[ clip.constructor.id ];
			if(clip.constructor === ctor_class)
				continue;
			var new_clip = new ctor_class();
			new_clip.fromJSON( clip.toJSON() );
			new_clip.start = clip.start;
			new_clip.duration = clip.duration;
			this.clips[i] = new_clip;
		}
	}
}

function Track( name )
{
	this.name = name || "noname";
	this.clips = [];
	this.hidden = false;
	this.editable = true;
	this._project = null;
	this.current_clip = null;
}

Track.prototype.getIndex = function()
{
	return this._project.tracks.indexOf(this);
}

Track.prototype.toJSON = function()
{
	var json = {
		name: this.name,
		clips: [],
		editable: this.editable,
		hidden: this.hidden
	};
	for(var i = 0; i < this.clips.length; ++i)
	{
		var shift = false;
		
		if(this.name.includes("Shift"))
			shift = true;
		var clip = this.clips[i];
		var data = ANIM.clipToJSON( clip );
		if(data)
		{
			data.shift = shift;
			json.clips.push( data );
		}
			
	}

	return json;
}

ANIM.clipToJSON = function( clip )
{
	var id;
	var data;
	if( clip.constructor === ANIM.MissingClip )
	{
		id = clip.missing_type;
		data = clip.json;
	}
	else if(clip.toJSON)
	{
		id = clip.constructor.id;
		data = clip.toJSON();
	}
	else
	{
		console.warn("Clip without toJSON, data not serialized");
		return null;
	}
	if( clip.fadein )
		data.fadein = clip.fadein;
	if( clip.fadeout )
		data.fadeout = clip.fadeout;
	if( clip.control_channels )
	{
		data.ccs = [];
		for(var i = 0; i < clip.control_channels.length; ++i)
			data.ccs.push( clip.control_channels[i].toJSON() );
	}

	return [ id, clip.start, clip.duration, data ];
}

Track.prototype.fromJSON = function(json)
{
	this.name = json.name;
	this.editable = json.editable;
	this.hidden = json.hidden;

	if(!json.clips)
	{
		console.warn("track without clips");
		return;
	}

	for(var i = 0; i < json.clips.length; ++i)
	{
		var clip_data = json.clips[i];
		var clip = ANIM.clipFromJSON( clip_data );
		this.add( clip );
	}
}

ANIM.clipFromJSON = function( clip_data, clip )
{
	var type = ANIM.clip_types[ clip_data[0] ];
	clip = clip || null;
	if(!clip)
	{
		if(type)
			clip = new type();
		else
		{
			console.error("Clip type id unknown:", clip_data[0] );
			clip = new ANIM.MissingClip();
			clip.missing_type = clip_data[0];
			clip.json = clip_data[3];
		}
	}
	clip.start = clip_data[1];
	clip.duration = clip_data[2];
	if(clip.fromJSON)
		clip.fromJSON( clip_data[3] );
	else if( clip.constructor !== ANIM.MissingClip )
		console.warn("Clip without fromJSON: ", clip_data[0] );
	var data = clip_data[3];

		clip.fadeout = data.fadeout;
	if( data.ccs )
	{
		clip.control_channels = [];
		for(var i = 0; i < data.ccs.length; ++i)
			clip.control_channels.push( new ANIM.ControlChannel( data.ccs[i] ) );
	}

	return clip;
}

//used to render the content of this track so it doesnt have to be rendered constantly
Track.prototype.getTempCanvas = function()
{
	if(!this._temp_canvas)
		this._temp_canvas = document.createElement("canvas");
	return this._temp_canvas;
}


Track.prototype.add = function( clip, time, duration )
{
	if(time !== undefined)
	{
		if(isNaN(time))
		{
			console.error("NaN in time");
			return;
		}
		clip.start = time;
	}
	if(duration !== undefined)
		clip.duration = duration;
	clip._track = this;
	this.clips.push( clip );
	this.sortClips();
}

Track.prototype.remove = function(clip)
{
	var index = this.clips.indexOf(clip);
	if(index != -1)
		this.clips.splice(index,1);
	this.sortClips();
}

Track.prototype.sortClips = function()
{
	this.clips.sort( function(a,b) {return a.start - b.start; });
}

Track.prototype.getClipAtTime = function(time)
{
	for(var i = 0, l = this.clips.length; i < l; ++i)
	{
		var clip = this.clips[i];
		if(clip.start > time || (clip.start + clip.duration) < time )
			continue;
		return clip;
	}
	return null;
}

Track.prototype.getClipsInRange = function(start,end)
{
	var res = [];
	for(var i = 0, l = this.clips.length; i < l; ++i)
	{
		var clip = this.clips[i];
		if(clip.start > end || (clip.start + clip.duration) < start )
			continue;
		res.push(clip);
	}
	return res;
}

ANIM.Track = Track;

// CONTROL CHANNEL : used to store keyframes

function ControlChannel(o)
{
	this.name = "param";
	this.type = ANIM.NUMBER;
	this.values = [];
	this.interpolation_type = ANIM.LINEAR;
	if(o)
		this.fromJSON(o);
}

ANIM.ControlChannel = ControlChannel;

ControlChannel.prototype.fromJSON = function(o)
{
	this.type = o.type;
	this.name = o.name;
	this.values = o.values;
}

ControlChannel.prototype.toJSON = function()
{
	return {
		type: this.type,
		name: this.name,
		values: this.values.concat()
	};
}

ControlChannel.prototype.addKeyframe = function( time, value )
{
	var k = [time,value];
	for(var i = 0; i < this.values.length; ++i)
	{
		if( this.values[i][0] > time )
		{
			this.values.splice(i,0,k);
			return k;
		}
	}
	this.values.push(k);
	return k;
}

ControlChannel.prototype.removeKeyframe = function( keyframe )
{
	for(var i = 0; i < this.values.length; ++i)
	{
		if( this.values[i] == keyframe )
		{
			this.values.splice(i,1);
			return;
		}
	}
}

ControlChannel.prototype.removeKeyframeByTime = function( time )
{
	for(var i = 0; i < this.values.length; ++i)
	{
		if( Math.abs( this.values[i][0] - time ) < 0.001 )
		{
			this.values.splice(i,1);
			return;
		}
	}
}

ControlChannel.prototype.removeKeyframeByIndex = function( index )
{
	this.values.splice(index,1);
}

ControlChannel.prototype.sort = function()
{
	this.values.sort( function(a,b) { return a[0] - b[0]; } );
}

ControlChannel.prototype.getSample = function( time )
{
	if(!this.values.length)
		return null;

	//sample value
	var prev;
	var next;
	for(var j = 0; j < this.values.length; ++j)
	{
		var v = this.values[j];
		if(v[0] < time)
		{
			prev = v;
			continue;
		}
		next = v;
		break;
	}

	if(!prev && !next)
		return 0; //no data

	if(!prev && next)
		return next[1];

	if(prev && !next)
		return prev[1];

	var f = (time - prev[0]) / (next[0] - prev[0]);
	if(this.type == ANIM.NUMBER)
		return prev[1] * (1-f) + next[1] * (f);

	return null;
}


// CLIPS *******************************************************
//-----------------------------Face Behaviour-----------------------------//
//FaceLexemeClip to show captions
FaceLexemeClip.lexemes = [
	"LIP_CORNER_DEPRESSOR", "LIP_CORNER_DEPRESSOR_LEFT","LIP_CORNER_DEPRESSOR_RIGHT",	"LIP_CORNER_PULLER","LIP_CORNER_PULLER_LEFT","LIP_CORNER_PULLER_RIGHT", 
	"LIP_PUCKERER", "LIP_STRECHER","LIP_FUNNELER","LIP_TIGHTENER","LIP_PRESSOR", "PRESS_LIPS",
	"MOUTH_OPEN","LOWER_LIP_DEPRESSOR", "CHIN_RAISER", "TONGUE_SHOW", 
	"BROW_LOWERER","BROW_LOWERER_LEFT","BROW_LOWERER_RIGHT", "INNER_BROW_RAISER","OUTER_BROW_RAISER", "BROW_RAISER_LEFT", "BROW_RAISER_RIGHT", "BROW_RAISER", 
	"UPPER_LID_RAISER", "CHEEK_RAISER", "LID_TIGHTENER", "EYES_CLOSED","BLINK","WINK_LEFT", "WINK_RIGHT",
	"NOSE_WRINKLER","UPPER_LIP_RAISER","DIMPLER", "DIMPLER_LEFT", "DIMPLER_RIGHT","JAW_DROP","MOUTH_STRETCH"];


function FaceLexemeClip(o)
{
	let lexeme = FaceLexemeClip.lexemes[6];
	this.start = 0;
	this.duration = 1;
	this.attackPeak = 0.25;
	this.relax = 0.75;
	
	this.properties = {};
	this.properties.amount = 0.5;
	this.properties.lexeme = lexeme;
	/*permanent : false,*/
	
	this.id = lexeme + "-" + Math.ceil(getTime());
	
	this._width = 0;
	this.color = "black";
	this.font = "40px Arial";
	this.clip_color = "cyan";

	if(o)
		this.configure(o);

	this.updateColor(this.properties.lexeme);
  //this.icon_id = 37;
}

FaceLexemeClip.type = "faceLexeme";
FaceLexemeClip.id = ANIM.FACELEXEME? ANIM.FACELEXEME:2;
FaceLexemeClip.clip_color = "cyan";
ANIM.registerClipType( FaceLexemeClip );

FaceLexemeClip.prototype.configure = function(o)
{
	this.start = o.start | 0;
	this.duration = o.duration | 1;
	this.attackPeak = o.attackPeak | 0.25;
	this.relax = o.relax | 0.75;

	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
		this.id = this.properties.lexeme + "-" + Math.ceil(getTime());
	}
}

FaceLexemeClip.prototype.updateColor = function(v) 
{
	if(v.includes("LIP") || v.includes("MOUTH") || v.includes("DIMPLER"))
		this.clip_color = 'cyan';
	else if(v.includes("BROW"))
		this.clip_color = 'orange';
	else if(v.includes("CHIN") || v.includes("JAW"))
		this.clip_color = 'purple';
	else if(v.includes("NOSE"))
		this.clip_color = 'yellow';
	else
		this.clip_color = 'green';
}
FaceLexemeClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
		attackPeak: this.attackPeak,
		relax : this.relax
	}
	for(var i in this.properties)
	{
		json[i] = this.properties[i];
	}
	return json;
}

FaceLexemeClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.properties.amount = json.amount;
	this.start = json.start;
	this.attackPeak = json.attackPeak;
	this.relax = json.relax;
	this.duration = json.duration;
	this.properties.lexeme = json.lexeme;
	/*this.properties.permanent = json.permanent;*/

}
function roundedRect(ctx, x, y, width, height, radiusStart, radiusEnd, fill = true) {
	ctx.beginPath();
	ctx.moveTo(x, y + radiusStart);
	ctx.arcTo(x, y + height, x + radiusStart, y + height, radiusStart);
	ctx.arcTo(x + width, y + height, x + width, y + height - radiusEnd, radiusEnd);
	ctx.arcTo(x + width, y, x + width - radiusEnd, y, radiusEnd);
	ctx.arcTo(x, y, x, y + radiusStart, radiusStart);
	if(fill)
		ctx.fill();
	else
		ctx.stroke();
}
const HexToRgb = (hex) => {
    var c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length== 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x'+c.join('');
        return [(c>>16)&255, (c>>8)&255, c&255];
    }
    throw new Error('Bad Hex');
}
FaceLexemeClip.prototype.drawTimeline = function( ctx, w,h, selected, timeline )
{
	//ctx.globalCompositeOperation =  "source-over";
	ctx.font = "11px Calibri";
	var text_info = ctx.measureText( this.id );
	if(timeline && timeline.timeToX)
	{
		// var gradient = ctx.createLinearGradient(0, 0, w, h);
		
		// ctx.globalCompositeOperation = "darken";
		let attack_x = timeline._seconds_to_pixels * this.attackPeak;
		let relax_x = timeline._seconds_to_pixels * this.relax ;
		// Add three color stops
		// gradient.addColorStop(0, "gray");
		// gradient.addColorStop(attack_x/w, this.clip_color);
		// gradient.addColorStop(relax_x/w, this.clip_color);
		// gradient.addColorStop(1, "gray");
		// ctx.beginPath();
		// ctx.rect(x, 0, timeline._seconds_to_pixels * this.relax - x, h);
		// // ctx.rect(0, 0, x, h);
		// // ctx.fill();
		// // x = timeline._seconds_to_pixels * this.relax ;
		// // ctx.beginPath();
		// // ctx.rect(x, 0, w - x, h);
		// ctx.fill();
		//ctx.fillStyle = gradient;
		ctx.fillStyle = this.clip_color;
		let color = HexToRgb(ctx.fillStyle);
		color = color.map(x => x*=0.8);
		ctx.fillStyle = 'rgba(' + color.join(',') + ', 1)';
		roundedRect(ctx, 0, 0, attack_x, h, 5, 0, true);
		roundedRect(ctx, relax_x, 0, w - relax_x, h, 0, 5, true);
		ctx.globalCompositeOperation = "source-over";
		
		// ctx.fillStyle = "rgba(164, 74, 41, 1)";
		// ctx.beginPath();
		// ctx.rect(attack_x - 0.5, 0, 1.5, h);
		// ctx.fill();
		// ctx.beginPath();
		// ctx.rect(relax_x, 0, 1.5, h);
		// ctx.fill();
		// let margin = 0;
		// let size = h * 0.4;
		// ctx.save();
		// ctx.translate(attack_x, size * 2 + margin);
		// ctx.rotate(45 * Math.PI / 180);		
		// ctx.fillRect( -size, -size, size, size);
		// ctx.restore();
		// ctx.save();
		// ctx.translate(relax_x, size * 2 + margin);
		// ctx.rotate(45 * Math.PI / 180);		
		// ctx.fillRect( -size, -size, size, size);
		// ctx.restore();
		
	}
	ctx.fillStyle = this.color;
	
	if( text_info.width < (w - 24) )
		ctx.fillText( this.id, 24, h/2 + 11/2);
}
FaceLexemeClip.prototype.showInfo = function(panel, callback)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		if(i=="lexeme"){
			panel.addCombo(i, property,{values: FaceLexemeClip.lexemes, thumbnail: true, callback: function(i,v)
			{
				if(v.includes("LIP") || v.includes("MOUTH") || v.includes("DIMPLER"))
					this.clip_color = 'cyan';
				else if(v.includes("BROW"))
					this.clip_color = 'orange';
				else if(v.includes("CHIN") || v.includes("JAW"))
					this.clip_color = 'purple';
				else if(v.includes("NOSE"))
					this.clip_color = 'yellow';
				else
					this.clip_color = 'green';

				this.properties[i] = v;
				this.id = v + "-" + Math.ceil(getTime());
				if(callback)
					callback();
			}.bind(this, i)});
		}
		else
		{
			switch(property.constructor)
			{

				case String:
					panel.addString(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
						if(callback)
							callback();
					}.bind(this, i)});
					break;
				case Number:
					if(i=="amount")
					{
						panel.addNumber(i, property, {min:0, max:1,callback: function(i,v)
						{
							this.properties[i] = v;
							if(callback)
								callback();
						}.bind(this,i)});
					}
					else{
						panel.addNumber(i, property, {callback: function(i,v)
						{
							if(i == "start"){
								var dt = v - this.properties[i];
								this.properties.attackPeak += dt;
								this.properties.relax += dt;
							}
							this.properties[i] = v;
							if(callback)
								callback();
						}.bind(this,i)});
					}
					break;
				case Boolean:
					panel.addCheckbox(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
						if(callback)
							callback();
					}.bind(this,i)});
						break;
				case Array:
					panel.addArray(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
						if(callback)
							callback();
					}.bind(this,i)});
						break;
			}
		}
	}
}
//FaceFACSClip
FaceFACSClip.type = "faceFACS";
FaceFACSClip.sides = ["LEFT", "RIGHT", "BOTH"];
function FaceFACSClip()
{
	this.id= "faceFACS-"+Math.ceil(getTime());;
	this.start = 0
	this.duration = 1;
	this._width = 0;

	this.properties = {
		amount : 0.5,
		attackPeak : 0.25,
		relax : 0.75,
		au : 0,
		side : "BOTH", //[LEFT, RIGHT, BOTH](optional)
		base : false
	}
	this.color = "black";
	this.font = "40px Arial";

}

FaceFACSClip.id = ANIM.FACEFACS? ANIM.FACEFACS:3;
FaceFACSClip.clip_color = "#00BDFF";
ANIM.registerClipType( FaceFACSClip );

FaceFACSClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,

	}
	for(var i in this.properties)
	{
		if(i == "base")
		{
			if(this.properties[i])
				json.type = "faceShift";
			continue;
		}
		json[i] = this.properties[i];
	}
	return json;
}

FaceFACSClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.properties.amount = json.amount;
	this.start = json.start;
	this.properties.attackPeak = json.attackPeak;
	this.properties.relax = json.relax;
	this.duration = json.duration;
	this.properties.au = json.au;
	/*this.properties.permanent = json.permanent;*/
	this.properties.side = json.side;
}

FaceFACSClip.prototype.drawTimeline = function( ctx, w,h, selected )
{
	ctx.globalCompositeOperation =  "source-over";
	var text_info = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( text_info.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}
FaceFACSClip.prototype.showInfo = function(panel)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		if(i=="side"){
			panel.addCombo(i, property,{values: FaceFACSClip.sides, callback: function(i,v)
			{
				this.properties[i] = v;
			}.bind(this, i)});
		}
		else
		{
			switch(property.constructor)
			{

				case String:
					panel.addString(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
					}.bind(this, i)});
					break;
				case Number:
					if(i=="amount")
					{
						panel.addNumber(i, property, {min:0, max:1,callback: function(i,v)
						{
							this.properties[i] = v;
						}.bind(this,i)});
					}
					else{
						panel.addNumber(i, property, {callback: function(i,v)
						{
							if(i == "start"){
								var dt = v - this.properties[i];
								this.properties.attackPeak += dt;
								this.properties.relax += dt;
							}
							this.properties[i] = v;
						}.bind(this,i)});
					}
				break;
				case Boolean:
					panel.addCheckbox(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
					}.bind(this,i)});
						break;
				case Array:
					panel.addArray(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
					}.bind(this,i)});
						break;
			}
		}
	}
}
//FaceEmotionClip
FaceEmotionClip.type = "faceEmotion";
FaceEmotionClip.emotions = ["HAPPINESS", "SADNESS", "SURPRISE", "FEAR","ANGER","DISGUST", "CONTEMPT"];
function FaceEmotionClip()
{
	this.id= "faceEmotion-"+Math.ceil(getTime());;
	this.start = 0
	this.duration = 1;
	this._width = 0;

	this.properties = {
		amount : 0.5,
		attackPeak : 0.25,
		relax : 0.75,
		emotion : "HAPPINESS", 
	}
	this.color = "black";
	this.font = "40px Arial";

}

FaceEmotionClip.id = ANIM.FACEEMOTION? ANIM.FACEEMOTION:4;
FaceEmotionClip.clip_color = "#00BDFF";
ANIM.registerClipType( FaceEmotionClip );

FaceEmotionClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,

	}
	for(var i in this.properties)
	{
		
		json[i] = this.properties[i];
	}
	return json;
}

FaceEmotionClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.properties.amount = json.amount;
	this.start = json.start;
	this.properties.attackPeak = json.attackPeak;
	this.properties.relax = json.relax;
	this.duration = json.duration;
	this.properties.emotion = json.emotion;
	/*this.properties.permanent = json.permanent;*/

}

FaceEmotionClip.prototype.drawTimeline = function( ctx, w,h, selected )
{
	ctx.globalCompositeOperation =  "source-over";
	var text_info = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( text_info.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}
FaceEmotionClip.prototype.showInfo = function(panel, callback)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		if(i=="emotion"){
			panel.addCombo(i, property,{values: FaceEmotionClip.emotions, callback: function(i,v)
			{
				this.properties[i] = v;
				if(callback)
					callback();
			}.bind(this, i)});
		}
		else
		{
			switch(property.constructor)
			{

				case String:
					panel.addString(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
						if(callback)
							callback();
					}.bind(this, i)});
					break;
				case Number:
					if(i=="amount")
					{
						panel.addNumber(i, property, {min:0, max:1,callback: function(i,v)
						{
							this.properties[i] = v;
							if(callback)
								callback();
						}.bind(this,i)});
					}
					else{
						panel.addNumber(i, property, {callback: function(i,v)
						{
							if(i == "start"){
								var dt = v - this.properties[i];
								this.properties.attackPeak += dt;
								this.properties.relax += dt;
							}
							this.properties[i] = v;
							if(callback)
								callback();
						}.bind(this,i)});
					}
				break;
				case Boolean:
					panel.addCheckbox(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
						if(callback)
							callback();
					}.bind(this,i)});
						break;
				case Array:
					panel.addArray(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
						if(callback)
							callback();
					}.bind(this,i)});
						break;
			}
		}
	}
}
/*----------------------------------Gaze Behaviour-----------------------------------*/
//GazeClip
GazeClip.type = "gaze";
GazeClip.influences = ["EYES", "HEAD", "SHOULDER", "WAIST", "WHOLE"];
GazeClip.directions = ["","RIGHT", "LEFT", "UP", "DOWN", "UPRIGHT", "UPLEFT", "DOWNLEFT", "DOWNRIGHT"];
function GazeClip()
{
	this.id= "gaze-"+Math.ceil(getTime());
	this.start = 0
	this.duration = 1;

	this._width = 0;

	this.properties = {
		target : "",
		ready : 0.25, //if it's not permanent
		relax : 0.75, //if it's not permanent
		influence : "EYES", //[EYES, HEAD, SHOULDER, WAIST, WHOLE](optional)
		offsetAngle : 0.0, //(optional)
		offsetDirection : "RIGHT", //[RIGHT, LEFT, UP, DOWN, UPRIGHT, UPLEFT, DOWNLEFT, DOWNRIGHT](optional)
		base : false
	}
	this.color = "black";
	this.font = "40px Arial";

}

GazeClip.id = ANIM.GAZE? ANIM.GAZE:5;
GazeClip.clip_color = "fuchsia";
ANIM.registerClipType( GazeClip );

GazeClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
		type: "gaze"
	}
	for(var i in this.properties)
	{
		if(i == "base")
		{
			if(this.properties[i])
				json.type = "gazeShift";
			continue;
		}

		json[i] = this.properties[i];
	}
	return json;
}

GazeClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.properties.target = json.target;
	this.start = json.start;
	this.properties.ready = json.ready;
	this.properties.relax = json.relax;
	this.duration = json.duration;
	this.properties.influence = json.influence;
	this.properties.offsetAngle = json.offsetAngle;
	this.properties.offsetDirection = json.offsetDirection;
	/*this.properties.permanent = json.permanent;*/
}

GazeClip.prototype.drawTimeline = function( ctx, w,h, selected )
{
	ctx.globalCompositeOperation =  "source-over";
	var text_info = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( text_info.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}
GazeClip.prototype.showInfo = function(panel)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		if(i=="influence"){
			panel.addCombo(i, property,{values: GazeClip.influences, callback: function(i,v)
			{
				this.properties[i] = v;
			}.bind(this, i)});
		}
		else if(i=="offsetDirection"){
			panel.addCombo(i, property,{values: GazeClip.directions, callback: function(i,v)
			{
				this.properties[i] = v;
			}.bind(this, i)});
		}
		else
		{
			switch(property.constructor)
			{

				case String:
					panel.addString(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
					}.bind(this, i)});
					break;
				case Number:
					if(i=="amount")
					{
						panel.addNumber(i, property, {min:0, max:1,callback: function(i,v)
						{
							this.properties[i] = v;
						}.bind(this,i)});
					}
					else{
						panel.addNumber(i, property, {callback: function(i,v)
						{
							if(i == "start"){
								var dt = v - this.properties[i];
								this.properties.ready += dt;
								this.properties.relax += dt;
							}
							this.properties[i] = v;
						}.bind(this,i)});
					}
					break;
				case Boolean:
					panel.addCheckbox(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
					}.bind(this,i)});
						break;
				case Array:
					panel.addArray(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
					}.bind(this,i)});
						break;
			}
		}
	}
}
/*----------------------------------Gesture Behaviour-----------------------------------*/
//GestureClip
GestureClip.type = "gesture";
GestureClip.modes = ["","LEFT_HAND", "RIGHT_HAND", "BOTH_HANDS"];
function GestureClip()
{
	this.id= "gesture-"+Math.ceil(getTime());;
	this.type = "gesture";
	this.start = 0
	this.duration = 1.75;

	this._width = 0;

	this.properties = {
		lexeme : "",
		mode : "",
		ready : 0.25,
		strokeStart : 0.75,
		stroke : 1,
		strokeEnd : 1.25,
		relax : 1.5,
		target : [0,0,0] //gesture is directed towards that target (optional) for pointing
	}
	this.color = "black";
	this.font = "40px Arial";

}

GestureClip.id = ANIM.GESTURE? ANIM.GESTURE:6;
GestureClip.clip_color = "lime";
ANIM.registerClipType( GestureClip );

GestureClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration
	}
	for(var i in this.properties)
	{
		json[i] = this.properties[i];
	}

	return json;
}

GestureClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.properties.lexeme  = json.lexeme;
	this.start = json.start;
	this.properties.ready = json.ready;
	this.properties.strokeStart = json.strokeStart;
	this.properties.stroke = json.stroke;
	this.properties.strokeEnd = json.strokeEnd;
	this.properties.relax = json.relax;
	this.duration = json.duration;
	this.properties.target = json.target;

}

GestureClip.prototype.drawTimeline = function( ctx, w,h, selected )
{
	//ctx.globalCompositeOperation =  "source-over";
	var text_info = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( text_info.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}
GestureClip.prototype.showInfo = function(panel)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		if(i=="mode"){
			panel.addCombo(i, property,{values: GestureClip.modes, callback: function(i,v)
			{
				this.properties[i] = v;
			}.bind(this, i)});
		}
		else
		{
			switch(property.constructor)
			{

				case String:
					panel.addString(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
					}.bind(this, i)});
					break;
				case Number:
					if(i=="amount")
					{
						panel.addNumber(i, property, {min:0, max:1,callback: function(i,v)
						{
							this.properties[i] = v;
						}.bind(this,i)});
					}
					else{
						panel.addNumber(i, property, {callback: function(i,v)
						{
							if(i == "start"){
								var dt = v - this.properties[i];
								this.properties.ready += dt;
								this.properties.strokeStart += dt;
								this.properties.stroke += dt;
								this.properties.strokeEnd += dt;
								this.properties.relax += dt;
							}
							this.properties[i] = v;
						}.bind(this,i)});
					}
					break;
				case Boolean:
					panel.addCheckbox(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
					}.bind(this,i)});
						break;
				case Array:
					panel.addArray(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
					}.bind(this,i)});
						break;
			}
		}
	}
}
/*----------------------------------Head Behaviour-----------------------------------*/
//HeadClip
HeadClip.type = "head";
HeadClip.lexemes = ["NOD", "SHAKE", "TILT"];
function HeadClip()
{
	this.id= "head-"+Math.ceil(getTime());;

	this.start = 0;
	this.duration = 1.5;

	this._width = 0;

	this.properties = {
		lexeme : HeadClip.lexemes[0], //[NOD,SHAKE, TILD...]
		repetition : 1, //[1,*] (optional)
		amount : 1, //[0,1]
		ready : 0.15,
		strokeStart : 0.5,
		stroke : 0.75,
		strokeEnd : 1,
		relax : 1.15
	}

	this.color = "black";
	this.font = "40px Arial";

}

HeadClip.id = ANIM.HEAD? ANIM.HEAD:7;
HeadClip.clip_color = "yellow";
ANIM.registerClipType( HeadClip );

HeadClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
	}
	for(var i in this.properties)
	{
		json[i] = this.properties[i];
	}
	return json;
}

HeadClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.properties.lexeme = json.lexeme;
	this.properties.repetition = json.repetition;
	this.properties.amount = json.amount;
	this.start = json.start;
	this.properties.ready = json.ready;
	this.properties.strokeStart = json.strokeStart;
	this.properties.stroke = json.stroke;
	this.properties.strokeEnd = json.strokeEnd;
	this.properties.relax = json.relax;
	this.duration = json.duration;
}

HeadClip.prototype.drawTimeline = function( ctx, w,h, selected )
{
	//ctx.globalCompositeOperation =  "source-over";
	var text_info = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( text_info.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}
HeadClip.prototype.showInfo = function(panel)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		if(i=="lexeme"){
			panel.addCombo(i, property,{values: HeadClip.lexemes, callback: function(i,v)
			{
				this.properties[i] = v;
			}.bind(this, i)});
		}
		else
		{
			switch(property.constructor)
			{

				case String:
					panel.addString(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
					}.bind(this, i)});
					break;
				case Number:
					if(i=="amount")
					{
						panel.addNumber(i, property, {min:0, max:1,callback: function(i,v)
						{
							this.properties[i] = v;
						}.bind(this,i)});
					}
					else{
						panel.addNumber(i, property, {callback: function(i,v)
						{
							if(i=="start")
							{
								var dt = v - this.properties[i];
								this.properties.ready += dt;
								this.properties.strokeStart += dt;
								this.properties.stroke += dt;
								this.properties.strokeEnd += dt;
								this.properties.relax += dt;
							}
							this.properties[i] = v;
						}.bind(this,i)});
					}
					break;
				case Boolean:
					panel.addCheckbox(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
					}.bind(this,i)});
						break;
				case Array:
					panel.addArray(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
					}.bind(this,i)});
						break;
			}
		}
	}

}

//HeadDirectionShiftClip
HeadDirectionShiftClip.type = "headDirectionShift";
function HeadDirectionShiftClip()
{
	this.id= "headDir-"+Math.ceil(getTime());
	this.properties = {target : ""}
	this.start = 0;
	this.duration = 0.5;

	this._width = 0;

	this.color = "black";
	this.font = "40px Arial";

}

HeadDirectionShiftClip.id = ANIM.HEADDIRECTION? ANIM.HEADDIRECTION:8;
HeadDirectionShiftClip.clip_color = "orange";
ANIM.registerClipType( HeadDirectionShiftClip );

HeadDirectionShiftClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		target: this.properties.target,
		start: this.start,
		duration: this.duration,
	}

	return json;
}

HeadDirectionShiftClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.properties.target = json.target;
	this.start = json.start;
	this.duration = json.duration;
}

HeadDirectionShiftClip.prototype.drawTimeline = function( ctx, w,h, selected )
{
	ctx.globalCompositeOperation =  "source-over";
	var text_info = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( text_info.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}
/*----------------------------------Posture Behaviour-----------------------------------*/
//PostureClip
PostureClip.type = "posture";
function PostureClip()
{
	this.id= "posture-"+Math.ceil(getTime());

	this.start = 0;
	this.duration = 1;

	this._width = 0;

	this.properties = {
		lexeme : "", //[ARMS_CROSSED,...]
		part : "", //[ARMS, LEFT_ARM, RIGHT_ARM, LEGS...]
		stance : "", //[SITTING, CROUNCHING, STANDING, LYING]
		ready : 0.25, //if it's not permanent
		relax : 0.75, //if it's not permanent
	/*	permanent : false,*/
	}
	this.color = "black";
	this.font = "40px Arial";

}

PostureClip.id = ANIM.POSTURE? ANIM.POSTURE:9;
PostureClip.clip_color = "#7CFF00";
ANIM.registerClipType( PostureClip );

PostureClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
	}
	for(var i in this.properties)
	{
		json[i] = this.properties[i];
	}
	return json;
}

PostureClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.properties.lexeme = json.lexeme;
	this.properties.part = json.part;
	this.properties.stance = json.stance;
	this.start = json.start;
	this.properties.ready = json.ready;
	this.properties.relax = json.relax;
	this.duration = json.duration;
	/*this.properties.permanent = json.permanent;*/
}

PostureClip.prototype.drawTimeline = function( ctx, w,h, selected )
{
	ctx.globalCompositeOperation =  "source-over";
	var text_info = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( text_info.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

/*-------------------------Speech Behaviour---------------------------------*/
//Speech to show captions
SpeechClip.type = "speech";
function SpeechClip()
{
	this.id = "speech-"+ Math.ceil(getTime());
	this.start = 0
	this.duration = 5;

	this._width = 0;

	this.properties = {inherited_text:false, text : ""}
	this.aduioId = null;
	this.color = "black";

  this.clip_color = "#94e9d9";
  //this.icon_id = 37;
}

SpeechClip.id = ANIM.SPEECH;
SpeechClip.clip_color = "#FF0046";
ANIM.registerClipType( SpeechClip );


SpeechClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
	}
	for(var i in this.properties)
	{
		json[i] = this.properties[i];
	}
	return json;
}

SpeechClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.start = json.start;
	this.duration = json.duration;
	this.properties.text = json.text;
	if(this.properties.inherited_text)
		this.properties.inherited_text = json.inherited_text;
	if(json.audioId)
		this.audioId = json.audioId;
}

SpeechClip.prototype.drawTimeline = function( ctx, w,h, selected )
{
	if(this.id == "")
		this.id = this.text;
	var text_info = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
/*	if( text_info.width < (w - 24) )*/
		ctx.fillText( this.id, 24,h * 0.7 );
}
SpeechClip.prototype.showInfo = function(panel)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		if(i=="text"){
			if(this.properties['inherited_text']==false)
			{
				var newPhrase = "";
    			var tags = [];
				var textarea = panel.addTextarea(i, property,{title:"Custom text", callback: function(v, value)
					{
						this.properties[i] = value;
				}.bind(this, i)});
				textarea.id = "custom-textarea";
				textarea.addEventListener("keypress", function(e){
					var that = this;
					/*if(e.key=="Alt"||e.key=="AltGraph" || e.key=="Control"|| e.key=="CapsLock" || e.key=="Backspace")
					  return;*/
					newPhrase =   textarea.getValue();
					if(e.key == "#"){
						autocomplete(textarea, EntitiesManager.getEntities(), tags, {})
						//displayEntity(i, phrase, e, tags)
						newPhrase = e.target.value;
					}
					textarea.setValue( newPhrase );
				}.bind(this));
				continue;
			}
		}
		if(i=="inherited_text")
		{
			var that = this;
			panel.addCheckbox(i, property, {title:"Text from the parent node", id:"inher", callback: function(v)
			{
				that.properties["inherited_text"] = v;
				var text_area = null
				for(var i in this.parentElement.children )
					if(this.parentElement.children[i].id == "custom-textarea")
						text_area = this.parentElement.children[i]
				
				if(v)
					text_area.style.visibility = "hidden";
				else
					text_area.style.visibility = "visible";
			}});
			continue;
		}
		else
		{
			switch(property.constructor)
			{

				case String:
					
					panel.addString(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
					}.bind(this, i)});
					
					break;
				case Number:
					if(i=="amount")
					{
						panel.addNumber(i, property, {min:0, max:1,callback: function(i,v)
						{
							this.properties[i] = v;
						}.bind(this,i)});
					}
					else
					{
						panel.addNumber(i, property, {callback: function(i,v)
						{
							this.properties[i] = v;
						}.bind(this,i)});
					}
					break;
				case Boolean:
					panel.addCheckbox(i, property, {callback: function(i,v, panel)
					{
						this.properties[i] = v;
					}.bind(this,i)});
						break;
				case Array:
					panel.addArray(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
					}.bind(this,i)});
						break;
			}
		}
	}
}

function BaseClip()
{
}

BaseClip.prototype.getProject = function()
{
	if(!this._track)
		return null;
	return this._track._project;
}

BaseClip.prototype.addControlChannel = function(name, type)
{
	if(!this.control_channels)
		this.control_channels = [];
	var cc = new ANIM.ControlChannel();
	cc.name = name;
	cc.type = type;
	this.control_channels.push(cc);
	return cc;
}

//returns value of a CC given a local_time
BaseClip.prototype.getCC = function(name, time, default_value )
{
	if(!this.control_channels)
		return default_value;

	for(var i = 0; i < this.control_channels.length;++i)
	{
		var cc = this.control_channels[i];
		if( cc.name != name )
			continue;
		//sample value
		var prev = null;
		var next = null;
		for(var j = 0; j < cc.values.length; ++j)
		{
			var v = cc.values[j];
			if(v[0] < time)
			{
				prev = v;
				continue;
			}
			next = v;
			break;
		}

		if(!prev && !next)
			return 0; //no data

		if(!prev && next)
			return next[1];

		if(prev && !next)
			return prev[1];

		var f = (time - prev[0]) / (next[0] - prev[0]);
		if(cc.type == ANIM.NUMBER)
			return prev[1] * (1-f) + next[1] * (f);
	}

	return default_value;
}



//AudioClip to playback audios ******************************
function AudioClip()
{
	/** 
	 * 
	 * 
	this.id = "speech-"+ Math.ceil(getTime());
	this.start = 0
	this.duration = 5;
	this._width = 0;
	this.properties = {text : ""}
	this.aduioId = null;
	this.color = "black";
  	this.clip_color = "#94e9d9";
	*/


	this._src = "";
	this.id = "audio-"+ Math.ceil(getTime());
	this.start = 0;
	this.duration = 1;
	this.volume = 0.5;
	this.offset_time = 0;
	this.properties = {url:"", text:""}
	this.position = new Float32Array(2);
	this.scale = new Float32Array([1,1]);
	this.clip_color = "#7c0022";
	this.color = "white";
	this._audio = new Audio();
	this._audio.onloadedmetadata = function(v){this.duration = this._audio.duration}.bind(this)
}
AudioClip.type = "lg"
AudioClip.id = ANIM.AUDIO;
AudioClip.clip_color = "#7c0022";

Object.defineProperty( AudioClip.prototype, "src", {
	set: function(v){
		
		this._src = v;
		this._audio.src = v;
	},
	get: function(){
		return this._src;
	}
});

AudioClip.id = ANIM.AUDIO;
ANIM.registerClipType( AudioClip );


AudioClip.prototype.preload = function( time, is_visible )
{
	if(!is_visible)
		this._audio.currentTime = this.offset_time;
}

AudioClip.prototype.drawTimeline = function( ctx, w,h, selected )
{
	//draw waveform...
	if(this.id == "")
		this.id = this.text;
	var text_info = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	/*	if( text_info.width < (w - 24) )*/
	ctx.fillText( this.id, 24,h * 0.7 );
}

AudioClip.prototype.onLeave = function( player )
{
	this._audio.volume = 0;
}

AudioClip.prototype.isLoading = function()
{
	return this._audio.seeking;
}

AudioClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
	}
	for(var i in this.properties)
	{
		json[i] = this.properties[i];
	}
	return json;
}

AudioClip.prototype.fromJSON = function(json)
{
	this.id = json.id;
	this.start = json.start;
	this.duration = json.duration;
	this.properties.url = json.url;
	this.properties.text = json.text;
	if(json.audioId)
		this.audioId = json.audioId;
}

AudioClip.prototype.showInfo = function(panel)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];

		switch(property.constructor)
		{
			
			case String:
				if(i == "url")
				{
					panel.addString(i, property, {callback: function(i,v)
						{
							this._audio.src = v;
							if(this._src != v)
								this._audio.load();
							this.properties[i] = v;
							this._src = v;
							
						}.bind(this, i)});
				}
				else{
					panel.addString(i, property, {callback: function(i,v)
						{
							this.properties[i] = v;
						}.bind(this, i)});
				}
				
				break;
			case Number:
				if(i=="amount")
				{
					panel.addNumber(i, property, {min:0, max:1,callback: function(i,v)
					{
						this.properties[i] = v;
					}.bind(this,i)});
				}
				else
				{
					panel.addNumber(i, property, {callback: function(i,v)
					{
						this.properties[i] = v;
					}.bind(this,i)});
				}
				break;
			case Boolean:
				panel.addCheckbox(i, property, {callback: function(i,v, panel)
				{
					this.properties[i] = v;
				}.bind(this,i)});
					break;
			case Array:
				panel.addArray(i, property, {callback: function(i,v)
				{
					this.properties[i] = v;
				}.bind(this,i)});
					break;
		}
	}
	
}

//helpers **************************

var seed = 123;
function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}
var noise_data = new Float32Array(1024);
for(var i = 0; i < noise_data.length; ++i)
	noise_data[i] = random();

function noise(t)
{
	var i = (t|0) % 1024;
	if(i < 0) i = 1024 + i;
	var i2 = (i+1) % 1024;
	var f = t-(t|0);
	f = f*f*f*(f*(f*6.0-15.0)+10.0); //exp
	return noise_data[i] * (1-f) + noise_data[i2] * f;
}

ANIM.noise = noise;

function distance(a,b)
{
	var x = b[0] - a[0];
	var y = b[1] - a[1];
	return Math.sqrt(x*x+y*y);
}

function vec2Length(x,y)
{
	return Math.sqrt(x*x+y*y);
}

function replace(target, search, replacement) {
    return target.replace(new RegExp(search, 'g'), replacement);
};

global.getTime = performance.now.bind(performance);


function RGB(r,g,b) { return "rgb(" + Math.floor(Math.clamp(r,0,1)*255) + "," + Math.floor(Math.clamp(g,0,1)*255) + "," + Math.floor(Math.clamp(b,0,1)*255) + ")"; }
function HSL(h,s,L) { return "hsl(" + Math.floor(h*360) + "," + Math.floor(Math.clamp(s,0,1)*100) + "%," + Math.floor(Math.clamp(v,0,1)*100) + "%)"; }
global.RGB = RGB;
global.HSL = HSL;


})(this);
