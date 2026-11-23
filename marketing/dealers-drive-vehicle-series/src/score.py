"""Original deterministic 120 BPM stereo score and edit-synchronised sound design.
No samples, external recordings, downloaded music, or third-party music rights.
"""
from array import array
import math, random, sys, wave
from pathlib import Path

SR=48000
N=20*SR
L=array('f',[0])*N
R=array('f',[0])*N
rng=random.Random(20261025)
TAU=2*math.pi
def hz(note): return 440*2**((note-69)/12)
def add(at,dur,fn,amp=1,pan=0):
    a=int(at*SR);count=min(int(dur*SR),N-a)
    left=math.sqrt((1-pan)/2);right=math.sqrt((1+pan)/2)
    for j in range(max(0,count)):
        v=fn(j/SR,j/count)*amp
        L[a+j]+=v*left;R[a+j]+=v*right
def bell(at,note,amp=.12,pan=0,dur=.9):
    f=hz(note)
    def sample(t,p):
        return (math.sin(TAU*f*t)+.32*math.sin(TAU*f*2.005*t)+.14*math.sin(TAU*f*3*t))*min(1,t/.007)*math.exp(-t*5)*min(1,(1-p)*20)
    add(at,dur,sample,amp,pan)
    if at+.19<20:add(at+.19,dur*.65,lambda t,p:sample(t,p),amp*.23,-pan)
def pad(at,notes,dur=2,amp=.027):
    for i,n in enumerate(notes):
        f=hz(n)
        def fn(t,p,f=f):
            env=min(1,t/.15)*min(1,(1-p)*8)
            duck=.55+.45*(1-math.exp(-((at+t)%.5)*12))
            return env*duck*(math.sin(TAU*f*t)+.25*math.sin(TAU*f*2*t)+.17*math.sin(TAU*(f*1.002)*t))
        add(at,dur,fn,amp,(i-1.5)*.38)
def kick(at,amp=.4):
    add(at,.34,lambda t,p:math.sin(TAU*(47*t+7*(1-math.exp(-t*30))))*math.exp(-t*14)+.06*(rng.random()*2-1)*math.exp(-t*250),amp)
def hat(at,amp=.026,pan=.2,open=False):
    add(at,.14 if open else .055,lambda t,p:(rng.random()*2-1)*math.exp(-t*(40 if open else 95)),amp,pan)
def clap(at,amp=.10):
    add(at,.13,lambda t,p:(rng.random()*2-1)*math.exp(-t*35)*(1+.4*math.sin(t*TAU*1400)),amp,-.13)
def bass(at,note,amp=.13,dur=.35):
    f=hz(note)
    add(at,dur,lambda t,p:(math.sin(TAU*f*t)+.18*math.sin(TAU*f*2*t))*min(1,t/.012)*math.exp(-t*5)*min(1,(1-p)*10),amp)
def sweep(at,dur=.28,amp=.12):
    # A short, warm filtered-noise ribbon, with stereo motion.
    phase=0;low=0
    count=min(int(dur*SR),N-int(at*SR));a=int(at*SR)
    for j in range(count):
        p=j/count;low=.86*low+.14*(rng.random()*2-1)
        v=low*math.sin(math.pi*p)**2*amp
        L[a+j]+=v*math.sqrt(1-p);R[a+j]+=v*math.sqrt(p)

chords=[[50,57,60,64,69],[46,53,57,60,65],[41,53,57,60,67],[48,55,60,62,67]]
roots=[38,34,29,36]
melody=[74,69,72,76,77,72,69,67]
for bar in range(9):
    at=bar*2
    pad(at,chords[bar%4],2.25,.023 if bar<2 else .03)
    for step in range(8):
        t=at+step*.25
        if t>=18.0:continue
        bell(t,melody[(step+bar*2)%8],.045 if bar<2 else .068,(step%3-1)*.48,.6)
        if bar>=1:hat(t,.035 if step%2 else .024,(-1 if step%2 else 1)*.35,step==7)
    for beat in range(4):
        t=at+beat*.5
        if t>=18.0:continue
        if bar>=1 or beat in (0,2):kick(t,.34 if bar<2 else .40)
        if beat in (1,3) and bar>=1:clap(t,.09)
        if beat in (0,2):bass(t+.015,roots[bar%4],.16)
    if bar>=2 and at+1.75<18.0:bass(at+1.75,roots[bar%4]+12,.08,.20)
for cut in [2,4,6,8.5,11,13.5,16,18]:
    sweep(max(0,cut-.22),.32,.3)
    add(cut,.12,lambda t,p:math.sin(TAU*82*t)*math.exp(-t*35),.20)
for at,n in [(16,74),(16.5,77),(17,81),(18,74),(18.2,81),(18.4,86)]:bell(at,n,.10,-.3 if at<18 else .3,1.6)
pad(18.0,[50,57,60,64,69],2.2,.055)

# Master saturation and final resolve, preserving dynamics and silence-free start.
samples=array('h')
peak=0
for i in range(N):
    t=i/SR;env=min(1,t/.012)*min(1,max(0,(20-t)/.55))
    l=math.tanh(L[i]*1.1)*env;r=math.tanh(R[i]*1.1)*env
    peak=max(peak,abs(l),abs(r))
    samples.extend((int(max(-1,min(1,l))*32767),int(max(-1,min(1,r))*32767)))
out=Path(sys.argv[1])
out.mkdir(parents=True,exist_ok=True)
with wave.open(str(out/'vehicle-original.wav'),'wb') as w:
    w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(samples.tobytes())
print(f'Original stereo score: 20 seconds / 120 BPM / 48 kHz / peak {peak:.4f}')
