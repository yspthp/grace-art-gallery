import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { move } from './movement.js';
import { works as catalog } from './artworks.js';
import { createLayout, zoneAt, streamingRequests } from './layout.js';
import { TextureStream } from './streaming.js';
import { createJoystick } from './joystick.js';
const gallery=createLayout(catalog);
const works=gallery.works;

const $=s=>document.querySelector(s);
const canvas=$('#scene');
const scene=new THREE.Scene();
scene.background=new THREE.Color('#e7e8db');
const camera=new THREE.PerspectiveCamera(57,innerWidth/innerHeight,.06,100);
camera.rotation.order='YXZ';
const start=new THREE.Vector3(3.65,1.64,3.85);
camera.position.copy(start);
camera.lookAt(-.6,1.7,-3.8);
let renderer;
try {
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
} catch(error) {
  $('#enter').textContent='無法啟動 3D：請使用支援 WebGL 2 的瀏覽器';
  throw error;
}
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.02;
renderer.outputColorSpace=THREE.SRGBColorSpace;
const pmrem=new THREE.PMREMGenerator(renderer);
const envRoom=new RoomEnvironment();
const environment=pmrem.fromScene(envRoom,.04);
scene.environment=environment.texture;
scene.environmentIntensity=.23;
envRoom.dispose();pmrem.dispose();

let seed=7103;
const rand=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
function texture(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
  return t;
}
const wood=texture(1024,256,(c,w,h)=>{
  c.fillStyle='#b6a184';c.fillRect(0,0,w,h);
  for(let y=0;y<h;y++){
    const lum=rand();c.strokeStyle=`rgba(${lum>.5?'241,223,188':'87,64,39'},${.03+rand()*.12})`;
    c.lineWidth=.4+rand()*1.3;c.beginPath();
    for(let x=0;x<=w;x+=8)c.lineTo(x,y+Math.sin(x/110+y*.13)*2+Math.sin(x/37+y*.3)*.4);
    c.stroke();
  }
  for(let i=0;i<15;i++){
    const y=rand()*h;c.strokeStyle='#56432a12';c.lineWidth=.6;c.beginPath();
    c.ellipse(rand()*w,y,30+rand()*120,2+rand()*3,0,0,Math.PI*2);c.stroke();
  }
});
const plaster=texture(512,512,(c,w,h)=>{
  const data=c.createImageData(w,h);
  for(let i=0;i<data.data.length;i+=4){const v=238+Math.floor(rand()*14);data.data.set([v,v-2,v-7,255],i);}
  c.putImageData(data,0,0);
});
plaster.wrapS=plaster.wrapT=THREE.RepeatWrapping;plaster.repeat.set(4,2);
const fabric=texture(256,256,(c,w,h)=>{
  c.fillStyle='#bcb59e';c.fillRect(0,0,w,h);
  for(let i=0;i<w;i+=2){c.fillStyle=i%4?'#8b856a25':'#fff9e940';c.fillRect(i,0,1,h);c.fillRect(0,i,w,1);}
});
fabric.wrapS=fabric.wrapT=THREE.RepeatWrapping;fabric.repeat.set(8,5);
const mat=(color,roughness=.8,extra={})=>new THREE.MeshStandardMaterial({color,roughness,...extra});
const walls=mat('#eee9db',.94,{map:plaster,bumpMap:plaster,bumpScale:.013});
const trim=mat('#e0d8c8',.78);
const darkWood=mat('#71523a',.56,{map:wood});
const frameWood=mat('#b7a082',.56,{map:wood});
const bronze=mat('#66533b',.35,{metalness:.7});
const linen=mat('#ece5ce',.94,{map:fabric});
function softBox(w,h,d,material,x,y,z){
  const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(.035,h/3)),material);
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;
}
function box(w,h,d,material,x,y,z,parent=scene,cast=true){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m;
}
function cylinder(rt,rb,h,material,x,y,z,parent=scene){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,32),material);
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
// One real room; the west wall is built around an actual window opening.
box(10,.15,5-gallery.back,mat('#9f8b70'),0,-.1,(5+gallery.back)/2);
const floorMats=Array.from({length:9},()=>mat(new THREE.Color().setHSL(.096,.17,.59+rand()*.10),.63,{map:wood,bumpMap:wood,bumpScale:.017}));
const boards=floorMats.map(material=>new THREE.InstancedMesh(new THREE.BoxGeometry(1,.045,.294),material,1600));
const boardCounts=boards.map(()=>0),boardTransform=new THREE.Object3D();
for(let row=0;row<Math.ceil((5-gallery.back)/.3);row++){
  const z=gallery.back+.15+row*.3;
  const offset=(row%3)*.67;
  for(let x=-6+offset;x<5;x+=2){
    const left=Math.max(-5,x),right=Math.min(5,x+2);
    if(right<=left)continue;
    const index=Math.floor(rand()*boards.length);
    boardTransform.position.set((left+right)/2,.005,z);boardTransform.scale.set(right-left-.008,1,1);boardTransform.updateMatrix();
    boards[index].setMatrixAt(boardCounts[index]++,boardTransform.matrix);
  }
}
boards.forEach((mesh,index)=>{mesh.count=boardCounts[index];mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);});
box(10,3.8,.18,walls,0,1.9,gallery.back);
// The original room is now the entrance hall. The repeated shell keeps the
// long gallery visually simple while allowing artwork textures to stream in.
const hallDepth=-4-gallery.back,hallCenter=(-4+gallery.back)/2;
box(.18,3.8,hallDepth,walls,5,1.9,hallCenter);
box(.18,3.8,hallDepth,walls,-5,1.9,hallCenter);
box(10,.13,hallDepth,mat('#eee9de'),0,3.86,hallCenter,scene,false);
for(const wall of gallery.partitions)box(wall.maxX-wall.minX,3.8,.2,walls,(wall.minX+wall.maxX)/2,1.9,(wall.minZ+wall.maxZ)/2);
for(const room of gallery.rooms){
  box(room.doorWidth,1,.2,walls,room.doorX,3.3,room.front);
  for(const x of [-4.88,4.88])box(.04,.14,10,trim,x,.08,(room.front+room.back)/2);
}
box(.18,3.8,9,walls,5,1.9,.5);
box(10,3.8,.18,walls,0,1.9,5);
box(.18,.7,9,walls,-5,.35,.5);
box(.18,.55,9,walls,-5,3.525,.5);
box(.18,2.55,1.2,walls,-5,1.975,-3.4);
box(.18,2.55,2.3,walls,-5,1.975,3.85);
box(10,.13,9,mat('#eee9de'),0,3.86,.5,scene,false);
for(const z of [-3.88,4.88])box(9.9,.14,.035,trim,0,.08,z);
for(const x of [-4.88,4.88])box(.035,.14,8.8,trim,x,.08,.5);
for(const z of [-3.86,4.86]){
  box(10,.10,.16,trim,0,3.55,z);
  box(9.8,.025,.07,mat('#fff0c9',.3,{emissive:'#ffe0a0',emissiveIntensity:.75}),0,3.61,z,scene,false);
}
// Deep oak window reveals, slender mullions, and a soft outdoor view.
const windowMat=mat('#dbd0b9',.6,{map:wood});
for(const z of [-2.8,-.96,.87,2.7])box(.22,2.65,.065,windowMat,-4.91,1.975,z);
for(const y of [.7,2.33,3.25])box(.22,.07,5.55,windowMat,-4.91,y,-.05);
box(.5,.09,5.85,mat('#d9cbb4',.7),-4.83,.68,-.05);
const outdoors=texture(1024,512,(c,w,h)=>{
  const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#dbe9e4');g.addColorStop(.55,'#eef0da');g.addColorStop(1,'#9eab7b');c.fillStyle=g;c.fillRect(0,0,w,h);
  for(let i=0;i<100;i++){
    const x=rand()*w,y=h*.6+rand()*h*.55,r=25+rand()*100;
    const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(88,112,65,${.04+rand()*.12})`);g.addColorStop(1,'rgba(110,137,87,0)');
    c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
  }
});
const view=new THREE.Mesh(new THREE.PlaneGeometry(8,4),new THREE.MeshBasicMaterial({map:outdoors}));
view.position.set(-5.8,2,-.05);view.rotation.y=Math.PI/2;scene.add(view);
scene.add(new THREE.HemisphereLight('#f4f0de','#9d8c72',1.45));
const sun=new THREE.DirectionalLight('#fff0d2',2.2);
sun.position.set(-8,4,2);sun.target.position.set(0,0,-2);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-8,right:8,top:7,bottom:-7,near:.1,far:25});
sun.shadow.normalBias=.025;sun.shadow.bias=-.00012;sun.shadow.radius=3;
scene.add(sun,sun.target);
const windowFill=new THREE.RectAreaLight('#fff5df',2.5,5.3,2.4);
windowFill.position.set(-4.7,2,-.05);windowFill.lookAt(2,1,0);scene.add(windowFill);
// Furniture is intentionally sparse so the original art remains the focus.
const rug=box(3.6,.016,2.3,linen,0,.04,1.48,scene,false);
softBox(2.8,.13,.8,darkWood,0,.46,1.5);
softBox(2.66,.09,.74,mat('#ded3b7',.95,{map:fabric}),0,.57,1.5);
for(const x of [-1.15,1.15])for(const z of [1.25,1.75])box(.10,.43,.1,darkWood,x,.23,z);
// A book and a restrained ceramic vessel.
box(.31,.037,.23,mat('#79836f'),.73,.64,1.52);
box(.27,.034,.21,mat('#d9cbaa'),.71,.678,1.51).rotation.y=.12;
cylinder(.10,.07,.16,mat('#c1ac89',.88),-.92,.70,1.5);
cylinder(.072,.072,.008,mat('#5b4c38'),-.92,.784,1.5);
// Subtle diffuse contact shading, independent of the hard afternoon sunlight.
const contact=texture(128,128,(c,w,h)=>{
  const g=c.createRadialGradient(w/2,h/2,8,w/2,h/2,w/2);
  g.addColorStop(0,'rgba(35,29,20,.32)');g.addColorStop(.45,'rgba(35,29,20,.18)');g.addColorStop(1,'rgba(35,29,20,0)');
  c.fillStyle=g;c.fillRect(0,0,w,h);
});
function contactShadow(w,d,x,y,z){
  const p=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:contact,transparent:true,depthWrite:false}));
  p.rotation.x=-Math.PI/2;p.position.set(x,y,z);scene.add(p);
}
contactShadow(3.5,1.5,0,.052,1.5);
contactShadow(1.2,1.2,4,.03,-2.7);
for(const x of [-1.15,1.15])for(const z of [1.25,1.75])contactShadow(.35,.35,x,.053,z);

// Small olive-like indoor tree.
cylinder(.32,.23,.57,mat('#bda98d',.92),4,.315,-2.7);
cylinder(.28,.28,.025,mat('#514332',1),4,.60,-2.7);
function branch(a,b,r){
  const delta=new THREE.Vector3().subVectors(b,a);
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r*.55,r,delta.length(),8),mat('#796b4e'));
  m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());m.castShadow=true;scene.add(m);
}
branch(new THREE.Vector3(4,.57,-2.7),new THREE.Vector3(4.02,2.4,-2.7),.027);
const leafGeometry=new THREE.SphereGeometry(1,7,5);
const leafMats=[mat('#6b7751',.9),mat('#7b8459',.9),mat('#909468',.9)];
for(let i=0;i<19;i++){
  const angle=i*2.4;
  const a=new THREE.Vector3(4,1.15+i*.06,-2.7);
  const end=new THREE.Vector3(4+Math.cos(angle)*(.25+rand()*.25),1.4+rand()*1.2,-2.7+Math.sin(angle)*.38);
  branch(a,end,.01);
  for(let j=0;j<8;j++){
    const p=a.clone().lerp(end,.35+j*.085);
    p.x+=(rand()-.5)*.2;p.y+=(rand()-.5)*.18;p.z+=(rand()-.5)*.2;
    const leaf=new THREE.Mesh(leafGeometry,leafMats[(i+j)%3]);leaf.position.copy(p);leaf.scale.set(.055,.013,.14);leaf.rotation.set(rand()*2,rand()*6,rand());leaf.castShadow=true;scene.add(leaf);
  }
}
function textPanel(textLines,w,h,x,y,z,font=36){
  const t=texture(1024,Math.round(1024*h/w),(c,cw,ch)=>{
    c.fillStyle='#ede8dc';c.fillRect(0,0,cw,ch);
    textLines.forEach((line,i)=>{
      c.font=`${i===0?'500':'400'} ${i===0?font:font*.64}px "Microsoft JhengHei",sans-serif`;
      c.fillStyle=i===0?'#4f5547':'#8e8b7d';c.fillText(line,38,60+i*font*1.5);
    });
  });
  const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t}));
  p.position.set(x,y,z);scene.add(p);return p;
}
textPanel(['恩慈畫室'],1.25,.18,3.35,2.13,-3.89,42);
const paintings=[],loader=new THREE.TextureLoader();
const placeholder=texture(128,128,(c,w,h)=>{
  c.fillStyle='#e9e3d5';c.fillRect(0,0,w,h);
  c.strokeStyle='#cfc6b5';c.lineWidth=5;c.strokeRect(10,10,w-20,h-20);
  c.fillStyle='#aaa08f';c.font='16px sans-serif';c.textAlign='center';c.fillText('載入中',w/2,h/2+6);
});
const stream=new TextureStream({
  load:async(url,signal)=>{
    const response=await fetch(url,{signal});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const bitmap=await createImageBitmap(await response.blob(),{imageOrientation:'flipY'});
    const t=new THREE.Texture(bitmap);t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;
    t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);t.needsUpdate=true;return t;
  },
  dispose:texture=>{texture.dispose();texture.image?.close?.();},
});
let loaded=false;
function updateArtworkStreaming(){
  const zone=zoneAt(camera.position.z,gallery.rooms.length);
  stream.update(streamingRequests(works,camera.position,zone,gallery.rooms.length));
  for(const work of works){
    const nearby=Math.abs(work.zone-zone)<=1;
    work.group.visible=nearby;
    if(work.spot)work.spot.visible=nearby;
    const map=stream.ready.get(`${work.id}:high`)||stream.ready.get(`${work.id}:low`)||placeholder;
    if(work.painting.material.map!==map){
      work.painting.material.map=map;
      work.painting.material.needsUpdate=true;
    }
  }
  $('#retry-load').hidden=stream.stats.failed.length===0;
  if(!loaded){
    loaded=true;$('#enter').disabled=false;$('#enter').innerHTML='進入畫室 <span>↗</span>';
    document.body.dataset.ready='true';
  }
}
function mountWork(work){
  const group=new THREE.Group();group.position.set(work.x,1.91,work.z);
  group.rotation.y=work.side==='left'?Math.PI/2:-Math.PI/2;
  work.group=group;
  const w=work.width+.31,h=work.height+.31;
  box(w+.09,h+.09,.095,frameWood,0,0,0,group);
  box(w,h,.025,mat('#f4f0e6',.94),0,0,.057,group);
  // Raised frame rails, bevel-like stepped inner edge, actual paper plane.
  const rail=.045;
  for(const x of [-w/2,w/2])box(rail,h+.045,.085,frameWood,x,0,.065,group);
  for(const y of [-h/2,h/2])box(w+.045,rail,.085,frameWood,0,y,.065,group);
  box(work.width+.018,work.height+.018,.008,mat('#b5ab98'),0,0,.075,group);
  const painting=new THREE.Mesh(new THREE.PlaneGeometry(work.width,work.height),mat('#ffffff',.98,{map:placeholder}));
  painting.position.z=.081;painting.userData.work=work;work.painting=painting;
  group.add(painting);paintings.push(painting);scene.add(group);
  const labelTexture=texture(256,64,(c,w,h)=>{
    c.fillStyle='#eee8da';c.fillRect(0,0,w,h);
    c.fillStyle='#656452';c.font='bold 30px "Microsoft JhengHei",sans-serif';
    c.textAlign='center';c.textBaseline='middle';c.fillText(`作品 ${work.id}`,w/2,h/2+1);
  });
  const label=new THREE.Mesh(new THREE.PlaneGeometry(.48,.12),new THREE.MeshBasicMaterial({map:labelTexture,transparent:true}));
  label.position.set(0,-.86,.09);label.userData.work=work;group.add(label);
  // Repeated fixtures; shared ambient lighting avoids 44 live light sources.
  cylinder(.055,.055,.11,bronze,work.x,3.68,work.z+.9);
  const fixture=cylinder(.066,.066,.20,bronze,work.x,3.55,work.z+.9);fixture.rotation.x=.38;
}
works.forEach(mountWork);
let exploring=false,drag=null,targetWork=null,quality=true,flight=null,noticeTimer;
const keys=new Set(),raycaster=new THREE.Raycaster();
const look=new THREE.Vector2();
function toast(text){$('#notice').textContent=text;$('#notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').classList.remove('visible'),3600);}
function enter(){if(!loaded)return;exploring=true;document.body.classList.add('exploring');$('#welcome').inert=true;canvas.focus({preventScroll:true});}
$('#enter').onclick=()=>{enter();toast('WASD 行走 · 拖曳環視 · 點擊畫作查看原圖');};
function unlock(){if(document.pointerLockElement)document.exitPointerLock();keys.clear();joystick.reset();drag=null;}
function openWork(work){
  if(!work)return;unlock();flight=null;
  $('#detail-image').src='./assets/'+work.file;$('#detail-image').alt=`作品 ${work.id} 原圖`;
  $('#detail-title').textContent=`作品 ${work.id}`;
  $('#detail-image').onerror=()=>{$('#detail-title').textContent=`作品 ${work.id} · 載入失敗，請關閉後重試`;};
  if(!$('#art-dialog').open)$('#art-dialog').showModal();
}
document.querySelectorAll('dialog .close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>{
  d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
});
$('#help').onclick=()=>{unlock();$('#help-dialog').showModal();};
$('#art-hint').onclick=()=>openWork(targetWork);
function goTo(work){
  if(!loaded)return;enter();unlock();
  const viewingX=work.side==='left'?work.x+1.9:work.x-1.9;
  flight={to:new THREE.Vector3(viewingX,1.64,work.z),yaw:work.side==='left'?Math.PI/2:-Math.PI/2,t:0};
}
$('#view-one').onclick=()=>goTo(works[0]);$('#view-two').onclick=()=>goTo(works[1]);
$('#browse').onclick=()=>{unlock();$('#browse-dialog').showModal();};
for(const work of works){
  const button=document.createElement('button');
  button.textContent=`作品 ${work.id} · 展區 ${String(work.zone+1).padStart(2,'0')}`;
  button.onclick=()=>{$('#browse-dialog').close();goTo(work);};
  $('#work-list').append(button);
}
const retryButton=document.createElement('button');retryButton.id='retry-load';
retryButton.textContent='部分作品載入失敗 · 重試';retryButton.hidden=true;
retryButton.onclick=()=>stream.retry();document.body.append(retryButton);
$('#reset').onclick=()=>{unlock();flight=null;camera.position.copy(start);camera.lookAt(-.6,1.7,-3.8);toast('已返回展室入口');};
$('#quality').onclick=()=>{
  quality=!quality;renderer.setPixelRatio(quality?Math.min(devicePixelRatio,1.65):1);
  sun.shadow.mapSize.set(quality?2048:1024,quality?2048:1024);
  if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}
  $('#quality').textContent='畫質：'+(quality?'高':'標準');
};
function modalOpen(){return !!document.querySelector('dialog[open]');}
window.addEventListener('keydown',e=>{
  if(modalOpen()||!exploring)return;
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();keys.add(e.code);flight=null;}
  if(e.code==='KeyE')openWork(targetWork);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();drag=null;});
document.addEventListener('visibilitychange',()=>{keys.clear();drag=null;});
document.addEventListener('pointerlockchange',()=>{$('#crosshair').hidden=document.pointerLockElement!==canvas;keys.clear();drag=null;});
document.addEventListener('pointerlockerror',()=>toast('可直接拖曳畫面環視'));
function rotate(dx,dy){
  flight=null;camera.rotation.y-=dx*.0025;camera.rotation.x=THREE.MathUtils.clamp(camera.rotation.x-dy*.0025,-1.12,1.12);
}
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&!modalOpen())rotate(e.movementX,e.movementY);});
canvas.addEventListener('pointerdown',e=>{
  if(!exploring||modalOpen()||drag)return;
  if(document.pointerLockElement===canvas){if(targetWork)openWork(targetWork);return;}
  drag={x:e.clientX,y:e.clientY,firstX:e.clientX,firstY:e.clientY,moved:false,id:e.pointerId};
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id||document.pointerLockElement===canvas)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(Math.hypot(e.clientX-drag.firstX,e.clientY-drag.firstY)>4)drag.moved=true;
  if(drag.moved)rotate(dx,dy);
  drag.x=e.clientX;drag.y=e.clientY;
});
for(const type of ['pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(drag?.id===e.pointerId)drag=null;});
canvas.addEventListener('pointerup',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const moved=drag.moved;drag=null;
  if(moved)return;
  look.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);
  raycaster.setFromCamera(look,camera);
  const hit=raycaster.intersectObjects(scene.children,true).find(hit=>hit.object.visible&&(!hit.object.parent||hit.object.parent.visible));
  if(hit?.object.userData.work&&hit.distance<3.1){openWork(hit.object.userData.work);return;}
  if(e.pointerType==='mouse' && canvas.requestPointerLock){
    const result=canvas.requestPointerLock();
    if(result?.catch)result.catch(()=>toast('可直接拖曳畫面環視'));
  }
});
const joystick=createJoystick($('#joystick'),{enabled:()=>exploring&&!modalOpen(),onStart:()=>{flight=null;}});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
let previous=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min((now-previous)/1000,.05);previous=now;
  if(flight){
    // Artwork shortcuts intentionally fade-teleport: no travel through the bench.
    flight.t+=dt;const f=Math.min(flight.t/.32,1);
    canvas.style.opacity=String(f<.5?1-f*1.4:.3+(f-.5)*1.4);
    if(f>=.5){camera.position.copy(flight.to);camera.rotation.set(.12,flight.yaw,0,'YXZ');}
    if(f>=1){flight=null;canvas.style.opacity='1';}
  } else if(exploring&&!modalOpen()){
    let forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
    let right=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
    forward+=joystick.state.forward;right+=joystick.state.right;
    const n=Math.hypot(forward,right);
    if(n){const scale=Math.max(1,n);forward/=scale;right/=scale;const a=camera.rotation.y,speed=1.7*dt;move(camera.position,(-Math.sin(a)*forward+Math.cos(a)*right)*speed,(-Math.cos(a)*forward-Math.sin(a)*right)*speed);}
  }
  updateArtworkStreaming();
  if(!flight)canvas.style.opacity='1';
  camera.updateMatrixWorld();
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  const hit=raycaster.intersectObjects(scene.children,true).find(hit=>hit.object.visible&&(!hit.object.parent||hit.object.parent.visible));
  targetWork=hit&&hit.distance<3.1?hit.object.userData.work:null;
  $('#art-hint').hidden=!exploring||!targetWork||modalOpen();
  renderer.render(scene,camera);
}
requestAnimationFrame(frame);
// Read-only inspection hook for local rendering / collision QA.
window.galleryDebug={get position(){return camera.position.toArray();},get loaded(){return loaded;},get objects(){return scene.children.length;},get calls(){return renderer.info.render.calls;}};
