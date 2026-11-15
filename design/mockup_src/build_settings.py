"""Build html_mockups/approved-settings.html: Settings (Phase G, approved Nov 15).

Layout: the rail (Settings active) + a 240 px context sidebar listing the sections (General, Data, About; clicking
scrolls to the section, the row follows the scroll) + a 720 px column of section cards (card title style).
Rows: label on the left, control on the right, no descriptions; a muted data line under the label only when it shows
data. Controls: the segmented group switch for 2-3 choices, a HeroUI-style Switch, a select for longer lists.
Changes save at once (no Save, no toast) except Reset layout (undo toast).

- General: Open on start (Home | Tasks | Calendar), Time format (12-hour | 24-hour), Day ends at (12 AM, 1-4 AM),
  Reset layout (data line: what differs from the defaults; disabled when nothing does).
- Data: Automatic backups (switch), Keep last (7 / 14 / 30 backups; disabled while backups are off), Backup folder
  (path, Open folder, Change), Back up now (Last backup: Today, 3 AM · 2.4 MB), Export all data (zip of CSVs).
- About: Version, Database (path, Open folder). Keyboard shortcuts left out for now.

The screen is drawn by one small script from a state object, so every control works in the mock (switches,
segmented groups, selects, Back up now, Retry, Reset layout with Undo, Export) and the time format changes every
time on the page. Mock now: Sat, Nov 14, 2026, 2:40 PM.

Reads approved-home.html (base CSS, rail, toast). Does not run rules.apply() (no Areas sidebar here).
Usage: python build_settings.py <html_mockups dir> <out.html>
"""
import re
import sys
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else 'approved-settings.html')


def svg(p):
    return f'<svg viewBox="0 0 24 24">{p}</svg>'


I = dict(
    general='<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    data='<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    about='<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/>',
)

STATES = [
    # label, state preset, overlay/action
    ('Normal (defaults)', 'normal', ''),
    ('Changed values', 'changed', ''),
    ('Day ends at select', 'normal', 'sel:dayend'),
    ('Keep last select', 'normal', 'sel:keep'),
    ('No backups yet', 'nobackup', ''),
    ('Backing up', 'backing', ''),
    ('Backup failed', 'failed', ''),
    ('Backup folder missing', 'missing', ''),
    ('Reset layout, undo toast', 'changed', 'reset'),
    ('Export done toast', 'normal', 'export'),
]

CSS = r"""
.app.sapp{display:flex}
.sapp .side{border-right:1px solid var(--border);gap:2px}
.sapp .side .item{cursor:pointer}
.sapp .side .item svg{width:16px;height:16px;flex:none;color:var(--text-tertiary)}
.sapp .side .item.on svg{color:var(--acc600)}
.smain .content{display:flex;flex-direction:column;min-height:0;height:100vh}
.smain .areahead{padding:24px 24px 0;align-items:center}
.smain .ttl{height:28px}
.sscroll{flex:1;min-height:0;overflow:auto;padding:16px 24px 120px;scroll-behavior:smooth}
.scol{width:720px;display:flex;flex-direction:column;gap:16px}
.scol .scard{scroll-margin-top:16px}
.scol .shead{min-height:0;padding:12px 16px 4px}
.scol .sbody{padding:0 16px 4px}
/* rows: label left, control right */
.srow{display:flex;align-items:center;gap:16px;min-height:52px;padding:10px 0;border-top:1px solid var(--n100)}
.srow:first-child{border-top:0}
.slab{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.slab .sl{font-size:13px;line-height:18px;font-weight:500;color:var(--text-primary)}
.slab .sd{font-size:12px;line-height:16px;color:var(--text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
.slab .sd.err{color:#cc363c}
.sctl{display:flex;align-items:center;gap:8px;flex:none}
.sctl .val{font-size:13px;color:var(--text-secondary);font-variant-numeric:tabular-nums}
.sapp .btn{margin-left:0;color:var(--text-primary)}
.sapp .btn:hover{background:var(--n100)}
.sapp .btn[disabled]{opacity:.45;cursor:not-allowed;background:#fff}
.sapp .btn svg{width:14px;height:14px}
.sapp .ibtn{width:28px;height:28px;display:grid;place-items:center;border:1px solid var(--border);border-radius:var(--r-control);background:#fff;color:var(--text-secondary);cursor:pointer}
.sapp .ibtn:hover{background:var(--n100)}
.sapp .ibtn[disabled]{opacity:.45;cursor:not-allowed;background:#fff}
.sapp .ibtn svg{width:14px;height:14px}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
/* segmented group switch */
.sseg{display:flex;background:var(--n200);border-radius:var(--r-control);padding:2px;height:28px}
.sseg span{padding:0 12px;display:flex;align-items:center;font-size:12px;font-weight:500;color:var(--text-secondary);border-radius:4px;cursor:pointer}
.sseg span.on{background:#fff;color:var(--text-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}
/* HeroUI switch */
.sw{width:36px;height:20px;border-radius:999px;background:var(--n300);position:relative;cursor:pointer;transition:background .15s;flex:none}
.sw::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:left .15s}
.sw.on{background:var(--acc600)}
.sw.on::after{left:18px}
/* select */
.ssel{position:relative}
.ssel .sbtn{height:28px;min-width:128px;display:flex;align-items:center;gap:8px;padding:0 8px 0 10px;border:1px solid var(--border);border-radius:var(--r-control);background:#fff;font:500 12px/16px Inter,sans-serif;color:var(--text-primary);cursor:pointer}
.ssel .sbtn .v{flex:1;text-align:left;font-variant-numeric:tabular-nums}
.ssel .sbtn svg{width:14px;height:14px;color:var(--text-tertiary)}
.ssel.open .sbtn{border-color:var(--acc600);box-shadow:0 0 0 2px var(--acc200)}
.ssel.dis .sbtn{opacity:.45;cursor:not-allowed}
.slist{position:absolute;right:0;top:32px;min-width:100%;background:#fff;border:1px solid var(--border);border-radius:10px;padding:6px;z-index:10;
  box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08)}
.slist .mi{justify-content:space-between;font-variant-numeric:tabular-nums}
.slist .mi:hover{background:var(--n100)}
.slist .mi svg{width:14px;height:14px;color:var(--acc600)}
.slist .mi.on{font-weight:500}
.sapp ~ .toast2{left:calc(288px + (100vw - 288px)/2)}
"""

JS = r"""
const NOW_H=14,NOW_M=40;
const PRESETS={
  normal:{start:'Home',tf:'12',dayend:0,layout:false,auto:true,keep:14,folder:'ok',bk:'ok',last:[3,0],size:'2.4 MB'},
  changed:{start:'Calendar',tf:'24',dayend:3,layout:true,auto:true,keep:30,folder:'ok',bk:'ok',last:[3,0],size:'2.4 MB'},
  nobackup:{start:'Home',tf:'12',dayend:0,layout:false,auto:true,keep:14,folder:'ok',bk:'none'},
  backing:{start:'Home',tf:'12',dayend:0,layout:false,auto:true,keep:14,folder:'ok',bk:'busy',last:[3,0],size:'2.4 MB'},
  failed:{start:'Home',tf:'12',dayend:0,layout:false,auto:true,keep:14,folder:'ok',bk:'fail',last:[3,0],size:'2.4 MB',failAt:[14,12]},
  missing:{start:'Home',tf:'12',dayend:0,layout:false,auto:true,keep:14,folder:'missing',bk:'ok',last:[3,0],size:'2.4 MB'},
};
const FOLDER='C:\\Users\\Arzel\\Documents\\Life OS\\Backups', FOLDER_MISSING='D:\\Backups\\Life OS';
const DB='C:\\Users\\Arzel\\AppData\\Roaming\\Life OS\\life_os.db';
let S={},OPEN='';
const IC={
  chev:'<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
  folder:'<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M13 11l3 3-3 3M8 14h8"/></svg>',
  spin:'<svg viewBox="0 0 24 24" class="spin"><path d="M21 12a9 9 0 1 1-6.2-8.6"/></svg>',
};
function tm(h,m){ // times on the hour drop ":00" in 12-hour
  if(S.tf==='24')return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
  const ap=h<12?'AM':'PM',h12=h%12===0?12:h%12;return h12+(m?':'+String(m).padStart(2,'0'):'')+' '+ap}
const DAYEND=[0,1,2,3,4];
function seg(key,opts,labels){return `<div class="sseg" data-k="${key}">${opts.map((o,i)=>`<span class="${S[key]===o?'on':''}" data-v="${o}">${labels?labels[i]:o}</span>`).join('')}</div>`}
function sel(key,opts,lab,dis){const open=OPEN===key&&!dis;
  return `<div class="ssel${open?' open':''}${dis?' dis':''}" data-k="${key}"><button class="sbtn"><span class="v">${lab(S[key])}</span>${IC.chev}</button>
    ${open?`<div class="slist">${opts.map(o=>`<div class="mi${o===S[key]?' on':''}" data-v="${o}">${lab(o)}${o===S[key]?IC.check:''}</div>`).join('')}</div>`:''}</div>`}
function row(label,ctl,data,err){return `<div class="srow"><div class="slab"><span class="sl">${label}</span>${data?`<span class="sd${err?' err':''}">${data}</span>`:''}</div><div class="sctl">${ctl}</div></div>`}
function card(id,title,rows){return `<section class="scard" id="sec-${id}"><header class="shead"><div><span class="stitle">${title}</span></div></header><div class="sbody">${rows}</div></section>`}
function backupLine(){
  if(S.bk==='none')return['No backups yet'];
  if(S.bk==='fail')return[`Failed today, ${tm(...S.failAt)} · couldn't write to the backup folder`,1];
  return[`Today, ${tm(...S.last)} · ${S.size}`];}
function render(){
  const main=document.querySelector('.scol');
  const general=
    row('Open on start',seg('start',['Home','Tasks','Calendar']))+
    row('Time format',seg('tf',['12','24'],['12-hour','24-hour']))+
    row('Day ends at',sel('dayend',DAYEND,h=>tm(h,0)))+
    row('Reset layout',`<button class="btn" data-a="reset"${S.layout?'':' disabled'}>Reset</button>`,S.layout?'Sidebar 280 px · 4 cards resized':'');
  const bl=backupLine(),miss=S.folder==='missing',busy=S.bk==='busy';
  const data=
    row('Automatic backups',`<span class="sw${S.auto?' on':''}" data-a="auto" role="switch"></span>`,S.auto&&S.bk!=='none'?`Daily, ${tm(3,0)}`:'')+
    row('Keep last',sel('keep',[7,14,30],n=>n+' backups',!S.auto))+
    row('Backup folder',`<button class="ibtn" title="Open folder"${miss?' disabled':''}>${IC.folder}</button><button class="btn" data-a="change">Change</button>`,
        miss?'Folder not found: '+FOLDER_MISSING:FOLDER,miss)+
    row('Last backup',S.bk==='fail'?`<button class="btn" data-a="backup">Retry</button>`:
        `<button class="btn" data-a="backup"${busy||miss?' disabled':''}>${busy?IC.spin+'Backing up':'Back up now'}</button>`,bl[0],bl[1])+
    row('Export all data',`<button class="btn" data-a="export">Export</button>`);
  const about=
    row('Version','<span class="val">0.1.0</span>')+
    row('Database',`<button class="ibtn" title="Open folder">${IC.folder}</button>`,DB);
  main.innerHTML=card('general','General',general)+card('data','Data',data)+card('about','About',about);
}
/* toast (the app's one toast design) */
const toastEl=document.getElementById('toast');let UNDO=null;
function toast(msg,undo){toastEl.querySelector('.tmsg').textContent=msg;toastEl.classList.add('on');UNDO=undo||null;
  toastEl.querySelector('.tundo').style.display=undo?'':'none';toastEl.querySelector('kbd').style.display=undo?'':'none';
  clearTimeout(window._tt);window._tt=setTimeout(()=>{if(!document.body.dataset.keep)toastEl.classList.remove('on')},6000)}
toastEl.querySelector('.tundo').onclick=()=>{if(UNDO)UNDO();UNDO=null;toastEl.classList.remove('on')};
function hideToast(){toastEl.classList.remove('on')}
/* actions */
function doReset(){const prev=S.layout;S.layout=false;render();toast('Layout reset',()=>{S.layout=prev;render()})}
function doExport(){toast('Exported life-os-2026-11-14.zip · 1.8 MB')}
function doBackup(){S.bk='busy';render();setTimeout(()=>{if(S.bk!=='busy')return;S.bk='ok';S.last=[NOW_H,NOW_M];S.size='2.4 MB';render()},1600)}
document.addEventListener('click',e=>{
  if(e.target.closest('.states'))return;
  const sg=e.target.closest('.sseg span');if(sg){const k=sg.parentElement.dataset.k;S[k]=sg.dataset.v;render();return}
  const mi=e.target.closest('.slist .mi');if(mi){const k=mi.closest('.ssel').dataset.k;S[k]=+mi.dataset.v;OPEN='';render();return}
  const sb=e.target.closest('.ssel .sbtn');if(sb){const w=sb.parentElement;if(w.classList.contains('dis'))return;const k=w.dataset.k;OPEN=OPEN===k?'':k;render();return}
  const a=e.target.closest('[data-a]');
  if(OPEN&&!e.target.closest('.ssel')){OPEN='';render()}
  if(!a||a.disabled)return;
  if(a.dataset.a==='auto'){S.auto=!S.auto;render()}
  if(a.dataset.a==='reset')doReset();
  if(a.dataset.a==='export')doExport();
  if(a.dataset.a==='backup')doBackup();
  if(a.dataset.a==='change'&&S.folder==='missing'){S.folder='ok';render()}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&OPEN){OPEN='';render()}
  if(e.key==='z'&&e.ctrlKey&&UNDO){UNDO();UNDO=null;hideToast()}});
/* sidebar: scroll to a section, row follows the scroll */
const sc=document.querySelector('.sscroll');
document.querySelectorAll('.side .item').forEach(it=>it.onclick=()=>{const t=document.getElementById('sec-'+it.dataset.s);sc.scrollTo({top:t.offsetTop-sc.offsetTop-16,behavior:'smooth'});
  document.querySelectorAll('.side .item').forEach(x=>x.classList.toggle('on',x===it));});
/* mock states */
const st=document.getElementById('st');
function setState(sp){st.querySelectorAll('span').forEach(x=>x.classList.toggle('on',x===sp));
  S=JSON.parse(JSON.stringify(PRESETS[sp.dataset.p]));OPEN='';hideToast();delete document.body.dataset.keep;
  const act=sp.dataset.act||'';
  if(act.startsWith('sel:'))OPEN=act.slice(4);
  render();sc.scrollTop=0;
  document.querySelectorAll('.side .item').forEach((x,i)=>x.classList.toggle('on',i===0));
  if(act==='reset'){document.body.dataset.keep=1;doReset()}
  if(act==='export'){document.body.dataset.keep=1;doExport()}}
st.onclick=e=>{const sp=e.target.closest('span[data-p]');if(sp)setState(sp)};
setState(st.querySelector('span.on'));
const tip=document.getElementById('tip');
document.addEventListener('mousemove',e=>{const t=e.target.closest('[title]');tip.style.display='none'});
"""


def build():
    home = (SRC / 'approved-home.html').read_text(encoding='utf-8')
    css = home[home.index('<style>') + 7:home.index('</style>')]
    i = home.index('<nav class="rail"')
    rail = home[i:home.index('</nav>', i) + 6]
    rail = rail.replace('<a class=on title="Home"', '<a title="Home"').replace('<a title="Settings"', '<a class=on title="Settings"')
    j = home.index('<div class="toast2 htoast" id="toast">')
    toast = home[j:home.index('</div>', j) + 6]
    side = ('<aside class="side">' + ''.join(
        f'<div class="item{" on" if n == 0 else ""}" data-s="{k}">{svg(I[k])}{t}</div>'
        for n, (k, t) in enumerate([('general', 'General'), ('data', 'Data'), ('about', 'About')])) + '</aside>')
    main = ('<main class="main smain"><div class="content"><div class="areahead"><div><div class="ttl">'
            '<h1 class="t-page">Settings</h1></div></div></div>'
            '<div class="sscroll"><div class="scol"></div></div></div></main>')
    sw = ''.join(f'<span{" class=on" if n == 0 else ""} data-p="{p}" data-act="{a}">{l}</span>'
                 for n, (l, p, a) in enumerate(STATES))
    html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Life OS — Settings, all states</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{css}{CSS}</style></head>
<body>
<div class="app sapp" id="settings">{rail}{side}{main}</div>
{toast}
<div class="states pstates"><span>Mock state</span><div class="seg" id="st">{sw}</div></div>
<div id="tip"></div>
<script>{JS}</script>
</body></html>'''
    OUT.write_text(html, encoding='utf-8')
    print('wrote', OUT, len(html))


if __name__ == '__main__':
    build()
