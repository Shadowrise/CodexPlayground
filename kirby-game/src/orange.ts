import { Group, Mesh, MeshLambertMaterial, Vector3 } from 'three';
import { fruitCalyx, fruitDetails, fruitLeaf, fruitSkin, fruitStem, fruitSurface } from './fruit-model';

export function makeOrange() {
  const group = new Group(); group.name = 'Pore textured ripe orange';
  const geometry = fruitSurface((u, v) => {
    const a = u * Math.PI * 2, t = v * Math.PI, ring = Math.sin(t);
    const r = .346 * ring * (1 + .008 * Math.cos(a * 9) * ring);
    const dimple = .025 * Math.exp(-(((1 - v) / .105) ** 2));
    const navel = .013 * Math.exp(-((v / .10) ** 2));
    return new Vector3(Math.sin(a) * r, .334 - .318 * Math.cos(t) - dimple + navel, Math.cos(a) * r * .98);
  });
  const body = new Mesh(geometry, new MeshLambertMaterial({ map: fruitSkin('orange') }));
  body.name = 'Orange finely pitted matte peel'; group.add(body);
  const navel = fruitCalyx(new Vector3(0, .03, 0), .026, '#a1672d');
  navel.rotateX(Math.PI); navel.translate(0, .06, 0);
  group.add(fruitDetails('Orange leafy calyx and blossom scar', [
    fruitCalyx(new Vector3(0, .627, 0), .066, '#496b30', 6),
    fruitStem([new Vector3(0, .624, 0), new Vector3(.006, .683, 0), new Vector3(.025, .727, .004)], .016, '#647039'),
    fruitLeaf([new Vector3(.014, .68, .002), new Vector3(.118, .718, .033), new Vector3(.232, .669, .07), new Vector3(.279, .587, .098)], .059, '#366631'),
    navel,
  ]));
  return group;
}
