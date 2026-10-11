import { CatmullRomCurve3, Group, Mesh, MeshLambertMaterial, Vector3 } from 'three';
import { fruitCalyx, fruitDetails, fruitLeaf, fruitSkin, fruitStem, fruitSurface } from './fruit-model';

export function makePear() {
  const group = new Group(); group.name = 'Curved golden speckled pear';
  const profile = new CatmullRomCurve3([
    new Vector3(0, .016, 0), new Vector3(.17, .034, 0), new Vector3(.287, .123, 0),
    new Vector3(.323, .278, 0), new Vector3(.286, .438, 0), new Vector3(.207, .585, 0),
    new Vector3(.139, .735, 0), new Vector3(.098, .825, 0), new Vector3(0, .864, 0),
  ]);
  const geometry = fruitSurface((u, v) => {
    const p = profile.getPoint(v), a = u * Math.PI * 2;
    const r = Math.max(0, p.x) * (1 + .018 * Math.cos(a * 5) * Math.sin(Math.PI * v));
    const bend = .054 * v ** 2;
    return new Vector3(bend + Math.sin(a) * r, p.y + .009 * Math.cos(a) * Math.sin(Math.PI * v), Math.cos(a) * r * .95);
  }, 40, 32);
  const body = new Mesh(geometry, new MeshLambertMaterial({ map: fruitSkin('pear') }));
  body.name = 'Pear continuous bulb and bent neck'; group.add(body);
  const scar = fruitCalyx(new Vector3(0, 0, 0), .026, '#775433');
  scar.rotateX(Math.PI); scar.translate(0, .019, 0);
  group.add(fruitDetails('Pear woody stalk and folded leaf', [
    fruitCalyx(new Vector3(.054, .865, 0), .029, '#8a7047'),
    fruitStem([new Vector3(.053, .853, 0), new Vector3(.067, .919, -.009), new Vector3(.042, .995, -.022), new Vector3(.06, 1.025, -.02)], .019, '#715438'),
    fruitStem([new Vector3(.054, .945, -.014), new Vector3(.101, .963, .008), new Vector3(.15, .949, .028)], .006, '#758442'),
    fruitLeaf([new Vector3(.086, .956, .004), new Vector3(.183, 1.006, .041), new Vector3(.30, .963, .101), new Vector3(.375, .859, .133)], .072, '#49763b'),
    scar,
  ]));
  return group;
}
