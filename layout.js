export const ROOM_DEPTH=10;
export const PER_ROOM=8;
export const FRONT=-4;
export const RADIUS=.28;
export function createLayout(artworks){
  const count=Math.ceil(artworks.length/PER_ROOM);
  const rooms=Array.from({length:count},(_,index)=>({
    index,front:FRONT-index*ROOM_DEPTH,back:FRONT-(index+1)*ROOM_DEPTH,
    doorX:index===0?0:(index%2?2.7:-2.7),doorWidth:2.2,
  }));
  const works=artworks.map((work,index)=>{
    const zone=Math.floor(index/PER_ROOM),slot=index%PER_ROOM;
    const side=slot%2?'right':'left';
    const ratio=work.pixelWidth/work.pixelHeight;
    return {...work,zone,side,x:side==='left'?-4.78:4.78,
      z:rooms[zone].front-1.8-Math.floor(slot/2)*2.1,
      width:1.3*Math.min(1,ratio),height:1.3*Math.min(1,1/ratio)};
  });
  const partitions=rooms.flatMap(room=>{
    const left=room.doorX-room.doorWidth/2,right=room.doorX+room.doorWidth/2;
    return [{minX:-5,maxX:left,minZ:room.front-.1,maxZ:room.front+.1},
      {minX:right,maxX:5,minZ:room.front-.1,maxZ:room.front+.1}];
  });
  return {rooms,works,partitions,back:rooms.at(-1)?.back??FRONT};
}
export function zoneAt(z,count){return Math.max(0,Math.min(count-1,Math.floor((FRONT-z)/ROOM_DEPTH)));}
export function viewingPoint(work){return {x:work.x+(work.side==='left'?1.9:-1.9),z:work.z};}
export function streamingRequests(works,position,zone,count){
  return works.flatMap(work=>{
    if(Math.abs(work.zone-zone)>1)return [];
    const distance=Math.hypot(position.x-work.x,position.z-work.z);
    const out=[{key:work.id+':low',url:'./assets/'+work.thumb,priority:(work.zone===zone?0:40)+distance}];
    if(distance<5.8)out.push({key:work.id+':high',url:'./assets/'+work.file,priority:20+distance});
    return out;
  });
}
