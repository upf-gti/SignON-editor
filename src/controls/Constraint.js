import {
	Vector3,
    MeshBasicMaterial,
    AdditiveBlending
} from 'three';

const _tempVector = new Vector3();
const _tempVector2 = new Vector3();

const redColor = 0xff6969;
const greenColor = 0x69ff69;
const blueColor = 0x6969ff;

class Constraint {

    constructor( space ) {

        this.space = space || 'world';
        this.enabled = true;

    }

    enable() {

        this.enabled = true;
    }

    disable() {

        this.enabled = false;
    }

    evaluate( transform, axis ) {

        throw( 'Implement a specific type of Constraint: TranslationConstraint, RotationConstraint' );
    }
    
    getHelperColor( e ) {

        const axis = e.target.axis;

        if( axis.length > 1 ) {

            if ( axis.search( 'X' ) === - 1 ) {

                return redColor;
    
            }
    
            if ( axis.search( 'Y' ) === - 1 ) {
    
                return greenColor;
            }
    
            if ( axis.search( 'Z' ) === - 1 ) {
    
                return blueColor;
    
            }

        }
        else {

            if ( axis.search( 'X' ) !== - 1 ) {

                return redColor;
    
            }
    
            if ( axis.search( 'Y' ) !== - 1 ) {
    
                return greenColor;
            }
    
            if ( axis.search( 'Z' ) !== - 1 ) {
    
                return blueColor;
    
            }

        }

        return redColor;

    }

};

class TranslationConstraint extends Constraint {

	constructor( space ) {

		super( space );

        this.offsetRange = {
            'x': [0.0, 0.0],
            'y': [0.0, 0.0],
            'z': [0.0, 0.0]
        };

	}

    setFromPointAndOffset( position, offset ) {

        this.offsetRange = {
			'x': [position.x - offset, position.x + offset],
			'y': [position.y - offset, position.y + offset],
			'z': [position.z - offset, position.z + offset]
		};

    }

    setFromRange( axis, a, b ) {

        this.offsetRange[ axis ] = [ a, b ];

        // Probably should have to take point to range [a, b]
        // to allow move it...

        // ...

    }

    evaluate( transform, axis ) {

        if( this.enabled === false) {

            return true;

        }

        axis = axis.toLowerCase();

        let space = this.space;

        const position = transform.object.position;
        const worldPosition = transform.object.getWorldPosition( _tempVector );

        if( transform === null ) {

            return false;

        }

        let result = true;

        _tempVector2.copy( space === 'local' ? position : worldPosition );

        if ( axis.search( 'x' ) !== - 1 ) {

            result &= ( _tempVector2.x >= this.offsetRange.x[ 0 ] );
            result &= ( _tempVector2.x <= this.offsetRange.x[ 1 ] );

        }

        if ( axis.search( 'y' ) !== - 1 ) {

            result &= ( _tempVector2.y >= this.offsetRange.y[ 0 ] );
            result &= ( _tempVector2.y <= this.offsetRange.y[ 1 ] );

        }

        if ( axis.search( 'z' ) !== - 1 ) {

            result &= ( _tempVector2.z >= this.offsetRange.z[ 0 ] );
            result &= ( _tempVector2.z <= this.offsetRange.z[ 1 ] );

        }

        return !!result;

    }
};

class RotationConstraint extends Constraint {

	// ...

};

export { TranslationConstraint, RotationConstraint };