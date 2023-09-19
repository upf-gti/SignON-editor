"use strict";

//ANIMATE by Javi Agenjo (@tamat) 2018 and modifyed by Eva Valls (2021) to define Agent Behaviors through the time
//************************************
//This file contains the code necessary to define BEHAVIORS (verbal and non-verbal) based on BML standard (Project, Tracks and Clips definitions)
//All the editor features are in timelineEditor.js (TIMELINE_EDITOR)

(function(global){

var ANIM = global.ANIM = {};

ANIM.clipTypes = [];

//blend modes
ANIM.NORMAL = 0;
ANIM.SCREEN = 1;
ANIM.OVERLAY = 2;
ANIM.MULTIPLY = 3;
ANIM.DARKEN = 4;
ANIM.HARD_LIGHT = 5;
ANIM.SOFT_LIGHT = 6;
ANIM.BLEND_MODES = ["Normal","Screen","Overlay","Multiply","Darken","Hard Light","Soft Light"];
ANIM.blendToOperation = {
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

// ANIM.clipTypes = [FaceLexemeClip, FaceFACSClip, FaceEmotionClip, GazeClip, HeadClip, ShoulderRaiseClip, ShoulderHunchClip, BodyMovementClip] ;

ANIM.registerClipType = function(ctor)
{
	var name = ctor.name;
	ANIM.clipTypes[ ctor.id ] = ctor;
	ANIM[ name ] = ctor;
}

// PROJECT ****************************************************
//a project contains tracks, a track contains clips, and a clip could contain frames
function Project()
{
	this.name = "unnamed";

	//timing
	this.mode = ANIM.PAUSED;
	this.currentTime = 0;
	this.duration = 60;
	this.framerate = 30;
	this.volume = 1;
	this.type = ANIM.CANVAS2D;
	this.allowSeeking = true;

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

	this.clipTypes = []; //list of all available clip types

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


Project.prototype.clear = function( skipDefaultTracks )
{
	this.currentTime = 0;

	this.globals = {};
	this.tracks.length = 0;
	this.markers.length = 0;

	this.includes = [];
	this.scripts = {};
	this.fonts = [];
}


Project.prototype.load = function( url, onComplete )
{
	var that = this;
	fetch(url)
	.then(function(response) {
		if(response.status == 404)
		{
			if(onComplete)
				onComplete(null);
		}
		else
		  return response.json();
	}).then( function(data){
		if(data)
			that.fromJSON(data, onComplete);
	});/*.catch(function(err){
		console.error( "error loading project: " + err );
	});
	*/
}

Project.prototype.toJSON = function()
{
	var json = {};

	json.name = this.name;

	json.currentTime = this.currentTime;
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

	this.currentTime = json.currentTime || 0;
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
			var ctorClass = ANIM.clipTypes[ clip.constructor.id ];
			if(clip.constructor === ctorClass)
				continue;
			var newClip = new ctorClass();
			newClip.fromJSON( clip.toJSON() );
			newClip.start = clip.start;
			newClip.duration = clip.duration;
			this.clips[i] = newClip;
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
	this.currentClip = null;
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
		id = clip.missingType;
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
	if( clip.controlChannels )
	{
		data.ccs = [];
		for(var i = 0; i < clip.controlChannels.length; ++i)
			data.ccs.push( clip.controlChannels[i].toJSON() );
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
		var clipData = json.clips[i];
		var clip = ANIM.clipFromJSON( clipData );
		this.add( clip );
	}
}

ANIM.clipFromJSON = function( clipData, clip )
{
	var type = ANIM.clipTypes[ clipData[0] ];
	clip = clip || null;
	if(!clip)
	{
		if(type)
			clip = new type();
		else
		{
			console.error("Clip type id unknown:", clipData[0] );
			clip = new ANIM.MissingClip();
			clip.missingType = clipData[0];
			clip.json = clipData[3];
		}
	}
	clip.start = clipData[1];
	clip.duration = clipData[2];
	if(clip.fromJSON)
		clip.fromJSON( clipData[3] );
	else if( clip.constructor !== ANIM.MissingClip )
		console.warn("Clip without fromJSON: ", clipData[0] );
	var data = clipData[3];

		clip.fadeout = data.fadeout;
	if( data.ccs )
	{
		clip.controlChannels = [];
		for(var i = 0; i < data.ccs.length; ++i)
			clip.controlChannels.push( new ANIM.ControlChannel( data.ccs[i] ) );
	}

	return clip;
}

//used to render the content of this track so it doesnt have to be rendered constantly
Track.prototype.getTempCanvas = function()
{
	if(!this._tempCanvas)
		this._tempCanvas = document.createElement("canvas");
	return this._tempCanvas;
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

FaceLexemeClip.type = "faceLexeme";
FaceLexemeClip.id = ANIM.FACELEXEME? ANIM.FACELEXEME:2;
FaceLexemeClip.clipColor = "cyan";

function FaceLexemeClip(o)
{
	let lexeme = FaceLexemeClip.lexemes[6];
	this.start = 0;
	this.duration = 1;
	this.attackPeak = 0.25;
	this.relax = 0.75;
	
	this.properties = {};
	this.properties.amount = 0.8;
	this.properties.lexeme = lexeme;
	/*permanent : false,*/
	
	
	this._width = 0;
	this.color = "black";
	this.font = "40px Arial";
	this.clipColor = "cyan";
	
	if(o)
		this.configure(o);
	
	this.id = this.properties.lexeme;
	this.updateColor(this.properties.lexeme);
  //this.icon_id = 37;
}

ANIM.registerClipType( FaceLexemeClip );

FaceLexemeClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	this.duration = o.duration || 1;
	this.attackPeak = this.fadein = o.attackPeak || 0.25;
	this.relax = this.fadeout = o.relax || 0.75;
	this.properties.lexeme = o.lexeme || this.properties.lexeme;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
		this.id = this.properties.lexeme;
	}
}

FaceLexemeClip.prototype.updateColor = function(v) 
{
	if(v.includes("LIP") || v.includes("MOUTH") || v.includes("DIMPLER"))
		this.clipColor = 'cyan';
	else if(v.includes("BROW"))
		this.clipColor = 'orange';
	else if(v.includes("CHIN") || v.includes("JAW"))
		this.clipColor = 'purple';
	else if(v.includes("NOSE"))
		this.clipColor = 'yellow';
	else
		this.clipColor = 'green';
}
FaceLexemeClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
		attackPeak: this.attackPeak,
		relax : this.relax,
		type: FaceLexemeClip.type
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
	this.start = json.start;
	this.attackPeak = this.fadein = json.attackPeak;
	this.relax = this.fadeout = json.relax;
	this.duration = json.duration;
	this.properties.lexeme = json.lexeme;
	this.properties.amount = json.amount;
}


FaceLexemeClip.prototype.drawClip = function( ctx, w,h, selected, timeline )
{
	ctx.font = "11px Calibri";
	let textInfo = ctx.measureText( this.id );
	if(timeline && timeline.timeToX)
	{

		let attackX = timeline.secondsToPixels * (this.attackPeak - this.start);
		let relaxX = timeline.secondsToPixels * (this.relax - this.start);
		
		ctx.fillStyle = this.clipColor;
		let color = HexToRgb(ctx.fillStyle);
		color = color.map(x => x*=0.8);
		ctx.fillStyle = 'rgba(' + color.join(',') + ', 1)';
		roundedRect(ctx, 0, 0, attackX, h, 5, 0, true);
		roundedRect(ctx, relaxX, 0, w - relaxX, h, 0, 5, true);
		ctx.globalCompositeOperation = "source-over";
		
	}
	ctx.fillStyle = this.color;
	
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24, h/2 + 11/2);
}

FaceLexemeClip.prototype.showInfo = function(panel, callback)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		if(i=="lexeme"){
			let values = [];
			for(let id in FaceLexemeClip.lexemes) {
				values.push({ value: FaceLexemeClip.lexemes[id], src: "./data/imgs/thumbnails/" + FaceLexemeClip.lexemes[id].toLowerCase() + ".png" })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				if(v.includes("LIP") || v.includes("MOUTH") || v.includes("DIMPLER"))
					this.clipColor = 'cyan';
				else if(v.includes("BROW"))
					this.clipColor = 'orange';
				else if(v.includes("CHIN") || v.includes("JAW"))
					this.clipColor = 'purple';
				else if(v.includes("NOSE"))
					this.clipColor = 'yellow';
				else
					this.clipColor = 'green';

				this.properties[name] = v;
				this.id = v;
				if(callback)
					callback();
				
			}, {filter: true});
		}
		else
		{
			switch(property.constructor)
			{

				case String:
					panel.addText(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;

				case Number:
					if(i=="amount")
					{
						panel.addNumber(i, property, (v, e, name) =>
						{
							this.properties[name] = v;
							if(callback)
								callback();
						},
						{min:0, max:1, step: 0.01});
					}
					else{
						panel.addNumber(i, property, (v, e, name) =>
						{
							if(name == "start"){
								var dt = v - this.properties[name];
								this.properties.attackPeak += dt;
								this.properties.relax += dt;
							}
							this.properties[name] = v;
							if(callback)
								callback();
						});
					}
					break;
				
				case Boolean:
					panel.addCheckbox(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
				
				case Array:
					panel.addArray(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
			}
		}
	}
}
//FaceFACSClip
FaceFACSClip.type = "faceFACS";
FaceFACSClip.sides = ["LEFT", "RIGHT", "BOTH"];

FaceFACSClip.id = ANIM.FACEFACS? ANIM.FACEFACS:3;
FaceFACSClip.clipColor = "#00BDFF";

function FaceFACSClip()
{
	this.id= "faceFACS";
	this.start = 0
	this.duration = 1;
	this._width = 0;

	this.properties = {
		amount : 0.5,
		attackPeak : 0.25,
		relax : 0.75,
		au : 0,
		side : "BOTH", //[LEFT, RIGHT, BOTH](optional)
		shift : false
	}
	this.color = "black";
	this.font = "40px Arial";
	this.clipColor = FaceFACSClip.clipColor;
}

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
		if(i == "shift")
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

FaceFACSClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.globalCompositeOperation =  "source-over";
	var textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
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
FaceEmotionClip.clipColor = "#00BDFF";
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

FaceEmotionClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.globalCompositeOperation =  "source-over";
	var textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
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
//FacePresetClip
FacePresetClip.type = "facePreset";
FacePresetClip.facePreset = ["Yes/No-Question", "Negative", "WH-word Questions", "Topic", "RH-Questions", "Anger", "Happiness", "Fear", "Sadness", "Surprise", "Disgust", "Contempt"];
FacePresetClip.customPresets = {};
function FacePresetClip(o)
{
	let preset = FacePresetClip.facePreset[0];
	this.start = 0;
	this.duration = 1;
	
	this.properties = {};
	this.properties.amount = 0.5;
	this.properties.preset = preset;
	/*permanent : false,*/
	this.clips = [];
	
	this._width = 0;
	this.color = "black";
	this.font = "40px Arial";
	this.clipColor = "green";
	
	if(o)
	this.configure(o);
	
	this.id = this.properties.preset + "-" + Math.ceil(getTime());
	this.addPreset(this.properties.preset)

  //this.icon_id = 37;
}

FacePresetClip.type = "facePreset";
FacePresetClip.id = ANIM.FACEPRESET? ANIM.FACEPRESET:12;
FacePresetClip.clipColor = "green";
ANIM.registerClipType( FacePresetClip );

FacePresetClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	this.duration = o.duration || 1;
	this.properties.preset = o.preset || this.properties.preset;
	if(FacePresetClip.facePreset.indexOf(this.properties.preset) < 0){
		FacePresetClip.facePreset.push(this.properties.preset);
		FacePresetClip.customPresets[this.properties.preset] = [...o.clips];
	}

	if(o.clips)
		this.clips = [...o.clips];
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
		this.id = this.properties.preset + "-" + Math.ceil(getTime());
	}
}
FacePresetClip.prototype.addPreset = function(preset){
	let clip = null;
	switch(preset){
		case "Yes/No-Question":
			// Raise eyebrows
			clip = new FaceLexemeClip({lexeme: "BROW_RAISER", start: this.start, duration: this.duration});
			this.clips.push(clip);
			// Tilt head forward
			break;
		case "Negative":
			// Shake head
			break;
		case "WH-word Questions":
			// Furrows eyebrows
			clip = new FaceLexemeClip({lexeme: "BROW_LOWERER", start: this.start, duration: this.duration});
			this.clips.push(clip);
			// Tilt head forward
			break;
		case "Topic":
			// Raise eyebrows
			clip = new FaceLexemeClip({lexeme: "BROW_RAISER", start: this.start, duration: this.duration});
			this.clips.push(clip);
			// Tilt head backward
			break;
		case "RH-Questions":
			// Raise eyebrows
			clip = new FaceLexemeClip({lexeme: "BROW_RAISER", start: this.start, duration: this.duration});
			this.clips.push(clip);
			// Tilt head backward and to the side
			break;

		case "Anger":
			clip = new FaceLexemeClip({lexeme: "BROW_LOWERER", start: this.start, duration: this.duration, properties: { amount: 1}});
			this.clips.push(clip);

			clip = new FaceLexemeClip({lexeme: "UPPER_LID_RAISER", start: this.start, duration: this.duration, properties: { amount: 1}});
			this.clips.push(clip);

			clip = new FaceLexemeClip({lexeme: "LID_TIGHTENER", start: this.start, duration: this.duration, properties: { amount: 1}});
			this.clips.push(clip);

			clip = new FaceLexemeClip({lexeme: "LIP_TIGHTENER", start: this.start, duration: this.duration, properties: { amount: 0.8}});
			this.clips.push(clip);

			break;

		case "Happiness":
			clip = new FaceLexemeClip({lexeme: "CHEEK_RAISER", start: this.start, duration: this.duration, properties: { amount: 0.3}});
			this.clips.push(clip);

			clip = new FaceLexemeClip({lexeme: "LIP_CORNER_PULLER", start: this.start, duration: this.duration, properties: { amount: 0.8}});
			this.clips.push(clip);
			break;

		case "Sadness":
			clip = new FaceLexemeClip({lexeme: "INNER_BROW_RAISER", start: this.start, duration: this.duration, properties: { amount: 1}});
			this.clips.push(clip);

			clip = new FaceLexemeClip({lexeme: "BROW_LOWERER", start: this.start, duration: this.duration, properties: { amount: 0.8}});
			this.clips.push(clip);

			clip = new FaceLexemeClip({lexeme: "LIP_CORNER_DEPRESSOR", start: this.start, duration: this.duration, properties: { amount: 0.5}});
			this.clips.push(clip);

			break;

		case "Fear":

			clip = new FaceLexemeClip({lexeme: "INNER_BROW_RAISER", start: this.start, duration: this.duration, properties: { amount: 0.8}});
			this.clips.push(clip);

			clip = new FaceLexemeClip({lexeme: "OUTER_BROW_RAISER", start: this.start, duration: this.duration, properties: { amount: 0.8}});
			this.clips.push(clip);

			clip = new FaceLexemeClip({lexeme: "BROW_LOWERER", start: this.start, duration: this.duration, properties: { amount: 1}});
			this.clips.push(clip);

			clip = new FaceLexemeClip({lexeme: "UPPER_LID_RAISER", start: this.start, duration: this.duration, properties: { amount: 1}});
			this.clips.push(clip);

			clip = new FaceLexemeClip({lexeme: "LID_TIGHTENER", start: this.start, duration: this.duration, properties: { amount: 0.8}});
			this.clips.push(clip);

			clip = new FaceLexemeClip({lexeme: "LIP_STRECHER", start: this.start, duration: this.duration, properties: { amount: 0.5}});
			this.clips.push(clip);
			
			clip = new FaceLexemeClip({lexeme: "JAW_DROP", start: this.start, duration: this.duration, properties: { amount: 0.5}});
			this.clips.push(clip);
			break;

		case "Surprise":
			clip = new FaceLexemeClip({lexeme: "INNER_BROW_RAISER", start: this.start, duration: this.duration, properties: { amount: 0.8}});
			this.clips.push(clip);

			clip = new FaceLexemeClip({lexeme: "OUTER_BROW_RAISER", start: this.start, duration: this.duration, properties: { amount: 1}});
			this.clips.push(clip);

			clip = new FaceLexemeClip({lexeme: "UPPER_LID_RAISER", start: this.start, duration: this.duration, properties: { amount: 0.5}});
			this.clips.push(clip);

			clip = new FaceLexemeClip({lexeme: "JAW_DROP", start: this.start, duration: this.duration, properties: { amount: 1}});
			this.clips.push(clip);
			break;

		case "Disgust":
			clip = new FaceLexemeClip({lexeme: "NOSE_WRINKLER", start: this.start, duration: this.duration, properties: { amount: 0.8}});
			this.clips.push(clip);

			clip = new FaceLexemeClip({lexeme: "LIP_CORNER_DEPRESSOR", start: this.start, duration: this.duration, properties: { amount: 0.5}});
			this.clips.push(clip);

			clip = new FaceLexemeClip({lexeme: "CHIN_RAISER", start: this.start, duration: this.duration, properties: { amount: 0.8}});
			this.clips.push(clip);
			break;
		
		case "Contempt":
			clip = new FaceLexemeClip({lexeme: "LIP_CORNER_PULLER_RIGHT", start: this.start, duration: this.duration, properties: { amount: 0.8}});
			this.clips.push(clip);

			clip = new FaceLexemeClip({lexeme: "DIMPLER_RIGHT", start: this.start, duration: this.duration, properties: { amount: 0.5}});
			this.clips.push(clip);

			break;
	
	}
	if(!clip && FacePresetClip.customPresets[preset])
	{
		for(let i = 0; i < FacePresetClip.customPresets[preset].length; i++){
			clip = new FaceLexemeClip(FacePresetClip.customPresets[preset][i]);
			this.clips.push(clip);
		}

	}
	return this.clips;
}

FacePresetClip.prototype.toJSON = function()
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

FacePresetClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.properties.amount = json.amount;
	this.start = json.start;
	this.duration = json.duration;
	this.properties.preset = json.preset;
	/*this.properties.permanent = json.permanent;*/

}

FacePresetClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.globalCompositeOperation =  "source-over";
	var textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

FacePresetClip.prototype.showInfo = function(panel, callback)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		if(i=="emotion"){
			panel.addCombo(i, property,{values: FacePresetClip.presets, callback: function(i,v)
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
GazeClip.influences = ["EYES", "HEAD", "NECK"];
GazeClip.directions = ["", "UPRIGHT", "UPLEFT", "DOWNRIGHT", "DOWNLEFT", "RIGHT", "LEFT", "UP", "DOWN"];
GazeClip.targets = ["UPRIGHT", "UPLEFT", "DOWNRIGHT", "DOWNLEFT", "RIGHT", "LEFT", "UP", "DOWN", "FRONT"];

function GazeClip(o)
{
	this.id= "gaze-"+Math.ceil(getTime());
	this.start = 0
	this.duration = 1;
	this.ready = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		target : "LEFT",		
		influence : "EYES", //[EYES, HEAD, "NECK"](optional)
		offsetAngle : 0.0, //(optional)
		offsetDirection : "", //[RIGHT, LEFT, UP, DOWN, UPRIGHT, UPLEFT, DOWNLEFT, DOWNRIGHT](optional)
		headOnly: true,
		shift : false
	}

	if(o)
		this.configure(o);

	this.color = "black";
	this.font = "40px Arial";

}

GazeClip.id = ANIM.GAZE ? ANIM.GAZE:5;
GazeClip.clipColor = "fuchsia";
ANIM.registerClipType( GazeClip );

GazeClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	this.duration = o.duration || 1;
	if(o.ready) this.ready = this.fadein = o.ready;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
}

GazeClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
		ready: this.ready,
		relax: this.relax,
		type: "gaze"
	}
	for(var i in this.properties)
	{
		if(i == "shift")
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
	this.configure(json);
}

GazeClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.font = "11px Calibri";
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

GazeClip.prototype.showInfo = function(panel, callback)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		let values = [];
		if(i=="influence"){
			for(let id in GazeClip.influences) {
				values.push({ value: GazeClip.influences[id]})
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
	
		}
		else if(i=="offsetDirection"){
			for(let id in GazeClip.directions) {
				values.push({ value: GazeClip.directions[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
			
		}
		else if(i=="target"){
			for(let id in GazeClip.targets) {
				values.push({ value: GazeClip.targets[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
			
		}
		else
		{
			switch(property.constructor)
			{

				case String:
					panel.addText(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;

				case Number:
					if(i=="amount")
					{
						panel.addNumber(i, property, (v, e, name) =>
						{
							this.properties[name] = v;
							if(callback)
								callback();
						},
						{min:0, max:1, step: 0.01});
					}
					else{
						panel.addNumber(i, property, (v, e, name) =>
						{
							if(name == "start"){
								var dt = v - this.properties[name];
								this.properties.attackPeak += dt;
								this.properties.relax += dt;
							}
							this.properties[name] = v;
							if(callback)
								callback();
						});
					}
					break;
				
				case Boolean:
					panel.addCheckbox(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
				
				case Array:
					panel.addArray(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
			}
		}
	}
}


/*----------------------------------Head Behaviour-----------------------------------*/
//HeadClip
HeadClip.type = "head";
HeadClip.lexemes = ["NOD", "SHAKE", "TILT", "TILTLEFT", "TILTRIGHT", "TILTFORWARD", "TILTBACKWARD", "FORWARD", "BACKWARD"];
HeadClip.id = ANIM.HEAD? ANIM.HEAD:7;
HeadClip.clipColor = "yellow";

function HeadClip(o)
{
	this.id= "Head movement";

	this.start = 0;
	this.duration = 1.5;
	this.ready = this.fadein = 0.15;
	this.strokeStart = 0.5;
	this.stroke = 0.75;
	this.strokeEnd = 1;
	this.relax = this.fadeout = 1.1;

	this._width = 0;

	this.properties = {
		lexeme : HeadClip.lexemes[0], //[NOD,SHAKE, TILD...]
		repetition : 1, //[1,*] (optional)
		amount : 1, //[0,1]
	}

	if(o)
		this.configure(o);
	this.color = "black";
	this.font = "40px Arial";
	this.clipColor = HeadClip.clipColor;
}


ANIM.registerClipType( HeadClip );

HeadClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	this.duration = o.duration || 1;
	if(o.ready) this.ready = this.fadein = o.ready;
	if(o.strokeStart) this.strokeStart = o.strokeStart;
	if(o.stroke) this.stroke  = o.stroke ;
	if(o.strokeEnd) this.strokeEnd = o.strokeEnd;
	if(o.relax) this.relax = this.fadeout = o.relax;

	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
}

HeadClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
		ready: this.ready,
		strokeStart: this.strokeStart,
		stroke : this.stroke ,
		strokeEnd: this.strokeEnd,
		relax: this.relax
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
	this.configure(json);
}

HeadClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.font = "11px Calibri";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

HeadClip.prototype.showInfo = function(panel, callback)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		if(i=="lexeme"){
			let values = [];
			for(let id in HeadClip.lexemes) {
				values.push({ value: HeadClip.lexemes[id]})
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
		}
		else
		{
			switch(property.constructor)
			{

				case String:
					panel.addText(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;

				case Number:
					if(i=="amount")
					{
						panel.addNumber(i, property, (v, e, name) =>
						{
							this.properties[name] = v;
							if(callback)
								callback();
						},
						{min:0, max:1, step: 0.01});
					}
					else{
						panel.addNumber(i, property, (v, e, name) =>
						{
							if(name == "start"){
								var dt = v - this.properties[name];
								this.properties.attackPeak += dt;
								this.properties.relax += dt;
							}
							this.properties[name] = v;
							if(callback)
								callback();
						});
					}
					break;
				
				case Boolean:
					panel.addCheckbox(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
				
				case Array:
					panel.addArray(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
			}
		}
	}

}

/** --------- Gesture Behaviour -------------------- */

//ShoulderRaiseClip
ShoulderRaiseClip.type = "gesture";
ShoulderRaiseClip.hands = ["LEFT", "RIGHT", "BOTH"];

ShoulderRaiseClip.id = ANIM.SHOULDERRAISE ? ANIM.SHOULDERRAISE: 6;
ShoulderRaiseClip.clipColor = "red";

function ShoulderRaiseClip(o)
{
	this.id= "Shoulder Raise";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		hand: "right",	
		shoulderRaise : 0.8,	
		shift : false
	}

	if(o)
		this.configure(o);

	this.color = "black";
	this.font = "40px Arial";
	this.clipColor = ShoulderRaiseClip.clipColor;
}

ANIM.registerClipType( ShoulderRaiseClip );

ShoulderRaiseClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	this.duration = o.duration || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
}

ShoulderRaiseClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	for(var i in this.properties)
	{
		if(i == "shift")
		{
			if(this.properties[i])
				json.type = "gesture";
			continue;
		}

		json[i] = this.properties[i];
	}
	return json;
}

ShoulderRaiseClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.configure(json);
}

ShoulderRaiseClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.font = "11px Calibri";
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

ShoulderRaiseClip.prototype.showInfo = function(panel, callback)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		let values = [];
		if(i=="hand"){
			for(let id in ShoulderRaiseClip.hands) {
				values.push({ value: ShoulderRaiseClip.hands[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v.toLowerCase();
				if(callback)
					callback();
				
			}, {filter: true});
			
		}
		else
		{
			switch(property.constructor)
			{

				case String:
					panel.addText(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;

				case Number:
					if(i=="shoulderRaise")
					{
						panel.addNumber(i, property, (v, e, name) =>
						{
							this.properties[name] = v;
							if(callback)
								callback();
						},
						{min:0, max:1, step: 0.01});
					}
					else{
						panel.addNumber(i, property, (v, e, name) =>
						{
							if(name == "start"){
								var dt = v - this.properties[name];
								this.properties.attackPeak += dt;
								this.properties.relax += dt;
							}
							this.properties[name] = v;
							if(callback)
								callback();
						});
					}
					break;
				
				case Boolean:
					panel.addCheckbox(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
				
				case Array:
					panel.addArray(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
			}
		}
	}
}

//ShoulderHunchClip
ShoulderHunchClip.type = "gesture";
ShoulderHunchClip.hands = ["LEFT", "RIGHT", "BOTH"];
ShoulderHunchClip.id = ANIM.SHOULDERHUNCH ? ANIM.SHOULDERHUNCH: 7;
ShoulderHunchClip.clipColor = "red";

function ShoulderHunchClip(o)
{
	this.id= "Shoulder Hunch";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent

	this._width = 0;

	this.properties = {
		hand: "right",	
		shoulderHunch : 0.8,	
		shift : false
	}

	if(o)
		this.configure(o);

	this.color = "black";
	this.font = "40px Arial";
	this.clipColor = ShoulderHunchClip.clipColor;
}

ANIM.registerClipType( ShoulderHunchClip );

ShoulderHunchClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	this.duration = o.duration || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
}

ShoulderHunchClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	for(var i in this.properties)
	{
		if(i == "shift")
		{
			if(this.properties[i])
				json.type = "gesture";
			continue;
		}

		json[i] = this.properties[i];
	}
	return json;
}

ShoulderHunchClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.configure(json);
}

ShoulderHunchClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.font = "11px Calibri";
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

ShoulderHunchClip.prototype.showInfo = function(panel, callback)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		let values = [];
		if(i=="hand"){
			for(let id in ShoulderHunchClip.hands) {
				values.push({ value: ShoulderHunchClip.hands[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
			
		}
		else
		{
			switch(property.constructor)
			{

				case String:
					panel.addText(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;

				case Number:
					if(i=="shoulderHunch")
					{
						panel.addNumber(i, property, (v, e, name) =>
						{
							this.properties[name] = v;
							if(callback)
								callback();
						},
						{min:0, max:1, step: 0.01});
					}
					else{
						panel.addNumber(i, property, (v, e, name) =>
						{
							if(name == "start"){
								var dt = v - this.properties[name];
								this.properties.attackPeak += dt;
								this.properties.relax += dt;
							}
							this.properties[name] = v;
							if(callback)
								callback();
						});
					}
					break;
				
				case Boolean:
					panel.addCheckbox(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
				
				case Array:
					panel.addArray(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
			}
		}
	}
}

//BodyMovementClip
BodyMovementClip.type = "gesture";
BodyMovementClip.movements = {"Tilt forward": "TF", "Tilt backward": "TB", "Tilt left": "TL", "Tilt right": "TR", "Rotate left": "RL", "Rotate right": "RR"};
BodyMovementClip.hands = ["LEFT", "RIGHT", "BOTH"];
BodyMovementClip.id = ANIM.BODYMOVEMENT ? ANIM.BODYMOVEMENT: 8;
BodyMovementClip.clipColor = "lima";

function BodyMovementClip(o)
{
	this.id= "Body Movement";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		hand: "right",
		bodyMovement : "TF",	
		amount: 1,	
		shift : false
	}

	if(o)
		this.configure(o);

	this.color = "black";
	this.font = "40px Arial";
	this.clipColor = BodyMovementClip.clipColor;
}

ANIM.registerClipType( BodyMovementClip );

BodyMovementClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	this.duration = o.duration || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
}

BodyMovementClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	for(var i in this.properties)
	{
		if(i == "shift")
		{
			if(this.properties[i])
				json.type = "gesture";
			continue;
		}

		json[i] = this.properties[i];
	}
	return json;
}

BodyMovementClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.configure(json);
}

BodyMovementClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.font = "11px Calibri";
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

BodyMovementClip.prototype.showInfo = function(panel, callback)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		let values = [];
		if(i=="hand"){
			for(let id in BodyMovementClip.hands) {
				values.push({ value: BodyMovementClip.hands[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
			
		}
		else if(i=="bodyMovement"){
			for(let id in BodyMovementClip.movements) {
				values.push({ value: id })
			}
			panel.addDropdown(i, values, Object.keys(BodyMovementClip.movements).find(key => BodyMovementClip.movements[key] === property), (v, e, name) => {
				
				this.properties[name] = BodyMovementClip.movements[v];
				if(callback)
					callback();
				
			}, {filter: true});
			
		}
		else
		{
			switch(property.constructor)
			{

				case String:
					panel.addText(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;

				case Number:
					if(i=="amount")
					{
						panel.addNumber(i, property, (v, e, name) =>
						{
							this.properties[name] = v;
							if(callback)
								callback();
						},
						{min:0, max:1, step: 0.01});
					}
					else{
						panel.addNumber(i, property, (v, e, name) =>
						{
							if(name == "start"){
								var dt = v - this.properties[name];
								this.properties.attackPeak += dt;
								this.properties.relax += dt;
							}
							this.properties[name] = v;
							if(callback)
								callback();
						});
					}
					break;
				
				case Boolean:
					panel.addCheckbox(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
				
				case Array:
					panel.addArray(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
			}
		}
	}
}

//BodyLocationClip
BodyLocationClip.type = "gesture";
BodyLocationClip.locations = ["head", "headtop", "forehead", "nose", "belownose", "chin", "underchin", "mouth", "earlobe", "earlobeR", "earlobeL", "ear ", "earR", "earL", "cheek ", "cheekR", "cheekL", "eye ", "eyeR", "eyeL", "eyebrow ", "eyebrowL", "eyebrowR", "mouth", "chest", "shoulderLine", "shoulder", "shoulderR", "shoulderL", "stomach", "belowstomach", "neutral"];
BodyLocationClip.sides = { "Right": "rr", "Slightly right": "r", "Left": "ll", "Slightly left": "l"};
BodyLocationClip.hands = ["LEFT", "RIGHT", "BOTH"];

BodyLocationClip.id = ANIM.BODYLOCATION ? ANIM.BODYLOCATION: ANIM.clipTypes.length;
BodyLocationClip.clipColor = "lima";

function BodyLocationClip(o)
{
	this.id= "Body Location";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		hand: "right",
		locationBodyArm : "chest",	
		secondLocationBodyArm: "chest",
		// optionals
		secondLocationBodyArm: "chest", // string
		side: "rr", // string, chooses a point to the right, slightly right, slightly left or left of the chosen point
		secondSide: "l", // string
	
		distance: 0, // [0,1] how far from the body to locate the hand. 0 = close, 1 = arm extended
		displace: "u", // string, 26 directions. Location will be offseted into that direction
		displaceDistance: 0.05, // number how far to move to the indicated side. Metres 
	 
		elbowRaise: 10, // in degrees. Positive values raise the elbow.
	
		//Following attributes describe which part of the hand will try to reach the locationBodyArm location 
		srcContact: "1PadPalmar", //source contact location in a single variable. Strings must be concatenate as srcFinger + srcLocation + srcSide (whenever each variable is needed). Afterwards, there is no need to use srcFinger, srcLocation or srcSide
		srcFinger: "1", // 1,2,3,4,5, see handconstellation for more information
		srcLocation: "Pad", // see handconstellation hand locations
		srcSide: "Palmar", // see handconstellation sides
		keepUpdatingContact: false, // once peak is reached, the location will be updated only if this is true. 
					// i.e.: set to false; contact tip of index; reach destination. Afterwards, changing index finger state will not modify the location
					// i.e.: set to true; contact tip of index; reach destination. Afterwards, changing index finger state (handshape) will make the location change depending on where the tip of the index is  
	
		shift: false, // contact information ( srcFinger, srcLocation, srcSide ) is not kept for shift
	}

	if(o)
		this.configure(o);

	this.color = "black";
	this.font = "11px Calibri";
	this.clipColor = BodyLocationClip.clipColor;
}

ANIM.registerClipType( BodyLocationClip );

BodyLocationClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	this.duration = o.duration || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
}

BodyLocationClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	for(var i in this.properties)
	{
		if(i == "shift")
		{
			if(this.properties[i])
				json.type = "gesture";
			continue;
		}

		json[i] = this.properties[i];
	}
	return json;
}

BodyLocationClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.configure(json);
}

BodyLocationClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.font = "11px Calibri";
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

BodyLocationClip.prototype.showInfo = function(panel, callback)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		let values = [];
		if(i=="hand"){
			for(let id in BodyLocationClip.hands) {
				values.push({ value: BodyLocationClip.hands[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
			
		}
		else if(i=="locationBodyArm" || i=="secondLocationBodyArm"){
			for(let id in BodyLocationClip.locations) {
				values.push({ value: BodyLocationClip.locations[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
			
		} 
		else if(i=="side" || i=="secondSide"){
				values = [];
				for(let id in BodyLocationClip.sides) {
					values.push({ value: id })
				}
				panel.addDropdown(i, values, Object.keys(BodyLocationClip.sides).find(key => BodyLocationClip.sides[key] === property), (v, e, name) => {
					
					this.properties[name] = BodyLocationClip.sides[v];
					if(callback)
						callback();
					
				}, {filter: true});

		} 
		else if(i=="srcFinger"){

			panel.addDropdown(i, ["1", "2", "3", "4", "5"], property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
		} 
		else {
			switch(property.constructor)
			{

				case String:
					panel.addText(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;

				case Number:
					if(i=="amount")
					{
						panel.addNumber(i, property, (v, e, name) =>
						{
							this.properties[name] = v;
							if(callback)
								callback();
						},
						{min:0, max:1, step: 0.01});
					}
					else if(i=="elbowRaise")
					{
						panel.addNumber(i, property, (v, e, name) =>
						{
							this.properties[name] = v;
							if(callback)
								callback();
						},
						{min:-360, max:360, step: 0.1});
					}
					else{
						panel.addNumber(i, property, (v, e, name) =>
						{
							if(name == "start"){
								var dt = v - this.properties[name];
								this.properties.attackPeak += dt;
								this.properties.relax += dt;
							}
							this.properties[name] = v;
							if(callback)
								callback();
						});
					}
					break;
				
				case Boolean:
					panel.addCheckbox(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
				
				case Array:
					panel.addArray(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
			}
		}
	}
}

//PalmOrientationClip
PalmOrientationClip.type = "gesture";
PalmOrientationClip.hands = ["LEFT", "RIGHT", "BOTH"];

PalmOrientationClip.id = ANIM.PALMORIENTATION ? ANIM.PALMORIENTATION: ANIM.clipTypes.length;
PalmOrientationClip.clipColor = "lima";

function PalmOrientationClip(o)
{
	this.id= "Palm Orientation";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		hand: "right",
		palmor: "u", //string 8 directions. Relative to arm (not to world coordinates )
    
		// optionals
		secondPalmor: "l", // string 8 directions. Will compute midpoint between palmor and secondPalmor.
		shift: false 
	}

	if(o)
		this.configure(o);

	this.color = "black";
	this.font = "11px Calibri";
	this.clipColor = PalmOrientationClip.clipColor;
}

ANIM.registerClipType( PalmOrientationClip );

PalmOrientationClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	this.duration = o.duration || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
}

PalmOrientationClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	for(var i in this.properties)
	{
		if(i == "shift")
		{
			if(this.properties[i])
				json.type = "gesture";
			continue;
		}

		json[i] = this.properties[i];
	}
	return json;
}

PalmOrientationClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.configure(json);
}

PalmOrientationClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.font = "11px Calibri";
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

PalmOrientationClip.prototype.showInfo = function(panel, callback)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		let values = [];
		if(i=="hand"){
			for(let id in PalmOrientationClip.hands) {
				values.push({ value: PalmOrientationClip.hands[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
			
		}
		else {
			switch(property.constructor)
			{

				case String:
					panel.addText(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;

				case Number:
					if(i=="elbowRaise")
					{
						panel.addNumber(i, property, (v, e, name) =>
						{
							this.properties[name] = v;
							if(callback)
								callback();
						},
						{min:-360, max:360, step: 0.1});
					}
					else{
						panel.addNumber(i, property, (v, e, name) =>
						{
							if(name == "start"){
								var dt = v - this.properties[name];
								this.properties.attackPeak += dt;
								this.properties.relax += dt;
							}
							this.properties[name] = v;
							if(callback)
								callback();
						});
					}
					break;
				
				case Boolean:
					panel.addCheckbox(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
				
				case Array:
					panel.addArray(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
			}
		}
	}
}


//ExtfidirClip
ExtfidirClip.type = "gesture";
ExtfidirClip.hands = ["LEFT", "RIGHT", "BOTH"];

ExtfidirClip.id = ANIM.PALMORIENTATION ? ANIM.PALMORIENTATION: ANIM.clipTypes.length;
ExtfidirClip.clipColor = "lima";

function ExtfidirClip(o)
{
	this.id= "Extfidir";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		hand: "right",
		extfidir: "l", // string  26 directions
    
		// optionals
		secondExtfidir: "l", // string 26 directions. Will compute midpoint between extifidir and secondExtfidir  
		shift: false, // optional
	}

	if(o)
		this.configure(o);

	this.color = "black";
	this.font = "11px Calibri";
	this.clipColor = ExtfidirClip.clipColor;
}

ANIM.registerClipType( ExtfidirClip );

ExtfidirClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	this.duration = o.duration || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
}

ExtfidirClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	for(var i in this.properties)
	{
		if(i == "shift")
		{
			if(this.properties[i])
				json.type = "gesture";
			continue;
		}

		json[i] = this.properties[i];
	}
	return json;
}

ExtfidirClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.configure(json);
}

ExtfidirClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.font = "11px Calibri";
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

ExtfidirClip.prototype.showInfo = function(panel, callback)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		let values = [];
		if(i=="hand"){
			for(let id in ExtfidirClip.hands) {
				values.push({ value: ExtfidirClip.hands[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
			
		}
		else {
			switch(property.constructor)
			{

				case String:
					panel.addText(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;

				case Number:
					panel.addNumber(i, property, (v, e, name) =>
					{
						if(name == "start"){
							var dt = v - this.properties[name];
							this.properties.attackPeak += dt;
							this.properties.relax += dt;
						}
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
				
				case Boolean:
					panel.addCheckbox(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
				
				case Array:
					panel.addArray(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
			}
		}
	}
}


//HandshapeClip
HandshapeClip.type = "gesture";
HandshapeClip.handshapes = ["fist", "finger2", "finger23", "finger23spread", "finger2345", "flat", "pinch12", "pinch12open", "pinchall", "ceeall", "cee12", "cee12open"];
HandshapeClip.thumbshapes = ["default", "out", "opposed", "across", "touch"];
HandshapeClip.bendstates = ["straight", "halfbent", "bent", "round", "hooked", "dblbent", "dblhooked"];
HandshapeClip.hands = ["LEFT", "RIGHT", "BOTH"];


HandshapeClip.id = ANIM.HANDSHAPE ? ANIM.HANDSHAPE: ANIM.clipTypes.length;
HandshapeClip.clipColor = "lima";

function HandshapeClip(o)
{
	this.id= "Handshape";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		hand: "right",
		handshape: "flat", //string from the handshape table
		
		// optionals
		secondHandshape: "flat", //string from the handshape table
		thumbshape: "touch", //string from thumbshape table. if not present, the predefined thumbshape for the handshape will be used
		secondThumbshape: "touch", // string from thumbshape table. Applied to secondHandshape
		tco: 0.3, // number [0,1]. Thumb Combination Opening from the Hamnosys specification 
		secondtco: 0.3, // number [0,1]. Thumb Combination Opening from the Hamnosys specification. Applied to secondHandshape
		
		mainBend: "hooked", // bend applied to selected fingers from the default handshapes. Basic handshapes and ThumbCombination handshapes behave differently. Value from the bend table
		secondMainBend: "hooked", // mainbend applied to secondHandshape
		bend1: "099", // overrides any other bend applied for this handshape for this finger. bend1=thumb, bend2=index, and so on. The value is one from the bend table
		mainSplay: 0.5, // number [-1,1]. Separates laterally fingers 2,4,5. Splay diminishes the more the finger is bent
		splay1: 0.5, // number [-1,1]. Sepparates laterally the specified finger. Splay diminishes the finger is bent. splay1=thumb, splay2=index, and so on
		shift: false,
	}

	if(o)
		this.configure(o);

	this.color = "black";
	this.font = "11px Calibri";
	this.clipColor = HandshapeClip.clipColor;
}

ANIM.registerClipType( HandshapeClip );

HandshapeClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	this.duration = o.duration || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
}

HandshapeClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	for(var i in this.properties)
	{
		if(i == "shift")
		{
			if(this.properties[i])
				json.type = "gesture";
			continue;
		}

		json[i] = this.properties[i];
	}
	return json;
}

HandshapeClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.configure(json);
}

HandshapeClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.font = "11px Calibri";
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

HandshapeClip.prototype.showInfo = function(panel, callback)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		let values = [];
		if(i=="hand"){
			for(let id in HandshapeClip.hands) {
				values.push({ value: HandshapeClip.hands[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
			
		}
		else if(i=="handshape" || i=="secondHandshape"){
			values = [];
			for(let id in HandshapeClip.handshapes) {
				values.push({ value: HandshapeClip.handshapes[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
			
		} 
		else if(i=="thumbshape" || i=="secondThumbshape"){
				values = [];
				for(let id in HandshapeClip.thumbshapes) {
					values.push({ value: HandshapeClip.thumbshapes[id] })
				}
				panel.addDropdown(i, values, property, (v, e, name) => {
					
					this.properties[name] = v;
					if(callback)
						callback();
					
				}, {filter: true});

		} 
		else if(i=="mainBend" || i=="secondMainBend"){

			values = [];
			for(let id in HandshapeClip.bendstates) {
				values.push({ value: HandshapeClip.bendstates[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});

	} 
		else {
			switch(property.constructor)
			{

				case String:
					panel.addText(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;

				case Number:
					panel.addNumber(i, property, (v, e, name) =>
					{
						if(name == "start"){
							var dt = v - this.properties[name];
							this.properties.attackPeak += dt;
							this.properties.relax += dt;
						}
						this.properties[name] = v;
						if(callback)
							callback();
					});
					
					break;
				
				case Boolean:
					panel.addCheckbox(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
				
				case Array:
					panel.addArray(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
			}
		}
	}
}


//HandConstellationClip
HandConstellationClip.type = "gesture";
HandConstellationClip.sides = ["Right", "Left", "Ulnar", "Radial", "Front", "Back", "Palmar"];
HandConstellationClip.handlocations = ["Tip", "Pad", "Mid", "Base", "Thumbball", "Hand", "Wrist"];
HandConstellationClip.armlocations = ["Forearm", "Elbow", "Upperarm"];
HandConstellationClip.hands = ["LEFT", "RIGHT", "BOTH"];


HandConstellationClip.id = ANIM.HANDSHAPE ? ANIM.HANDSHAPE: ANIM.clipTypes.length;
HandConstellationClip.clipColor = "lima";

function HandConstellationClip(o)
{
	this.id= "Hand Constellation";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		hand: "right",
		handConstellation: true,
		//Location of the hand in the specified hand (or dominant hand)
		srcContact: "2PadBack", // source contact location in a single variable. Strings must be concatenate as srcFinger + srcLocation + srcSide (whenever each variable is needed). Afterwards, there is no need to use srcFinger, srcLocation or srcSide
		srcFinger: "2", // 1,2,3,4,5. If the location does not use a finger, do not include this
		srcLocation: "Pad", // string from hand locations (although no forearm, elbow, upperarm are valid inputs here)
		srcSide: "Back", // Ulnar, Radial, Palmar, Back
		
		//Location of the hand in the unspecified hand (or non dominant hand)
		dstContact: "2Tip", // source contact location in a single variable. Strings must be concatenate as dstFinger + dstLocation + dstSide (whenever each variable is needed). Afterwards, there is no need to use dstFinger, dstLocation or dstSide
		dstFinger: "2", // 1,2,3,4,5. If the location does not use a finger, do not include this
		dstLocation: "Base", // string from hand locations or arm locations
		dstSide: "Palmar", // Ulnar, Radial, Palmar, Back 
		
		hand: "dom", // if hand=="both", both hand will try to reach each other, meeting in the middle. Otherwise, only the specified hand will move.

		// optionals
		distance: 0, //[-ifinity,+ifninity] where 0 is touching and 1 is the arm size. Distance between endpoints. 
		distanceDirection: "l", // string, any combination of the main directions. If not provided, defaults to horizontal outwards direction
		
		keepUpdatingContact: false, // once peak is reached, the location will be updated only if this is true. 
						// i.e.: set to false; contact tip of index; reach destination. Afterwards, changing index finger state will not modify the location
						// i.e.: set to true; contact tip of index; reach destination. Afterwards, changing index finger state (handshape) will make the location change depending on where the tip of the index is  
	}

	if(o)
		this.configure(o);

	this.color = "black";
	this.font = "11px Calibri";
	this.clipColor = HandConstellationClip.clipColor;
}

ANIM.registerClipType( HandConstellationClip );

HandConstellationClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	this.duration = o.duration || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
}

HandConstellationClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	for(var i in this.properties)
	{
		if(i == "shift")
		{
			if(this.properties[i])
				json.type = "gesture";
			continue;
		}

		json[i] = this.properties[i];
	}
	return json;
}

HandConstellationClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.configure(json);
}

HandConstellationClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.font = "11px Calibri";
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

HandConstellationClip.prototype.showInfo = function(panel, callback)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		let values = [];
		if(i=="hand"){
			for(let id in HandConstellationClip.hands) {
				values.push({ value: HandConstellationClip.hands[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
			
		}
		else if(i=="srcSide" || i=="dstSide"){
			values = [];
			for(let id in HandConstellationClip.sides) {
				values.push({ value: HandConstellationClip.sides[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
			
		} 
		else if(i=="srcLocation" ){
				values = [];
				for(let id in HandConstellationClip.handlocations) {
					values.push({ value: HandConstellationClip.handlocations[id] })
				}
				panel.addDropdown(i, values, property, (v, e, name) => {
					
					this.properties[name] = v;
					if(callback)
						callback();
					
				}, {filter: true});

		} 
		else if(i=="dstLocation"){

			values = [];
			for(let id in HandConstellationClip.armlocations) {
				values.push({ value: HandConstellationClip.armlocations[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});

		} 
		else if(i=="srcFinger" || i == "dstFinger"){

			panel.addDropdown(i, ["1", "2", "3", "4", "5"], property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
		}
		else {
			switch(property.constructor)
			{

				case String:
					panel.addText(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;

				case Number:
					panel.addNumber(i, property, (v, e, name) =>
					{
						if(name == "start"){
							var dt = v - this.properties[name];
							this.properties.attackPeak += dt;
							this.properties.relax += dt;
						}
						this.properties[name] = v;
						if(callback)
							callback();
					});
					
					break;
				
				case Boolean:
					panel.addCheckbox(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
				
				case Array:
					panel.addArray(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
			}
		}
	}
}


//CircularMotionClip
CircularMotionClip.type = "gesture";
CircularMotionClip.hands = ["LEFT", "RIGHT", "BOTH"];

CircularMotionClip.id = ANIM.CIRCULARMOTION ? ANIM.CIRCULARMOTION: ANIM.clipTypes.length;
CircularMotionClip.clipColor = "lima";

function CircularMotionClip(o)
{
	this.id= "Circular Motion";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		hand: "right",
		motion: "circular",
		direction: "o", // string 26 directions. Axis of rotation
		
		// optionals
		secondDirection: "l", // string 8 directions. Will compute midpoint between direction and secondDirection.
		distance: 0.05, // number, radius in metres of the circle. Default 0.05 m (5 cm)
		startAngle: 0, // where in the circle to start. 0º indicates up. Indicated in degrees. Default to 0º. [-infinity, +infinity]
		endAngle: 360, // where in the circle to finish. 0º indicates up. Indicated in degrees. Default to 360º. [-infinity, +infinity]
		zigzag: "l", // string 26 directions
		zigzagSize: 0.05, // amplitude of zigzag (from highest to lowest point) in metres. Default 0.01 m (1 cm)
		zigzagSpeed: 3, // oscillations per second. Default 2
	}

	if(o)
		this.configure(o);

	this.color = "black";
	this.font = "11px Calibri";
	this.clipColor = CircularMotionClip.clipColor;
}

ANIM.registerClipType( CircularMotionClip );

CircularMotionClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	this.duration = o.duration || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
}

CircularMotionClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	for(var i in this.properties)
	{
		if(i == "shift")
		{
			if(this.properties[i])
				json.type = "gesture";
			continue;
		}

		json[i] = this.properties[i];
	}
	return json;
}

CircularMotionClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.configure(json);
}

CircularMotionClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.font = "11px Calibri";
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

CircularMotionClip.prototype.showInfo = function(panel, callback)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		let values = [];
		if(i=="hand"){
			for(let id in CircularMotionClip.hands) {
				values.push({ value: CircularMotionClip.hands[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
			
		}
		else {
			switch(property.constructor)
			{

				case String:
					panel.addText(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					}, {disabled: i=="motion"});
					break;

				case Number:
					panel.addNumber(i, property, (v, e, name) =>
					{
						if(name == "start"){
							var dt = v - this.properties[name];
							this.properties.attackPeak += dt;
							this.properties.relax += dt;
						}
						this.properties[name] = v;
						if(callback)
							callback();
					});
					
					break;
				
				case Boolean:
					panel.addCheckbox(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
				
				case Array:
					panel.addArray(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
			}
		}
	}
}

//WristMotionClip
WristMotionClip.type = "gesture";
WristMotionClip.modes = ["LEFT", "RIGHT", "BOTH"];
WristMotionClip.sides = ["nod", "nodding", "swing", "swinging", "twist", "twisting", "stirCW", "stircw", "stirCCW", "stirccw", "all"];

WristMotionClip.id = ANIM.WRISTMOTION ? ANIM.WRISTMOTION: ANIM.clipTypes.length;
WristMotionClip.clipColor = "lima";

function WristMotionClip(o)
{
	this.id= "Wrist Motion";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		hand: "right",
		motion: "wrist",
		mode: "nod",
		/* either a: 
			- string from [ "nod", "nodding", "swing", "swinging", "twist", "twisting", "stirCW", "stircw", "stirCCW", "stirccw", "all" ]
			- or a value from [ 0 = None, 1 = twist, 2 = nod, swing = 4 ]. 
		Several values can co-occur by using the OR (|) operator. I.E. ( 2 | 4 ) = stirCW
		Several values can co-occur by summing the values. I.E. ( 2 + 4 ) = stirCW
		*/

		// optionals
		speed: 3, // oscillations per second. Negative values accepted. Default 3. 
		intensity: 0.3, // [0,1]. Default 0.3
	}

	if(o)
		this.configure(o);

	this.color = "black";
	this.font = "11px Calibri";
	this.clipColor = WristMotionClip.clipColor;
}

ANIM.registerClipType( WristMotionClip );

WristMotionClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	this.duration = o.duration || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
}

WristMotionClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	for(var i in this.properties)
	{
		if(i == "shift")
		{
			if(this.properties[i])
				json.type = "gesture";
			continue;
		}

		json[i] = this.properties[i];
	}
	return json;
}

WristMotionClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.configure(json);
}

WristMotionClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.font = "11px Calibri";
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

WristMotionClip.prototype.showInfo = function(panel, callback)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		let values = [];
		if(i=="hand"){
			for(let id in WristMotionClip.hands) {
				values.push({ value: WristMotionClip.hands[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
			
		}
		else if(i=="mode"){
			values = [];
			for(let id in WristMotionClip.modes) {
				values.push({ value: WristMotionClip.modes[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
			
		} 
		else {
			switch(property.constructor)
			{

				case String:
					panel.addText(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					}, {disabled: i=="motion"});
					break;

				case Number:
					let options = {};
					if(i == "intensity") {
						options.min = 0;
						options.max = 1;
					}
					panel.addNumber(i, property, (v, e, name) =>
					{
						if(name == "start"){
							var dt = v - this.properties[name];
							this.properties.attackPeak += dt;
							this.properties.relax += dt;
						}
						this.properties[name] = v;
						if(callback)
							callback();
					}, options);
					
					break;
				
				case Boolean:
					panel.addCheckbox(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
				
				case Array:
					panel.addArray(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
			}
		}
	}
}

//FingerplayMotionClip
FingerplayMotionClip.type = "gesture";
FingerplayMotionClip.sides = ["Right", "Left", "Ulnar", "Radial", "Front", "Back", "Palmar"];
FingerplayMotionClip.handlocations = ["Tip", "Pad", "Mid", "Base", "Thumbball", "Hand", "Wrist"];
FingerplayMotionClip.armlocations = ["Forearm", "Elbow", "Upperarm"];
FingerplayMotionClip.hands = ["LEFT", "RIGHT", "BOTH"];


FingerplayMotionClip.id = ANIM.FINGERPLAYMOTION ? ANIM.FINGERPLAYMOTION: ANIM.clipTypes.length;
FingerplayMotionClip.clipColor = "lima";

function FingerplayMotionClip(o)
{
	this.id= "Fingerplay Motion";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		hand: "right",
		
		motion: "fingerplay",

		// optionals
		speed: 2, // oscillations per second. Default 3
		intensity: 0.5, //[0,1]. Default 0.3
		fingers: "13", // string with numbers. Each number present activates a finger. 2=index, 3=middle, 4=ring, 4=pinky. I.E. "234" activates index, middle, ring but not pinky. Default all enabled
		exemptedFingers: "2", //string with numbers. Blocks a finger from doing the finger play. Default all fingers move
	
	}

	if(o)
		this.configure(o);

	this.color = "black";
	this.font = "11px Calibri";
	this.clipColor = FingerplayMotionClip.clipColor;
}

ANIM.registerClipType( FingerplayMotionClip );

FingerplayMotionClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	this.duration = o.duration || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
}

FingerplayMotionClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		duration: this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	for(var i in this.properties)
	{
		if(i == "shift")
		{
			if(this.properties[i])
				json.type = "gesture";
			continue;
		}

		json[i] = this.properties[i];
	}
	return json;
}

FingerplayMotionClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.configure(json);
}

FingerplayMotionClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.font = "11px Calibri";
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

FingerplayMotionClip.prototype.showInfo = function(panel, callback)
{
	for(var i in this.properties)
	{
		var property = this.properties[i];
		let values = [];
		if(i=="hand"){
			for(let id in FingerplayMotionClip.hands) {
				values.push({ value: FingerplayMotionClip.hands[id] })
			}
			panel.addDropdown(i, values, property, (v, e, name) => {
				
				this.properties[name] = v;
				if(callback)
					callback();
				
			}, {filter: true});
			
		}
		else {
			switch(property.constructor)
			{

				case String:
					panel.addText(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					}, {disabled: i=="motion"});
					break;

				case Number:
					let options = {};
					if(i == "intensity") {
						options.min = 0;
						options.max = 1;
					}
					panel.addNumber(i, property, (v, e, name) =>
					{
						if(name == "start"){
							var dt = v - this.properties[name];
							this.properties.attackPeak += dt;
							this.properties.relax += dt;
						}
						this.properties[name] = v;
						if(callback)
							callback();
					}, options);
					
					break;
				
				case Boolean:
					panel.addCheckbox(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
				
				case Array:
					panel.addArray(i, property, (v, e, name) =>
					{
						this.properties[name] = v;
						if(callback)
							callback();
					});
					break;
			}
		}
	}
}

//helpers **************************

var seed = 123;
function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}
var noiseData = new Float32Array(1024);
for(var i = 0; i < noiseData.length; ++i)
	noiseData[i] = random();

function noise(t)
{
	var i = (t|0) % 1024;
	if(i < 0) i = 1024 + i;
	var i2 = (i+1) % 1024;
	var f = t-(t|0);
	f = f*f*f*(f*(f*6.0-15.0)+10.0); //exp
	return noiseData[i] * (1-f) + noiseData[i2] * f;
}

ANIM.noise = noise;


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
