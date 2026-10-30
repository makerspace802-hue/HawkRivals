import * as THREE from 'three';
export function addIdentity(scene:THREE.Object3D){
 const coral=new THREE.MeshStandardMaterial({color:'#d97b6c',roughness:.66,metalness:.25});
 const pale=new THREE.MeshStandardMaterial({color:'#d8e0e7',roughness:.7});
 const ink=new THREE.MeshStandardMaterial({color:'#24374f',metalness:.55,roughness:.45});
 const add=(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number)=>{const p=new THREE.Mesh(g,m);p.position.set(x,y,z);p.castShadow=p.receiveShadow=true;scene.add(p);return p;};
 for(const side of [-1,1])for(let n=0;n<4;n++){
 const x=side*(42+n*20),z=-30-n*30,y=15+n*9;
 const balloon=add(new THREE.SphereGeometry(5,24,16),n%2?coral:pale,x,y+10,z);balloon.scale.set(1,1.3,1);
 add(new THREE.CylinderGeometry(.11,.11,13,8),ink,x,y,z);
 add(new THREE.CylinderGeometry(7,4,1.8,10),pale,x,y-7,z);
 const turbine=add(new THREE.TorusGeometry(4,.35,8,24),coral,x,y-5,z+4);
 for(let k=0;k<6;k++){const vane=add(new THREE.BoxGeometry(.7,3,.12),ink,x+Math.sin(k*Math.PI/3)*2,y-5+Math.cos(k*Math.PI/3)*2,z+4);vane.rotation.z=-k*Math.PI/3-.4;}
 void turbine;
}
}
