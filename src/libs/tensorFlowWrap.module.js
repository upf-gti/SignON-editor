import "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@2.0.0/dist/tf.min.js";

/**
 * An easy to use class to load tensorflow models and predicting whole batchs and single samples without worrying about TensorFlow intrinsics 
 */

class TFModel {

    constructor(path = null, onLoad = null) {

        // Use gpu
        tf.backend("webgl");

        this.model = null;
        this.onLoad = onLoad;
        if ( path )
            this.loadLayersModel( path );
    }
    
    // async
    loadLayersModel( path ) {
        
        this.deinit(); // deallocate memory
        tf.loadLayersModel( path, false ).then( (result) => {
            this.model = result; 
            if( this.onLoad )
                this.onLoad();
        } );
    }

    // extremely important to call this function before destroying module
    deinit() {

        if ( this.model )
            tf.dispose( this.model );
        this.model = null;
    }

    isModelReady() {
        
        return !!this.model;
    }

    predictSampleSync(sample) {

        if ( !this.model )
            return null;
  
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

    predictBatchSync(arr) {

        if ( !this.model )
            return null;
  
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

    getInputShape() {

        if ( !this.model )
            return null;
        if ( !this.model.inputs || this.model.inputs.length <= 0 ) {
            console.log( "TensorFlowWrap: model missing input layer"); 
            return null;
        }

        let inputLayer = this.model.inputs[0];
        let shape = inputLayer.shape;
        if ( shape.length <= 0 )
            return null;

        return shape;
    }

    getInputSampleShape() {

        let shape = this.getInputShape();
        if ( shape == null || shape.length <= 0 )
            return null;
        if ( shape[0] == null )
            shape = shape.slice( 1, shape.length );

        return shape;
    }
};

/*
this.onStart = function (){
  let test = new TFModel("pathToModel.json");
  test.onLoad = function (){ 
    let result = test.predictSync( dataArray );
  }
}
*/

export { TFModel };