// The scope for the callbacks is the editor
// Icons: https://icons.getbootstrap.com/

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
            item.type === 'image' ? content.src = item.icon : content.className = item.icon;
            content.parentElement.classList.add('selected');
        }else {
            item.type === 'image' ? content.src = item.nIcon : content.className =  item.nIcon;
            content.parentElement.classList.remove('selected');
        }
    },

    items: [
        {
            name: 'skin',
            property: 'showSkin',
            icon: 'bi bi-person-x-fill',
            nIcon: 'bi bi-person-check-fill',
            callback: function() {
                let model = this.scene.getObjectByName("Armature");
                model.visible = this.showSkin;
                
            }
        },

        {
            name: 'skeleton',
            property: 'showSkeleton',
            icon: 'fa-solid fa-skull',
            nIcon: 'fa-solid fa-skull',
            callback: function() {
                let skeleton = this.scene.getObjectByName("SkeletonHelper");
                skeleton.visible = this.showSkeleton;
                this.scene.getObjectByName('GizmoPoints').visible = this.showSkeleton;
            }
        },

        {
            name: 'hud',
            property: 'showHUD',
            icon: 'https://webglstudio.org/latest/imgs/mini-icon-gui.png',
            type: 'image',
            callback: function() {
                
                this.scene.getObjectByName('SkeletonHelper').visible = this.showHUD;
                this.scene.getObjectByName('GizmoPoints').visible = this.showHUD;
                this.scene.getObjectByName('Grid').visible = this.showHUD;
                
                let skull = document.querySelector("[title=skeleton]");
                if(!this.showHUD) {
                    this.gizmo.stop();
                    skull.classList.remove("selected")
                }
                else if(this.scene.getObjectByName("SkeletonHelper").visible)
                    skull.classList.add("selected");

                const video = document.getElementById("capture");
                const tl = document.getElementById("timeline");
                tl.style.display    = this.showHUD ? "block": "none";
                video.style.display = this.showHUD ? "flex" : "none";
            }
        },

        {
            name: 'bonesZtest',
            property: 'boneUseDepthBuffer',
            icon: 'https://webglstudio.org/latest/imgs/mini-icon-depth.png',
            type: 'image',
            callback: function() {
                this.gizmo.bonePoints.material.depthTest = !this.gizmo.bonePoints.material.depthTest;
            }
        },

        {
            name: 'anim-loop',
            property: 'animLoop',
            icon: 'bi bi-arrow-clockwise'
        }
    ]

};

export { CanvasButtons };