import * as THREE from 'three';
/** Deterministic woven, stone and normal fields authored from arithmetic. */
export function fieldTexture(kind:string,normal=false){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const c=canvas.getContext('2d')!,pixels=c.createImageData(256,256);
 let seed=17+kind.length*93;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){
  const i=(y*256+x)*4,n=rand(),weave=((x%8<2?1:0)+(y%8<2?1:0))*7;
  const v=155+n*44+Math.sin(x*.13+y*.05)*8-weave;
  pixels.data[i]=normal?128:v;pixels.data[i+1]=normal?128:v;pixels.data[i+2]=normal?255:v;pixels.data[i+3]=255;
 }c.putImageData(pixels,0,0);
 if(!normal&&!/cloud/.test(kind)){c.strokeStyle='rgba(28,34,48,.23)';c.lineWidth=2;for(let y=0;y<256;y+=64){c.beginPath();c.moveTo(0,y);c.lineTo(256,y);c.stroke();for(let x=(y%128?32:0);x<256;x+=64)c.strokeRect(x,y,64,64);}}
 const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=normal?THREE.NoColorSpace:THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
