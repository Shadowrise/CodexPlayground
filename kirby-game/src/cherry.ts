import { Color, Float32BufferAttribute, Group, Mesh, MeshLambertMaterial, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fruitCalyx, fruitDetails, fruitLeaf, fruitSkin, fruitStem, fruitSurface, smooth } from './fruit-model';

/** Two plump, slightly different cherries with stems seated in actual dimples. */
export function makeCherry() {
  const group = new Group(); group.name = 'Detailed paired red cherries';
  const berry = fruitSurface((u, v) => {
    const a = u * Math.PI * 2, t = v * Math.PI, ring = Math.sin(t);
    const groove = .008 * Math.exp(-((Math.sin(a) / .17) ** 2)) * smooth(.45, .9, v) * ring;
    const r = Math.max(0, .203 * ring * (1 + .052 * ring) - groove);
    const dimple = .034 * Math.exp(-(((1 - v) / .135) ** 2));
    const y = .20 - .195 * Math.cos(t) - dimple + .003 * Math.sin(a) * ring;
    return new Vector3(Math.sin(a) * r, y, Math.cos(a) * r * .96);
  }, 28, 22);
  const cherries = [
    { x: -.20, y: .011, z: 0, scale: 1, colour: '#ffffff' },
    { x: .218, y: 0, z: .049, scale: .965, colour: '#f7e3e9' },
  ];
  const bodies = cherries.map(cherry => {
    const geometry = berry.clone(); geometry.scale(cherry.scale, cherry.scale, cherry.scale);
    geometry.translate(cherry.x, cherry.y, cherry.z);
    const colour = new Color(cherry.colour), colours: number[] = [];
    for (let i = 0; i < geometry.attributes.position.count; i++) colours.push(colour.r, colour.g, colour.b);
    geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
    return geometry;
  });
  const geometry = mergeGeometries(bodies)!; berry.dispose(); bodies.forEach(body => body.dispose());
  const body = new Mesh(geometry, new MeshLambertMaterial({ map: fruitSkin('cherry'), vertexColors: true }));
  body.name = 'Cherry plump heart shaped skins'; group.add(body);
  const sockets = cherries.map(cherry => new Vector3(cherry.x, cherry.y + .361 * cherry.scale, cherry.z));
  group.add(fruitDetails('Cherry curved twin stalks and veined leaf', [
    fruitCalyx(sockets[0], .025, '#646433'), fruitCalyx(sockets[1], .024, '#716f36'),
    fruitStem([sockets[0], new Vector3(-.188, .51, -.005), new Vector3(-.095, .679, .016), new Vector3(.016, .802, .034)], .012, '#6b7937'),
    fruitStem([sockets[1], new Vector3(.205, .503, .057), new Vector3(.114, .691, .048), new Vector3(.016, .802, .034)], .011, '#7b863e'),
    fruitStem([new Vector3(.016, .788, .034), new Vector3(.011, .852, .024), new Vector3(.031, .894, .014)], .017, '#826844'),
    fruitStem([new Vector3(.011, .842, .027), new Vector3(.072, .862, .035), new Vector3(.102, .858, .052)], .005, '#687d37', 6, 5),
    fruitLeaf([new Vector3(.056, .855, .033), new Vector3(.16, .904, .061), new Vector3(.30, .861, .132), new Vector3(.37, .763, .163)], .066, '#3f753b'),
  ]));
  return group;
}
