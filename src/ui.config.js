// The scope for the callbacks is the editor
// Icons: https://icons.getbootstrap.com/

// THREE.js
const LoopOnce = 2200;
const LoopRepeat = 2201;
const LoopPingPong = 2202;

const CanvasButtons = {

    onCreate: function(item, content) {
        if( this[item.property] ) {
            content.parentElement.classList.add('selected');
        }
    },

    onChange: function(item, content) {
        this[item.property] = !this[item.property];
        if(!item.nIcon) item.nIcon = item.icon;

        if( this[item.property] ) {
            content.className = 'bi bi-' + item.icon;
            content.parentElement.classList.add('selected');
        }else {
            content.className = 'bi bi-' + item.nIcon;
            content.parentElement.classList.remove('selected');
        }
    },

    items: [
        {
            name: 'skin',
            property: 'showSkin',
            icon: 'person-x-fill',
            nIcon: 'person-check-fill',
            callback: function() {
                let model = this.scene.getObjectByName("Armature");
                model.visible = this.showSkin;
            }
        },

        {
            name: 'hud',
            property: 'showHUD',
            icon: 'box',
            callback: function() {
                this.scene.getObjectByName('SkeletonHelper').visible = this.showHUD;
                this.scene.getObjectByName('GizmoPoints').visible = this.showHUD;
                this.scene.getObjectByName('Grid').visible = this.showHUD;
            }
        },

        {
            name: 'anim-loop',
            property: 'animLoop',
            icon: 'arrow-clockwise'
        }
    ]

};

export { CanvasButtons };