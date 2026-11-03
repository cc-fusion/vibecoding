import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Grid2X2, Braces, BookOpen, Code2, Layers3, Sparkles, ArrowUpRight, ChevronRight, ChevronDown, Menu, X, Check, ArrowRight, Cpu, Download, FileText, PanelLeftClose, CircleHelp, Keyboard, Compass, Leaf, Zap, Plus, Home, Search, Heart, ExternalLink } from 'lucide-react';
import { Simulation } from './lib/client.js';
import { DEFAULT_SCENE, clone } from './lib/scene-builder.js';
import { SCENES } from './lib/scenes.js';
import PlaygroundView from './components/PlaygroundView.jsx';
import SceneLibrary from './components/SceneLibrary.jsx';
import SceneEditor from './components/SceneEditor.jsx';
import Documentation from './components/Documentation.jsx';
import { Logo, Pill, Github } from './components/ui.jsx';

const VIEWS = { playground:'Playground', scenes:'Scene library', editor:'Scene editor', docs:'Documentation', api:'API reference', examples:'Examples' };
const INITIAL_HASH = window.location.hash.slice(1);
export default function App() {
  const [view,setView] = useState(VIEWS[INITIAL_HASH] ? INITIAL_HASH : 'playground');
  const [mobileNav,setMobileNav] = useState(false);
  const [sceneId,setSceneId] = useState('cutting');
  const [sceneInfo,setSceneInfo] = useState(null);
  const [phase,setPhase] = useState('loading');
  const [running,setRunning] = useState(false);
  const [finished,setFinished] = useState(false);
  const [stats,setStats] = useState(null);
  const [fps,setFps] = useState(60);
  const [quality,setQuality] = useState('medium');
  const [error,setError] = useState('');
  const [toast,setToast] = useState('');
  const [isFullscreen,setIsFullscreen] = useState(false);
  const [draft,setDraft] = useState(clone(DEFAULT_SCENE));
  const [favorites,setFavorites] = useState(()=>{try{return JSON.parse(localStorage.getItem('taichi-favorites')||'[]');}catch{return [];}});
  const simulation = useRef(null);
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const runtime = useRef({ready:false,wasm:false});
  const currentScene = useRef('cutting');
  const controlsDefaults = {gravity:-9.81,gravityEnabled:true,speed:1,wheelSpeed:200,automaticWheel:true,mode:'touch',touch:true,hasWheel:true};
  const [controls,setControls] = useState(controlsDefaults);
  const notify = useCallback((text)=>{setToast(text);},[]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),3400);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{localStorage.setItem('taichi-favorites',JSON.stringify(favorites));},[favorites]);
  const navigate = (next) => { setView(next);setMobileNav(false);window.location.hash=next;window.scrollTo({top:0,behavior:'instant'}); };
  useEffect(()=>{const change=()=>{const v=window.location.hash.slice(1);if(VIEWS[v])setView(v);};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
  useEffect(()=>{
    let alive=true, raf=0, frameCount=0, last=performance.now();
    try {
      const sim=new Simulation({canvas:canvasRef.current,scene:'cutting',autoPlay:true,quality:'medium'});
      simulation.current=sim; if (import.meta.env.DEV) window.__taichi = sim;
      sim.on('ready',({simd})=>{if(alive){runtime.current={ready:true,wasm:simd};}});
      sim.on('loaded',info=>{if(!alive)return;setSceneInfo(info);setPhase('ready');setError('');setFinished(false);setControls(p=>({...p,...info.controls,hasWheel:info.controls?.wheelSpeed!==90 || info.sceneId==='cutting' || info.custom}));});
      sim.on('stats',s=>{if(alive)setStats(s);});
      sim.on('state',s=>{if(alive){setRunning(s.running);setFinished(s.finished);}});
      sim.on('log',m=>{if(m.level==='error')console.warn(m.line);});
      sim.on('error',e=>{if(alive){setError(String(e.message||e));setPhase('error');setRunning(false);console.error('Taichi initialization:', e);}});
      sim.on('controls',patch=>{if(alive)setControls(p=>({...p,...patch}));});
      const loop=now=>{frameCount++;if(now-last>750){setFps(Math.min(120,Math.round(frameCount*1000/(now-last))));frameCount=0;last=now;}raf=requestAnimationFrame(loop);};raf=requestAnimationFrame(loop);
    } catch(e) {setError(e.message);setPhase('error');console.error('Taichi initialization:', e);}
    return()=>{alive=false;cancelAnimationFrame(raf);simulation.current?.dispose();simulation.current=null;};
  },[]);
  useEffect(()=>{simulation.current?.setInteraction({enabled:controls.touch,mode:controls.mode});},[controls.touch,controls.mode]);
  const setControl = patch=>{setControls(p=>({...p,...patch}));simulation.current?.update(patch);};
  const loadScene = async (scene, opts={})=>{
    if(!simulation.current)return;
    setPhase('loading');setError('');setStats(null);setFinished(false);
    const id=typeof scene==='string'?scene:scene.id||'custom';
    currentScene.current=scene;setSceneId(id);
    try {await simulation.current.loadScene(scene,{autoPlay:opts.autoPlay??true,quality:opts.quality||quality});if(opts.navigate!==false)navigate('playground');}
    catch(e){setPhase('error');setError(e.message);notify(e.message);}
  };
  const changeQuality = async q=>{setQuality(q);await loadScene(currentScene.current,{quality:q,navigate:false});};
  const onNewScene = ()=>{setDraft(clone(DEFAULT_SCENE));navigate('editor');};
  const openEditor = ()=>{if(sceneInfo?.custom&&typeof currentScene.current==='object')setDraft(clone(currentScene.current));navigate('editor');};
  const applyScene = async definition=>{setDraft(clone(definition));await loadScene(definition);};
  const toggleFullscreen = ()=>setIsFullscreen(v=>!v);
  useEffect(()=>{const fn=e=>{if(e.key==='Escape'){setIsFullscreen(false);setMobileNav(false);} };window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn);},[]);
  useEffect(()=>{
    const shortcuts=e=>{
      if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable||e.ctrlKey||e.metaKey||e.altKey)return;
      if(e.key===' '&&view==='playground'){e.preventDefault();running?simulation.current?.pause():simulation.current?.play();}
      if(e.key.toLowerCase()==='f'&&view==='playground')setIsFullscreen(v=>!v);
      if(e.key.toLowerCase()==='r'&&view==='playground')simulation.current?.reset({autoPlay:false}).catch(notify);
      if(e.key.toLowerCase()==='s'&&view==='playground')simulation.current?.step();
      if(e.key==='?')notify('Shortcuts: Space = play/pause · S = step · R = reset · F = fullscreen');
    };window.addEventListener('keydown',shortcuts);return()=>window.removeEventListener('keydown',shortcuts);
  },[running,view]);
  const navItem = (id, Icon, extra) => <button key={id} className={`nav-item ${view===id?'active':''}`} onClick={()=>navigate(id)}><Icon size={17}/><span>{VIEWS[id]}</span>{extra}</button>;
  return <div className="app-shell">
    {mobileNav&&<div className="sidebar-scrim" onClick={()=>setMobileNav(false)}/>}
    <aside className={`sidebar ${mobileNav?'mobile-open':''}`}>
      <button className="brand-button" onClick={()=>navigate('playground')} aria-label="Taichi home"><Logo/></button>
      <div className="sidebar-workspace"><span className="workspace-avatar"><Box size={15}/></span><div><strong>My workspace</strong><span>Local playground</span></div><ChevronDown size={13}/></div>
      <nav className="sidebar-nav"><span className="nav-section-title">WORKSPACE</span>{navItem('playground',Grid2X2)}{navItem('scenes',Layers3,<span className="nav-count">10</span>)}{navItem('editor',Braces)}<span className="nav-section-title resources">RESOURCES</span>{navItem('docs',BookOpen)}{navItem('api',Code2)}{navItem('examples',Sparkles,<span className="nav-new">NEW</span>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-cta"><span className="cta-icon"><Zap size={17}/></span><h3>A little code. A lot of possibility.</h3><p>Bring real-time physics into your next project.</p><button onClick={()=>navigate('docs')}>Start building<ArrowUpRight size={14}/></button></div><button className="sidebar-source" onClick={()=>navigate('docs')}><BookOpen size={16}/><span>Getting started</span><ArrowUpRight size={13}/></button><div className="sidebar-footer"><span><span className="small-green-dot"/>All systems local</span><span>v1.0.0</span></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" onClick={()=>setMobileNav(true)} aria-label="Open navigation"><Menu size={20}/></button><Home size={14}/><ChevronRight size={12}/><span>{VIEWS[view]}</span></div><div className="topbar-actions"><span className={`engine-status ${phase==='error'?'failed':''}`}><span className="status-dot"/>{phase==='error'?'Engine unavailable':phase==='loading'?'Engine warming up':'Engine ready'}</span><span className="topbar-divider"/><a href="https://github.com/cc-fusion/vibecoding/tree/main/battle/claude-opus-5.5-max" target="_blank" rel="noreferrer" className="topbar-link"><Github size={16}/><span>View source</span><ArrowUpRight size={12}/></a><button className="js-badge" onClick={()=>navigate('docs')} title="JavaScript library documentation">JS</button></div></header>
      <main className="main-content">
        <div className={view==='playground'?'':'hidden-view'}><PlaygroundView simulation={simulation} canvasRef={canvasRef} viewportRef={viewportRef} sceneId={sceneId} sceneInfo={sceneInfo} phase={phase} error={error} running={running} finished={finished} stats={stats} fps={fps} controls={controls} setControl={setControl} quality={quality} setQuality={changeQuality} onLoad={loadScene} onNew={onNewScene} onEditor={openEditor} onLibrary={()=>navigate('scenes')} onDocs={()=>navigate('docs')} onToast={notify} onReplay={()=>window.location.reload()} isFullscreen={isFullscreen} onFullscreen={toggleFullscreen}/></div>
        {view==='scenes'&&<SceneLibrary onSelect={loadScene} onNew={onNewScene} favorites={favorites} onFavorite={id=>setFavorites(f=>f.includes(id)?f.filter(x=>x!==id):[...f,id])}/>}
        {view==='editor'&&<SceneEditor draft={draft} setDraft={setDraft} onApply={applyScene} onDocs={()=>navigate('docs')} onToast={notify}/>}
        {view==='docs'&&<Documentation page="docs" onExample={(scene)=>loadScene(scene)} onEditor={onNewScene} onToast={notify}/>}
        {view==='api'&&<Documentation page="api" onExample={(scene)=>loadScene(scene)} onEditor={onNewScene} onToast={notify}/>}
        {view==='examples'&&<Documentation page="examples" onExample={(scene)=>loadScene(scene)} onEditor={onNewScene} onToast={notify}/>}
        <footer className="main-footer"><span>Built on curiosity. Powered by <strong>WebAssembly.</strong></span><div><span>MLS-MPM + CPIC</span><span className="footer-dot">·</span><a href="https://github.com/yuanming-hu/taichi_mpm" target="_blank" rel="noreferrer">A port of taichi_mpm<ArrowUpRight size={12}/></a></div></footer>
      </main>
    </div>
    {toast&&<div className="toast" role="status"><span><Check size={15}/></span>{toast}<button aria-label="Dismiss notification" onClick={()=>setToast('')}><X size={14}/></button></div>}
  </div>;
}
