import { Group, Mesh, MeshLambertMaterial, Vector3 } from 'three';
import { fruitCalyx, fruitDetails, fruitSkin, fruitStem, fruitSurface } from './fruit-model';

export function makeWatermelon() {
  const group = new Group(); group.name = 'Organic striped oval watermelon';
  const geometry = fruitSurface((u, v) => {
    const a = u * Math.PI * 2, t = v * Math.PI, ring = Math.sin(t);
    const r = ring * (1 + .008 * Math.cos(a * 10) * ring);
    // Long axis joins the stalk to the blossom; stripes follow that axis.
    const x = -.635 * Math.cos(t);
    let y = .425 + Math.cos(a) * .414 * r;
    y = .02 + Math.max(0, y - .02); // A small, natural resting patch.
    return new Vector3(x, y, Math.sin(a) * .429 * r);
  }, 44, 30);
  const body = new Mesh(geometry, new MeshLambertMaterial({ map: fruitSkin('watermelon') }));
  body.name = 'Watermelon irregular striped mottled rind'; group.add(body);
  const scar = fruitCalyx(new Vector3(0, 0, 0), .036, '#8d7441');
  scar.rotateZ(-Math.PI / 2); scar.translate(.638, .425, 0);
  const stalkBase = fruitCalyx(new Vector3(0, 0, 0), .045, '#748446');
  stalkBase.rotateZ(Math.PI / 2); stalkBase.translate(-.636, .425, 0);
  group.add(fruitDetails('Watermelon dry stalk, tendril and blossom', [
    stalkBase, scar,
    fruitStem([new Vector3(-.626, .425, 0), new Vector3(-.67, .445, .012), new Vector3(-.695, .521, .025), new Vector3(-.756, .576, .013)], .019, '#778346'),
    fruitStem([new Vector3(-.751, .571, .013), new Vector3(-.774, .592, .015), new Vector3(-.787, .588, .023)], .017, '#685437'),
    fruitStem([new Vector3(-.682, .493, .022), new Vector3(-.701, .542, .09), new Vector3(-.68, .59, .145), new Vector3(-.63, .603, .16), new Vector3(-.605, .574, .132), new Vector3(-.631, .558, .11)], .006, '#8b9250'),
  ]));
  return group;
}
