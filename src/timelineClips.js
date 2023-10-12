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
// ANIM.AUDIO = 1;
// ANIM.FACELEXEME = 2;
// ANIM.FACEFACS = 3;
// ANIM.FACEEMOTION = 4;
// ANIM.GAZE = 5;
// ANIM.GESTURE = 6;
// ANIM.HEAD = 7;
// ANIM.HEADDIRECTION = 8;
// ANIM.POSTURE = 9;
// ANIM.LOCOMOTION = 10;

// ANIM.CUSTOM = 11;

// ANIM.clipTypes = [FaceLexemeClip, FaceFACSClip, FaceEmotionClip, GazeClip, HeadClip, ShoulderClip, ShoulderHunchClip, BodyMovementClip] ;

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
	"Lip Corner Depressor", "Lip Corner Depressor Left","Lip Corner Depressor Right",	"Lip Corner Puller","Lip Corner Puller Left","Lip Corner Puller Right", 
	"Lip Strecher","Lip Funneler","Lip Tightener", "Lip Puckerer", "Lip Puckerer Left", "Lip Puckerer Right", "Lip Pressor", "Lips Part", "Lip Suck", "Lip Suck Upper", "Lip Suck Lower",
	"Lower Lip Depressor", "Upper Lip Raiser", "Upper Lip Raiser Left", "Upper Lip Raiser Right", "Chin Raiser", "Dimpler", "Dimpler Left", "Dimpler Right",

	"Nose Wrinkler", "Mouth Stretch", "Mouth Open", "Jaw Drop", "Jaw Sideways Left", "Jaw Sideways Right", "Jaw Thrust", "Tongue Show", "Cheek Blow", "Cheek Suck",
	"Brow Lowerer", "Brow Lowerer Left", "Brow Lowerer Right", "Brow Raiser", "Brow Raiser Left", "Brow Raiser Right", "Inner Brow Raiser", "Outer Brow Raiser",
	"Upper Lid Raiser", "Upper Lid Raiser Left", "Upper Lid Raiser Right", "Cheek Raiser", "Lid Tightener", "Eyes Closed", "Blink", "Wink Left", "Wink Right"
]

FaceLexemeClip.type = "faceLexeme";
FaceLexemeClip.id = ANIM.FACELEXEME ? ANIM.FACELEXEME: ANIM.clipTypes.length;
FaceLexemeClip.clipColor = "#dda4bd";

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
	this.color = "#1a1f23";
	this.font = "11px Calibri";
	this.clipColor = FaceLexemeClip.clipColor;
	
	if(o)
		this.configure(o);
	
	this.id = this.properties.lexeme = capitalize(this.properties.lexeme.replaceAll("_", " "));
	this.updateColor(this.properties.lexeme);
  //this.icon_id = 37;
}

ANIM.registerClipType( FaceLexemeClip );

FaceLexemeClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	if(o.duration) this.duration = o.duration || 1;
	if(o.end) this.duration = (o.end - o.start) || 1;
	this.attackPeak = this.fadein = o.attackPeak || 0.25;
	this.relax = this.fadeout = o.relax || 0.75;
	for(let property in this.properties) {
		
		if(property == "lexeme") {
			
			this.properties.lexeme = this.id = o.lexeme || o.properties.lexeme;
		}
		else if(o[property] != undefined)
			this.properties[property] = o[property];
	
	}
}

FaceLexemeClip.prototype.updateColor = function(v) 
{
	// if(v.includes("LIP") || v.includes("MOUTH") || v.includes("DIMPLER"))
	// 	this.clipColor = 'cyan';
	// else if(v.includes("BROW"))
	// 	this.clipColor = 'orange';
	// else if(v.includes("CHIN") || v.includes("JAW"))
	// 	this.clipColor = 'purple';
	// else if(v.includes("NOSE"))
	// 	this.clipColor = 'yellow';
	// else
	// 	this.clipColor = 'green';
}
FaceLexemeClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		end: this.start + this.duration,
		attackPeak: this.attackPeak,
		relax : this.relax,
		type: FaceLexemeClip.type
	}
	for(var i in this.properties)
	{
		json[i] = typeof(this.properties[i]) == 'string' ? this.properties[i].replaceAll(" ", "_").toUpperCase() : this.properties[i];
	}
	return json;
}

FaceLexemeClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.configure(json);
}


FaceLexemeClip.prototype.drawClip = function( ctx, w,h, selected, timeline )
{
	ctx.font = this.font;
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

	// Lexeme property
	let values = [];
	for(let id in FaceLexemeClip.lexemes) {
		values.push({ value: FaceLexemeClip.lexemes[id], src: "./data/imgs/thumbnails/" + FaceLexemeClip.lexemes[id].toLowerCase().replaceAll(" ", "_") + ".png" })
	}

	panel.addDropdown("Lexeme", values, this.properties.lexeme, (v, e, name) => {
		this.id = v;

		this.properties.lexeme = v;
		if(callback)
			callback();
		
	}, {filter: true, title: "Lexicon based on Action Units"});


	// Amount property
	let options = { precision: 2,  min: 0, max: 1, step: 0.01 };

	panel.addNumber("Amount", this.properties.amount.toFixed(2), (v, e, name) =>
	{
		this.properties.amount = v;
		if(callback)
			callback();
	}, { precision: 2,  min: 0, max: 1, step: 0.01, title: "Intensity of the action" } );

}

//FaceFACSClip
FaceFACSClip.type = "faceFACS";
FaceFACSClip.sides = ["LEFT", "RIGHT", "BOTH"];

FaceFACSClip.id = ANIM.FACEFACS ? ANIM.FACEFACS: ANIM.clipTypes.length;
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
	this.color = "#1a1f23";
	this.font = "11px Calibri";
	this.clipColor = FaceFACSClip.clipColor;
}

ANIM.registerClipType( FaceFACSClip );

FaceFACSClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		end: this.start + this.duration,

	}
	for(var i in this.properties)
	{
		if(i == "shift")
		{
			if(this.properties[i] != undefined)
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

FaceEmotionClip.id = ANIM.FACEEMOTION ? ANIM.FACEEMOTION: ANIM.clipTypes.length;
FaceEmotionClip.clipColor = "#00BDFF";

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
	this.color = "#1a1f23";
	this.font = "11px Calibri";

}

ANIM.registerClipType( FaceEmotionClip );

FaceEmotionClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		end: this.start + this.duration,

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

FacePresetClip.type = "facePreset";
FacePresetClip.id = ANIM.FACEPRESET ? ANIM.FACEPRESET: ANIM.clipTypes.length;
FacePresetClip.clipColor = "green";

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
	this.color = "#1a1f23";
	this.font = "11px Calibri";
	this.clipColor = "green";
	
	if(o)
	this.configure(o);
	
	this.id = this.properties.preset + "-" + Math.ceil(getTime());
	this.addPreset(this.properties.preset)

  //this.icon_id = 37;
}

ANIM.registerClipType( FacePresetClip );

FacePresetClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
		if(o.duration) this.duration = o.duration || 1;
	if(o.end) this.duration = (o.end - o.start) || 1;
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
		end: this.start + this.duration,

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
GazeClip.influences = ["Eyes", "Head", "Neck"];
GazeClip.directions = ["", "Up right", "Up left", "Down right", "Down left", "Right", "Left", "Up", "Down"];
GazeClip.targets = ["Up right", "Up left", "Down right", "Down left", "Right", "Left", "Up", "Down", "Front"];

GazeClip.id = ANIM.GAZE ? ANIM.GAZE: ANIM.clipTypes.length;
GazeClip.clipColor = "#7162b4";

function GazeClip(o)
{
	this.id = "Eyes Gaze";
	this.start = 0
	this.duration = 1;
	this.ready = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		target : "Left",		
		influence : "Eyes", //[EYES, HEAD, "NECK"](optional)
		offsetAngle : 0.0, //(optional)
		offsetDirection : "", //[RIGHT, LEFT, UP, DOWN, UPRIGHT, UPLEFT, DOWNLEFT, DOWNRIGHT](optional)
		headOnly: false,
		shift : false
	}

	if(o)
		this.configure(o);

	this.color = "#1a1f23";
	this.font = "11px Calibri";
	this.clipColor = GazeClip.clipColor;
}

ANIM.registerClipType( GazeClip );

GazeClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	if(o.duration) this.duration = o.duration || 1;
	if(o.end) this.duration = (o.end - o.start) || 1;
	if(o.ready) this.ready = this.fadein = o.ready;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
	for(let p in this.properties) {
		if(o[p] != undefined) {
			if(typeof(o[p]) == 'string')
				o[p] = capitalize(o[p]);
			this.properties[p] = o[p];
		}
	}

	switch(this.properties.influence) {
		case "Eyes":
			this.id = "Eyes Gaze";
			break;
		case "Head":
			this.id = "Head Gaze";
			break;
		case "Neck":
			this.id = "Neck Gaze";
			break;
	}
}

GazeClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		end: this.start + this.duration,
		ready: this.ready,
		relax: this.relax,
		type: "gaze"
	}
	for(var i in this.properties)
	{
		json[i] = typeof(this.properties[i]) == 'string' ? this.properties[i].replaceAll(" ", "_").toUpperCase() : this.properties[i];
		if(json[i] == "")
			json[i] = null;
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
	ctx.font = this.font;
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

GazeClip.prototype.showInfo = function(panel, callback)
{

	// Influence property
	panel.addDropdown("Influence", GazeClip.influences, this.properties.influence, (v, e, name) => {
		
		this.properties.influence = v
		if(this.id == "Eyes Gaze" || this.id == "Head Gaze" || this.id == "Neck Gaze") {
			this.id = v + " Gaze";
		}
		if(callback)
			callback(true);
		
	}, {filter: true, title: "Parts of the body to move to affect the gaze direction"});

	// Target property
	panel.addDropdown("Target", GazeClip.targets, this.properties.target, (v, e, name) => {
		
		this.properties.target = v;
		if(callback)
			callback();
		
	}, {filter: true});

	panel.addCheckbox("Set as base gaze", this.properties.shift, (v, e, name) =>
	{
		this.properties.shift = v;
		if(callback)
			callback();
	});

	panel.addText(null, "Optional properties", null, {disabled: true});

	// Offset Driection property
	panel.addDropdown("Offset direction", ["", ...GazeClip.directions], this.properties.offsetDirection, (v, e, name) => {
		
		this.properties.offsetDirection = v;
		if(callback)
			callback();
		
	}, {filter: true, });

	// Offset Angle property
	panel.addNumber("Offset angle", this.properties.offsetAngle, (v, e, name) =>
	{
		this.properties.offsetAngle = v;
		if(callback)
			callback();
	},  {precision: 2, title: "Offset in degrees relative to the target in the specified offset direction"});

	// Head only property
	if(this.properties.influence != "Eyes") {

		panel.addCheckbox("Only head gaze", this.properties.headOnly, (v, e, name) =>
		{
			this.properties.headOnly = v;
			if(callback)
				callback();
		});
	}
}


/*----------------------------------Head Behaviour-----------------------------------*/
//HeadClip
HeadClip.type = "head";
HeadClip.lexemes = ["Nod", "Shake", "Tilt", "Tilt left", "Tilt right", "Tilt forward", "Tilt backward", "Forward", "Backward"];
HeadClip.id = ANIM.HEAD ? ANIM.HEAD: ANIM.clipTypes.length;
HeadClip.clipColor = "#66c2a5";

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
		lexeme : "Nod", //[NOD,SHAKE, TILD...]
		repetition : 1, //[1,*] (optional)
		amount : 1, //[0,1]
	}

	if(o)
		this.configure(o);
	this.color = "#1a1f23";
	this.font = "11px Calibri";
	this.clipColor = HeadClip.clipColor;
	this.type = HeadClip.type;
}


ANIM.registerClipType( HeadClip );

HeadClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	if(o.duration) this.duration = o.duration || 1;
	if(o.end) this.duration = (o.end - o.start) || 1;
	if(o.ready) this.ready = this.fadein = o.ready;
	if(o.strokeStart) this.strokeStart = o.strokeStart;
	if(o.stroke) this.stroke  = o.stroke ;
	if(o.strokeEnd) this.strokeEnd = o.strokeEnd;
	if(o.relax) this.relax = this.fadeout = o.relax;

	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
	for(let p in this.properties) {
		if(o[p] != undefined) {
			if(typeof(o[p]) == 'string')
				o[p] = capitalize(o[p].replaceAll("_", " "));
			this.properties[p] = o[p];
		}
	}
}

HeadClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		end: this.start + this.duration,
		ready: this.ready,
		strokeStart: this.strokeStart,
		stroke : this.stroke ,
		strokeEnd: this.strokeEnd,
		relax: this.relax,
		type: this.type
	}
	for(var i in this.properties)
	{
		json[i] = typeof(this.properties[i]) == 'string' ? this.properties[i].replaceAll(" ", "_").toUpperCase() : this.properties[i];
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
	ctx.font = this.font;
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

HeadClip.prototype.showInfo = function(panel, callback)
{

	// Lexeme property
	panel.addDropdown('Lexeme', HeadClip.lexemes, this.properties.lexeme, (v, e, name) => {
		
		this.properties.lexeme = v;
		if(callback)
			callback();
		
	}, {filter: true, title: "Head movement"});
	
	// Amount property
	let options = { precision: 2,  min: 0, step: 1 };

	panel.addNumber("Repetitions", this.properties.repetition, (v, e, name) =>
	{
		this.properties.repetition = v;
		if(callback)
			callback();
	}, options );

	// Amount property
	options = { precision: 2,  min: 0, max: 1, step: 0.01, title: "Intensity of the movement" };

	panel.addNumber("Amount", this.properties.amount.toFixed(2), (v, e, name) =>
	{
		this.properties.amount = v;
		if(callback)
			callback();
	}, options );
}

/** --------- Gesture Behaviour -------------------- */

//ElbowRaiseClip
ElbowRaiseClip.type = "gesture";
ElbowRaiseClip.hands = ["Left", "Right", "Both"];
ElbowRaiseClip.movements = ["Raise", "Hunch"];
ElbowRaiseClip.id = ANIM.ELBOW ? ANIM.ELBOW: ANIM.clipTypes.length;
ElbowRaiseClip.clipColor = "#abdda4";

function ElbowRaiseClip(o)
{
	this.id = "Elbow Raise";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		hand: "Right",	
		elbowRaise : 0.8,	
		amount: 0.8,
		shift : false
	}

	if(o)
		this.configure(o);

	this.color = "#1a1f23";
	this.font = "11px Calibri";
	this.clipColor = ElbowRaiseClip.clipColor;
}

ANIM.registerClipType( ElbowRaiseClip );

ElbowRaiseClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	if(o.duration) this.duration = o.duration || 1;
	if(o.end) this.duration = (o.end - o.start) || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);		
	}
	for(let p in this.properties) {
		if(o[p] != undefined) {
			if(typeof(o[p]) == 'string')
				o[p] = capitalize(o[p].replaceAll("_", " "));
			this.properties[p] = o[p];
		}
	}
	this.properties.amount = o.elbowRaise || this.properties.amount;
}

ElbowRaiseClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		end: this.start + this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	
	for(var i in this.properties)
	{
		if(i == "amount")
			json[i] = this.properties.amount;
		else
			json[i] = typeof(this.properties[i]) == 'string' ? this.properties[i].replaceAll(" ", "_").toUpperCase() : this.properties[i];
	}
	return json;
}

ElbowRaiseClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.configure(json);
}

ElbowRaiseClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.font = this.font;
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

ElbowRaiseClip.prototype.showInfo = function(panel, callback)
{
	panel.addText(null, "Raises the elbow (added to the elbow raise automatically computed while moving the arm)", null, {disabled: true});

	// Hand property
	panel.addDropdown("Side",  ShoulderClip.hands, this.properties.hand, (v, e, name) => {
		
		this.properties.hand = v.toLowerCase();
		if(callback)
			callback();
		
	}, {filter: true, title: "Arm to apply the movement"});

	// EblowRaise amount property
	let options = { precision: 2, min : -1, max : 1, step:  0.01, title: "Amplitude of the movement"};
	
	panel.addNumber("Amount", this.properties.amount, (v, e, name) =>
	{
		this.properties.amount = v;
		if(callback)
			callback();
	}, options);

	panel.addCheckbox("Set as base elbow position", this.properties.shift, (v, e, name) =>
	{
		this.properties.shift = v;
		if(callback)
			callback();
	});

}

//ShoulderClip
ShoulderClip.type = "gesture";
ShoulderClip.hands = ["Left", "Right", "Both"];
ShoulderClip.movements = ["Raise", "Hunch"];
ShoulderClip.id = ANIM.SHOULDER ? ANIM.SHOULDER: ANIM.clipTypes.length;
ShoulderClip.clipColor = "#abdda4";

function ShoulderClip(o)
{
	this.id = "Shoulder";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.movementType = "Raise";
	this.properties = {
		hand: "Right",	
		shoulderRaise : 0.8,	
		amount: 0.8,
		shift : false
	}

	if(o)
		this.configure(o);

	this.color = "#1a1f23";
	this.font = "11px Calibri";
	this.clipColor = ShoulderClip.clipColor;
}

ANIM.registerClipType( ShoulderClip );

ShoulderClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	if(o.duration) this.duration = o.duration || 1;
	if(o.end) this.duration = (o.end - o.start) || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);		
	}
	for(let p in this.properties) {
		if(o[p] != undefined) {
			if(typeof(o[p]) == 'string')
				o[p] = capitalize(o[p].replaceAll("_", " "));
			this.properties[p] = o[p];
		}
	}
	this.properties.amount = o.shoulderRaise || o.shoulderHunch || this.properties.amount;
	if(o.shoulderRaise != undefined)
		this.movementType = "Raise";
	else if(o.shoulderHunch != undefined)
		this.movementType = "Hunch";
}

ShoulderClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		end: this.start + this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}

	json["shoulder" + this.movementType] = this.properties.amount;

	for(var i in this.properties)
	{
		json[i] = typeof(this.properties[i]) == 'string' ? this.properties[i].replaceAll(" ", "_").toUpperCase() : this.properties[i];
	}
	return json;
}

ShoulderClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.configure(json);
}

ShoulderClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.font = this.font;
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

ShoulderClip.prototype.showInfo = function(panel, callback)
{
	panel.addText(null, "Moves the shoulder forward or up", null, {disabled: true});
	// Movement type
	panel.addDropdown("Movement", ShoulderClip.movements, this.movementType, (v, e, name) => {
		
		this.movementType = v;
		if(callback)
			callback();
		
	}, {filter: true});

	// Hand property
	panel.addDropdown("Side",  ShoulderClip.hands, this.properties.hand, (v, e, name) => {
		
		this.properties.hand = v.toLowerCase();
		if(callback)
			callback();
		
	}, {filter: true, title: "Arm to apply the movement"});

	// ShoulderRaise/ShoulderHunch amount property
	let options = { precision: 2, min : -1, max : 1, step:  0.01, title: "Amplitude of the movement"};	
	panel.addNumber("Amount", this.properties.amount, (v, e, name) =>
	{
		this.properties.amount = v;
		if(callback)
			callback();
	}, options);

	panel.addCheckbox("Set as base shoulder position", this.properties.shift, (v, e, name) =>
	{
		this.properties.shift = v;
		if(callback)
			callback();
	});

}

//BodyMovementClip
BodyMovementClip.type = "gesture";
BodyMovementClip.movements = ["Tilt forward", "Tilt backward", "Tilt left", "Tilt right", "Rotate left", "Rotate right"];
BodyMovementClip.hands = ["Left", "Right", "Both"];
BodyMovementClip.id = ANIM.BODYMOVEMENT ? ANIM.BODYMOVEMENT: 8;
BodyMovementClip.clipColor = "#fee08b";

function BodyMovementClip(o)
{
	this.id= "Body Movement";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		hand: "Right",
		bodyMovement : "Tilt forward",	
		amount: 0.5,	
		shift : false
	}

	if(o)
		this.configure(o);

	this.color = "#1a1f23";
	this.font = "11px Calibri";
	this.clipColor = BodyMovementClip.clipColor;
}

ANIM.registerClipType( BodyMovementClip );

BodyMovementClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	if(o.duration) this.duration = o.duration || 1;
	if(o.end) this.duration = (o.end - o.start) || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
	for(let p in this.properties) {
		if(o[p] != undefined) {
			if(typeof(o[p]) == 'string')
				o[p] = capitalize(o[p].replaceAll("_", " "));
			this.properties[p] = o[p];
		}
	}
}

BodyMovementClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		end: this.start + this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	for(var i in this.properties)
	{
		json[i] = typeof(this.properties[i]) == 'string' ? this.properties[i].replaceAll(" ", "_").toUpperCase() : this.properties[i];
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
	ctx.font = this.font;
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

BodyMovementClip.prototype.showInfo = function(panel, callback)
{
	panel.addText(null, "Moves the body (trunk)", null, {disabled: true});
	// Movement
	panel.addDropdown("Movement", BodyMovementClip.movements, this.properties.bodyMovement, (v, e, name) => {
		
		this.properties.bodyMovement = v;
		if(callback)
			callback();
		
	}, {filter: true});

	// Amount property
	let options = { precision: 2, min : 0, max : 1, step:  0.01, title: "Intensity of the movement"};
	
	panel.addNumber("Amount", this.properties.amount, (v, e, name) =>
	{
		this.properties.amount = v;
		if(callback)
			callback();
	}, options);
}

//ArmLocationClip
ArmLocationClip.type = "gesture";
ArmLocationClip.locations = ["Head", "Head top", "Forehead", "Nose", "Below nose", "Chin", "Under chin", "Mouth", "Earlobe", "Earlobe Right", "Earlobe Left", "Ear ", "Ear Right", "Ear Left", "Cheek ", "Cheek Right", "Cheek Left", 
								"Eye ", "Eye Right", "Eye Left", "Eyebrow ", "Eyebrow Left", "Eyebrow Right", "Mouth", "Chest", "Shoulder Line", "Shoulder", "Shoulder Right", "Shoulder Left", "Stomach", "Below stomach", "Neutral"];
ArmLocationClip.sides = { "Right": "rr", "Slightly right": "r", "Left": "ll", "Slightly left": "l"};
ArmLocationClip.hands = ["Left", "Right", "Both"];
ArmLocationClip.directions = ["Up", "Down", "Left", "Right", "In", "Out",
								"Up Left", "Up Right", "Up In", "Up Out",
								"Left In", "Left Out", "Right In", "Right Out",								
								"Down Left", "Down Right", "Down In", "Down Out",
								"Up Out Left", "Up Out Right", "Down Out Left", "Down Out Right",
								"Down Out Left", "Down Out Right", "Down In Left", "Down In Right"];
ArmLocationClip.fingers = ["","Thumb", "Index", "Middle", "Ring", "Pinky"];
ArmLocationClip.hand_locations = ["","Tip", "Pad", "Mid", "Base", "Thumb ball", "Hand", "Wrist"];
ArmLocationClip.hand_sides = ["", "Right", "Left", "Ulnar", "Radial", "Front", "Back", "Palmar"];

ArmLocationClip.id = ANIM.ARMLOCATION ? ANIM.ARMLOCATION: ANIM.clipTypes.length;
ArmLocationClip.clipColor = "#fdae61";

function ArmLocationClip(o)
{
	this.id= "Arm location";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		hand: "Right",
		locationBodyArm : "Chest",	
		// optionals
		secondLocationBodyArm: "", // string
		side: "", // string, chooses a point to the right, slightly right, slightly left or left of the chosen point
		secondSide: "", // string
	
		distance: 0, // [0,1] how far from the body to locate the hand. 0 = close, 1 = arm extended
		displace: "", // string, 26 directions. Location will be offseted into that direction
		displaceDistance: 0.05, // number how far to move to the indicated side. Metres 
	 	
		//Following attributes describe which part of the hand will try to reach the locationBodyArm location 
		srcFinger: "", // 1,2,3,4,5, see handconstellation for more information
		srcLocation: "", // see handconstellation hand locations
		srcSide: "", // see handconstellation sides
		keepUpdatingContact: false, // once peak is reached, the location will be updated only if this is true. 
					// i.e.: set to false; contact tip of index; reach destination. Afterwards, changing index finger state will not modify the location
					// i.e.: set to true; contact tip of index; reach destination. Afterwards, changing index finger state (handshape) will make the location change depending on where the tip of the index is  
	
		shift: false, // contact information ( srcFinger, srcLocation, srcSide ) is not kept for shift
	}

	if(o)
		this.configure(o);

	this.color = "#1a1f23";
	this.font = "11px Calibri";
	this.clipColor = ArmLocationClip.clipColor;
}

ANIM.registerClipType( ArmLocationClip );

ArmLocationClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	if(o.duration) this.duration = o.duration || 1;
	if(o.end) this.duration = (o.end - o.start) || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
	for(let p in this.properties) {
		if(o[p] != undefined) {
			if(typeof(o[p]) == 'string')
				o[p] = capitalize(o[p].replaceAll("_", " "));
			this.properties[p] = o[p];
		}
	}
	if(o.side || o.secondSide) {
		for(let s in ArmLocationClip.sides) {
			if(o.side == ArmLocationClip.sides[s])
				this.properties.side = s;
			if(o.secondSide == ArmLocationClip.sides[s])
				this.properties.secondSide = s;
		}
	}
	if(o.displace) {
		this.properties.displace = "";
		for(let i = 0; i < o.displace.length; i++) {
			let char = o.displace[i];
			switch(char) {
				case "u":
					this.properties.displace += "Up";
					break;
				case "d":
					this.properties.displace +=	"Down";
					break;
				case "l":
					this.properties.displace += "Left";
					break;
				case "r":
					this.properties.displace += "Right";
					break;
				case "i":
					this.properties.displace += "In";
					break;
				case "o": 
					this.properties.displace += "Out";
				break;

			}
		}
	}
	if(o.srcFinger) this.properties.srcFinger = ArmLocationClip.fingers[o.srcFinger];
}

ArmLocationClip.prototype.toJSON = function()
{
	let json = {
		id: this.id,
		start: this.start,
		end: this.start + this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	for(let i in this.properties)
	{
		if( i == "side" || i == "secondSide") 
			json[i] = ArmLocationClip.sides[this.properties[i]];
		else if ( i == "displace" && this.properties[i] != "") {
			let d = this.properties[i].split(" ");
			json[i] = "";
			for(let j = 0; j < d.length; j++) {
				json[i] += d[j][0].toLowerCase();
			}
		}
		else if(i == "srcFinger") {
			json[i] = ArmLocationClip.fingers.indexOf(this.properties[i])
			json[i] = json[i] < 0 ? null : json[i];
		}
		else 
			json[i] = typeof(this.properties[i]) == 'string' ? this.properties[i].replaceAll(" ", "_").toUpperCase() : this.properties[i];

		if(json[i] == "")
			json[i] = null;
	}
	return json;
}

ArmLocationClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.configure(json);
}

ArmLocationClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.font = this.font;
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

ArmLocationClip.prototype.showInfo = function(panel, callback)
{
	panel.addText(null, "Moves the arm (wrist) to a location of the body.", null, {disabled: true});
	// Location body arm property
	panel.addDropdown("Arm location", ArmLocationClip.locations, this.properties.locationBodyArm, (v, e, name) => {
		
		this.properties.locationBodyArm = v;
		if(callback)
			callback();
		
	}, {filter: true});

	// Hand property
	panel.addDropdown("Arm", ArmLocationClip.hands, this.properties.hand, (v, e, name) => {
				
		this.properties.hand = v;
		if(callback)
			callback();
		
	}, {filter: true, title: "Arm to apply the movement"});


	panel.addCheckbox("Set as base location", this.properties.shift, (v, e, name) =>
	{
		this.properties.shift = v;
		if(callback)
			callback();
	});
	
	panel.addSeparator();
	panel.addTitle( "Optionals");

	// Location side
	panel.addDropdown("Side", ["", ...Object.keys(ArmLocationClip.sides)], this.properties.side, (v, e, name) => {
		
		this.properties.side = v;
		if(callback)
			callback();
		
	}, {filter: true, title: "Side offset ott the chosen point"});

	// Second location body arm property
	panel.addDropdown("Second location", ["", ...ArmLocationClip.locations], this.properties.secondLocationBodyArm, (v, e, name) => {
		
		this.properties.secondLocationBodyArm = v;
		if(callback)
			callback(true);
		
	}, {filter: true });

	if(this.properties.secondLocationBodyArm) {
		// Second loaction side
		panel.addDropdown("Second side", ["", ...Object.keys(ArmLocationClip.sides)], this.properties.secondSide, (v, e, name) => {
				
			this.properties.secondSide = v;
			if(callback)
				callback();
			
		}, {filter: true});
	}
	
	// Distance property 
	panel.addNumber("Distance from body", this.properties.distance, (v, e, name) =>
	{
		this.properties.distance = v;
		if(callback)
			callback();
	}, {precision: 2, min: 0, max: 1, step: 0.01, title: "How far from the body to locate the hand. 0 = close, 1 = arm extended"});

	// Displacement property
	panel.addDropdown("Displace", ArmLocationClip.directions, this.properties.displace, (v, e, name) => {
	
		this.properties.displace = v;
		if(callback)
			callback(true);
		
	}, {filter: true, title: "Location will be offseted into that direction"});

	if(this.properties.displace) {

		// Displace distance
		panel.addNumber("Displace distance", this.properties.displaceDistance, (v, e, name) =>
		{
			this.properties.displaceDistance = v;
			if(callback)
				callback();
		}, {precision: 2, min: 0, step: 0.01, title: "How far to move to the indicated side. In meters "});
				
	}

	panel.addSeparator();
	// Hnad constellation properties
	panel.addText(null, "Part of the hand that will try to reach the body location", null, {disabled: true});

	// Part of the hand
	panel.addDropdown("Location", ArmLocationClip.fingers, this.properties.srcLocation, (v, e, name) => {
				
		this.properties.srcLocation = v;
		if(callback)
			callback(true);
		
	}, {filter: true});

	if(this.properties.srcLocation && this.properties.srcLocation != "Tip") {
		panel.addDropdown("Side", ArmLocationClip.hand_sides, this.properties.srcSide, (v, e, name) => {
				
			this.properties.srcSide = v;
			if(callback)
				callback();
			
		}, {filter: true});
	
	}
	if(this.properties.srcLocation == "Tip" || this.properties.srcLocation == "Pad" || this.properties.srcLocation == "Mid" || this.properties.srcLocation == "Base") {

		panel.addDropdown("Finger", ArmLocationClip.fingers, this.properties.srcFinger, (v, e, name) => {
				
			this.properties.srcFinger = v;
			if(callback)
				callback();
			
		}, {filter: true});
	}
}

//PalmOrientationClip
PalmOrientationClip.type = "gesture";
PalmOrientationClip.hands = ["Left", "Right", "Both"];
PalmOrientationClip.directions = ["Up", "Down", "Left", "Right", "Up Left", "Up Right", "Down Left", "Down Right"];

PalmOrientationClip.id = ANIM.PALMORIENTATION ? ANIM.PALMORIENTATION: ANIM.clipTypes.length;
PalmOrientationClip.clipColor = "#f46d43";

function PalmOrientationClip(o)
{
	this.id= "Palm Orientation";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		hand: "Right",
		palmor: "Up", //string 8 directions. Relative to arm (not to world coordinates )
    
		// optionals
		secondPalmor: "", // string 8 directions. Will compute midpoint between palmor and secondPalmor.
		shift: false 
	}

	if(o)
		this.configure(o);

	this.color = "#1a1f23";
	this.font = "11px Calibri";
	this.clipColor = PalmOrientationClip.clipColor;
}

ANIM.registerClipType( PalmOrientationClip );

PalmOrientationClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	if(o.duration) this.duration = o.duration || 1;
	if(o.end) this.duration = (o.end - o.start) || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
	for(let p in this.properties) {
		if(o[p] != undefined) {
			if(typeof(o[p]) == 'string')
				o[p] = capitalize(o[p].replaceAll("_", " "));
			this.properties[p] = o[p];
		}
	}
	if(o.palmor) {
		this.properties.palmor = "";
		for(let i = 0; i < o.palmor.length; i++) {
			let char = o.palmor[i];
			switch(char) {
				case "u":
					this.properties.palmor += "Up";
					break;
				case "d":
					this.properties.palmor +=	"Down";
					break;
				case "l":
					this.properties.palmor += "Left";
					break;
				case "r":
					this.properties.palmor += "Right";
					break;
			}
		}
	}

	if(o.secondPalmor) {
		this.properties.secondPalmor = "";
		for(let i = 0; i < o.secondPalmor.length; i++) {
			let char = o.secondPalmor[i];
			switch(char) {
				case "u":
					this.properties.secondPalmor += "Up";
					break;
				case "d":
					this.properties.secondPalmor +=	"Down";
					break;
				case "l":
					this.properties.secondPalmor += "Left";
					break;
				case "r":
					this.properties.secondPalmor += "Right";
					break;
			}
		}
	}
}

PalmOrientationClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		end: this.start + this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	for(var i in this.properties)
	{
		if ( (i == "palmor" || i == "secondPalmor") && this.properties[i] != "") {
			let d = this.properties[i].split(" ");
			json[i] = "";
			for(let j = 0; j < d.length; j++) {
				json[i] += d[j][0].toLowerCase();
			}
		}
		else 
			json[i] = typeof(this.properties[i]) == 'string' ? this.properties[i].replaceAll(" ", "_").toUpperCase() : this.properties[i];

		if(json[i] == "")
			json[i] = null;
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
	ctx.font = this.font;
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

PalmOrientationClip.prototype.showInfo = function(panel, callback)
{

	panel.addText(null, "Roll of the wrist joint", null, {disabled: true});
	// Direction property
	panel.addDropdown("Direction", Object.keys(PalmOrientationClip.directions), this.properties.palmor, (v, e, name) => {
		
		this.properties.palmor = v;
		if(callback)
			callback();
		
	}, {filter: true, title: "Direction relative to arm (not to world coordinates)"});

	// Hand property
	panel.addDropdown("Hand", PalmOrientationClip.hands, this.properties.hand, (v, e, name) => {
				
		this.properties.hand = v;
		if(callback)
			callback();
		
	}, {filter: true});


	panel.addCheckbox("Set as base orientation", this.properties.shift, (v, e, name) =>
	{
		this.properties.shift = v;
		if(callback)
			callback();
	});
	
	panel.addSeparator();

	panel.addTitle( "Optionals");

	// Second direction side
	panel.addDropdown("Second direction", ["", ...Object.keys(PalmOrientationClip.directions)], this.properties.secondPalmor, (v, e, name) => {
		
		this.properties.secondPalmor = v;
		if(callback)
			callback();
		
	}, {filter: true, title: "Will compute midpoint between direction and second direction"});
}

//HandOrientationClip
HandOrientationClip.type = "gesture";
HandOrientationClip.hands = ["Left", "Right", "Both"];
HandOrientationClip.directions = ["Up", "Down", "Left", "Right", "In", "Out",
							"Up Left", "Up Right", "Up In", "Up Out",
							"Left In", "Left Out", "Right In", "Right Out",								
							"Down Left", "Down Right", "Down In", "Down Out",
							"Up Out Left", "Up Out Right", "Down Out Left", "Down Out Right",
							"Down Out Left", "Down Out Right", "Down In Left", "Down In Right"];

HandOrientationClip.id = ANIM.HANDORIENTATION ? ANIM.HANDORIENTATION: ANIM.clipTypes.length;
HandOrientationClip.clipColor = "#d53e4f";

function HandOrientationClip(o)
{
	this.id = "Hand orientation";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		hand: "Right",
		extfidir: "Left", // string  26 directions
    
		// optionals
		secondExtfidir: "", // string 26 directions. Will compute midpoint between extifidir and secondExtfidir  
		shift: false, // optional
	}

	if(o)
		this.configure(o);

	this.color = "#1a1f23";
	this.font = "11px Calibri";
	this.clipColor = HandOrientationClip.clipColor;
}

ANIM.registerClipType( HandOrientationClip );

HandOrientationClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	if(o.duration) this.duration = o.duration || 1;
	if(o.end) this.duration = (o.end - o.start) || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
	for(let p in this.properties) {
		if(o[p] != undefined) {
			if(typeof(o[p]) == 'string')
				o[p] = capitalize(o[p].replaceAll("_", " "));
			this.properties[p] = o[p];
		}
	}
	if(o.extfidir) {
		this.properties.extfidir = "";
		for(let i = 0; i < o.extfidir.length; i++) {
			let char = o.extfidir[i];
			switch(char) {
				case "u":
					this.properties.extfidir += "Up";
					break;
				case "d":
					this.properties.extfidir +=	"Down";
					break;
				case "l":
					this.properties.extfidir += "Left";
					break;
				case "r":
					this.properties.extfidir += "Right";
					break;
				case "i":
					this.properties.extfidir += "In";
					break;
				case "o":
					this.properties.extfidir += "Out";
					break;
			}
		}
	}

	if(o.secondExtfidir) {
		this.properties.secondExtfidir = "";
		for(let i = 0; i < o.secondExtfidir.length; i++) {
			let char = o.secondExtfidir[i];
			switch(char) {
				case "u":
					this.properties.secondExtfidir += "Up";
					break;
				case "d":
					this.properties.secondExtfidir +=	"Down";
					break;
				case "l":
					this.properties.secondExtfidir += "Left";
					break;
				case "r":
					this.properties.secondExtfidir += "Right";
					break;
				case "i":
					this.properties.secondExtfidir += "In";
					break;
				case "o":
					this.properties.secondExtfidir += "Out";
					break;
			}
		}
	}
}

HandOrientationClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		end: this.start + this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	for(var i in this.properties)
	{
		for(var i in this.properties)
		{
			if ( (i == "extfidir" || i == "secondExtfidir") && this.properties[i] != "") {
				let d = this.properties[i].split(" ");
				json[i] = "";
				for(let j = 0; j < d.length; j++) {
					json[i] += d[j][0].toLowerCase();
				}
			}
			else 
				json[i] = typeof(this.properties[i]) == 'string' ? this.properties[i].replaceAll(" ", "_").toUpperCase() : this.properties[i];

			if(json[i] == "")
				json[i] = null;
		}
	}
	return json;
}

HandOrientationClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.configure(json);
}

HandOrientationClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.font = this.font;
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

HandOrientationClip.prototype.showInfo = function(panel, callback)
{
	panel.addText(null,"Roll of the wrist joint", null, {disabled: true});
	// Direction property
	panel.addDropdown("Direction", HandOrientationClip.directions, this.properties.extfidir, (v, e, name) => {
		
		this.properties.extfidir = v;
		if(callback)
			callback();
		
	}, {filter: true, title: "Direction relative to arm (not to world coordinates)"});

	// Hand property
	panel.addDropdown("Hand", HandOrientationClip.hands, this.properties.hand, (v, e, name) => {
				
		this.properties.hand = v;
		if(callback)
			callback();
		
	}, {filter: true});


	panel.addCheckbox("Set as base exfidir", this.properties.shift, (v, e, name) =>
	{
		this.properties.shift = v;
		if(callback)
			callback();
	});
	
	panel.addSeparator();

	panel.addTitle( "Optionals");

	// Second direction side
	panel.addDropdown("Second direction", ["", ...HandOrientationClip.directions], this.properties.secondExtfidir, (v, e, name) => {
		
		this.properties.secondExtfidir = v;
		if(callback)
			callback();
		
	}, {filter: true, title: "Will compute midpoint between direction and second direction"});
}


//HandshapeClip
HandshapeClip.type = "gesture";
HandshapeClip.handshapes = ["Fist", "Finger 2", "Finger 23", "Finger 23 spread", "Finger 2345", "Flat", "Pinch 12", "Pinch 12 open", "Pinchall", "Cee all", "Cee 12", "Cee 12 open"];
HandshapeClip.thumbshapes = ["Default", "Out", "Opposed", "Across", "Touch"];
HandshapeClip.bendstates = ["Straight", "Half bent", "Bent", "Round", "Hooked", "Double bent", "Double hooked"];
HandshapeClip.hands = ["Left", "Right", "Both"];
HandshapeClip.fingers = ["","Thumb", "Index", "Middle", "Ring", "Pinky"];

HandshapeClip.id = ANIM.HANDSHAPE ? ANIM.HANDSHAPE: ANIM.clipTypes.length;
HandshapeClip.clipColor = "#9e0142";

function HandshapeClip(o)
{
	this.id= "Handshape";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		hand: "Right",
		handshape: "Flat", //string from the handshape table
		
		// optionals
		secondHandshape: "", //string from the handshape table
		thumbshape: "", //string from thumbshape table. if not present, the predefined thumbshape for the handshape will be used
		secondThumbshape: "", // string from thumbshape table. Applied to secondHandshape
		tco: 0, // number [0,1]. Thumb Combination Opening from the Hamnosys specification 
		secondtco: 0.3, // number [0,1]. Thumb Combination Opening from the Hamnosys specification. Applied to secondHandshape
		
		mainBend: "", // bend applied to selected fingers from the default handshapes. Basic handshapes and ThumbCombination handshapes behave differently. Value from the bend table
		secondMainBend: "", // mainbend applied to secondHandshape
		mainSplay: 0.5, // number [-1,1]. Separates laterally fingers 2,4,5. Splay diminishes the more the finger is bent
		shift: false,
	}

	if(o)
		this.configure(o);

	this.color = "#1a1f23";
	this.font = "11px Calibri";
	this.clipColor = HandshapeClip.clipColor;
}

ANIM.registerClipType( HandshapeClip );

HandshapeClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	if(o.duration) this.duration = o.duration || 1;
	if(o.end) this.duration = (o.end - o.start) || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
	for(let p in this.properties) {
		if(o[p] != undefined) {
			if(typeof(o[p]) == 'string')
				o[p] = capitalize(o[p].replaceAll("_", " "));
			this.properties[p] = o[p];
		}
	}
}

HandshapeClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		end: this.start + this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	for(var i in this.properties)
	{
		for(var i in this.properties)
		{
			json[i] = typeof(this.properties[i]) == 'string' ? this.properties[i].replaceAll(" ", "_").toUpperCase() : this.properties[i];

			if(json[i] == "")
				json[i] = null;
		}
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
	ctx.font = this.font;
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

HandshapeClip.prototype.showInfo = function(panel, callback)
{
	panel.addText(null,"Sets the posture of the fingers of a hand. Fingers are numbered from thumb to pinky", null, {disabled: true});
	
	// Handshape property
	panel.addDropdown("Hand shape", HandshapeClip.handshapes, this.properties.handshape, (v, e, name) => {
		
		this.properties.handshape = v;
		if(callback)
			callback();
		
	}, {filter: true});

	// Hand property
	panel.addDropdown("Hand", HandshapeClip.hands, this.properties.hand, (v, e, name) => {
				
		this.properties.hand = v;
		if(callback)
			callback();
		
	}, {filter: true});


	panel.addCheckbox("Set as base gaze", this.properties.shift, (v, e, name) =>
	{
		this.properties.shift = v;
		if(callback)
			callback();
	});
	
	panel.addSeparator();

	panel.addTitle( "Optionals");

	// Thumbshape property
	panel.addDropdown("Thumb shape", ["", ...HandshapeClip.thumbshapes], this.properties.thumbshape, (v, e, name) => {
	
		this.properties.thumbshape = v;
		if(callback)
			callback();
		
	}, {filter: true});

	// TCO property 
	panel.addNumber("Thumb Combination Opening", this.properties.tco, (v, e, name) =>
	{
		this.properties.tco = v;
		if(callback)
			callback();
	}, {precision: 2, min: 0, max: 1, step: 0.01});

	// Main splay property 
	panel.addNumber("Main splay fingers", this.properties.mainSplay, (v, e, name) =>
	{
		this.properties.mainSplay = v;
		if(callback)
			callback();
	}, {precision: 2, min: 0, max: 1, step: 0.01});

	// Bend property
	panel.addDropdown("Main bend", ["", ...HandshapeClip.bendstates], this.properties.mainBend, (v, e, name) => {

		this.properties.mainBend = v;
		if(callback)
			callback();
		
	}, {filter: true});
	

	panel.addText(null, "Optional second hand shape", null, {disabled: true});

	// Second handshape property
	panel.addDropdown("Second hand shape", ["", ...HandshapeClip.handshapes], this.properties.secondHandshape, (v, e, name) => {
			
		this.properties.secondHandshape = v;
		if(callback)
			callback();
		
	}, {filter: true});


	// Second thumbshape property
	panel.addDropdown("Second thumb shape", ["", ...HandshapeClip.thumbshapes], this.properties.secondThumbshape, (v, e, name) => {
	
		this.properties.secondThumbshape = v;
		if(callback)
			callback();
		
	}, {filter: true});


	// Second TCO property 
	panel.addNumber("Second Thumb Combination Opening", this.properties.secondtco, (v, e, name) =>
	{
		this.properties.secondtco = v;
		if(callback)
			callback();
	}, {precision: 2, min: 0, max: 1, step: 0.01});

	// Second bend property
	panel.addDropdown("Second main bend", ["", ...HandshapeClip.bendstates], this.properties.secondMainBend, (v, e, name) => {

		this.properties.secondMainBend = v;
		if(callback)
			callback();
		
	}, {filter: true});

}


//HandConstellationClip
HandConstellationClip.type = "gesture";
HandConstellationClip.hands = ["Left", "Right", "Both", "Dominant", "Non dominant"];
HandConstellationClip.arm_locations = ["Forearm", "Elbow", "Upper arm"];
HandConstellationClip.hand_locations = ["","Tip", "Pad", "Mid", "Base", "Thumb ball", "Hand", "Wrist"];
HandConstellationClip.hand_sides = ["", "Right", "Left", "Ulnar", "Radial", "Back", "Palmar"];
HandConstellationClip.fingers = ["","Thumb", "Index", "Middle", "Ring", "Pinky"];
HandConstellationClip.directions = ["Up", "Down", "Left", "Right", "In", "Out",
									"Up Left", "Up Right", "Up In", "Up Out",
									"Left In", "Left Out", "Right In", "Right Out",								
									"Down Left", "Down Right", "Down In", "Down Out",
									"Up Out Left", "Up Out Right", "Down Out Left", "Down Out Right",
									"Down Out Left", "Down Out Right", "Down In Left", "Down In Right"];

HandConstellationClip.id = ANIM.HANDCONSTELLATION ? ANIM.HANDCONSTELLATION: ANIM.clipTypes.length;
HandConstellationClip.clipColor = "#0ac8c8";

function HandConstellationClip(o)
{
	this.id= "Hand Constellation";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;

	this.properties = {
		hand: "Right",
		handConstellation: true,
		//Location of the hand in the specified hand (or dominant hand)
		srcFinger: "Thumb", // 1,2,3,4,5. If the location does not use a finger, do not include this
		srcLocation: "Pad", // string from hand locations (although no forearm, elbow, upperarm are valid inputs here)
		srcSide: "Back", // Ulnar, Radial, Palmar, Back
		
		//Location of the hand in the unspecified hand (or non dominant hand)
		dstFinger: "Thumb", // 1,2,3,4,5. If the location does not use a finger, do not include this
		dstLocation: "Base", // string from hand locations or arm locations
		dstSide: "Palmar", // Ulnar, Radial, Palmar, Back 

		// optionals
		distance: 0, //[-ifinity,+ifninity] where 0 is touching and 1 is the arm size. Distance between endpoints. 
		distanceDirection: "", // string, any combination of the main directions. If not provided, defaults to horizontal outwards direction ?!!!!!!!!!!!!!!!!! 26 DIRECTIONS?????
		
		keepUpdatingContact: false, // once peak is reached, the location will be updated only if this is true. 
						// i.e.: set to false; contact tip of index; reach destination. Afterwards, changing index finger state will not modify the location
						// i.e.: set to true; contact tip of index; reach destination. Afterwards, changing index finger state (handshape) will make the location change depending on where the tip of the index is  
	}

	if(o)
		this.configure(o);

	this.color = "#1a1f23";
	this.font = "11px Calibri";
	this.clipColor = HandConstellationClip.clipColor;
}

ANIM.registerClipType( HandConstellationClip );

HandConstellationClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	if(o.duration) this.duration = o.duration || 1;
	if(o.end) this.duration = (o.end - o.start) || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
	for(let p in this.properties) {
		if(o[p] != undefined) {
			if(typeof(o[p]) == 'string')
				o[p] = capitalize(o[p].replaceAll("_", " "));
			this.properties[p] = o[p];
		}
	}
	if(o.srcSide || o.dstSide) {
		for(let s in HandConstellationClip.sides) {
			if(o.srcSide == HandConstellationClip.sides[s])
				this.properties.srcSide = s;
			if(o.dstSide == HandConstellationClip.sides[s])
				this.properties.dstSide = s;
		}
	}
	if(o.distanceDirection) {
		this.properties.distanceDirection = "";
		for(let i = 0; i < o.distanceDirection.length; i++) {
			let char = o.distanceDirection[i];
			switch(char) {
				case "u":
					this.properties.distanceDirection += "Up";
					break;
				case "d":
					this.properties.distanceDirection +=	"Down";
					break;
				case "l":
					this.properties.distanceDirection += "Left";
					break;
				case "r":
					this.properties.distanceDirection += "Right";
					break;
				case "i":
					this.properties.distanceDirection += "In";
					break;
				case "o": 
					this.properties.distanceDirection += "Out";
				break;

			}
		}
	}

	if(o.srcFinger) this.properties.srcFinger = HandConstellationClip.fingers[o.srcFinger];
	if(o.dstFinger) this.properties.dstFinger = HandConstellationClip.fingers[o.dstFinger];
}

HandConstellationClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		end: this.start + this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	for(let i in this.properties)
	{
		if ( i == "distanceDirection" && this.properties[i] != "") {
			let d = this.properties[i].split(" ");
			json[i] = "";
			for(let j = 0; j < d.length; j++) {
				json[i] += d[j][0].toLowerCase();
			}
		}
		else if(i == "srcFinger" || i == "dstFinger") {
			json[i] = HandConstellationClip.fingers.indexOf(this.properties[i])
			json[i] = json[i] < 0 ? null : json[i];
		}
		else 
			json[i] = typeof(this.properties[i]) == 'string' ? this.properties[i].replaceAll(" ", "_").toUpperCase() : this.properties[i];

		if(json[i] == "")
			json[i] = null;
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
	ctx.font = this.font;
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

HandConstellationClip.prototype.showInfo = function(panel, callback)
{
	panel.addText(null, "Moves the hand position with respect to each other.", null, {disabled: true});
	
	// Hand property
	panel.addDropdown("Hand", HandConstellationClip.hands, this.properties.hand, (v, e, name) => {
				
		this.properties.hand = v;
		if(callback)
			callback();
		
	}, {filter: true});


	// Hand constellation properties
	panel.addText(null, "Location of the hand in the specified hand (or dominant hand)", null, {disabled: true})
	// Part of the hand
	panel.addDropdown("Location", HandConstellationClip.hand_locations, this.properties.srcLocation, (v, e, name) => {
				
		this.properties.srcLocation = v;
		if(callback)
			callback(true);
		
	}, {filter: true});

	if(this.properties.srcLocation && this.properties.srcLocation != "Tip") {
		panel.addDropdown("Side", HandConstellationClip.hand_sides, this.properties.srcSide, (v, e, name) => {
				
			this.properties.srcSide = v;
			if(callback)
				callback();
			
		}, {filter: true});
	
	}
	if(this.properties.srcLocation == "Tip" || this.properties.srcLocation == "Pad" || this.properties.srcLocation == "Mid" || this.properties.srcLocation == "Base") {

		panel.addDropdown("Finger", HandConstellationClip.fingers, this.properties.srcFinger, (v, e, name) => {
				
			this.properties.srcFinger = v;
			if(callback)
				callback();
			
		}, {filter: true});
	}
	panel.addText(null, "Location of the hand in the unspecified hand (or non dominant hand)", null, {disabled: true});

	// Part of the hand
	panel.addDropdown("Location", [...HandConstellationClip.hand_locations, ...HandConstellationClip.arm_locations], this.properties.dstLocation, (v, e, name) => {
				
		this.properties.dstLocation = v;
		if(callback)
			callback(true);
		
	}, {filter: true});

	if(this.properties.dstLocation != "Tip") {
		let sides = HandConstellationClip.hand_sides;
		if(this.properties.dstLocation == "Elbow" || this.properties.dstLocation == "Upper arm") {
			let i = sides.indexOf("Palmar");
			sides[i] = "Front";
		}
		panel.addDropdown("Side", sides, this.properties.dstSide, (v, e, name) => {
				
			this.properties.dstSide = v;
			if(callback)
				callback();
			
		}, {filter: true});
	
	}
	if(this.properties.dstLocation == "Tip" || this.properties.dstLocation == "Pad" || this.properties.dstLocation == "Mid" || this.properties.dstLocation == "Base") {

		panel.addDropdown("Finger", HandConstellationClip.fingers, this.properties.dstFinger, (v, e, name) => {
				
			this.properties.dstFinger = v;
			if(callback)
				callback();
			
		}, {filter: true});
	}

	panel.addSeparator();
	
	panel.addTitle( "Optionals");
	
	// Distance property 
	panel.addNumber("Distance from body", this.properties.distance, (v, e, name) =>
	{
		this.properties.distance = v;
		if(callback)
			callback();
	}, {precision: 2, min: 0, max: 1, step: 0.01});

	// Displacement property
	panel.addDropdown("Distance direction", ArmLocationClip.directions, this.properties.distanceDirection, (v, e, name) => {
	
		this.properties.distanceDirection = v;
		if(callback)
			callback(true);
		
	}, {filter: true});

}


//DirectedMotionClip
DirectedMotionClip.type = "gesture";
DirectedMotionClip.hands = ["Left", "Right", "Both"];
DirectedMotionClip.directions = ["Up", "Down", "Left", "Right", "In", "Out",
								"Up Left", "Up Right", "Up In", "Up Out",
								"Left In", "Left Out", "Right In", "Right Out",								
								"Down Left", "Down Right", "Down In", "Down Out",
								"Up Out Left", "Up Out Right", "Down Out Left", "Down Out Right",
								"Down Out Left", "Down Out Right", "Down In Left", "Down In Right"];
DirectedMotionClip.second_directions = ["Up", "Down", "Left", "Right","Up Left", "Up Right", "Down Left", "Down Right"];

DirectedMotionClip.id = ANIM.DIRECTEDMOTION ? ANIM.DIRECTEDMOTION: ANIM.clipTypes.length;
DirectedMotionClip.clipColor = "#5e9fdd";

function DirectedMotionClip(o)
{
	this.id= "Directed Motion";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;
	
	this.properties = {
		hand: "Right",
		direction: "Out", // string 26 directions. Axis of rotation		
		motion: "Directed",
		// optionals
		secondDirection: "", // string 8 directions. Will compute midpoint between direction and secondDirection.
		distance: 0.05, // number, metres of the displacement. Default 0.2 m (20 cm)
		curve: "", // string 8 directions. Default to none
		secondCurve: "", // string 8 directions. Will compute midpoint between curve and secondCurve.
		curveSteepness: 1, // number meaning the sharpness of the curve
		zigzag: "", // string 26 directions
		zigzagSize: 0.05, // amplitude of zigzag (from highest to lowest point) in metres. Default 0.01 m (1 cm)
		zigzagSpeed: 2, // oscillations per second. Default 2
	}
	this.zigzag = false;

	if(o)
		this.configure(o);

	this.color = "#1a1f23";
	this.font = "11px Calibri";
	this.clipColor = DirectedMotionClip.clipColor;
}

ANIM.registerClipType( DirectedMotionClip );

DirectedMotionClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	if(o.duration) this.duration = o.duration || 1;
	if(o.end) this.duration = (o.end - o.start) || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
	for(let p in this.properties) {
		if(o[p] != undefined) {
			if(typeof(o[p]) == 'string')
				o[p] = capitalize(o[p].replaceAll("_", " "));
			this.properties[p] = o[p];
		}
	}
	if(o.direction) {
		this.properties.direction = "";
		for(let i = 0; i < o.direction.length; i++) {
			let char = o.direction[i];
			switch(char) {
				case "u":
					this.properties.direction += "Up";
					break;
				case "d":
					this.properties.direction += "Down";
					break;
				case "l":
					this.properties.direction += "Left";
					break;
				case "r":
					this.properties.direction += "Right";
					break;
				case "i":
					this.properties.direction += "In";
					break;
				case "o": 
					this.properties.direction += "Out";
				break;

			}
		}
	}

	if(o.secondDirection) {
		this.properties.secondDirection = "";
		for(let i = 0; i < o.secondDirection.length; i++) {
			let char = o.secondDirection[i];
			switch(char) {
				case "u":
					this.properties.secondDirection += "Up";
					break;
				case "d":
					this.properties.secondDirection += "Down";
					break;
				case "l":
					this.properties.secondDirection += "Left";
					break;
				case "r":
					this.properties.secondDirection += "Right";
					break;
			}
		}
	}

	if(o.curve) {
		this.properties.curve = "";
		for(let i = 0; i < o.curve.length; i++) {
			let char = o.curve[i];
			switch(char) {
				case "u":
					this.properties.curve += "Up";
					break;
				case "d":
					this.properties.curve += "Down";
					break;
				case "l":
					this.properties.curve += "Left";
					break;
				case "r":
					this.properties.curve += "Right";
					break;
			}
		}
	}

	if(o.secondCurve) {
		this.properties.secondCurve = "";
		for(let i = 0; i < o.secondCurve.length; i++) {
			let char = o.secondCurve[i];
			switch(char) {
				case "u":
					this.properties.secondCurve += "Up";
					break;
				case "d":
					this.properties.secondCurve += "Down";
					break;
				case "l":
					this.properties.secondCurve += "Left";
					break;
				case "r":
					this.properties.secondCurve += "Right";
					break;
			}
		}
	}

	if(o.zigzag) {
		this.properties.zigzag = "";
		for(let i = 0; i < o.zigzag.length; i++) {
			let char = o.zigzag[i];
			switch(char) {
				case "u":
					this.properties.zigzag += "Up";
					break;
				case "d":
					this.properties.zigzag += "Down";
					break;
				case "l":
					this.properties.zigzag += "Left";
					break;
				case "r":
					this.properties.zigzag += "Right";
					break;
				case "i":
					this.properties.zigzag += "In";
					break;
				case "o": 
					this.properties.zigzag += "Out";
				break;

			}
		}
	}
}

DirectedMotionClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		end: this.start + this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture",
	}
	for(let i in this.properties)
	{
		if ( (i == "direction" || i == "secondDirection" || i == "zigzag") && this.properties[i] != "") {
			let d = this.properties[i].split(" ");
			json[i] = "";
			for(let j = 0; j < d.length; j++) {
				json[i] += d[j][0].toLowerCase();
			}
		}
		else 
			json[i] = typeof(this.properties[i]) == 'string' ? this.properties[i].replaceAll(" ", "_").toUpperCase() : this.properties[i];

		if(json[i] == "")
			json[i] = null;
	}
	return json;
}

DirectedMotionClip.prototype.fromJSON = function( json )
{
	this.id = json.id;
	this.configure(json);
}

DirectedMotionClip.prototype.drawClip = function( ctx, w,h, selected )
{
	ctx.font = this.font;
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

DirectedMotionClip.prototype.showInfo = function(panel, callback)
{
	panel.addText(null, "Moves the arm (wrist) in a linear direction.", null, {disabled: true});
	
	// Hand property
	panel.addDropdown("Hand", DirectedMotionClip.hands, this.properties.hand, (v, e, name) => {
				
		this.properties.hand = v;
		if(callback)
			callback();
		
	}, {filter: true});

	// Movement direction property
	panel.addDropdown("Direction", DirectedMotionClip.directions, this.properties.direction, (v, e, name) => {
				
		this.properties.direction = v;
		if(callback)
			callback(true);
		
	}, {filter: true});

	panel.addSeparator();
	
	panel.addTitle( "Optionals");
	
	// Displacement property
	panel.addDropdown("Second direction", ["", ...DirectedMotionClip.second_directions], this.properties.secondDirection, (v, e, name) => {
	
		this.properties.secondDirection = v;
		if(callback)
			callback(true);
		
	}, {filter: true});

	// Distance property 
	panel.addNumber("Meters of the displacemenent", this.properties.distance, (v, e, name) =>
	{
		this.properties.distance = v;
		if(callback)
			callback();
	}, {precision: 2, min: 0, step: 0.01});

	panel.addDropdown("Curve direction", ["", ...DirectedMotionClip.second_directions], this.properties.curve, (v, e, name) => {
	
		this.properties.curve = v;
		if(callback)
			callback(true);
		
	}, {filter: true});

	panel.addDropdown("Second curve direction", ["", ...DirectedMotionClip.second_directions], this.properties.secondCurve, (v, e, name) => {
	
		this.properties.secondCurve = v;
		if(callback)
			callback(true);
		
	}, {filter: true});

	panel.addNumber("Sharpness of the curve", this.properties.curveSteepness, (v, e, name) =>
	{
		this.properties.curveSteepness = v;
		if(callback)
			callback();
	}, {precision: 2, min: 0, step: 0.01});

	panel.addCheckbox("Apply zig-zag", this.zigzag, (v, e, name) =>
	{
		this.zigzag = v;
		this.properties.zigzag = v ? this.properties.zigzag: ""; // string 26 directions
		this.properties.zigzagSize = v ? this.properties.zigzagSize: null; // amplitude of zigzag (from highest to lowest point) in metres. Default 0.01 m (1 cm)
		this.properties.zigzagSpeed = v ? this.properties.zigzagSpeed : null;

		if(callback)
			callback(true);
	});

	if(this.zigzag) {
		panel.addDropdown("Zig zag direction", ["", ...DirectedMotionClip.directions], this.properties.zigzag, (v, e, name) => {
				
			this.properties.zigzag = v;
			if(callback)
				callback(true);
			
		}, {filter: true});

		panel.addNumber("Zig zag amplitude", this.properties.zigzagSize, (v, e, name) =>
		{
			this.properties.zigzagSize = v;
			if(callback)
				callback();
		}, {precision: 2, min: 0, step: 0.01});

		panel.addNumber("Zig zag speed", this.properties.zigzagSpeed, (v, e, name) =>
		{
			this.properties.zigzagSpeed = v;
			if(callback)
				callback();
		}, {precision: 2, min: 0, step: 1});
	
	}
}

//CircularMotionClip
CircularMotionClip.type = "gesture";
CircularMotionClip.hands = ["Left", "Right", "Both"];
CircularMotionClip.directions = ["Up", "Down", "Left", "Right", "In", "Out",
								"Up Left", "Up Right", "Up In", "Up Out",
								"Left In", "Left Out", "Right In", "Right Out",								
								"Down Left", "Down Right", "Down In", "Down Out",
								"Up Out Left", "Up Out Right", "Down Out Left", "Down Out Right",
								"Down Out Left", "Down Out Right", "Down In Left", "Down In Right"];
CircularMotionClip.second_directions = ["Up", "Down", "Left", "Right","Up Left", "Up Right", "Down Left", "Down Right"];

CircularMotionClip.id = ANIM.CIRCULARMOTION ? ANIM.CIRCULARMOTION: ANIM.clipTypes.length;
CircularMotionClip.clipColor = "#5e9fdd";

function CircularMotionClip(o)
{
	this.id= "Circular Motion";
	this.start = 0
	this.duration = 1;
	this._width = 0;
	
	this.properties = {
		hand: "Right",
		direction: "Out", // string 26 directions. Axis of rotation
		motion:  "Circular",
		
		// optionals
		secondDirection: "", // string 8 directions. Will compute midpoint between direction and secondDirection.
		distance: 0.05, // number, radius in metres of the circle. Default 0.05 m (5 cm)
		startAngle: 0, // where in the circle to start. 0º indicates up. Indicated in degrees. Default to 0º. [-infinity, +infinity]
		endAngle: 360, // where in the circle to finish. 0º indicates up. Indicated in degrees. Default to 360º. [-infinity, +infinity]
		zigzag: "", // string 26 directions
		zigzagSize: "", // amplitude of zigzag (from highest to lowest point) in metres. Default 0.01 m (1 cm)
		zigzagSpeed: "", // oscillations per second. Default 2
	}
	this.zigzag = false;

	if(o)
		this.configure(o);

	this.color = "#1a1f23";
	this.font = "11px Calibri";
	this.clipColor = CircularMotionClip.clipColor;
}

ANIM.registerClipType( CircularMotionClip );

CircularMotionClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	if(o.duration) this.duration = o.duration || 1;
	if(o.end) this.duration = (o.end - o.start) || 1;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
	for(let p in this.properties) {
		if(o[p] != undefined) {
			if(typeof(o[p]) == 'string')
				o[p] = capitalize(o[p].replaceAll("_", " "));
			this.properties[p] = o[p];
		}
	}
	if(o.direction) {
		this.properties.direction = "";
		for(let i = 0; i < o.direction.length; i++) {
			let char = o.direction[i];
			switch(char) {
				case "u":
					this.properties.direction += "Up";
					break;
				case "d":
					this.properties.direction += "Down";
					break;
				case "l":
					this.properties.direction += "Left";
					break;
				case "r":
					this.properties.direction += "Right";
					break;
				case "i":
					this.properties.direction += "In";
					break;
				case "o": 
					this.properties.direction += "Out";
				break;

			}
		}
	}
	if(o.secondDirection) {
		this.properties.secondDirection = "";
		for(let i = 0; i < o.secondDirection.length; i++) {
			let char = o.secondDirection[i];
			switch(char) {
				case "u":
					this.properties.secondDirection += "Up";
					break;
				case "d":
					this.properties.secondDirection += "Down";
					break;
				case "l":
					this.properties.secondDirection += "Left";
					break;
				case "r":
					this.properties.secondDirection += "Right";
					break;
			}
		}
	}

	if(o.zigzag) {
		this.properties.zigzag = "";
		for(let i = 0; i < o.zigzag.length; i++) {
			let char = o.zigzag[i];
			switch(char) {
				case "u":
					this.properties.zigzag += "Up";
					break;
				case "d":
					this.properties.zigzag += "Down";
					break;
				case "l":
					this.properties.zigzag += "Left";
					break;
				case "r":
					this.properties.zigzag += "Right";
					break;
				case "i":
					this.properties.zigzag += "In";
					break;
				case "o": 
					this.properties.zigzag += "Out";
				break;

			}
		}
	}
}

CircularMotionClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		end: this.start + this.duration,
		type: "gesture",
	}
	for(let i in this.properties)
	{
		if ( (i == "direction" || i == "secondDirection" || i == "zigzag") && this.properties[i] != "") {
			let d = this.properties[i].split(" ");
			json[i] = "";
			for(let j = 0; j < d.length; j++) {
				json[i] += d[j][0].toLowerCase();
			}
		}
		else 
			json[i] = typeof(this.properties[i]) == 'string' ? this.properties[i].replaceAll(" ", "_").toUpperCase() : this.properties[i];

		if(json[i] == "")
			json[i] = null;
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
	ctx.font = this.font;
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

CircularMotionClip.prototype.showInfo = function(panel, callback)
{
	panel.addText(null, "Moves the arm (wrist) in a circular motion.", null, {disabled: true});
	
	// Hand property
	panel.addDropdown("Hand", CircularMotionClip.hands, this.properties.hand, (v, e, name) => {
				
		this.properties.hand = v;
		if(callback)
			callback();
		
	}, {filter: true});

	// Movement direction property
	panel.addDropdown("Direction", CircularMotionClip.directions, this.properties.direction, (v, e, name) => {
				
		this.properties.direction = v;
		if(callback)
			callback(true);
		
	}, {filter: true});

	panel.addSeparator();
	
	panel.addTitle( "Optionals");
	
	// Displacement property
	panel.addDropdown("Second direction", ["", ...CircularMotionClip.second_directions], this.properties.secondDirection, (v, e, name) => {
	
		this.properties.secondDirection = v;
		if(callback)
			callback(true);
		
	}, {filter: true});

	// Distance property 
	panel.addNumber("Radius of the circle", this.properties.distance, (v, e, name) =>
	{
		this.properties.distance = v;
		if(callback)
			callback();
	}, {precision: 2, min: 0, step: 0.01});

	panel.addNumber("Start angle", this.properties.startAngle, (v, e, name) =>
	{
		this.properties.startAngle = v;
		if(callback)
			callback();
	}, {precision: 2, min: -360, max: 360, step: 0.1});

	panel.addNumber("End angle", this.properties.endAngle, (v, e, name) =>
	{
		this.properties.endAngle = v;
		if(callback)
			callback();
	}, {precision: 2, min: -360, max: 360, step: 0.1});


	panel.addCheckbox("Apply zig-zag", this.zigzag, (v, e, name) =>
	{
		this.zigzag = v;
		this.properties.zigzag = v ? this.properties.zigzag: ""; // string 26 directions
		this.properties.zigzagSize = v ? this.properties.zigzagSize: null; // amplitude of zigzag (from highest to lowest point) in metres. Default 0.01 m (1 cm)
		this.properties.zigzagSpeed = v ? this.properties.zigzagSpeed : null;

		if(callback)
			callback(true);
	});

	if(this.zigzag) {
		panel.addDropdown("Zig zag direction", ["", ...CircularMotionClip.directions], this.properties.zigzag, (v, e, name) => {
				
			this.properties.zigzag = v;
			if(callback)
				callback(true);
			
		}, {filter: true});

		panel.addNumber("Zig zag amplitude", this.properties.zigzagSize, (v, e, name) =>
		{
			this.properties.zigzagSize = v;
			if(callback)
				callback();
		}, {precision: 2, min: 0, step: 0.01});

		panel.addNumber("Zig zag speed", this.properties.zigzagSpeed, (v, e, name) =>
		{
			this.properties.zigzagSpeed = v;
			if(callback)
				callback();
		}, {precision: 2, min: 0, step: 1});
	
	}
}

//WristMotionClip
WristMotionClip.type = "gesture";
WristMotionClip.hands = ["Left", "Right", "Both"];
WristMotionClip.modes = ["Nod", "Nodding", "Swing", "Swinging", "Twist", "Twisting", "Stir CW", "Stir CCW", "All"];

WristMotionClip.id = ANIM.WRISTMOTION ? ANIM.WRISTMOTION: ANIM.clipTypes.length;
WristMotionClip.clipColor = "#5e9fdd";

function WristMotionClip(o)
{
	this.id= "Wrist Motion";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;
	
	this.properties = {
		hand: "Right",
		mode: "Nod",
		motion: "Wrist",
		 /* either a: 
			- string from [ "NOD", "NODDING", "SWING", "SWINGING", "TWIST", "TWISTING", "STIR_CW", "STIR_CCW", "ALL" ]
			- or a value from [ 0 = None, 1 = TWIST, 2 = NOD, SWING = 4 ]. 
		Several values can co-occur by using the OR (|) operator. I.E. ( 2 | 4 ) = STIR_CW
		Several values can co-occur by summing the values. I.E. ( 2 + 4 ) = STIR_CW
		*/

		// optionals
		speed: 3, // oscillations per second. Negative values accepted. Default 3. 
		intensity: 0.3, // [0,1]. Default 0.3
	}

	if(o)
		this.configure(o);

	this.color = "#1a1f23";
	this.font = "11px Calibri";
	this.clipColor = WristMotionClip.clipColor;
}

ANIM.registerClipType( WristMotionClip );

WristMotionClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	if(o.duration) this.duration = o.duration || 1;
	if(o.end) this.duration = (o.end - o.start) || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
	for(let p in this.properties) {
		if(o[p] != undefined) {
			if(typeof(o[p]) == 'string')
				o[p] = capitalize(o[p].replaceAll("_", " "));
			this.properties[p] = o[p];
		}
	}
}

WristMotionClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		end: this.start + this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture"
	}
	for(let i in this.properties)
	{
		json[i] = typeof(this.properties[i]) == 'string' ? this.properties[i].replaceAll(" ", "_").toUpperCase() : this.properties[i];

		if(json[i] == "")
			json[i] = null;
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
	ctx.font = this.font;
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

WristMotionClip.prototype.showInfo = function(panel, callback)
{
	panel.addText(null, "Repetitive swinging, nodding and twisting of wrist (wiggle for the wrist).", null, {disabled: true});
	
	// Hand property
	panel.addDropdown("Hand", WristMotionClip.hands, this.properties.hand, (v, e, name) => {
				
		this.properties.hand = v;
		if(callback)
			callback();
		
	}, {filter: true});

	// Mode property
	panel.addDropdown("Direction", WristMotionClip.modes, this.properties.mode, (v, e, name) => {
				
		this.properties.mode = v;
		if(callback)
			callback(true);
		
	}, {filter: true});

	panel.addSeparator();
	
	panel.addTitle( "Optionals");

	// Speed property 
	panel.addNumber("Speed", this.properties.speed, (v, e, name) =>
	{
		this.properties.speed = v;
		if(callback)
			callback();
	}, {precision: 2, step: 0.01});

	// Intensity property
	panel.addNumber("Intensity", this.properties.intensity, (v, e, name) =>
	{
		this.properties.intensity = v;
		if(callback)
			callback();
	}, {precision: 2, min: 0, max: 1, step: 0.1});
}

//FingerplayMotionClip
FingerplayMotionClip.type = "gesture";
FingerplayMotionClip.hands = ["Left", "Right", "Both"];
FingerplayMotionClip.fingers = ["Thumb", "Index", "Middle", "Ring", "Pinky"];

FingerplayMotionClip.id = ANIM.FINGERPLAYMOTION ? ANIM.FINGERPLAYMOTION: ANIM.clipTypes.length;
FingerplayMotionClip.clipColor = "#e6f598";

function FingerplayMotionClip(o)
{
	this.id= "Fingerplay Motion";
	this.start = 0
	this.duration = 1;
	this.attackPeak = this.fadein = 0.25; //if it's not permanent
	this.relax = this.fadeout = 0.75; //if it's not permanent
	this._width = 0;
	
	this.properties = {
		hand: "Right",
		motion: "Fingerplay",
		// optionals
		speed: 3, // oscillations per second. Default 3
		intensity: 0.5, //[0,1]. Default 0.3
		fingers: "Thumb Index Middle Ring Pinky", // string with numbers. Each number present activates a finger. 2=index, 3=middle, 4=ring, 4=pinky. I.E. "234" activates index, middle, ring but not pinky. Default all enabled
		exemptedFingers: "", //string with numbers. Blocks a finger from doing the finger play. Default all fingers move
	}

	if(o)
		this.configure(o);

	this.color = "#1a1f23";
	this.font = "11px Calibri";
	this.clipColor = FingerplayMotionClip.clipColor;
}

ANIM.registerClipType( FingerplayMotionClip );

FingerplayMotionClip.prototype.configure = function(o)
{
	this.start = o.start || 0;
	if(o.duration) this.duration = o.duration || 1;
	if(o.end) this.duration = (o.end - o.start) || 1;
	if(o.attackPeak) this.attackPeak = this.fadein = o.attackPeak;
	if(o.relax) this.relax = this.fadeout = o.relax;
	if(o.properties)
	{
		Object.assign(this.properties, o.properties);
	}
	for(let p in this.properties) {
		if(o[p] != undefined) {
			if(typeof(o[p]) == 'string')
				o[p] = capitalize(o[p].replaceAll("_", " "));
			this.properties[p] = o[p];
		}
	}

	if(o.fingers) {
		this.properties.fingers = "";
		for(let char in o.fingers) {

			this.properties.fingers += FingerplayMotionClip.fingers[char] + " ";
		}
	}
	if(o.exemptedFingers) {
		this.properties.exemptedFingers = "";
		for(let char in o.exemptedFingers) {

			this.properties.exemptedFingers += FingerplayMotionClip.fingers[char] + " ";
		}
	}
}

FingerplayMotionClip.prototype.toJSON = function()
{
	var json = {
		id: this.id,
		start: this.start,
		end: this.start + this.duration,
		attackPeak: this.attackPeak,
		relax: this.relax,
		type: "gesture",
	}

	for(let i in this.properties)
	{
		if(i == "fingers" || i == "exemptedFingers") {

			let fingers = this.properties[i].split(" ");
			json[i] = "";
			for(let f = 0; f < fingers.length; f++) {

				let idx = FingerplayMotionClip.fingers.indexOf(fingers[f]);
				json[i] += idx < 0 ? "" : idx + 1;
			}
		}
		else 
			json[i] = typeof(this.properties[i]) == 'string' ? this.properties[i].replaceAll(" ", "_").toUpperCase() : this.properties[i];

		if(json[i] == "")
			json[i] = null;
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
	ctx.font = this.font;
	ctx.globalCompositeOperation =  "source-over";
	let textInfo = ctx.measureText( this.id );
	ctx.fillStyle = this.color;
	if( textInfo.width < (w - 24) )
		ctx.fillText( this.id, 24,h * 0.7 );
}

FingerplayMotionClip.prototype.showInfo = function(panel, callback)
{
	panel.addText(null, "Wiggle fingers of the hand.", null, {disabled: true});
	
	// Hand property
	panel.addDropdown("Hand", FingerplayMotionClip.hands, this.properties.hand, (v, e, name) => {
				
		this.properties.hand = v;
		if(callback)
			callback();
		
	}, {filter: true});

	panel.addSeparator();
	
	panel.addTitle( "Optionals");

	// Speed property 
	panel.addNumber("Speed", this.properties.speed, (v, e, name) =>
	{
		this.properties.speed = v;
		if(callback)
			callback();
	}, {precision: 2, step: 0.01});

	// Intensity property
	panel.addNumber("Intensity", this.properties.intensity, (v, e, name) =>
	{
		this.properties.intensity = v;
		if(callback)
			callback();
	}, {precision: 2, min: 0, max: 1, step: 0.1});

	panel.addText(null, "Active fingers", null, {disabled:true});

	for(let i=0; i < FingerplayMotionClip.fingers.length; i++) {

		let active = this.properties.fingers.includes(FingerplayMotionClip.fingers[i]);
		panel.addCheckbox(FingerplayMotionClip.fingers[i], active, (v,e, name) => {
			if(v) {
				this.properties.fingers += name + " ";
			}
			else {
				this.properties.fingers = this.properties.fingers.replace(name + " ", "");
			}
			if(callback)
				callback();
		} )
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

function capitalize(text) {
	text = text.toLowerCase();
	return text.charAt(0).toUpperCase() + text.slice(1);
}
global.getTime = performance.now.bind(performance);


function RGB(r,g,b) { return "rgb(" + Math.floor(Math.clamp(r,0,1)*255) + "," + Math.floor(Math.clamp(g,0,1)*255) + "," + Math.floor(Math.clamp(b,0,1)*255) + ")"; }
function HSL(h,s,L) { return "hsl(" + Math.floor(h*360) + "," + Math.floor(Math.clamp(s,0,1)*100) + "%," + Math.floor(Math.clamp(v,0,1)*100) + "%)"; }
global.RGB = RGB;
global.HSL = HSL;


})(this);
