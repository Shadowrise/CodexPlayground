import { Group, Mesh, MeshLambertMaterial, Vector3 } from 'three';
import { fruitCalyx, fruitDetails, fruitLeaf, fruitSkin, fruitStem, fruitSurface } from './fruit-model';

export function makePeach() {
  const group = new Group(); group.name = 'Velvety blushed peach';
  const geometry = fruitSurface((u, v) => {
    const a = u * Math.PI * 2, t = v * Math.PI, ring = Math.sin(t);
    const y = .335 - .315 * Math.cos(t);
    // Two gentle cheeks join into one skin; the suture is an actual depression.
    const groove = .032 * Math.exp(-((Math.sin(a) / .15) ** 2)) * ring ** .55;
    const r = Math.max(0, ring * (.336 + .018 * Math.sin(t)) - groove);
    const topDimple = .052 * Math.exp(-(((1 - v) / .125) ** 2));
    return new Vector3(Math.sin(a) * r, y - topDimple + .012 * Math.sin(a) * ring, Math.cos(a) * r * .94);
  });
  const body = new Mesh(geometry, new MeshLambertMaterial({ map: fruitSkin('peach') }));
  body.name = 'Peach softly cleft fuzzy skin'; group.add(body);
  group.add(fruitDetails('Peach twig and veined leaves', [
    fruitCalyx(new Vector3(0, .602, 0), .029, '#826444'),
    fruitStem([new Vector3(0, .591, 0), new Vector3(.009, .657, .006), new Vector3(.034, .713, .014)], .016, '#826444'),
    fruitLeaf([new Vector3(.02, .668, .008), new Vector3(.12, .714, .018), new Vector3(.25, .685, .07), new Vector3(.34, .609, .105)], .05, '#41743b'),
    fruitLeaf([new Vector3(.025, .681, .01), new Vector3(-.07, .723, -.018), new Vector3(-.16, .703, -.055), new Vector3(-.21, .65, -.09)], .036, '#527b3d'),
  ]));
  return group;
}
