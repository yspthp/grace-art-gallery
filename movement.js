import { works } from './artworks.js';
import { createLayout, RADIUS } from './layout.js';
const layout=createLayout(works);
export const bounds = { minX:-4.58,maxX:4.58,minZ:layout.back+.4,maxZ:4.48 };
// Expanded by the visitor radius (0.26m), so the camera never clips furniture.
export const obstacles = [
  {minX:-1.66,maxX:1.66,minZ:.83,maxZ:2.17},
  {minX:3.46,maxX:4.48,minZ:-3.18,maxZ:-2.16},
];
const partitions=layout.partitions;
export function canStand(x,z) {
  return x>=bounds.minX && x<=bounds.maxX && z>=bounds.minZ && z<=bounds.maxZ &&
    !obstacles.some(b=>x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ) &&
    !partitions.some(wall=>z>wall.minZ-RADIUS&&z<wall.maxZ+RADIUS&&x>wall.minX-RADIUS&&x<wall.maxX+RADIUS);
}
export function move(position,dx,dz) {
  // Sliding collision plus substeps prevents tunnelling after long frames.
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));
  for(let i=0;i<steps;i++){
    if(canStand(position.x+dx/steps,position.z)) position.x+=dx/steps;
    if(canStand(position.x,position.z+dz/steps)) position.z+=dz/steps;
  }
  return position;
}
