import subprocess, json, os, sys
S=os.environ['S']; V=S+'/vw'; OUT=S+'/w/g12/out'
HAIR=[('B0','B0Back'),('D0','D0Back'),('Y0','Y0Back'),('L0','L0Back'),('K0',None),('C0',None),('N0','N0Back'),('F0','F0Back')]
BASES=['boy','dragon','beauty','lad','nin','blen']; DEFH=['B0','D0','Y0','L0','N0','F0']
jobs=[]; n=0
def dump(key, rx, tag):
    pz = tag.startswith(('base','outfit','gear'))
    subprocess.run(['python3','-I',V+('/pose.py' if pz else '/dump.py'),OUT,key,V+'/d_'+tag,rx]+(['62'] if pz else []),check=True,stdout=subprocess.DEVNULL)
def hrx(h): return 'Hair_'+h[0]+'$|Hair_'+h[1]+'$' if h[1] else 'Hair_'+h[0]+'$'
def add(tag,key,rx,w,h,ch,cy,yaw=0):
    dump(key,rx,tag); jobs.append(dict(d='d_'+tag,out='th_'+tag+'.png',yaw=yaw,w=w,h=h,ch=ch,cy=cy))
for i,k in enumerate(BASES):
    add('base_%d'%i,k,'Skin_Body|Face%d_|%s|Outfit_Under'%(i,hrx((DEFH[i],DEFH[i]+'Back' if DEFH[i] not in('K0','C0') else None))),192,192,.52,1.69,0)
for i in range(6): add('face_%d'%i,'boy','Skin_Body|Face%d_|Hair_B0'%i,192,192,.50,1.74,0)
for i,h in enumerate(HAIR): add('hair_%d'%i,'boy','Skin_Body|Face0_|'+hrx(h),192,192,.60,1.73,0)
add('hair_8','boy','Skin_Body|Face0_',192,192,.60,1.73,0)
for i,o in enumerate(['Outfit_Under','Outfit_Peasant','Outfit_Ranger_(?!HeadHood)','Outfit_Scout_']): add('outfit_%d'%i,'boy','Skin_Body|Face0_|Hair_B0|'+o,150,200,1.95,0.96)
add('gear_0','boy','Skin_Body|Face0_|Hair_B0|Outfit_Scout_(Body|Boots)',150,200,1.95,0.96)
add('gear_1','boy','Skin_Body|Face0_|Hair_B0|Outfit_Scout_(Body|Boots|Cloak)|Gear_',150,200,1.95,0.96)
json.dump(jobs,open(V+'/j_th.json','w'))
