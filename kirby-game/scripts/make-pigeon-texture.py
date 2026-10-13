"""Deterministic gouache/graphite atlas for the approved pigeon geometry."""
from pathlib import Path
import math
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[1] / "design" / "pigeon"
SIZE = 2048
rng = random.Random(4317)
noise_rng = np.random.default_rng(4317)

def rgb(value):
    return np.array(tuple(bytes.fromhex(value.lstrip("#"))), dtype=np.float32)

def smooth(value, lo, hi):
    t = np.clip((value-lo)/(hi-lo), 0, 1)
    return t*t*(3-2*t)

def mix(a, b, weight):
    return a*(1-weight[..., None])+b*weight[..., None]

def grain(image, strength=1.35):
    a = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    h, w = a.shape[:2]
    coarse = Image.fromarray(noise_rng.integers(100, 155, (max(8,h//38),max(8,w//38)),dtype=np.uint8)).resize((w,h),Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(7))
    wash = (np.asarray(coarse,dtype=np.float32)-127)*.10
    speck = noise_rng.normal(0,strength,(h,w)).astype(np.float32)
    a += (wash+speck)[..., None]
    return Image.fromarray(np.uint8(np.clip(a,0,255))).convert("RGBA")

def daub(draw, x, y, length, width, angle, color, alpha):
    # Open, tapered feather-shaped brush mark with a broken, asymmetric tip.
    shape=[(-.38,-.44),(.30,-.50),(.48,-.17),(.39,.23),(.12,.50),(-.04,.36),(-.21,.47),(-.43,.13),(-.48,-.20)]
    co, si = math.cos(angle), math.sin(angle)
    points=[]
    for px,py in shape:
        px*=width*rng.uniform(.9,1.1);py*=length*rng.uniform(.94,1.06)
        points.append((x+px*co-py*si,y+px*si+py*co))
    draw.polygon(points, fill=(*color,alpha))

def marks(image, count, area="body"):
    w,h=image.size
    for layer in range(3):
        overlay=Image.new("RGBA",image.size);d=ImageDraw.Draw(overlay)
        for _ in range(count//3):
            x=rng.uniform(-25,w+25);y=rng.uniform(0,h)
            if area=="body":
                world_y=2.768-y/h*2.381
                theta=x/w*math.tau
                head=world_y>2.25
                neck=1.55<world_y<2.28
                angle=.36*math.cos(theta)+rng.uniform(-.24,.24)
                if neck:
                    # Interleaved sage/plum feathers, with staggered tips.
                    sage=world_y>1.98+rng.uniform(-.13,.13)
                    color=(105,132,127) if sage else (139,116,149)
                    length=rng.uniform(28,67);width=rng.uniform(14,33);alpha=rng.randrange(28,68)
                else:
                    length=rng.uniform(15,32) if head else rng.uniform(35,80)
                    width=rng.uniform(9,18) if head else rng.uniform(17,43)
                    color=rng.choice([(188,188,192),(101,108,121),(148,144,152),(181,178,177)])
                    alpha=rng.randrange(12,30) if head else rng.randrange(13,34)
            else:
                angle=(.55 if area=="wing" else 1.22)+rng.uniform(-.18,.18)
                length=rng.uniform(18,48);width=rng.uniform(9,23)
                color=rng.choice([(184,186,190),(103,111,126),(155,157,166)])
                alpha=rng.randrange(14,34)
            daub(d,x,y,length,width,angle,color,alpha)
            if area=="body" and (x<30 or x>w-30):
                daub(d,x+(w if x<30 else -w),y,length,width,angle,color,alpha)
        image=Image.alpha_composite(image,overlay.filter(ImageFilter.GaussianBlur(.65)))
    # Sparse broken graphite strokes at feather tips, never closed scale rows.
    overlay=Image.new("RGBA",image.size);d=ImageDraw.Draw(overlay)
    for _ in range(count//5):
        x=rng.uniform(0,w);y=rng.uniform(0,h)
        length=rng.uniform(7,25) if area=="body" else rng.uniform(8,21)
        angle=.25*math.cos(x/w*math.tau) if area=="body" else .65
        dx=math.sin(angle)*length;dy=math.cos(angle)*length
        points=[(x,y),(x+dx*.4+rng.uniform(-2,2),y+dy*.4),(x+dx,y+dy)]
        d.line(points, fill=(74,80,94,rng.randrange(16,37)),width=1)
        if rng.random()<.35:
            d.line([(x+3,y+2),(x+dx*.55+3,y+dy*.55+2)],fill=(208,205,202,25),width=1)
    return Image.alpha_composite(image,overlay.filter(ImageFilter.GaussianBlur(.3)))

# Cylindrical body UV: angular coordinate around the whole bird, height downward.
w=h=1536
theta=np.linspace(0,math.tau,w,dtype=np.float32)[None,:]
y=np.linspace(2.768,.387,h,dtype=np.float32)[:,None]
front=np.maximum(0,np.sin(theta))*np.ones_like(y)
head=smooth(y,2.08,2.66)*np.ones_like(theta)
body=np.broadcast_to(rgb("#7f8999"),(h,w,3)).copy()
body=mix(body,rgb("#647389"),head*.64)
belly=front**.7*(1-smooth(y,1.52,2.03))
body=mix(body,rgb("#9c9ba2"),belly*.86)
# Broad irregular washes underneath individual neck dabs.
irregular=.045*np.sin(theta*7)+.028*np.cos(theta*13)
plum=np.exp(-((y-(1.87+irregular))/.28)**4)*.38
sage=np.exp(-((y-(2.12+irregular))/.14)**2)*.33
body=mix(body,rgb("#887695"),plum)
body=mix(body,rgb("#6e8983"),sage)
body=Image.fromarray(np.uint8(np.clip(body,0,255))).convert("RGBA")
body=grain(marks(body,3800,"body"),1.30)
# Wrap the tiny seam strip so moving around the back never reveals a paint join.
body_array=np.asarray(body).copy();seam=(body_array[:,:2,:3].astype(np.uint16)+body_array[:,-2:,:3].astype(np.uint16))//2
body_array[:,:2,:3]=seam;body_array[:,-2:,:3]=seam
body=Image.fromarray(body_array)

# Preserve the sketch's feather-bar shapes, rebuild their tonal treatment using
# the same palette and brushwork as the body, removing the old pasted pencil rim.
reference=Image.open(OUT/"wing-paint.png").convert("RGB").filter(ImageFilter.MedianFilter(3)).filter(ImageFilter.GaussianBlur(1.5)).resize((512,512),Image.Resampling.BICUBIC)
luma=np.asarray(reference,dtype=np.float32).mean(axis=2)
mask=smooth(luma,92,159)
wing=mix(np.broadcast_to(rgb("#59687c"),(512,512,3)),rgb("#939dab"),mask)
wing=Image.fromarray(np.uint8(np.clip(wing,0,255))).convert("RGBA")
wing=grain(marks(wing,530,"wing"),1.30)

# Tail has elongated, broad painted feather strokes and soft graphite divisions.
tail=Image.new("RGBA",(512,512),(87,103,124,255))
tail=marks(tail,310,"tail")
overlay=Image.new("RGBA",tail.size);d=ImageDraw.Draw(overlay)
for offset in [-45,50,139]:
    path=[]
    for xx in range(0,513,8):
        yy=230+offset+xx*.28+4*math.sin(xx/48)
        path.append((xx,yy))
    d.line(path,fill=(53,68,88,70),width=3)
tail=grain(Image.alpha_composite(tail,overlay.filter(ImageFilter.GaussianBlur(1.1))),1.30)

# Shared matte dry-brush detail for beak/feet and very restrained ivory eyes.
detail=Image.new("RGBA",(512,512),(246,245,244,255))
detail=grain(marks(detail,240,"tail"),.65)
eyes=Image.new("RGBA",(512,512),(250,249,247,255))
eyes=grain(eyes,.40)
overlay=Image.new("RGBA",eyes.size);d=ImageDraw.Draw(overlay)
for n in range(16):
    x=rng.randrange(30,450);yy=rng.randrange(40,440)
    d.arc((x-35,yy-12,x+35,yy+20),20,95,fill=(165,158,155,12),width=2)
eyes=Image.alpha_composite(eyes,overlay.filter(ImageFilter.GaussianBlur(.5)))

def padded(image):
    w,h=image.size
    inner=np.asarray(image.resize((w-32,h-32),Image.Resampling.LANCZOS))
    return Image.fromarray(np.pad(inner,((16,16),(16,16),(0,0)),mode="edge"))

atlas=Image.new("RGBA",(SIZE,SIZE),(246,245,244,255))
atlas.paste(padded(body),(0,0));atlas.paste(padded(wing),(1536,0));atlas.paste(padded(tail),(1536,512));atlas.paste(padded(detail),(1536,1024));atlas.paste(padded(eyes),(1536,1536))
atlas.save(OUT/"pigeon-paint-atlas.png",optimize=True)
cache=OUT.parents[1]/"node_modules"/".cache"/"pigeon"
cache.mkdir(parents=True,exist_ok=True)
(cache/"paint-atlas.rgba").write_bytes(atlas.tobytes())
print(f"Saved {SIZE}x{SIZE} unified pigeon atlas: {(OUT/'pigeon-paint-atlas.png').stat().st_size} bytes")
