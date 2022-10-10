import * as THREE from "./libs/three.module.js";
import "https://cdn.jsdelivr.net/npm/low-pass-filter"
//-----------------------------------------------@MouthAnalyser-----------------------------------------------

/*var PITCH_CONFIDENCE = 5//10.0; //5.f
var YAW_CONFIDENCE = 10//15.0; //10.f
var ROLL_CONFIDENCE	= 15//20.0; //15.f*/

class MouthAnalyser{

  constructor(){


    //Properties
    this.properties = {
      
      CALIBRATION_QUEUE_LENGTH: 20,
      expression_confidence: 1,
      pitch_confidence: 10,
      yaw_confidence : 10,
      roll_confidence: 15
    }

    //----ACTION UNITS
    this._AUStates = {};
    this._actionUnitWeightMap = {};
    this.neutralAUStates = {};
    this.newAUWeights = {};
    this.newFaceAngles = {};
    this.currentAUWeights = null;
    this.currentFaceAngles = null;
    this.lastAUWeights = {};
    
    var AUs = MouthAnalyser.ActionUnits;
    
    for(var i = 0; i< AUs.length; i++)
    {
      var au = AUs[i];
      this._AUStates[au] = 0 ;
      this._actionUnitWeightMap[au] = 0;
      this.neutralAUStates[au] = 0;
      this.lastAUWeights[au] = 0;
      this.newAUWeights[au] = 0;
    }
  
    //----CALIBRATION
    this.calibrated = false;
    this.calibrating = false;

    this.faceNum = 0;
   
    this.faceQueue = [];
    this._currentFace = {};
    this.neutralFAPUs = {}//Object.assign({}, _neutralFAPUs);
    //this.neutralAUStates = {}//Object.assign({},actionUnit);
    this.neutralPose ={}// Object.assign({}, _neutralPose);
    this.scale = 1;
    
    
    this.lastFace = null;
    this.lastFaceAngles = null;
    //wait = 30;
  }
  //this.expressionConfidence = -1;
}
MouthAnalyser.MOUTH_OPEN = "Mouth open";
MouthAnalyser.MOUTH_LEFT_RAISE = "Left raise";
MouthAnalyser.MOUTH_RIGHT_RAISE = "Right raise";
MouthAnalyser.MOUTH_LEFT = "Mouth Left"
MouthAnalyser.MOUTH_RIGHT = "Mouth right";
MouthAnalyser.ActionUnits = ["MOUTH_OPEN" , "MOUTH_LEFT_RAISE", "MOUTH_RIGHT_RAISE", "MOUTH_LEFT", "MOUTH_RIGHT"];
MouthAnalyser.FAPUS = ["MNS", "MW"];

MouthAnalyser.prototype.onGetOutputs = function() {
	return [[MouthAnalyser.MOUTH_OPEN,"number"],
          [MouthAnalyser.MOUTH_LEFT_RAISE ,"number"],
          [MouthAnalyser.MOUTH_RIGHT_RAISE ,"number"],
          [MouthAnalyser.MOUTH_LEFT ,"number"],
          [MouthAnalyser.MOUTH_RIGHT ,"number"]];
}
MouthAnalyser.prototype.onGetInputs = function() {
  return [["expr_confidence", "number"], ["pitch_confidence", "number"], ["yaw_confidence", "number"], ["roll_confidence", "number"]];
}
MouthAnalyser.prototype.update = function(face)
{
  //var face = this.getInputData(0);
  if(!face) return;
  if(this.inputs){

    for(var i= 1; i<this.inputs.length;i++)
    {
      var input = this.inputs[i];
      switch(input.name){
        
        case "expr_confidence":
          if(this.getInputData(i))
          	this.properties["expression_confidence"] = this.getInputData(i);
          break;
        case "pitch_confidence":
          if(this.getInputData(i))
          	this.properties["pitch_confidence"] = this.getInputData(i);
          break;
        case "yaw_confidence":
          if(this.getInputData(i))
          	this.properties["yaw_confidence"] = this.getInputData(i);
          break;
        case "roll_confidence":
          if(this.getInputData(i))
          	this.properties["roll_confidence"] = this.getInputData(i);
          break;
      }

    }
  }
	if(face)
  {
    this._currentFace = face;
    this.maxQueueLength = this.properties["CALIBRATION_QUEUE_LENGTH"];
    this.expressionConfidence = this.properties["expression_confidence"];

    if(face.neutral ){//|| this.getInputData(1)){
      this.calibrating = true;
      this.calibrated = false;
      this.faceNum = 0;
      this.faceQueue = [];
    }
    if(this.faceNum >= this.maxQueueLength&&this.calibrating){
      //this.scale = face.scale;

      var AUs = MouthAnalyser.ActionUnits;
 			this.neutralFAPUs = {}  
  		this.neutralPose ={}
      
      for(var i = 0; i< AUs.length; i++)
      {
        var au = AUs[i];

        this.neutralAUStates[au] = 0;

      }
      this.extractNeutralAUStates()
      this.extractNeutralFAPUs();
      this.extractNeutralPose();

      this.cleanQueue();
      this.faceNum = 0;
      this.calibrating = false;
      this.calibrated = true;
    } 

    var auStates = this.measureAUStates();

    /*var faceAngles = {
      x: -face.rotationX,		//pitch
      y: -face.rotationY,		//yaw
      z: face.rotationZ     //roll
    };*/

    if(this.calibrating){

      var fapus = this.measureFAPUs();

      var newFace = {
        FAPUs: fapus,
        AUStates: auStates,
        //headPose: faceAngles
      };
      this.queueNewFace(newFace);
    }
    else if(this.calibrated){

      this._AUStates = auStates;
      this.computeWeights();
      var fapus = this.measureFAPUs();
      this._currentFace.FAPUs = fapus;
      var newFace = {
        FAPUs:fapus,
        AUStates: auStates,
        //headPose: faceAngles,
        weightMap: this._actionUnitWeightMap
      };  
      this.queueNewFace(newFace);

      if(this.lastFace == null) return;

      this.optimizeAUWeights(); 
      //this.optimizeFaceAngles(); 

      this.smoothAUWeights();	
      //this.smoothFaceAngles();

      this.lastAUWeights = Object.assign({},this.newAUWeights);
      this.lastFaceAngles = Object.assign({},this.newFaceAngles);

    }
	}

  if(this.outputs)
    for(var i = 0; i < this.outputs.length; i++)
    {
      var output = this.outputs[i];
      if(!output.links || !output.links.length)
        continue;

      var result = null;
      switch( output.name )
      {
        case MouthAnalyser.MOUTH_OPEN: 
          result = this.lastAUWeights["MOUTH_OPEN"];
          break;
        case MouthAnalyser.MOUTH_LEFT_RAISE: 
          result = this.lastAUWeights["MOUTH_LEFT_RAISE"];
          break;
        case MouthAnalyser.MOUTH_RIGHT_RAISE : 
          result = this.lastAUWeights["MOUTH_RIGHT_RAISE"];
          break;
        case MouthAnalyser.MOUTH_LEFT : 
          result = this.lastAUWeights["MOUTH_LEFT"];
          break;
        case MouthAnalyser.MOUTH_RIGHT : 
          result = this.lastAUWeights["MOUTH_RIGHT"];
          break;
      }
      this.setOutputData(i, result);
    }
    return this.lastAUWeights;
  
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//							RSNeutralFace
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

MouthAnalyser.prototype.measureFAPUs = function(landmarks)
{
  var fapus = {};
	//if(this.calibrating){
  
		fapus["MNS"] = this.landmarkDistance(0,1)/1024;//this.landmarkDistance(2,13) / 1024;//this.landmarkDistance(33,62) / 1024;
		fapus["MW"] = this.landmarkDistance(61,291) / 1024;//this.landmarkDistance(48,54) / 1024;
   
 // }
  return fapus;
}
MouthAnalyser.prototype.extractNeutralFAPUs = function()
{
	if(this.faceNum<=0) return;
  
  var FAPUs = MouthAnalyser.FAPUS;
  var sum = {};
  for(var i = 0; i<FAPUs.length; i++)
  {
    var fapu = FAPUs[i];
    sum[fapu] = 0;
  }

	for(var i = 0; i < this.faceQueue.length; i++)
	{
		if( this.faceQueue[i] == null || this.faceQueue[i] == undefined) continue;
		var nf = this.faceQueue[i];
    for(var fapu in nf.FAPUs){
    	sum[fapu] += nf.FAPUs[fapu];
    }
	}
	//sha darreglar
  for(var fapu in nf.FAPUs){
  //	if(calibrating =="front"){
    	this.neutralFAPUs[fapu] = sum[fapu]/this.faceNum;
  /*  }
    else{
    	this.maxFAPUs[calibrating][fapu] = sum[fapu]/this.faceNum;
    }*/
  }
}
MouthAnalyser.prototype.extractNeutralAUStates = function()
{
	if(this.faceNum<=0) return;

	for(var i = this.faceQueue.length - 1; i > -1; i--)
	{
		if( this.faceQueue[i] == null || this.faceQueue[i] == undefined) continue;

		var AUStates = this.faceQueue[i].AUStates;
		for(var au in AUStates)
		{
				this.neutralAUStates[au] += AUStates[au]/this.faceNum;
		}
	}
}
MouthAnalyser.prototype.extractNeutralPose = function(){
	if(this.faceNum<=0) return;

  var sumYPR = { x:0, y:0, z:0}// Object.assign({}, _neutralPose);
  
  for(var i = 0; i < this.faceQueue.length; i++)
	{
		if( this.faceQueue[i] == null || this.faceQueue[i] == undefined) continue;
		var nf = this.faceQueue[i];
    /*for(var pos in nf.headPose){
    	sumYPR[pos] += nf.headPose[pos];
    }*/
	}
  
  /*for(var pos in nf.headPose)
  {
    	this.neutralPose[pos] = sumYPR[pos]/this.faceNum;
  }*/
}

MouthAnalyser.prototype.landmarkDistance = function(i,j)
{
  var landmarks = this._currentFace.points;

  var vi = new THREE.Vector3(landmarks[i].x, landmarks[i].y, landmarks[i].z);
  var vj = new THREE.Vector3(landmarks[j].x, landmarks[j].y, landmarks[j].z);
  
  return vi.distanceTo(vj);

}
MouthAnalyser.prototype.measureAUStates = function(landmarks)
{
  var mouth_open  = (this.landmarkDistance(81,178)+this.landmarkDistance(13,14)+this.landmarkDistance(311,402))/3;
  var mouth_left_raise = - (this.landmarkDistance(362,291)-this.landmarkDistance(291,1)); 
	var mouth_right_raise = - (this.landmarkDistance(133,61) - this.landmarkDistance(61,1)); 
	var mouth_left = this.landmarkDistance(291,263) - this.landmarkDistance(291,1);
	var mouth_right  = this.landmarkDistance(61,33) - this.landmarkDistance(61,1);
  /*var mouth_open  = (this.landmarkDistance(61,67)+this.landmarkDistance(62,66)+this.landmarkDistance(63,65))/3;
  var mouth_left_raise = - (this.landmarkDistance(42,54)-this.landmarkDistance(54,33)); 
	var mouth_right_raise = - (this.landmarkDistance(39,48) - this.landmarkDistance(48,33)); 
	var mouth_left = this.landmarkDistance(54,45) - this.landmarkDistance(54,33);
	var mouth_right  = this.landmarkDistance(48,36) - this.landmarkDistance(48,33);*/
	  
  var auStates = {
    MOUTH_OPEN: mouth_open , 
    MOUTH_LEFT_RAISE: mouth_left_raise, 
    MOUTH_RIGHT_RAISE: mouth_right_raise, 
    MOUTH_LEFT: mouth_left, 
    MOUTH_RIGHT: mouth_right
  }
  return auStates;
}
MouthAnalyser.prototype.computeWeights = function()
{
  var smooth = this.scale/this._currentFace.scale;
  
  var MNS0 = this._currentFace.FAPUs ? this._currentFace.FAPUs["MNS"]: this.neutralFAPUs["MNS"];
  var MW0 = this._currentFace.FAPUs ? this._currentFace.FAPUs["MW"]: this.neutralFAPUs["MW"];

	{//MOUTH_OPEN,
		var currentValue = this._AUStates["MOUTH_OPEN"]*smooth;
		var neutralValue = this.neutralAUStates["MOUTH_OPEN"];

		var delta = (currentValue - neutralValue)/MNS0; 

    if (delta > 0)
      this._actionUnitWeightMap["MOUTH_OPEN"] = CalWeight(delta, 1024 * 1);//1.2
    else
      this._actionUnitWeightMap["MOUTH_OPEN"] = 0;
    
	}

	{//MOUTH_LEFT_RAISE,	
		var currentValue = this._AUStates["MOUTH_LEFT_RAISE"]*smooth;
		var neutralValue = this.neutralAUStates["MOUTH_LEFT_RAISE"];

		var delta = (currentValue - neutralValue)/MNS0;

    if (delta > 0)
      this._actionUnitWeightMap["MOUTH_LEFT_RAISE"] = CalWeight(delta, 1024 * 0.4);
    else
      this._actionUnitWeightMap["MOUTH_LEFT_RAISE"] =  0;
    
	}

	{//MOUTH_RIGHT_RAISE,
		var currentValue = this._AUStates["MOUTH_RIGHT_RAISE"]*smooth;
		var neutralValue = this.neutralAUStates["MOUTH_RIGHT_RAISE"];

		var delta = (currentValue - neutralValue)/MNS0;
    
    if (delta > 0)
      this._actionUnitWeightMap["MOUTH_RIGHT_RAISE"] = CalWeight(delta, 1024 * 0.4);
    else
      this._actionUnitWeightMap["MOUTH_RIGHT_RAISE"] = 0;
  
	}
  {//MOUTH_LEFT_DECLINE,	
		var currentValue = this._AUStates["MOUTH_LEFT_RAISE"]*smooth;
		var neutralValue = this.neutralAUStates["MOUTH_LEFT_RAISE"];

		var delta = (currentValue - neutralValue)/MNS0;
    
    if (delta > 0)
      this._actionUnitWeightMap["MOUTH_LEFT_DECLINE"] =0;
    else
      this._actionUnitWeightMap["MOUTH_LEFT_DECLINE"] =  CalWeight(-delta, 1024 * 0.7);
	}

	{//MOUTH_RIGHT_DECLINE,
		var currentValue = this._AUStates["MOUTH_RIGHT_RAISE"]*smooth;
		var neutralValue = this.neutralAUStates["MOUTH_RIGHT_RAISE"];

		var delta = (currentValue - neutralValue)/MNS0;
    
    if (delta > 0)
      this._actionUnitWeightMap["MOUTH_RIGHT_DECLINE"] =0;
    else
      this._actionUnitWeightMap["MOUTH_RIGHT_DECLINE"] =  CalWeight(-delta, 1024 * 0.7);

	}

	{//MOUTH_LEFT,	
		var currentValue = this._AUStates["MOUTH_LEFT"]*smooth;
		var neutralValue = this.neutralAUStates["MOUTH_LEFT"];

		var delta = (currentValue - neutralValue)/MW0;
    
    if (delta > 0)
      this._actionUnitWeightMap["MOUTH_LEFT"] = CalWeight(delta, 1024 * 0.2);
    else
      this._actionUnitWeightMap["MOUTH_LEFT"] = 0;

	}

	{//MOUTH_RIGHT,
		var currentValue = this._AUStates["MOUTH_RIGHT"]*smooth;
		var neutralValue = this.neutralAUStates["MOUTH_RIGHT"];

		var delta = (currentValue - neutralValue)/MW0;
    
    if (delta > 0)
      this._actionUnitWeightMap["MOUTH_RIGHT"] = CalWeight(delta, 1024 * 0.2);
    else
      this._actionUnitWeightMap["MOUTH_RIGHT"] = 0;
  }
}


MouthAnalyser.prototype.evaluteStates = function()
{
	//LostTracking
	var lostTrackingRate = 1 - this.faceNum/this.faceQueue.length;

	//PoseShifting
	var rawAngles = this.lastFace.headPose;

  var pitch = this.properties["pitch_confidence"]*DEG2RAD - this.neutralPose.x;
  var yaw = this.properties["yaw_confidence"]*DEG2RAD - this.neutralPose.y;
  var roll = this.properties["roll_confidence"]*DEG2RAD - this.neutralPose.z;
  
	var wx = Math.clamp(Math.abs(rawAngles.x)/pitch,0,1);
	var wy = Math.clamp(Math.abs(rawAngles.y)/yaw,0,1);
	var wz = Math.clamp(Math.abs(rawAngles.z)/roll,0,1);
  
	var poseShiftingRate = Math.max(Math.max(wx, wy),wz);

	var conf = Math.max(lostTrackingRate,poseShiftingRate);
	conf = Math.pow(conf,2);
	this.expressionConfidence =  this.properties["expression_confidence"] - conf;
	this.expressionConfidence = Math.clamp(this.expressionConfidence,0,1);
}

MouthAnalyser.prototype.optimizeAUWeights = function()
{
  this.currentAUWeights = Object.assign({},this.lastFace.weightMap);
	this.newAUWeights = Object.assign({},this.currentAUWeights);
  
	this.newAUWeights["MOUTH_RIGHT_RAISE"] = Math.clamp(this.currentAUWeights["MOUTH_RIGHT_RAISE"] - this.currentAUWeights["MOUTH_LEFT"], 0, 1);
  this.newAUWeights["MOUTH_LEFT_RAISE"] = Math.clamp(this.currentAUWeights["MOUTH_LEFT_RAISE"] - this.currentAUWeights["MOUTH_RIGHT"], 0, 1);

}
MouthAnalyser.prototype.smoothAUWeights = function()
{ 	
	//this.evaluteStates();

	for(var au in this.lastAUWeights)
	{
    this.newAUWeights[au] = this.lastAUWeights[au]*(1-this.expressionConfidence) + this.newAUWeights[au]*this.expressionConfidence;
		
	}
}

MouthAnalyser.prototype.queueNewFace = function(face)
{
	this.faceQueue.push(face);
	
	if(face != null){
		this.faceNum++;
		this.lastFace = face;
	}

	while(this.faceQueue.length > this.maxQueueLength)
	{
		var frontface = this.faceQueue.shift();
		if(frontface == this.lastFace) this.lastFace = null;
		if(frontface != null){ 
			this.faceNum--;
			//delete frontface;
		}
	};
}

MouthAnalyser.prototype.cleanQueue = function()
{
	while(this.faceQueue.length>0)
	{
		var frontface = this.faceQueue.shift();
		//if(frontface) delete frontface;
	}
	this.faceNum = 0;
	this.lastFace = null;
}

function CalWeight(delta, threshold)
{
	var weight = 0;
	if ((delta > 0) && (threshold > 0))
	{
		weight = Math.min(Math.max(delta / threshold, 0.0), 1.0);
	}
	return weight;
}


//-----------------------------------------------@EyebrowsAnalyser-----------------------------------------------

class EyebrowsAnalyser{

  constructor(){
    //Properties
    this.properties = {
      CALIBRATION_QUEUE_LENGTH: 20,
      expression_confidence: 1,
      pitch_confidence: 15,
      yaw_confidence : 15,
      roll_confidence: 15
    }
  /*  this.addProperty("CALIBRATION_QUEUE_LENGTH",20);
    this.addProperty("expression confidence", 1)
    this.addProperty("PITCH_CONFIDENCE" , 5)
    this.addProperty("YAW_CONFIDENCE" , 10)
    this.addProperty("ROLL_CONFIDENCE" , 15)*/

    //----ACTION UNITS
    this.newAUWeights = {};
    this._AUStates = {};
    this._actionUnitWeightMap = {};
    this.neutralAUStates = {};
    this.lastAUWeights = {};
    
    var AUs = EyebrowsAnalyser.ActionUnits;
    
    for(var i = 0; i< AUs.length; i++)
    {
      var au = AUs[i];
      this._AUStates[au] = 0 ;
      this._actionUnitWeightMap[au] = 0;
      this.neutralAUStates[au] = 0;
      this.lastAUWeights[au] = 0;
      this.newAUWeights[au] = 0;
    }
    //----CALIBRATION
    this.calibrated = false;
    this.calibrating = false;

    this.faceNum = 0;
    this.faceQueue = [];
    this._currentFace = {};
    this.neutralFAPUs = {}//Object.assign({}, _neutralFAPUs);
    //this.neutralAUStates = {}//Object.assign({},actionUnit);
    this.neutralPose ={}// Object.assign({}, _neutralPose);
    this.scale = 1;
    
    this.newFaceAngles = {};
    this.currentAUWeights = null;
    this.currentFaceAngles = null;
    
    this.lastFace = null;
    this.lastFaceAngles = null;
    //wait = 30;
  // this.expressionConfidence = 1;
  }
}
EyebrowsAnalyser.EYEBROW_DOWN_L = "down left";
EyebrowsAnalyser.EYEBROW_DOWN_R = "down right";
EyebrowsAnalyser.EYEBROW_UP_L = "up left";
EyebrowsAnalyser.EYEBROW_UP_R = "up right";

EyebrowsAnalyser.ActionUnits = [ "EYEBROW_DOWN_L", "EYEBROW_DOWN_R", "EYEBROW_UP_L", "EYEBROW_UP_R" ];

EyebrowsAnalyser.FAPUS = ["ES", "ENS"];

EyebrowsAnalyser.prototype.onGetOutputs = function() {
	return [[EyebrowsAnalyser.EYEBROW_DOWN_L,"number"],
          [EyebrowsAnalyser.EYEBROW_DOWN_R ,"number"],
          [EyebrowsAnalyser.EYEBROW_UP_L ,"number"],
          [EyebrowsAnalyser.EYEBROW_UP_R ,"number"]];
}
EyebrowsAnalyser.prototype.onGetInputs = function() {
  return [["expr_confidence", "number"], ["pitch_confidence", "number"], ["yaw_confidence", "number"], ["roll_confidence", "number"]];
}
EyebrowsAnalyser.prototype.update = function(face)
{
 // var face = this.getInputData(0);
//  if(!face) return;
  if(this.inputs){

    for(var i= 1; i<this.inputs.length;i++)
    {
      var input = this.inputs[i];
      switch(input.name){
        
        case "expr_confidence":
          if(this.getInputData(i))
          	this.properties["expression_confidence"] = this.getInputData(i);
          break;
        case "pitch_confidence":
          if(this.getInputData(i))
          	this.properties["pitch_confidence"] = this.getInputData(i);
          break;
        case "yaw_confidence":
          if(this.getInputData(i))
          	this.properties["yaw_confidence"] = this.getInputData(i);
          break;
        case "roll_confidence":
          if(this.getInputData(i))
          	this.properties["roll_confidence"] = this.getInputData(i);
          break;
      }

    }
  }
	if(face)
  {
    this._currentFace = face;
    this.maxQueueLength = this.properties["CALIBRATION_QUEUE_LENGTH"];
    this.expressionConfidence = this.properties["expression_confidence"];
    
    if(face.neutral){
      this.calibrating = true;
      this.calibrated = false;
      this.faceNum = 0;
      this.faceQueue = [];
    }
    
    if(this.faceNum >= this.maxQueueLength&&this.calibrating){
      this.scale = face.scale;

      this.neutralAUStates = {
        EYEBROW_DOWN_L: 0,
        EYEBROW_DOWN_R: 0,
        EYEBROW_UP_L: 0,
        EYEBROW_UP_R: 0
      }
      this.extractNeutralAUStates()
      this.extractNeutralFAPUs();
      this.extractNeutralPose();

      this.cleanQueue();
      this.faceNum = 0;
      this.calibrating = false;
      this.calibrated = true;
    } 

    var auStates = this.measureAUStates();


    if(this.calibrating){

      var fapus = this.measureFAPUs();

      var newFace = {
        FAPUs: fapus,
        AUStates: auStates
     
      };
      this.queueNewFace(newFace);
    }
    else if(this.calibrated){

      this._AUStates = auStates;
      this.computeWeights();
      var newFace = {
        AUStates: auStates,
        weightMap: this._actionUnitWeightMap
      };  
      this.queueNewFace(newFace);

      if(this.lastFace == null) return;

      this.optimizeAUWeights(); 
      //this.optimizeFaceAngles(); 

      this.smoothAUWeights();	
      //this.smoothFaceAngles();

      this.lastAUWeights = Object.assign({},this.newAUWeights);
      //this.lastFaceAngles = Object.assign({},this.newFaceAngles);

    }
  }  
	
  
  if(this.outputs)
    for(var i = 0; i < this.outputs.length; i++)
    {
      var output = this.outputs[i];
      if(!output.links || !output.links.length)
        continue;

      var result = null;
      switch( output.name )
      {
        case EyebrowsAnalyser.EYEBROW_DOWN_L: 
          result = this.lastAUWeights["EYEBROW_DOWN_L"];
          break;
        case EyebrowsAnalyser.EYEBROW_DOWN_R: 
          result = this.lastAUWeights["EYEBROW_DOWN_R"];
          break;
        case EyebrowsAnalyser.EYEBROW_UP_L : 
          result = this.lastAUWeights["EYEBROW_UP_L"];
          break;
        case EyebrowsAnalyser.EYEBROW_UP_R : 
          result = this.lastAUWeights["EYEBROW_UP_R"];
          break;
      }
      this.setOutputData(i, result);
    }
  return this.lastAUWeights;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//							RSNeutralFace
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

EyebrowsAnalyser.prototype.measureFAPUs = function(landmarks)
{
  var fapus = {};
	if(this.calibrating){
  
    fapus["ES"] = this.landmarkDistance(468,473)/1024//(this.landmarkDistance(33,133)*0.5 + this.landmarkDistance(362,263)*0.5 + this.landmarkDistance(133,362)) / 1024;
		fapus["ENS"] = this.landmarkDistance(1,6)/1024//this.landmarkDistance(168,2) / 1024;
  }
  return fapus;
}
EyebrowsAnalyser.prototype.extractNeutralFAPUs = function()
{
	if(this.faceNum<=0) return;

  var sum = {
    ES:0, //eye separation
    ENS:0 //eye-nose separation
  }; //angle unit

	for(var i = 0; i < this.faceQueue.length; i++)
	{
		if( this.faceQueue[i] == null || this.faceQueue[i] == undefined) continue;
		var nf = this.faceQueue[i];
    for(var fapu in nf.FAPUs){
    	sum[fapu] += nf.FAPUs[fapu];
    }
	}

  for(var fapu in nf.FAPUs)
  {
    	this.neutralFAPUs[fapu] = sum[fapu]/this.faceNum;
  }
}
EyebrowsAnalyser.prototype.extractNeutralAUStates = function()
{
	if(this.faceNum<=0) return;

	for(var i = this.faceQueue.length - 1; i > -1; i--)
	{
		if( this.faceQueue[i] == null || this.faceQueue[i] == undefined) continue;

		var AUStates = this.faceQueue[i].AUStates;
		for(var au in AUStates)
		{
				this.neutralAUStates[au] += AUStates[au]/this.faceNum;
		}
	}
}
EyebrowsAnalyser.prototype.extractNeutralPose = function(){
	if(this.faceNum<=0) return;

	var sumYPR = { x:0, y:0, z:0}

  for(var i = 0; i < this.faceQueue.length; i++)
	{
		if( this.faceQueue[i] == null || this.faceQueue[i] == undefined) continue;
		var nf = this.faceQueue[i];
    // for(var pos in nf.headPose){
    // 	sumYPR[pos] += nf.headPose[pos];
    // }
	}
  
  // for(var pos in nf.headPose){
  //   	this.neutralPose[pos] = sumYPR[pos]/this.faceNum;
  // }
}

EyebrowsAnalyser.prototype.landmarkDistance = function(i,j)
{
  var landmarks = this._currentFace.points;

  var vi = new THREE.Vector3(landmarks[i].x, landmarks[i].y, landmarks[i].z);
  var vj = new THREE.Vector3(landmarks[j].x, landmarks[j].y, landmarks[j].z);

  return vi.distanceTo(vj);

}
EyebrowsAnalyser.prototype.measureAUStates = function(landmarks)
{
  var eyebrow_left = (this.landmarkDistance(285,362)+this.landmarkDistance(295,381)+this.landmarkDistance(282,380))/3;//(this.landmarkDistance(285,362)+this.landmarkDistance(295,380)+this.landmarkDistance(282,373))/3;
  var eyebrow_right = (this.landmarkDistance(55,133)+this.landmarkDistance(65,154)+this.landmarkDistance(52,153))/3; 
  
  var auStates = {
    EYEBROW_DOWN_L: eyebrow_left,
    EYEBROW_UP_L: eyebrow_left,
    EYEBROW_DOWN_R: eyebrow_right,
    EYEBROW_UP_R: eyebrow_right
  }
  return auStates;
}
EyebrowsAnalyser.prototype.computeWeights = function()
{
  
	var ENS0 = this.neutralFAPUs["ENS"];
	var ES0 = this.neutralFAPUs["ES"];
    
  var smooth = this.scale/this._currentFace.scale;
  
	{//EYEBROW_Up_L,
		var currentValue = this._AUStates["EYEBROW_UP_L"]///this._currentFace.scale;;
		var neutralValue = this.neutralAUStates["EYEBROW_UP_L"]///this.scale;
		
		var delta = (currentValue*smooth - neutralValue)/ENS0;

    if (delta >= 0)
      this._actionUnitWeightMap["EYEBROW_UP_L"] = CalWeight(delta, 1024 * 0.2);
    else
      this._actionUnitWeightMap["EYEBROW_UP_L"] = 0;
    
	}

	{//EYEBROW_Up_R,
		var currentValue = this._AUStates["EYEBROW_UP_R"]///this._currentFace.scale;;
		var neutralValue = this.neutralAUStates["EYEBROW_UP_R"]///this.scale;;

		var delta = (currentValue*smooth - neutralValue)/ENS0;

    if (delta >= 0)
      this._actionUnitWeightMap["EYEBROW_UP_R"] = CalWeight(delta, 1024 * 0.2);
    else
      this._actionUnitWeightMap["EYEBROW_UP_R"] = 0;

	}
	
	{//EYEBROW_DOWN_L,
		var currentValue = this._AUStates["EYEBROW_DOWN_L"]///this._currentFace.scale;;
		var neutralValue = this.neutralAUStates["EYEBROW_DOWN_L"]///this.scale;;

		var delta = (currentValue*smooth - neutralValue)/ES0;
    
    if (delta > 0)
      this._actionUnitWeightMap["EYEBROW_DOWN_L"] = 0;
    else
      this._actionUnitWeightMap["EYEBROW_DOWN_L"] = CalWeight(-delta, 1024 * 0.1);
  
	}

	{//EYEBROW_DOWN_R,
		var currentValue = this._AUStates["EYEBROW_DOWN_R"]///this._currentFace.scale;;
		var neutralValue = this.neutralAUStates["EYEBROW_DOWN_R"]///this.scale;;

		var delta = (currentValue*smooth - neutralValue)/ES0;
    
    if (delta > 0)
      this._actionUnitWeightMap["EYEBROW_DOWN_R"] = 0;
    else
      this._actionUnitWeightMap["EYEBROW_DOWN_R"] = CalWeight(-delta, 1024 * 0.1);
   
	}
}

EyebrowsAnalyser.prototype.evaluteStates = function()
{
	//LostTracking
	var lostTrackingRate = 1 - this.faceNum/this.faceQueue.length;

	//PoseShifting
	var rawAngles = this.lastFace.headPose;
  
  var pitch = this.properties["pitch_confidence"]*DEG2RAD - this.neutralPose.x;
  var yaw = this.properties["yaw_confidence"]*DEG2RAD - this.neutralPose.y;
  var roll = this.properties["roll_confidence"]*DEG2RAD - this.neutralPose.z;
  
	var wx = Math.clamp(Math.abs(rawAngles.x)/pitch,0,1);
	var wy = Math.clamp(Math.abs(rawAngles.y)/yaw,0,1);
	var wz = Math.clamp(Math.abs(rawAngles.z)/roll,0,1);
	var poseShiftingRate = Math.max(Math.max(wx, wy),wz);

	var conf = Math.max(lostTrackingRate,poseShiftingRate);
	conf = Math.pow(conf,2);
	this.expressionConfidence = this.properties["expression_confidence"] - conf;
  this.expressionConfidence = Math.clamp(this.expressionConfidence,0,1);
}
EyebrowsAnalyser.prototype.optimizeAUWeights = function()
{
  this.currentAUWeights = Object.assign({},this.lastFace.weightMap);
	this.newAUWeights = Object.assign({},this.currentAUWeights);

}
EyebrowsAnalyser.prototype.smoothAUWeights = function()
{ 	
	//this.evaluteStates();
	for(var au in this.lastAUWeights)
	{
    this.newAUWeights[au] = this.lastAUWeights[au]*(1-this.expressionConfidence) + this.newAUWeights[au]*this.expressionConfidence;
		
	}
}

EyebrowsAnalyser.prototype.queueNewFace = function(face)
{
	this.faceQueue.push(face);
	
	if(face != null){
		this.faceNum++;
		this.lastFace = face;
	}

	while(this.faceQueue.length > this.maxQueueLength)
	{
		var frontface = this.faceQueue.shift();
		if(frontface == this.lastFace) this.lastFace = null;
		if(frontface != null){ 
			this.faceNum--;
			//delete frontface;
		}
	};
}

EyebrowsAnalyser.prototype.cleanQueue = function()
{
	while(this.faceQueue.length>0)
	{
		var frontface = this.faceQueue.shift();
		//if(frontface) delete frontface;
	}
	this.faceNum = 0;
	this.lastFace = null;
}

  
//-----------------------------------------------@EyelidsAnalyser-----------------------------------------------

class EyelidsAnalyser{

  constructor(){
    //Properties
    this.properties = {
      CALIBRATION_QUEUE_LENGTH: 20,
      expression_confidence: 1,
      pitch_confidence: 15,
      yaw_confidence : 10,
      roll_confidence: 15
    }

    //----ACTION UNITS
    this._AUStates = {};
    this._actionUnitWeightMap = {};
    this.neutralAUStates = {};
    this.newAUWeights = {};
    this.newFaceAngles = {};
    this.currentAUWeights = null;
    this.currentFaceAngles = null;
    this.lastAUWeights = {};
    
    var AUs = EyelidsAnalyser.ActionUnits;
    
    for(var i = 0; i< AUs.length; i++)
    {
      var au = AUs[i];
      this._AUStates[au] = 0 ;
      this._actionUnitWeightMap[au] = 0;
      this.neutralAUStates[au] = 0;
      this.lastAUWeights[au] = 0;
      this.newAUWeights[au] = 0;
    }
    
    //----CALIBRATION
    this.calibrated = false;
    this.calibrating = false;

    this.faceNum = 0;
    this.faceQueue = [];
    this._currentFace = {};
    this.neutralFAPUs = {}//Object.assign({}, _neutralFAPUs);
    //this.neutralAUStates = {}//Object.assign({},actionUnit);
    this.neutralPose ={}// Object.assign({}, _neutralPose);
    this.scale = 1;
    
    
    this.lastFace = null;
    this.lastFaceAngles = null;

    //this.expressionConfidence = -1;
  }
}

EyelidsAnalyser.EYELID_CLOSE_L = "Left closed";
EyelidsAnalyser.EYELID_CLOSE_R = "Right closed";
EyelidsAnalyser.EYELID_OPEN_L = "Left open";
EyelidsAnalyser.EYELID_OPEN_R = "Right open"
EyelidsAnalyser.ActionUnits = ["EYELID_CLOSE_L" , "EYELID_CLOSE_R", "EYELID_OPEN_L", "EYELID_OPEN_R"]
EyelidsAnalyser.FAPUS = ["IRISD_L", "IRISD_R"];

EyelidsAnalyser.prototype.onGetOutputs = function() {
	return [[EyelidsAnalyser.EYELID_CLOSE_L,"number"],
          [EyelidsAnalyser.EYELID_CLOSE_R ,"number"],
          [EyelidsAnalyser.EYELID_OPEN_L ,"number"],
          [EyelidsAnalyser.EYELID_OPEN_R ,"number"]];
}

EyelidsAnalyser.prototype.onGetInputs = function() {
  return [["expr_confidence", "number"], ["pitch_confidence", "number"], ["yaw_confidence", "number"], ["roll_confidence", "number"]];
}

EyelidsAnalyser.prototype.update = function(face)
{

 // if(!face) return;
  if(this.inputs){

    for(var i= 1; i<this.inputs.length;i++)
    {
      var input = this.inputs[i];
      switch(input.name){
        
        case "expr_confidence":
          if(this.getInputData(i))
          	this.properties["expression_confidence"] = this.getInputData(i);
          break;
        case "pitch_confidence":
          if(this.getInputData(i))
          	this.properties["pitch_confidence"] = this.getInputData(i);
          break;
        case "yaw_confidence":
          if(this.getInputData(i))
          	this.properties["yaw_confidence"] = this.getInputData(i);
          break;
        case "roll_confidence":
          if(this.getInputData(i))
          	this.properties["roll_confidence"] = this.getInputData(i);
          break;
      }

    }
  }
  
	if(face)
  {
    this._currentFace = face;
    this.maxQueueLength = this.properties["CALIBRATION_QUEUE_LENGTH"];
    this.expressionConfidence = this.properties["expression_confidence"];

    if(this.faceNum >= this.maxQueueLength&&this.calibrating){
      this.scale = face.scale;

      var AUs = EyelidsAnalyser.ActionUnits;

      for(var i = 0; i< AUs.length; i++)
      {
        var au = AUs[i];

        this.neutralAUStates[au] = 0;

      }
      this.extractNeutralAUStates()
      this.extractNeutralFAPUs();
      this.extractNeutralPose();

      this.cleanQueue();
      this.faceNum = 0;
      this.calibrating = false;
      this.calibrated = true;
    } 

    if(face.neutral){
      this.calibrating = true;
      this.calibrated = false;
      this.faceNum = 0;
      this.faceQueue = [];
    }
    var auStates = this.measureAUStates();



    if(this.calibrating){

      var fapus = this.measureFAPUs();

      var newFace = {
        FAPUs: fapus,
        AUStates: auStates,
       
      };
      this.queueNewFace(newFace);
    }
    else if(this.calibrated){

      this._AUStates = auStates;
      this.computeWeights();
      var newFace = {
        AUStates: auStates,
        weightMap: this._actionUnitWeightMap
      };  
      this.queueNewFace(newFace);

      if(this.lastFace == null) return;

      this.optimizeAUWeights(); 
      //this.optimizeFaceAngles(); 

      this.smoothAUWeights();	
      //this.smoothFaceAngles();

      this.lastAUWeights = Object.assign({},this.newAUWeights);
     // this.lastFaceAngles = Object.assign({},this.newFaceAngles);

    }
	}

  if(this.outputs)
    for(var i = 0; i < this.outputs.length; i++)
    {
      var output = this.outputs[i];
      if(!output.links || !output.links.length)
        continue;

      var result = null;
      switch( output.name )
      {
        case EyelidsAnalyser.EYELID_CLOSE_L: 
          result = this.lastAUWeights["EYELID_CLOSE_L"];
          break;
        case EyelidsAnalyser.EYELID_CLOSE_R: 
          result = this.lastAUWeights["EYELID_CLOSE_R"];
          break;
        case EyelidsAnalyser.EYELID_OPEN_L : 
          result = this.lastAUWeights["EYELID_OPEN_L"];
          break;
        case EyelidsAnalyser.EYELID_OPEN_R : 
          result = this.lastAUWeights["EYELID_OPEN_R"];
          break;
      }
      this.setOutputData(i, result);
    }
  return this.lastAUWeights;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//							RSNeutralFace
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

EyelidsAnalyser.prototype.measureFAPUs = function(landmarks)
{
  var fapus = {};
	if(this.calibrating){
  
    fapus["IRISD_L"] = this.landmarkDistance(387,373) / 1024;
		fapus["IRISD_R"] = this.landmarkDistance(160,144) / 1024; 
  }
  return fapus;
}
EyelidsAnalyser.prototype.extractNeutralFAPUs = function()
{
	if(this.faceNum<=0) return;
  
  var FAPUs = EyelidsAnalyser.FAPUS;
  var sum = {};
  for(var i = 0; i<FAPUs.length; i++)
  {
    var fapu = FAPUs[i];
    sum[fapu] = 0;
  }

	for(var i = 0; i < this.faceQueue.length; i++)
	{
		if( this.faceQueue[i] == null || this.faceQueue[i] == undefined) continue;
		var nf = this.faceQueue[i];
    for(var fapu in nf.FAPUs){
    	sum[fapu] += nf.FAPUs[fapu];
    }
	}
	//sha darreglar
  for(var fapu in nf.FAPUs){
  //	if(calibrating =="front"){
    	this.neutralFAPUs[fapu] = sum[fapu]/this.faceNum;
  /*  }
    else{
    	this.maxFAPUs[calibrating][fapu] = sum[fapu]/this.faceNum;
    }*/
  }
}
EyelidsAnalyser.prototype.extractNeutralAUStates = function()
{
	if(this.faceNum<=0) return;
	//if(calibrating =="front"){
	//	this.initActionUnitWeightMap(this.neutralAUStates);
  /*}else{
    this.initActionUnitWeightMap(this.maxAUStates[calibrating]);
  }*/
	for(var i = this.faceQueue.length - 1; i > -1; i--)
	{
		if( this.faceQueue[i] == null || this.faceQueue[i] == undefined) continue;

		var AUStates = this.faceQueue[i].AUStates;
		for(var au in AUStates)
		{
      //if(calibrating =="front"){
				this.neutralAUStates[au] += AUStates[au]/this.faceNum;
     /* }
      else{
      	this.maxAUStates[calibrating][au] += AUStates[au]/this.faceNum;
      }*/
		}
	}
}
EyelidsAnalyser.prototype.extractNeutralPose = function(){
	if(this.faceNum<=0) return;

  var sumYPR = { x:0, y:0, z:0}
  
  for(var i = 0; i < this.faceQueue.length; i++)
	{
		if( this.faceQueue[i] == null || this.faceQueue[i] == undefined) continue;
		var nf = this.faceQueue[i];
    // for(var pos in nf.headPose){
    // 	sumYPR[pos] += nf.headPose[pos];
    // }
	}
  
	// //sha darreglar
  // for(var pos in nf.headPose){
  //   //if(calibrating =="front"){
  //   	this.neutralPose[pos] = sumYPR[pos]/this.faceNum;
  //   /*}
  //   else{
  //   	this.maxPoses[calibrating][pos] = sumYPR[pos]/this.faceNum;
  //   }*/
  // }
}

EyelidsAnalyser.prototype.landmarkDistance = function(i,j)
{
  var landmarks = this._currentFace.points;

  var vi = new THREE.Vector3(landmarks[i].x, landmarks[i].y, landmarks[i].z);
  var vj = new THREE.Vector3(landmarks[j].x, landmarks[j].y, landmarks[j].z);

  return vi.distanceTo(vj);

}
EyelidsAnalyser.prototype.measureAUStates = function(landmarks)
{

	var eyelid_left = (this.landmarkDistance(387,373)+this.landmarkDistance(385,380))/2; 
	var eyelid_right = (this.landmarkDistance(158,153)+this.landmarkDistance(160,144))/2; 

  var auStates = {
    EYELID_CLOSE_L: eyelid_left , 
    EYELID_CLOSE_R: eyelid_right, 
    EYELID_OPEN_L: eyelid_left, 
    EYELID_OPEN_R: eyelid_right
  }
  return auStates;
}
EyelidsAnalyser.prototype.computeWeights = function()
{
  var smooth = this.scale/this._currentFace.scale;
  
  var IRISD_L0 = this.neutralFAPUs["IRISD_L"];
	var IRISD_R0 = this.neutralFAPUs["IRISD_R"];
  
	{//EYELID_CLOSE_L,
		var currentValue = this._AUStates["EYELID_CLOSE_L"]*smooth;
		var neutralValue = this.neutralAUStates["EYELID_CLOSE_L"];

		var delta = (currentValue - neutralValue)/IRISD_L0; 

    if (delta > 0)
      this._actionUnitWeightMap["EYELID_CLOSE_L"] = 0;
    else
      this._actionUnitWeightMap["EYELID_CLOSE_L"] = CalWeight(-delta, 1024 * 0.4);
    
	}

	{//EYELID_CLOSE_R,	
		var currentValue = this._AUStates["EYELID_CLOSE_R"]*smooth;
		var neutralValue = this.neutralAUStates["EYELID_CLOSE_R"];

		var delta = (currentValue - neutralValue)/IRISD_R0;

    if (delta > 0)
      this._actionUnitWeightMap["EYELID_CLOSE_R"] = 0;
    else
      this._actionUnitWeightMap["EYELID_CLOSE_R"] =  CalWeight(-delta, 1024 * 0.4);
    
	}

  {//EYELID_OPEN_L,	
		var currentValue = this._AUStates["EYELID_OPEN_L"]*smooth;
		var neutralValue = this.neutralAUStates["EYELID_OPEN_L"];

		var delta = (currentValue - neutralValue)/IRISD_L0;
    
    if (delta > 0)
      this._actionUnitWeightMap["EYELID_OPEN_L"] = CalWeight(delta, 1024 * 0.6);
    else
      this._actionUnitWeightMap["EYELID_OPEN_L"] =  0;
	}

	{//EYELID_OPEN_R,
		var currentValue = this._AUStates["EYELID_OPEN_R"]*smooth;
		var neutralValue = this.neutralAUStates["EYELID_OPEN_R"];

		var delta = (currentValue - neutralValue)/IRISD_R0;
    
    if (delta > 0)
      this._actionUnitWeightMap["EYELID_OPEN_R"] = CalWeight(delta, 1024 * 0.6);
    else
      this._actionUnitWeightMap["EYELID_OPEN_R"] =  0;

	}

}


EyelidsAnalyser.prototype.evaluteStates = function()
{
	//LostTracking
	var lostTrackingRate = 1 - this.faceNum/this.faceQueue.length;

	//PoseShifting
	var rawAngles = this.lastFace.headPose;

  var pitch = this.properties["pitch_confidence"]*DEG2RAD - this.neutralPose.x;
  var yaw = this.properties["yaw_confidence"]*DEG2RAD - this.neutralPose.y;
  var roll = this.properties["roll_confidence"]*DEG2RAD - this.neutralPose.z;
  
	var wx = Math.clamp(Math.abs(rawAngles.x)/pitch,0,1);
	var wy = Math.clamp(Math.abs(rawAngles.y)/yaw,0,1);
	var wz = Math.clamp(Math.abs(rawAngles.z)/roll,0,1);
  
	var poseShiftingRate = Math.max(Math.max(wx, wy),wz);

	var conf = Math.max(lostTrackingRate,poseShiftingRate);
	conf = Math.pow(conf,2);
	this.expressionConfidence =  this.properties["expression_confidence"] - conf;
	this.expressionConfidence = Math.clamp(this.expressionConfidence,0,1);
}
EyelidsAnalyser.prototype.optimizeAUWeights = function()
{
  this.currentAUWeights = Object.assign({},this.lastFace.weightMap);
	this.newAUWeights = Object.assign({},this.currentAUWeights);

}
EyelidsAnalyser.prototype.smoothAUWeights = function()
{ 	
	//this.evaluteStates();

	for(var au in this.lastAUWeights)
	{
    this.newAUWeights[au] = this.lastAUWeights[au]*(1-this.expressionConfidence) + this.newAUWeights[au]*this.expressionConfidence;
		
	}
}

EyelidsAnalyser.prototype.queueNewFace = function(face)
{
	this.faceQueue.push(face);
	
	if(face != null){
		this.faceNum++;
		this.lastFace = face;
	}

	while(this.faceQueue.length > this.maxQueueLength)
	{
		var frontface = this.faceQueue.shift();
		if(frontface == this.lastFace) this.lastFace = null;
		if(frontface != null){ 
			this.faceNum--;
			//delete frontface;
		}
	};
}

EyelidsAnalyser.prototype.cleanQueue = function()
{
	while(this.faceQueue.length>0)
	{
		var frontface = this.faceQueue.shift();
		//if(frontface) delete frontface;
	}
	this.faceNum = 0;
	this.lastFace = null;
}

class AnimationGenerator{
  constructor(){
    
    this.mouthAnalyser = new MouthAnalyser();
    this.mouthAnalyser.properties.expression_confidence = 1;
    this.browsAnalyser = new EyebrowsAnalyser();
    this.mouthAnalyser.properties.expression_confidence = 0.8;
    this.eyelidsAnalyser = new EyelidsAnalyser();
    this.mouthAnalyser.properties.expression_confidence = 0.8;
  }
}
let jsonData = {0:{x:[], y:[], z:[]},1:{x:[], y:[], z:[]},6:{x:[], y:[], z:[]},13:{x:[], y:[], z:[]},14:{x:[], y:[], z:[]},17:{x:[], y:[], z:[]},61:{x:[], y:[], z:[]},81:{x:[], y:[], z:[]},178:{x:[], y:[], z:[]},311:{x:[], y:[], z:[]},402:{x:[], y:[], z:[]},291:{x:[], y:[], z:[]},55:{x:[], y:[], z:[]},65:{x:[], y:[], z:[]},52:{x:[], y:[], z:[]},285:{x:[], y:[], z:[]},295:{x:[], y:[], z:[]},282:{x:[], y:[], z:[]},468:{x:[], y:[], z:[]},133:{x:[], y:[], z:[]},154:{x:[], y:[], z:[]},153:{x:[], y:[], z:[]},33:{x:[], y:[], z:[]},473:{x:[], y:[], z:[]},362:{x:[], y:[], z:[]},381:{x:[], y:[], z:[]},380:{x:[], y:[], z:[]},263:{x:[], y:[], z:[]}}

AnimationGenerator.prototype.createFacialAnimation = function(name, landmarks, morphTargetDictionary) {

  let BS = [];
  BS.length = Object.keys(morphTargetDictionary).length;
  BS.fill(0);

  let tracks = [];

  const times = [];
  var time_accum = 0.0;
      
  let AU2BS = {
    "MOUTH_OPEN" : "MouthOpen",
    "MOUTH_LEFT" : "Midmouth_Left",
    "MOUTH_RIGHT": "Midmouth_Right",
    "MOUTH_LEFT_RAISE"  : "Smile_Left",
    "MOUTH_RIGHT_RAISE" : "Smile_Right",
    "EYEBROW_DOWN_L" : "BrowsDown_Left",
    "EYEBROW_DOWN_R" : "BrowsDown_Right",
    "EYEBROW_UP_L"  : "BrowsUp_Left",
    "EYEBROW_UP_R"  : "BrowsUp_Right"
  }
  //let values = [];
  let values = {
    "MouthOpen"       : [],
    "Midmouth_Left"   : [],
    "Midmouth_Right"  : [],
    "Smile_Left"      : [],
    "Smile_Right"     : [],
    "BrowsDown_Left"  : [],
    "BrowsDown_Right" : [],
    "BrowsUp_Left"    : [],
    "BrowsUp_Right"   : []
  }
  for (let i = 0; i< landmarks.length; i++) {
    /*let x = landmarks[i].FLM.map(e=>e.x);
    smoothDepth(x);
    landmarks[i].FLM.map((n,idx)=>n.x=x[idx]);

    let y = landmarks[i].FLM.map(e=>e.y);
    smoothDepth(y);
    landmarks[i].FLM.map((n,idx)=>n.y=y[idx]);*/

    let z = landmarks[i].FLM.map(e=>e.z);
    smoothDepth(z);
    landmarks[i].FLM.map((n,idx)=>n.z=z[idx]);
  }
  for (let i = 0; i< landmarks.length; i++) {

    let facialLandmarks = landmarks[i].FLM;

    
    //use 10 first frames to calibrate the system (assume neutral face)
    let neutralFace = (i<10) ? true : false;
    
    let mouthBSw = this.mouthAnalyser.update({"points":  facialLandmarks, "scale":1, "neutral": neutralFace});
    let browsBSw = this.browsAnalyser.update({"points":  facialLandmarks, "scale":1, "neutral": neutralFace});
    let eyelidsBSw = this.eyelidsAnalyser.update({"points":  facialLandmarks, "scale":1, "neutral": neutralFace});

    //let l = [0,1,6,13,14,17,61,81,178,311,402,291,55,65,52,285,295,282,468,133,154,153,33,473,362,381,380,263];
    for(let li in jsonData){
      jsonData[li]['x'].push(facialLandmarks[li].x);
      jsonData[li]['y'].push(facialLandmarks[li].y);
      jsonData[li]['z'].push(facialLandmarks[li].z);
    }
    //create animation
  //   if(!neutralFace){
    
  //     BS.fill(0);
  //     for(let m in mouthBSw){
  //       let trackName = AU2BS[m];
  //       BS[morphTargetDictionary[trackName]] = mouthBSw[m];
  //     }
  //     for(let b in browsBSw){
  //       let trackName = AU2BS[b];
  //       BS[morphTargetDictionary[trackName]] = browsBSw[b];
  //     }
  //     values = values.concat(BS);
  //     time_accum += landmarks[i].dt / 1000.0;
  //     times.push(time_accum);
  //   }
  // }

  // if (times.length > 0) {

  //   if (values.length > 0) {
  //       const bodyBS = new THREE.NumberKeyframeTrack( 'Body.morphTargetInfluences', times, values);
  //       const eyelashesBS = new THREE.NumberKeyframeTrack( 'Eyelashes.morphTargetInfluences', times, values);
  //       tracks.push(bodyBS);
  //       tracks.push(eyelashesBS);
  //   }

    for(let m in mouthBSw){
      let trackName = AU2BS[m];
      if(trackName)
        values[trackName].push(mouthBSw[m]);
    }
    for(let b in browsBSw){
      let trackName = AU2BS[b];
      if(trackName)
        values[trackName].push(browsBSw[b]);
    }
    time_accum += landmarks[i].dt / 1000.0;
    times.push(time_accum);

  }
 
  if (times.length > 0) {
    let tracksL = Object.keys(values).length;

    if (tracksL > 0) {
      for(let name in morphTargetDictionary) {
      //for (let name in values) {
        let bodyBS = null;
        let eyelashesBS = null; 

        if(values[name]){
          bodyBS = new THREE.NumberKeyframeTrack( 'Body.morphTargetInfluences['+ name +']', times, values[name]);
          eyelashesBS = new THREE.NumberKeyframeTrack( 'Eyelashes.morphTargetInfluences['+ name +']', times, values[name]);
        }
        else{
          let BS = [];
          BS.length = times.length;
          BS.fill(0);
          bodyBS = new THREE.NumberKeyframeTrack( 'Body.morphTargetInfluences['+ name +']', times, BS);
          eyelashesBS = new THREE.NumberKeyframeTrack( 'Eyelashes.morphTargetInfluences['+ name +']', times, BS );
        }
        tracks.push(bodyBS);
        tracks.push(eyelashesBS);
      }
    }
  }
  // use -1 to automatically calculate
  // the length from the array of tracks
  const length = -1;
  //download(JSON.stringify(jsonData), "facialLandmarks.json", "text/plain");
  return new THREE.AnimationClip(name || "facial_anim", length, tracks);
}

AnimationGenerator.prototype.createFacialAnimationFromData = function(data, morphTargetDictionary) {

  let BS = [];
  if(morphTargetDictionary){
    BS.length = Object.keys(morphTargetDictionary).length;
    BS.fill(0);
  }

  let tracks = [];
  let values = {};

  const times = [];
  var time_accum = 0.0;
      
  let AU2BS = {
    "AU01": ["BrowsOuterLower_Left", "BrowsOuterLower_Right"], 
    "AU02": ["BrowsUp_Left", "BrowsUp_Right"], 
    "AU04": ["BrowsIn_Left", "BrowsIn_Right"], 
    "AU05": ["EyesWide_Left", "EyesWide_Right"], 
    "AU06": null, //Cheek Raiser
    "AU07": ["Squint_Left", "Squint_Right"], 
    "AU09": ["NoseScrunch_Left", "NoseScrunch_Right"], 
    "AU10": ["UpperLipUp_Left", "UpperLipUp_Right"], 
    "AU12": ["Smile_Left", "Smile_Right"], 
    "AU14": null, //Dimpler
    "AU15": ["Frown_Left", "Frown_Right"], 
    "AU17": ["MouthUp"], 
    "AU20": null,  //Lip Stretcher
    "AU23": ["MouthNarrow_Left", "MouthNarrow_Right"], 
    "AU25": ["LowerLipDown_Left", "LowerLipDown_Right"], 
    "AU26": ["JawDown"], 
    "AU28": ["UpperLipIn", "LowerLipIn"], 
    "AU45": ["Blink_Left", "Blink_Right"],
  }
  let headPose = [];
  //go through all AU data
  let AUs = Object.keys(AU2BS);
  for (let frame = 0; frame < data.length; frame++) {

    let rawData = data[frame];

    // if(rawData.confidence < 0.5)
    //   continue;
    for (let i = 0; i < AUs.length; i++) {
      let idx = AUs[i] + '_r'; //AUx_r = intensity
      let pix = AUs[i] + '_c'; //AUx_c = presence
      let intensity = rawData[pix] ? rawData[idx] / 5 : 0; // OpenFace: For intensity of AU 1 the column AU01_r in the output file would range from 0 (not present), 1 (present at minimum intensity), 5 (present at maximum intensity)
      let trackNames = AU2BS[AUs[i]];
      
      if (!trackNames) 
        continue;
      
      for (let t = 0; t < trackNames.length; t++) {
        if (values[trackNames[t]] === undefined)
          values[trackNames[t]] = [ parseFloat(intensity) ];
          else 
            values[trackNames[t]].push( parseFloat(intensity) );
      }
    }
    const euler = new THREE.Euler( rawData['pose_Rx'], rawData['pose_Ry'], rawData['pose_Rz'], 'ZYX' );
    const quaternion = new THREE.Quaternion().setFromEuler ( euler );
    headPose.push( quaternion.x );
    headPose.push( quaternion.y );
    headPose.push( quaternion.z );
    headPose.push( quaternion.w );

    times.push( parseFloat(rawData.timestamp) );
  }

  if (times.length > 0) {
    let tracksL = Object.keys(values).length;

    if (tracksL > 0) {
      for(let name in values) {
      //for (let name in values) {
        let bodyBS = null;
        let eyelashesBS = null; 

        if(values[name]){
          bodyBS = new THREE.NumberKeyframeTrack( 'Body.morphTargetInfluences['+ name +']', times, values[name] || 0.0);
          eyelashesBS = new THREE.NumberKeyframeTrack( 'Eyelashes.morphTargetInfluences['+ name +']', times, values[name] || 0.0);
        }
        else{
          let BS = [];
          BS.length = times.length;
          BS.fill(0);
          bodyBS = new THREE.NumberKeyframeTrack( 'Body.morphTargetInfluences['+ name +']', times, BS);
          eyelashesBS = new THREE.NumberKeyframeTrack( 'Eyelashes.morphTargetInfluences['+ name +']', times, BS );
        }
        tracks.push(bodyBS);
        tracks.push(eyelashesBS);
      }
    }
    tracks.push( new THREE.QuaternionKeyframeTrack( 'mixamorig_Head.quaternion', times, headPose || 0.0) );
  }
  // use -1 to automatically calculate
  // the length from the array of tracks
  const length = -1;
  //download(JSON.stringify(jsonData), "facialLandmarks.json", "text/plain");
  return new THREE.AnimationClip(name || "facial_anim", length, tracks);
}

AnimationGenerator.prototype.create3DLandmarksAnimation = function ( data, name ) {
  
  let times = [];
  let values = {};
  for (let i = 0; i < data.length; i++){
    for (let j = 0; j < 68; j++){
        let landmark = [ 0.001  * parseFloat( data[i]["X_" + j] ), 2.25 - 0.001  * parseFloat( data[i]["Y_" + j] ), parseFloat(0.9 - 0.001 * data[i]["Z_" + j] )];
        if( values[j] === undefined) 
          values[j] = landmark;
        else
          values[j] =  [...values[j], ...landmark ] ;
        }
    times.push( parseFloat(data[i].timestamp) );
  }
  
  let tracks = [];
  for(let trackname in values) {
    tracks.push( new THREE.VectorKeyframeTrack( 'lm_' + trackname + '.position', times, values[trackname] || 0.0) );
  }

  // use -1 to automatically calculate
  // the length from the array of tracks
  const length = -1;
  //download(JSON.stringify(jsonData), "facialLandmarks.json", "text/plain");
  return new THREE.AnimationClip(name || "3D_landmarks", length, tracks);
}

function smoothDepth(data){
  // Filter requirements.
  let T = 5.0         //Sample Period
  let fs = 44100       //sample rate, Hz
  let cutoff = 0.0001      //desired cutoff frequency of the filter, Hz ,      slightly higher than actual 1.2 Hz
  let nyq = 0.5 * fs  //Nyquist Frequency
  let order = 2       //sin wave can be approx represented as quadratic
  lowPassFilter.lowPassFilter(data, cutoff, fs, 1)
}
function download(content, fileName, contentType) {
  const a = document.createElement("a");
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
 }
export {AnimationGenerator}