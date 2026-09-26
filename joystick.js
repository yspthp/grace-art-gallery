export function stickVector(dx,dy,radius,deadzone=.12){
  const length=Math.hypot(dx,dy),amount=Math.min(1,length/radius);
  const power=Math.max(0,(amount-deadzone)/(1-deadzone));
  return {right:power?dx/length*power:0,forward:power?-dy/length*power:0,
    x:length?dx/length*Math.min(length,radius):0,y:length?dy/length*Math.min(length,radius):0};
}
export function createJoystick(element,{enabled,onStart}){
  const knob=element.querySelector('.stick-knob');
  const state={right:0,forward:0};
  let pointer=null;
  function reset(){
    const old=pointer;pointer=null;state.right=state.forward=0;
    knob.style.transform='translate(0px,0px)';
    element.classList.remove('active');
    if(old!==null&&element.hasPointerCapture(old))element.releasePointerCapture(old);
  }
  function update(event){
    const rect=element.getBoundingClientRect();
    const radius=(rect.width-knob.offsetWidth)/2-5;
    const vector=stickVector(event.clientX-rect.left-rect.width/2,event.clientY-rect.top-rect.height/2,radius);
    state.right=vector.right;state.forward=vector.forward;
    knob.style.transform=`translate(${vector.x}px,${vector.y}px)`;
  }
  element.addEventListener('pointerdown',event=>{
    if(pointer!==null||!enabled()||(event.pointerType==='mouse'&&event.button!==0))return;
    event.preventDefault();pointer=event.pointerId;element.setPointerCapture(pointer);
    onStart();element.classList.add('active');update(event);
  });
  element.addEventListener('pointermove',event=>{if(event.pointerId===pointer){event.preventDefault();update(event);}});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])
    element.addEventListener(type,event=>{if(event.pointerId===pointer)reset();});
  window.addEventListener('blur',reset);
  window.addEventListener('resize',reset);
  document.addEventListener('visibilitychange',reset);
  return {state,reset};
}
