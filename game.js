import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const canvas = document.querySelector('#scene');
const loading = document.querySelector('#loadingScreen');
const intro = document.querySelector('#introCard');
const hud = document.querySelector('#gameHud');
const mobileControls = document.querySelector('#mobileControls');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#c7e1e3');
scene.fog = new THREE.FogExp2('#c7dfd9', 0.00155);
const camera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.1, 1200);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const hemi = new THREE.HemisphereLight('#eaf6ed', '#65754d', 2.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0d3', 3.1);
sun.position.set(-110, 150, 65);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -100; sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100; sun.shadow.camera.bottom = -100;
sun.shadow.bias = -0.00015;
scene.add(sun);

const terrainSize = 920;
function terrainHeight(x, z) {
  const hills = Math.sin(x * 0.011 + z * 0.007) * 4.1 + Math.cos(z * 0.016 - x * 0.008) * 2.8 + Math.sin(x * 0.032 + z * 0.021) * 1.1;
  const ridge1 = Math.exp(-(((x - 185) / 118) ** 2 + ((z + 70) / 205) ** 2)) * 29;
  const ridge2 = Math.exp(-(((x + 238) / 145) ** 2 + ((z - 80) / 230) ** 2)) * 23;
  const basin = -Math.exp(-(((x + 25) / 115) ** 2 + ((z - 110) / 112) ** 2)) * 4;
  return hills + ridge1 + ridge2 + basin;
}
function makeTerrain() {
  const divisions = 190;
  const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, divisions, divisions);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  const colors = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = terrainHeight(x, z);
    pos.setY(i, y);
    const variation = (Math.sin(x * .045) + Math.cos(z * .038) + Math.sin((x + z) * .025)) * .035;
    if (y > 17) c.set('#87947b');
    else c.set('#a8b68d');
    c.offsetHSL(variation, 0.015, variation * 0.65);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  ground.receiveShadow = true;
  scene.add(ground);
}
makeTerrain();

const routePoints = [
  new THREE.Vector3(-18, 0, 180), new THREE.Vector3(-25, 0, 130), new THREE.Vector3(-5, 0, 75),
  new THREE.Vector3(34, 0, 28), new THREE.Vector3(58, 0, -22), new THREE.Vector3(44, 0, -77),
  new THREE.Vector3(6, 0, -121), new THREE.Vector3(-42, 0, -160), new THREE.Vector3(-75, 0, -214),
  new THREE.Vector3(-58, 0, -267), new THREE.Vector3(-6, 0, -305), new THREE.Vector3(54, 0, -342),
  new THREE.Vector3(84, 0, -390), new THREE.Vector3(55, 0, -434)
];
const route = new THREE.CatmullRomCurve3(routePoints, false, 'catmullrom', .25);
const routeSamples = route.getPoints(260);
function roadHeight(x, z) { return terrainHeight(x, z) + .17; }
function makeRoad() {
  const verts = [], uvs = [], indices = [];
  const samples = route.getPoints(320);
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i], tangent = route.getTangent(i / (samples.length - 1));
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    for (const edge of [-1, 1]) {
      const x = p.x + side.x * edge * 5.2, z = p.z + side.z * edge * 5.2;
      verts.push(x, roadHeight(x, z), z);
      uvs.push(edge === -1 ? 0 : 1, i / 7);
    }
    if (i < samples.length - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const road = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#b8a382', roughness: 1, side: THREE.DoubleSide }));
  road.receiveShadow = true; scene.add(road);
  // Fine, sunlit gravel shoulders give the trail a softer edge.
  for (const sideSign of [-1, 1]) {
    const shoulderVerts = [];
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i], tangent = route.getTangent(i / (samples.length - 1));
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      for (const offset of [5.1, 6.7]) {
        const x = p.x + side.x * sideSign * offset, z = p.z + side.z * sideSign * offset;
        shoulderVerts.push(x, roadHeight(x, z) + .025, z);
      }
      if (i < samples.length - 1) { /* indexed below */ }
    }
    const sv = [], si = [];
    for (let i=0;i<samples.length;i++) {
      const a=i*2; sv.push(...shoulderVerts.slice(a*3,a*3+6));
      if(i<samples.length-1) si.push(a,a+1,a+2,a+1,a+3,a+2);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position',new THREE.Float32BufferAttribute(sv,3)); sg.setIndex(si); sg.computeVertexNormals();
    const sm = new THREE.Mesh(sg,new THREE.MeshStandardMaterial({color:'#cab894',roughness:1,side:THREE.DoubleSide})); sm.receiveShadow=true; scene.add(sm);
  }
}
makeRoad();

const pineMaterials = ['#526f4c','#607b52','#71875a'].map(color => new THREE.MeshStandardMaterial({ color, roughness: 1 }));
const trunkMat = new THREE.MeshStandardMaterial({ color: '#70543c', roughness: 1 });
const rockMat = new THREE.MeshStandardMaterial({ color: '#858a76', roughness: 1 });
const treeGeo = new THREE.ConeGeometry(1, 1, 7);
const trunkGeo = new THREE.CylinderGeometry(.13, .2, 1, 6);
const broadGeo = new THREE.IcosahedronGeometry(1, 1);
function isNearRoute(x,z,margin=15) {
  let best=Infinity;
  for(let i=0;i<routeSamples.length;i+=3) best=Math.min(best,Math.hypot(x-routeSamples[i].x,z-routeSamples[i].z));
  return best<margin;
}
let seed = 12671;
function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
function makeTree(x,z,scale,style) {
  const y=terrainHeight(x,z);
  const group=new THREE.Group(); group.position.set(x,y,z); group.scale.setScalar(scale);
  if(style===0){
    const trunk=new THREE.Mesh(trunkGeo,trunkMat);trunk.position.y=.75;trunk.castShadow=true;group.add(trunk);
    for(let i=0;i<3;i++){const crown=new THREE.Mesh(treeGeo,pineMaterials[Math.floor(random()*pineMaterials.length)]);crown.scale.set(1.35-i*.2,1.8,1.35-i*.2);crown.position.y=1.5+i*.72;crown.castShadow=true;group.add(crown);}
  } else {
    const trunk=new THREE.Mesh(trunkGeo,trunkMat);trunk.position.y=.85;trunk.scale.set(1,1.7,1);trunk.castShadow=true;group.add(trunk);
    const crown=new THREE.Mesh(broadGeo,pineMaterials[Math.floor(random()*pineMaterials.length)]);crown.scale.set(1.65,1.3,1.55);crown.position.y=2.2;crown.castShadow=true;group.add(crown);
  }
  scene.add(group);
}
for(let i=0;i<360;i++){
  const x=(random()-.5)*760,z=(random()-.5)*760;
  if(isNearRoute(x,z,13)||Math.hypot(x,z-180)<30)continue;
  makeTree(x,z,.65+random()*1.35,random()<.76?0:1);
}
for(let i=0;i<70;i++){
  const x=(random()-.5)*670,z=(random()-.5)*660;
  if(isNearRoute(x,z,9))continue;
  const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.6+random()*1.5,0),rockMat);
  rock.position.set(x,terrainHeight(x,z)+.25,z);rock.scale.y=.5+random()*.6;rock.rotation.set(random(),random()*3,random());rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
}

// A quiet alpine lake, a glint of blue between the trees.
const lake = new THREE.Mesh(new THREE.CircleGeometry(37, 48), new THREE.MeshStandardMaterial({ color: '#82b8b8', roughness: .22, metalness: .12, transparent: true, opacity: .84 }));
lake.rotation.x=-Math.PI/2;lake.position.set(-94,terrainHeight(-94,58)+.16,58);lake.scale.set(1.5,.72,1);scene.add(lake);

// Distant layered ridgelines sit on the horizon to make the valley feel open.
function makeRidge(z, color, height, spread) {
  const points=[]; const count=50;
  for(let i=0;i<=count;i++){
    const x=-520+i*(1040/count);
    const peak=Math.max(0,Math.sin(i*.48+z*.01)*.5+Math.sin(i*.19+2)*.35+Math.cos(i*.77)*.12);
    points.push(new THREE.Vector3(x,20+peak*height,z+(random()-.5)*spread));
  }
  const shape=new THREE.Shape();shape.moveTo(points[0].x,points[0].y);
  for(let i=1;i<points.length;i++)shape.lineTo(points[i].x,points[i].y);
  shape.lineTo(points.at(-1).x,-80);shape.lineTo(points[0].x,-80);shape.closePath();
  const geo=new THREE.ShapeGeometry(shape,1);const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,fog:true}));
  mesh.position.z=z;mesh.renderOrder=-2;scene.add(mesh);
}
makeRidge(-470,'#a5bdb1',85,7);makeRidge(-520,'#8fa99b',120,12);makeRidge(410,'#b5c8b3',65,10);

// Hand-built expedition 4x4; all geometry stays lightweight and works without external assets.
const jeep = new THREE.Group();
const chassis = new THREE.Group(); jeep.add(chassis); scene.add(jeep);
const bodyPaint = new THREE.MeshStandardMaterial({color:'#d27b45',roughness:.65,metalness:.08});
const darkPaint = new THREE.MeshStandardMaterial({color:'#263932',roughness:.62,metalness:.15});
const glassMat = new THREE.MeshStandardMaterial({color:'#9ebbb4',roughness:.22,metalness:.12,transparent:true,opacity:.66});
const seatMat = new THREE.MeshStandardMaterial({color:'#514738',roughness:1});
const lampMat = new THREE.MeshStandardMaterial({color:'#f8e4a6',emissive:'#d6a84c',emissiveIntensity:.75});
function box(parent,material,size,pos){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
box(chassis,darkPaint,[2.45,.42,4.05],[0,.86,0]);
box(chassis,bodyPaint,[2.55,.65,2.0],[0,1.37,.68]);
box(chassis,bodyPaint,[2.32,.68,1.36],[0,1.57,-1.03]);
box(chassis,darkPaint,[2.48,.16,1.65],[0,1.12,-.94]);
// cabin frame and broad front/rear glass
for(const x of [-1.04,1.04]){
  const pillar=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,1.12,8),darkPaint);pillar.position.set(x,2.02,-.58);pillar.rotation.x=-.19;pillar.castShadow=true;chassis.add(pillar);
  const rear=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,1.07,8),darkPaint);rear.position.set(x,2.0,-1.6);rear.rotation.x=.25;rear.castShadow=true;chassis.add(rear);
  box(chassis,seatMat,[.72,.72,.15],[x*.48,1.65,-.55]);
}
box(chassis,darkPaint,[2.1,.12,.14],[0,2.58,-1.08]);
const windshield=new THREE.Mesh(new THREE.PlaneGeometry(1.95,.78),glassMat);windshield.position.set(0,2.1,.18);windshield.rotation.x=-.22;chassis.add(windshield);
const rearGlass=new THREE.Mesh(new THREE.PlaneGeometry(1.75,.65),glassMat);rearGlass.position.set(0,2.12,-1.7);rearGlass.rotation.x=Math.PI+.25;chassis.add(rearGlass);
// Door rails, mirrors, front bumper and lights
for(const x of [-1.28,1.28]){
  box(chassis,darkPaint,[.08,.12,1.2],[x,1.56,-.63]);
  const mirror=box(chassis,darkPaint,[.24,.12,.15],[x*1.08,1.95,.13]);mirror.rotation.z=x<0?-.12:.12;
  const light=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,.08,16),lampMat);light.rotation.z=Math.PI/2;light.position.set(x*.78,1.51,1.72);chassis.add(light);
}
box(chassis,darkPaint,[2.72,.18,.2],[0,.86,2.04]);
box(chassis,darkPaint,[2.48,.14,.18],[0,.86,-2.02]);
// roof rack, little rolled canvas and a spare tire
box(chassis,darkPaint,[1.78,.11,1.24],[0,2.68,-1.1]);
for(const x of [-.7,.7])box(chassis,bodyPaint,[.11,.22,.11],[x,2.82,-1.1]);
const spare=new THREE.Mesh(new THREE.TorusGeometry(.43,.16,10,20),darkPaint);spare.position.set(0,1.55,-2.16);spare.rotation.x=Math.PI/2;chassis.add(spare);
const wheelMat=new THREE.MeshStandardMaterial({color:'#202a27',roughness:.88});
const hubMat=new THREE.MeshStandardMaterial({color:'#b8b19a',metalness:.32,roughness:.55});
const wheels=[];
for(const x of [-1.29,1.29])for(const z of [-1.28,1.34]){
  const pivot=new THREE.Group();pivot.position.set(x,.67,z);chassis.add(pivot);
  const tire=new THREE.Mesh(new THREE.CylinderGeometry(.52,.52,.34,18),wheelMat);tire.rotation.z=Math.PI/2;tire.castShadow=true;pivot.add(tire);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.355,12),hubMat);hub.rotation.z=Math.PI/2;hub.position.x=x<0?-.01:.01;pivot.add(hub);
  wheels.push({pivot,tire,front:z>0});
}
// Start at the trailhead, with the nose following the first bend.
const startT=.035, startPos=route.getPoint(startT), startTan=route.getTangent(startT);
jeep.position.set(startPos.x,terrainHeight(startPos.x,startPos.z)+.1,startPos.z);
jeep.rotation.y=Math.atan2(-startTan.x,-startTan.z);
const checkpoints=[
 {name:'Mirante da Serra',t:.28},
 {name:'Lago Escondido',t:.49},
 {name:'Bosque das Araucárias',t:.72},
 {name:'Fim da Estrada',t:.96}
].map((item,index)=>({ ...item, position:route.getPoint(item.t), index, found:false, marker:null }));
for(const cp of checkpoints){
 const group=new THREE.Group();group.position.copy(cp.position);group.position.y=terrainHeight(cp.position.x,cp.position.z)+.15;
 const ring=new THREE.Mesh(new THREE.TorusGeometry(2.8,.12,8,36),new THREE.MeshBasicMaterial({color:'#f4c77c'}));ring.position.y=3.1;group.add(ring);
 const orb=new THREE.Mesh(new THREE.SphereGeometry(.48,16,12),new THREE.MeshBasicMaterial({color:'#fff1c0'}));orb.position.y=3.1;group.add(orb);
 const beam=new THREE.Mesh(new THREE.CylinderGeometry(.08,.38,3,12,1,true),new THREE.MeshBasicMaterial({color:'#f7d99b',transparent:true,opacity:.18,side:THREE.DoubleSide}));beam.position.y=1.6;group.add(beam);
 cp.marker=group;scene.add(group);
}

const keys=new Set();
const touch={left:false,right:false,gas:false,brake:false};
let started=false, speed=0, steering=0, distanceTravelled=0, audioCtx=null, engineOsc=null, engineGain=null, soundOn=false;
const maxSpeed=27;
const speedEl=document.querySelector('#speedValue');
const objectiveEl=document.querySelector('#objectiveName');
const distanceEl=document.querySelector('#objectiveDistance');
const countEl=document.querySelector('#checkpointCount');
const locationEl=document.querySelector('#locationName');
const arrival=document.querySelector('#arrivalCard');
const arrivalName=document.querySelector('#arrivalName');
let arrivalTimer;
function setSound(enabled){
 soundOn=enabled;document.querySelector('#soundIcon').style.opacity=enabled?'1':'.48';
 if(enabled&&!audioCtx){
   audioCtx=new AudioContext();engineOsc=audioCtx.createOscillator();engineGain=audioCtx.createGain();engineOsc.type='sawtooth';engineOsc.frequency.value=48;engineGain.gain.value=.0001;engineOsc.connect(engineGain).connect(audioCtx.destination);engineOsc.start();
 }
 if(audioCtx){if(audioCtx.state==='suspended')audioCtx.resume();engineGain.gain.setTargetAtTime(enabled?.018:.0001,audioCtx.currentTime,.12);}
}
document.querySelector('#soundButton').addEventListener('click',()=>setSound(!soundOn));
function updateObjective(){
 const next=checkpoints.find(cp=>!cp.found);
 if(next){objectiveEl.textContent=next.name;const d=jeep.position.distanceTo(next.position);distanceEl.textContent=d>1000?(d/1000).toFixed(1)+' km':Math.round(d*10)+' m';}
 else {objectiveEl.textContent='Siga explorando';distanceEl.textContent='∞';}
}
function setLocation(){
 let nearest=checkpoints[0],best=Infinity;
 for(const cp of checkpoints){const d=jeep.position.distanceTo(cp.position);if(d<best){best=d;nearest=cp;}}
 const name=best<95?nearest.name:(jeep.position.z>80?'Vale do Pinheiro':jeep.position.z>-70?'Curva do Cedro':jeep.position.z>-230?'Lago Escondido':'Alto da Serra');
 locationEl.textContent=name.toLocaleUpperCase('pt-BR');
}
function begin(){
 if(started)return;started=true;intro.style.opacity='0';intro.style.transform='translateY(-42%) translateX(-8px)';
 setTimeout(()=>intro.hidden=true,650);document.querySelector('#locationTag').style.opacity='0';hud.hidden=false;mobileControls.hidden=false;
}
document.querySelector('#startButton').addEventListener('click',begin);
document.querySelector('#helpButton').addEventListener('click',()=>document.querySelector('#helpPopover').hidden=!document.querySelector('#helpPopover').hidden);
document.querySelector('#closeHelp').addEventListener('click',()=>document.querySelector('#helpPopover').hidden=true);
window.addEventListener('keydown',e=>{const key=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();keys.add(key);if(!started&&['w','arrowup'].includes(key))begin();});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>keys.clear());
for(const button of document.querySelectorAll('[data-control]')){
 const action=button.dataset.control;
 const down=e=>{e.preventDefault();touch[action]=true;if(action==='gas'&&!started)begin();};
 const up=e=>{e.preventDefault();touch[action]=false;};
 button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('pointerleave',up);
}
function active(...names){return names.some(n=>keys.has(n));}
const clock=new THREE.Clock();
let uiClock=0;
function animate(){
 requestAnimationFrame(animate);
 const dt=Math.min(clock.getDelta(),.04),time=clock.elapsedTime;
 for(const cp of checkpoints){if(cp.marker){cp.marker.children[0].rotation.z=time*.55;cp.marker.children[1].position.y=3.1+Math.sin(time*2+cp.index)*.2;}}
 if(started){
   const gas=active('w','arrowup')||touch.gas, reverse=active('s','arrowdown')||touch.brake, brake=active(' ','shift')||touch.brake;
   const steerInput=(active('a','arrowleft')||touch.left?1:0)-(active('d','arrowright')||touch.right?1:0);
   if(gas)speed=Math.min(maxSpeed,speed+dt*9.3);
   else if(reverse&&!brake)speed=Math.max(-8,speed-dt*7);
   else speed*=Math.max(0,1-dt*(brake?4.7:1.05));
   if(brake&&speed>0)speed=Math.max(0,speed-dt*18);
   steering=THREE.MathUtils.damp(steering,steerInput,5.5,dt);
   const steerStrength=(.22+Math.min(Math.abs(speed)/maxSpeed,1)*.86);
   jeep.rotation.y+=steering*steerStrength*dt*Math.sign(speed||1);
   const forward=new THREE.Vector3(-Math.sin(jeep.rotation.y),0,-Math.cos(jeep.rotation.y));
   jeep.position.addScaledVector(forward,speed*dt);
   const terrainY=terrainHeight(jeep.position.x,jeep.position.z);
   const bump=Math.sin(time*10+distanceTravelled*.35)*Math.min(Math.abs(speed)*.002,.045);
   jeep.position.y=THREE.MathUtils.damp(jeep.position.y,terrainY+.1+bump,8,dt);
   chassis.rotation.z=THREE.MathUtils.damp(chassis.rotation.z,-steering*Math.min(Math.abs(speed)/maxSpeed,1)*.08,4,dt);
   chassis.rotation.x=THREE.MathUtils.damp(chassis.rotation.x,gas?-.018:reverse?.014:0,3,dt);
   for(const wheel of wheels){wheel.tire.rotation.x-=speed*dt*1.65;if(wheel.front)wheel.pivot.rotation.y=steering*.42;}
   distanceTravelled+=Math.abs(speed*dt);
   for(const cp of checkpoints){
     if(!cp.found&&jeep.position.distanceTo(cp.position)<12){cp.found=true;cp.marker.visible=false;countEl.textContent=String(checkpoints.filter(c=>c.found).length);arrivalName.textContent=cp.name;arrival.hidden=false;clearTimeout(arrivalTimer);arrivalTimer=setTimeout(()=>arrival.hidden=true,3100);}
   }
   if(uiClock>0.15){speedEl.textContent=String(Math.round(Math.abs(speed)*3.6)).padStart(2,'0');updateObjective();setLocation();uiClock=0;}
   uiClock+=dt;
   if(engineOsc&&audioCtx&&soundOn)engineOsc.frequency.setTargetAtTime(42+Math.abs(speed)*3.4,audioCtx.currentTime,.08);
 }
 // Smooth chase camera, with enough look-ahead to read the next curve.
 const forward=new THREE.Vector3(-Math.sin(jeep.rotation.y),0,-Math.cos(jeep.rotation.y));
 const desiredCamera=jeep.position.clone().addScaledVector(forward,-10.5).add(new THREE.Vector3(0,5.3,0));
 camera.position.lerp(desiredCamera,1-Math.exp(-dt*3.1));
 const lookAt=jeep.position.clone().addScaledVector(forward,5.7).add(new THREE.Vector3(0,1.45,0));
 camera.lookAt(lookAt);
 renderer.render(scene,camera);
}
animate();
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));});
setTimeout(()=>{loading.style.opacity='0';setTimeout(()=>loading.remove(),850);},650);
