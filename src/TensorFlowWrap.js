//@TensorFlowWrap

/**
 * An easy to use class to load tensorflow models and predicting whole batchs and single samples without worrying about TensorFlow intrinsics 
 */

// Load tensorflow lib ---------------------------------------
/*if ( ! document.getElementById("tensorflowLib") ){
  let script = document.createElement('script');
  script.id = "tensorflowLib";
  script.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@2.0.0/dist/tf.min.js";
  document.getElementsByTagName("body")[0].appendChild(script);
  
}*/
tf.backend("webgl"); // run on gpu.   others:   "cpu"  "best"


// class -----------------------------------------------------

function TFModel ( path = null, onLoad = null ){
 
  this.model = null;
  this.onLoad = onLoad;
  if ( path ){  this.loadLayersModel( path ); }
  
}
this.TFModel = TFModel;

// extremely important to call this function before destroying module
TFModel.prototype.deinit = function ( ){
  if ( this.model ){  tf.dispose( this.model );   }
  this.model = null;

}


// async
TFModel.prototype.loadLayersModel = function( path ){
  this.deinit(); // deallocate memory
  
  let that = this;
  tf.loadLayersModel( path, false )
  .then( function( result ){ that.model = result; if( that.onLoad ) { that.onLoad(); } });
 
}

TFModel.prototype.isModelReady = function () { return !!this.model; }

TFModel.prototype.predictSampleSync = function ( sample ){
  if ( !this.model ){ return null; } 
  
  let shape = this.getInputShape();
  shape[0] = 1;

  // disposes of any tensor created except the returned one.
  let inputTensor = tf.tensor( sample, shape, 'float32' );
  //let inputTensorReshaped = tf.reshape( inputTensor, shape );
  
  let resultTensor = this.model.predict( inputTensor );
  
  // asynchronous mode
  //result.array().then( array => console.log(array) );
  let resultArray = resultTensor.arraySync();
  tf.dispose( resultTensor );
  tf.dispose( inputTensor );  
  //tf.dispose( inputTensorReshaped );  
  return resultArray[0];

}

TFModel.prototype.predictBatchSync = function ( arr ){
  if ( !this.model ){ return null; } 
  
  // disposes of any tensor created except the returned one.
  let inputTensor = tf.tensor( arr );
  let resultTensor = this.model.predict( inputTensor );
  
  // asynchronous mode
  //result.array().then( array => console.log(array) );
  let resultArray = resultTensor.arraySync();
  tf.dispose( resultTensor );
  tf.dispose( inputTensor );  
  return resultArray;
}


TFModel.prototype.getInputShape = function () { 
    if ( !this.model ){ return null; }
    if ( !this.model.inputs || this.model.inputs.length <= 0 ){ console.log( "TensorFlowWrap: model missing input layer"); return null; }
    let inputLayer = this.model.inputs[0];
    let shape = inputLayer.shape;
    if ( shape.length <= 0 ){ return null; }
    return shape;
}

// returns an input sample shape
TFModel.prototype.getInputSampleShape = function (){
    let shape = this.getInputShape();
    if ( shape == null || shape.length <= 0 ){ return null; }
    if ( shape[0] == null ){ shape = shape.slice( 1, shape.length ); }
    return shape;
}

/*
this.onStart = function (){
  let test = new TFModel("https://webglstudio.org/latest/fileserver/files//jaumep/projects/Dev/Lipsync/model.json");
  test.onLoad = function (){ 
    let result = test.predictSync( [[43,43,60,51,57,27,17,10,9,5,4,5,14,22,5,16,7,3,18,18,19,30,22,2,0,0,0]] );
    test.deinit();
  }
  
}
*/
