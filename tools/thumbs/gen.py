#!/usr/bin/env python3
"""Writes a harness command that renders every creator thumbnail. usage: gen.py > cmd/N.js ; then python3 finish.py previews out_dir"""
import json
BASE_OF={'furlan':'furlan','isabel':'isabel','tomako':'tomako','loud':'loud','anime':'anime','akane':'isabel','medieval':'isabel','benimaru':'furlan'}
KITS=['furlan','isabel','tomako','loud','anime','akane','medieval','benimaru']; BASES=['furlan','isabel','tomako','loud','anime']
shots=[]
def add(name,o,wait=1700): shots.append({'name':'th_'+name,'js':'__th('+json.dumps(o)+')','wait':wait})
for k in KITS: add('face_'+k,{'base':BASE_OF[k],'fk':k,'hk':k,'view':'face','yaw':.38,'d':.44,'th':.89,'p':.02})
for k in KITS: add('hair_'+k,{'base':'furlan','fk':'furlan','hk':k,'view':'face','yaw':.85,'d':.46,'th':.9,'p':.1})
for b in BASES: add('base_'+b,{'base':b,'fk':BASE_OF.get(b,b),'hk':b,'view':'full','yaw':.3,'d':1.32,'th':.5,'p':.02})
for i in range(8): shots.append({'name':'th_shape_%d'%i,'js':'__th({base:"isabel",fk:"isabel",hk:"isabel",view:"face",yaw:.38,d:.44,th:.89,p:.02,face:STORY.creatorKit.FACE_PRESETS[%d][1]})'%i,'wait':1700})
for i in range(6): shots.append({'name':'th_body_%d'%i,'js':'__th({base:"isabel",fk:"isabel",hk:"isabel",view:"full",yaw:.3,d:1.32,th:.5,p:.02,bod:STORY.creatorKit.BODY_PRESETS[%d][1]})'%i,'wait':1700})
print('return '+json.dumps({'viewport':[512,512],'shots':shots})+';')
